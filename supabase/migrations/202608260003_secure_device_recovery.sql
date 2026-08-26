-- One-device account recovery without SMS.
-- Recovery codes are shown once; only SHA-256 hashes are persisted.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.students
  add column if not exists recovery_code_hash text,
  add column if not exists recovery_code_created_at timestamptz,
  add column if not exists device_bound_at timestamptz;

update public.students
set device_bound_at = coalesce(device_bound_at, created_at, now())
where device_bound_at is null;

alter table public.device_transfer_requests
  add column if not exists attempt_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists verification_method text,
  add column if not exists verified_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text;

alter table public.device_transfer_requests
  drop constraint if exists device_transfer_requests_attempt_count_check,
  add constraint device_transfer_requests_attempt_count_check
    check (attempt_count between 0 and 5),
  drop constraint if exists device_transfer_requests_verification_method_check,
  add constraint device_transfer_requests_verification_method_check
    check (verification_method is null or verification_method in ('recovery_code', 'admin_review'));

create index if not exists device_transfer_requests_rate_limit_idx
  on public.device_transfer_requests (requester_user_id, phone, requested_at desc);

create or replace function private.normalize_recovery_code(code_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select upper(regexp_replace(code_value, '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function private.hash_recovery_code(code_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(private.normalize_recovery_code(code_value), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.issue_recovery_code(target_phone text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  raw_hex text := upper(pg_catalog.encode(extensions.gen_random_bytes(8), 'hex'));
  recovery_code text;
begin
  recovery_code := 'BIO-' || substr(raw_hex, 1, 4) || '-' || substr(raw_hex, 5, 4)
    || '-' || substr(raw_hex, 9, 4) || '-' || substr(raw_hex, 13, 4);

  update public.students
  set recovery_code_hash = private.hash_recovery_code(recovery_code),
      recovery_code_created_at = now()
  where phone = btrim(target_phone);

  if not found then
    raise exception 'Student not found';
  end if;

  return recovery_code;
end;
$$;

revoke all on function private.normalize_recovery_code(text) from public, anon, authenticated;
revoke all on function private.hash_recovery_code(text) from public, anon, authenticated;
revoke all on function private.issue_recovery_code(text) from public, anon, authenticated;

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
    if student_record.recovery_code_hash is null then
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
    if student_record.recovery_code_hash is null then
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

  if not found
     or student_record.recovery_code_hash is null
     or student_record.recovery_code_hash <> private.hash_recovery_code(recovery_code) then
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

create or replace function public.request_device_transfer(
  student_phone text,
  new_device_id text,
  transfer_reason text default 'تغيير الجهاز'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_phone text := btrim(student_phone);
  request_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if normalized_phone !~ '^[0-9]{9,15}$' or btrim($2) = '' then
    return jsonb_build_object('success', false, 'message', 'تعذر إرسال الطلب بالبيانات المدخلة.');
  end if;
  if not exists (select 1 from public.students where phone = normalized_phone) then
    return jsonb_build_object('success', false, 'message', 'تعذر إرسال الطلب بالبيانات المدخلة.');
  end if;
  if exists (
    select 1 from public.device_transfer_requests
    where requester_user_id = caller_id and phone = normalized_phone and status = 'pending'
  ) then
    return jsonb_build_object('success', false, 'message', 'لديك طلب نقل معلق قيد المراجعة بالفعل.');
  end if;
  if (
    select count(*) from public.device_transfer_requests
    where requester_user_id = caller_id and requested_at > now() - interval '1 hour'
  ) >= 3 then
    return jsonb_build_object('success', false, 'message', 'تم بلوغ حد الطلبات المؤقت. حاول لاحقاً.');
  end if;

  insert into public.device_transfer_requests
    (phone, new_device_id, reason, status, requester_user_id)
  values
    (normalized_phone, btrim($2), coalesce(nullif(btrim($3), ''), 'تغيير الجهاز'), 'pending', caller_id)
  returning id into request_id;

  return jsonb_build_object('success', true, 'requestId', request_id, 'message', 'تم إرسال طلب نقل الجهاز للمراجعة.');
end;
$$;

create or replace function public.review_device_transfer(
  request_id uuid,
  review_status text,
  reviewer_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or (auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' then
    raise exception 'Admin authorization required';
  end if;
  if review_status not in ('approved', 'rejected') then
    return jsonb_build_object('success', false, 'message', 'حالة المراجعة غير صالحة.');
  end if;
  if char_length(btrim(coalesce(reviewer_note, ''))) < 5 then
    return jsonb_build_object('success', false, 'message', 'أضف ملاحظة توضّح طريقة التحقق من الطالب.');
  end if;

  update public.device_transfer_requests
  set status = review_status,
      reviewed_at = now(),
      reviewed_by = caller_id,
      review_note = btrim(reviewer_note),
      verification_method = 'admin_review',
      verified_at = case when review_status = 'approved' then now() else null end
  where id = request_id and status = 'pending';

  if not found then
    return jsonb_build_object('success', false, 'message', 'الطلب غير موجود أو تمت مراجعته سابقاً.');
  end if;
  return jsonb_build_object('success', true, 'message', 'تم تحديث طلب نقل الجهاز.');
end;
$$;

create or replace function public.admin_issue_recovery_code(student_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_code text;
begin
  if auth.uid() is null or (auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' then
    raise exception 'Admin authorization required';
  end if;
  if not exists (select 1 from public.students where phone = btrim(student_phone)) then
    return jsonb_build_object('success', false, 'message', 'حساب الطالب غير موجود.');
  end if;
  recovery_code := private.issue_recovery_code(btrim(student_phone));
  return jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء رمز جديد. الرمز السابق أصبح غير صالح.',
    'recoveryCode', recovery_code
  );
end;
$$;

create or replace function public.handle_device_transfer(
  student_phone text,
  new_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  approved_request public.device_transfer_requests%rowtype;
  student_record public.students%rowtype;
  replacement_code text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into approved_request
  from public.device_transfer_requests
  where requester_user_id = caller_id
    and phone = btrim(student_phone)
    and public.device_transfer_requests.new_device_id = btrim($2)
    and status = 'approved'
    and verification_method = 'admin_review'
    and reviewed_by is not null
  order by reviewed_at desc nulls last, requested_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'needsTransfer', true, 'message', 'طلب النقل لم تتم الموافقة عليه بعد.');
  end if;

  update public.students
  set user_id = caller_id,
      device_id = btrim($2),
      device_bound_at = now()
  where phone = btrim(student_phone)
  returning * into student_record;

  if not found then
    return jsonb_build_object('success', false, 'message', 'تعذر إتمام نقل الحساب.');
  end if;

  replacement_code := private.issue_recovery_code(btrim(student_phone));

  update public.device_transfer_requests
  set status = 'completed', completed_at = now()
  where id = approved_request.id;

  return jsonb_build_object(
    'success', true,
    'message', 'تم نقل الحساب إلى هذا الهاتف بعد موافقة المسؤول.',
    'recoveryCode', replacement_code,
    'student', jsonb_build_object(
      'name', student_record.name,
      'governorate', coalesce(student_record.governorate, ''),
      'isPremium', coalesce(student_record.is_premium, false)
    )
  );
end;
$$;

revoke all on function public.register_or_restore_student(text, text, text, text) from public, anon;
revoke all on function public.transfer_with_recovery_code(text, text, text) from public, anon;
revoke all on function public.request_device_transfer(text, text, text) from public, anon;
revoke all on function public.review_device_transfer(uuid, text, text) from public, anon;
revoke all on function public.admin_issue_recovery_code(text) from public, anon;
revoke all on function public.handle_device_transfer(text, text) from public, anon;
grant execute on function public.register_or_restore_student(text, text, text, text) to authenticated;
grant execute on function public.transfer_with_recovery_code(text, text, text) to authenticated;
grant execute on function public.request_device_transfer(text, text, text) to authenticated;
grant execute on function public.review_device_transfer(uuid, text, text) to authenticated;
grant execute on function public.admin_issue_recovery_code(text) to authenticated;
grant execute on function public.handle_device_transfer(text, text) to authenticated;

commit;
