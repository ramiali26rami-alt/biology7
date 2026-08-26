-- Keep recovery-code hashes outside the Data API while restoring table-level
-- SELECT required by PostgREST. RLS remains the authority for student rows.

begin;

create table if not exists private.student_recovery_codes (
  phone text primary key references public.students(phone) on update cascade on delete cascade,
  recovery_code_hash text not null,
  created_at timestamptz not null default now()
);

alter table private.student_recovery_codes enable row level security;
revoke all on table private.student_recovery_codes from public, anon, authenticated;

insert into private.student_recovery_codes (phone, recovery_code_hash, created_at)
select phone, recovery_code_hash, coalesce(recovery_code_created_at, now())
from public.students
where recovery_code_hash is not null
on conflict (phone) do update
set recovery_code_hash = excluded.recovery_code_hash,
    created_at = excluded.created_at;

create or replace function private.issue_recovery_code(target_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_hex text := upper(pg_catalog.encode(extensions.gen_random_bytes(8), 'hex'));
  recovery_code text;
  issued_at timestamptz := now();
begin
  recovery_code := 'BIO-' || substr(raw_hex, 1, 4) || '-' || substr(raw_hex, 5, 4)
    || '-' || substr(raw_hex, 9, 4) || '-' || substr(raw_hex, 13, 4);

  update public.students
  set recovery_code_created_at = issued_at
  where phone = btrim(target_phone);

  if not found then
    raise exception 'Student not found';
  end if;

  insert into private.student_recovery_codes (phone, recovery_code_hash, created_at)
  values (btrim(target_phone), private.hash_recovery_code(recovery_code), issued_at)
  on conflict (phone) do update
  set recovery_code_hash = excluded.recovery_code_hash,
      created_at = excluded.created_at;

  return recovery_code;
end;
$$;

create or replace function public.register_or_restore_student(
  student_name text,
  student_phone text,
  student_governorate text,
  student_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_phone text := btrim(student_phone);
  student_record public.students%rowtype;
  recovery_code text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if normalized_phone = '' or btrim(student_name) = '' or btrim(student_device_id) = '' then
    return jsonb_build_object('success', false, 'message', 'بيانات التسجيل غير مكتملة.');
  end if;
  if normalized_phone !~ '^[0-9]{9,15}$' then
    return jsonb_build_object('success', false, 'message', 'رقم الهاتف غير صالح.');
  end if;
  if exists (
    select 1 from public.students
    where user_id = caller_id and phone <> normalized_phone
  ) then
    return jsonb_build_object('success', false, 'message', 'هذا الجهاز مرتبط بحساب طالب آخر.');
  end if;

  select * into student_record
  from public.students
  where phone = normalized_phone
  for update;

  if not found then
    insert into public.students
      (phone, name, governorate, device_id, is_premium, user_id, device_bound_at)
    values
      (normalized_phone, btrim(student_name), btrim(student_governorate), btrim(student_device_id), false, caller_id, now())
    returning * into student_record;
    recovery_code := private.issue_recovery_code(normalized_phone);
  elsif student_record.user_id = caller_id then
    update public.students
    set name = btrim(student_name),
        governorate = btrim(student_governorate),
        device_id = btrim(student_device_id),
        device_bound_at = case
          when device_id is distinct from btrim(student_device_id) then now()
          else coalesce(device_bound_at, now())
        end
    where phone = normalized_phone
    returning * into student_record;
    if not exists (
      select 1 from private.student_recovery_codes where phone = normalized_phone
    ) then
      recovery_code := private.issue_recovery_code(normalized_phone);
    end if;
  elsif student_record.user_id is null
        and (student_record.device_id = btrim(student_device_id) or student_record.device_id = 'reset') then
    update public.students
    set user_id = caller_id,
        device_id = btrim(student_device_id),
        device_bound_at = now(),
        name = btrim(student_name),
        governorate = btrim(student_governorate)
    where phone = normalized_phone
    returning * into student_record;
    if not exists (
      select 1 from private.student_recovery_codes where phone = normalized_phone
    ) then
      recovery_code := private.issue_recovery_code(normalized_phone);
    end if;
  else
    return jsonb_build_object(
      'success', false,
      'needsTransfer', true,
      'message', 'هذا الرقم مرتبط بهاتف آخر. استخدم رمز الاسترداد أو أرسل طلب مراجعة.'
    );
  end if;

  select * into student_record from public.students where phone = normalized_phone;
  return jsonb_strip_nulls(jsonb_build_object(
    'success', true,
    'message', 'تم تسجيل الحساب أو استعادته بنجاح.',
    'recoveryCode', recovery_code,
    'student', jsonb_build_object(
      'name', student_record.name,
      'governorate', coalesce(student_record.governorate, ''),
      'isPremium', coalesce(student_record.is_premium, false)
    )
  ));
end;
$$;

create or replace function public.transfer_with_recovery_code(
  student_phone text,
  new_device_id text,
  recovery_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_phone text := btrim(student_phone);
  transfer_request public.device_transfer_requests%rowtype;
  student_record public.students%rowtype;
  stored_recovery_hash text;
  replacement_code text;
  next_attempt integer;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if normalized_phone = '' or btrim($2) = '' or btrim($3) = '' then
    return jsonb_build_object('success', false, 'message', 'تعذر التحقق من رمز الاسترداد.');
  end if;
  if exists (
    select 1 from public.students
    where user_id = caller_id and phone <> normalized_phone
  ) then
    return jsonb_build_object('success', false, 'message', 'هذا الجهاز مرتبط بحساب طالب آخر.');
  end if;

  select * into transfer_request
  from public.device_transfer_requests
  where requester_user_id = caller_id
    and phone = normalized_phone
    and status = 'pending'
  order by requested_at desc
  limit 1
  for update;

  if not found then
    insert into public.device_transfer_requests
      (phone, new_device_id, reason, status, requester_user_id)
    values
      (normalized_phone, btrim($2), 'استرداد الحساب بالرمز', 'pending', caller_id)
    returning * into transfer_request;
  elsif transfer_request.locked_until is not null and transfer_request.locked_until > now() then
    return jsonb_build_object(
      'success', false,
      'locked', true,
      'message', 'تم إيقاف المحاولات مؤقتاً. حاول بعد 15 دقيقة أو اطلب مراجعة الإدارة.'
    );
  elsif transfer_request.locked_until is not null then
    update public.device_transfer_requests
    set attempt_count = 0, locked_until = null, new_device_id = btrim($2)
    where id = transfer_request.id
    returning * into transfer_request;
  else
    update public.device_transfer_requests
    set new_device_id = btrim($2)
    where id = transfer_request.id;
  end if;

  select * into student_record
  from public.students
  where phone = normalized_phone
  for update;

  if student_record.phone is not null then
    select recovery_code_hash into stored_recovery_hash
    from private.student_recovery_codes
    where phone = normalized_phone;
  end if;

  if student_record.phone is null
     or stored_recovery_hash is null
     or stored_recovery_hash <> private.hash_recovery_code(recovery_code) then
    next_attempt := least(transfer_request.attempt_count + 1, 5);
    update public.device_transfer_requests
    set attempt_count = next_attempt,
        locked_until = case when next_attempt >= 5 then now() + interval '15 minutes' else null end
    where id = transfer_request.id;
    return jsonb_build_object(
      'success', false,
      'locked', next_attempt >= 5,
      'message', case when next_attempt >= 5
        then 'تم إيقاف المحاولات مؤقتاً. حاول بعد 15 دقيقة أو اطلب مراجعة الإدارة.'
        else 'تعذر التحقق من رمز الاسترداد.'
      end
    );
  end if;

  update public.students
  set user_id = caller_id,
      device_id = btrim($2),
      device_bound_at = now()
  where phone = normalized_phone
  returning * into student_record;

  replacement_code := private.issue_recovery_code(normalized_phone);

  update public.device_transfer_requests
  set status = 'completed',
      completed_at = now(),
      verification_method = 'recovery_code',
      verified_at = now(),
      attempt_count = 0,
      locked_until = null
  where id = transfer_request.id;

  return jsonb_build_object(
    'success', true,
    'message', 'تم نقل الحساب بأمان إلى هذا الهاتف وإلغاء ارتباط الهاتف السابق.',
    'recoveryCode', replacement_code,
    'student', jsonb_build_object(
      'name', student_record.name,
      'governorate', coalesce(student_record.governorate, ''),
      'isPremium', coalesce(student_record.is_premium, false)
    )
  );
end;
$$;

alter table public.students drop column recovery_code_hash;

-- PostgREST requires table-level SELECT. RLS still limits each student to the
-- row whose user_id equals auth.uid(), while admins retain their existing policy.
grant select on table public.students to authenticated;

commit;
