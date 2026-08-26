-- Security migration for Biology 7.
-- Review and apply only after anonymous Supabase sign-ins are enabled.

begin;

alter table public.students
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.device_transfer_requests
  add column if not exists requester_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists students_user_id_key
  on public.students (user_id)
  where user_id is not null;
create index if not exists quiz_results_student_phone_idx
  on public.quiz_results (student_phone);
create index if not exists activation_codes_used_by_phone_idx
  on public.activation_codes (used_by_phone);
create index if not exists device_transfer_requests_requester_idx
  on public.device_transfer_requests (requester_user_id, status);
create index if not exists device_transfer_requests_phone_status_idx
  on public.device_transfer_requests (phone, status);

alter table public.students enable row level security;
alter table public.quiz_results enable row level security;
alter table public.activation_codes enable row level security;
alter table public.question_analytics enable row level security;
alter table public.device_transfer_requests enable row level security;
alter table public.system_settings enable row level security;

drop policy if exists "Allow update students" on public.students;
drop policy if exists "allow_insert_new_student" on public.students;
drop policy if exists "deny_update_from_client" on public.students;
drop policy if exists "students_select_own" on public.students;
drop policy if exists "students_admin_all" on public.students;
create policy "students_select_own" on public.students
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "students_admin_all" on public.students
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "allow_insert_own_results" on public.quiz_results;
drop policy if exists "allow_read_all_results" on public.quiz_results;
drop policy if exists "quiz_results_insert_own" on public.quiz_results;
drop policy if exists "quiz_results_select_own" on public.quiz_results;
drop policy if exists "quiz_results_admin_all" on public.quiz_results;
create policy "quiz_results_insert_own" on public.quiz_results
  for insert to authenticated
  with check (exists (
    select 1 from public.students s
    where s.user_id = (select auth.uid())
      and s.phone = student_phone
  ));
create policy "quiz_results_select_own" on public.quiz_results
  for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.user_id = (select auth.uid())
      and s.phone = student_phone
  ));
create policy "quiz_results_admin_all" on public.quiz_results
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Allow insert activation codes" on public.activation_codes;
drop policy if exists "Allow select activation codes" on public.activation_codes;
drop policy if exists "allow_admin_all_on_codes" on public.activation_codes;
drop policy if exists "deny_read_codes" on public.activation_codes;
drop policy if exists "activation_codes_admin_all" on public.activation_codes;
create policy "activation_codes_admin_all" on public.activation_codes
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "allow_all_on_analytics" on public.question_analytics;
drop policy if exists "question_analytics_admin_all" on public.question_analytics;
create policy "question_analytics_admin_all" on public.question_analytics
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "allow_insert_transfer_request" on public.device_transfer_requests;
drop policy if exists "allow_read_own_transfer_request" on public.device_transfer_requests;
drop policy if exists "transfer_requests_select_own" on public.device_transfer_requests;
drop policy if exists "transfer_requests_admin_all" on public.device_transfer_requests;
create policy "transfer_requests_select_own" on public.device_transfer_requests
  for select to authenticated
  using (requester_user_id = (select auth.uid()));
create policy "transfer_requests_admin_all" on public.device_transfer_requests
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "system_settings_curriculum_read" on public.system_settings;
drop policy if exists "system_settings_admin_all" on public.system_settings;
create policy "system_settings_curriculum_read" on public.system_settings
  for select to authenticated
  using (key = 'curriculum_data');
create policy "system_settings_admin_all" on public.system_settings
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop view if exists public.leaderboard_students;

drop function if exists public.claim_activation_code(text, text);
drop function if exists public.handle_device_transfer(text, text);

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
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if normalized_phone = '' or btrim(student_name) = '' or btrim(student_device_id) = '' then
    return jsonb_build_object('success', false, 'message', 'بيانات التسجيل غير مكتملة.');
  end if;

  select * into student_record
  from public.students
  where phone = normalized_phone
  for update;

  if not found then
    insert into public.students (phone, name, governorate, device_id, is_premium, user_id)
    values (normalized_phone, btrim(student_name), btrim(student_governorate), btrim(student_device_id), false, caller_id)
    returning * into student_record;
  elsif student_record.user_id = caller_id then
    update public.students
    set name = btrim(student_name),
        governorate = btrim(student_governorate),
        device_id = btrim(student_device_id)
    where phone = normalized_phone
    returning * into student_record;
  elsif student_record.user_id is null
        and (student_record.device_id = btrim(student_device_id) or student_record.device_id = 'reset') then
    update public.students
    set user_id = caller_id,
        device_id = btrim(student_device_id),
        name = btrim(student_name),
        governorate = btrim(student_governorate)
    where phone = normalized_phone
    returning * into student_record;
  else
    return jsonb_build_object(
      'success', false,
      'needsTransfer', true,
      'message', 'هذا الرقم مرتبط بجهاز آخر. أرسل طلب نقل ليوافق عليه المسؤول.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'تم تسجيل الحساب أو استعادته بنجاح.',
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
  request_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if btrim(student_phone) = '' or btrim(new_device_id) = '' then
    return jsonb_build_object('success', false, 'message', 'بيانات الطلب غير مكتملة.');
  end if;
  if not exists (select 1 from public.students where phone = btrim(student_phone)) then
    return jsonb_build_object('success', false, 'message', 'تعذر إرسال الطلب بالبيانات المدخلة.');
  end if;
  if exists (
    select 1 from public.device_transfer_requests
    where requester_user_id = caller_id and phone = btrim(student_phone) and status = 'pending'
  ) then
    return jsonb_build_object('success', false, 'message', 'لديك طلب نقل معلق قيد المراجعة بالفعل.');
  end if;

  insert into public.device_transfer_requests
    (phone, new_device_id, reason, status, requester_user_id)
  values
    (btrim(student_phone), btrim(new_device_id), coalesce(nullif(btrim(transfer_reason), ''), 'تغيير الجهاز'), 'pending', caller_id)
  returning id into request_id;

  return jsonb_build_object('success', true, 'requestId', request_id, 'message', 'تم إرسال طلب نقل الجهاز للمراجعة.');
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
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into approved_request
  from public.device_transfer_requests
  where requester_user_id = caller_id
    and phone = btrim(student_phone)
    and new_device_id = btrim(new_device_id)
    and status = 'approved'
  order by reviewed_at desc nulls last, requested_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'needsTransfer', true, 'message', 'طلب النقل لم تتم الموافقة عليه بعد.');
  end if;

  update public.students
  set user_id = caller_id, device_id = btrim(new_device_id)
  where phone = btrim(student_phone)
  returning * into student_record;

  if not found then
    return jsonb_build_object('success', false, 'message', 'تعذر إتمام نقل الحساب.');
  end if;

  update public.device_transfer_requests
  set status = 'completed', completed_at = now()
  where id = approved_request.id;

  return jsonb_build_object(
    'success', true,
    'message', 'تم نقل الحساب إلى هذا الجهاز بعد موافقة المسؤول.',
    'student', jsonb_build_object(
      'name', student_record.name,
      'governorate', coalesce(student_record.governorate, ''),
      'isPremium', coalesce(student_record.is_premium, false)
    )
  );
end;
$$;

create or replace function public.claim_activation_code(code_to_claim text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_phone text;
  normalized_code text := upper(btrim(code_to_claim));
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select phone into caller_phone
  from public.students
  where user_id = caller_id
  for update;

  if caller_phone is null then
    return jsonb_build_object('success', false, 'message', 'يجب تسجيل حساب الطالب أولاً.');
  end if;

  perform 1 from public.activation_codes
  where code = normalized_code and is_used = false
  for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو مستخدم مسبقاً.');
  end if;

  update public.activation_codes
  set is_used = true, used_by_phone = caller_phone, used_at = now()
  where code = normalized_code and is_used = false;

  update public.students set is_premium = true where user_id = caller_id;
  return jsonb_build_object('success', true, 'message', 'تم تفعيل الباقة الكاملة بنجاح!');
end;
$$;

create or replace function public.update_student_name(student_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or btrim(student_name) = '' then
    return false;
  end if;
  update public.students
  set name = btrim(student_name)
  where user_id = auth.uid();
  return found;
end;
$$;

create or replace function public.record_question_result(
  p_question_id text,
  p_lesson_id text,
  p_question_text text,
  p_is_correct boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  insert into public.question_analytics
    (question_id, lesson_id, question_text, wrong_count, correct_count)
  values
    (p_question_id, p_lesson_id, p_question_text,
     case when p_is_correct then 0 else 1 end,
     case when p_is_correct then 1 else 0 end)
  on conflict (question_id) do update
  set lesson_id = excluded.lesson_id,
      question_text = excluded.question_text,
      wrong_count = public.question_analytics.wrong_count + excluded.wrong_count,
      correct_count = public.question_analytics.correct_count + excluded.correct_count;
end;
$$;

create or replace function public.get_leaderboard()
returns table (
  name text,
  governorate text,
  lessons_count bigint,
  quizzes_count bigint,
  total_score bigint,
  accuracy integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.name,
    coalesce(s.governorate, ''),
    count(distinct r.lesson_id),
    count(r.id),
    coalesce(sum(r.score), 0),
    case when coalesce(sum(r.total_questions), 0) > 0
      then round(100.0 * sum(r.score) / sum(r.total_questions))::integer
      else 0
    end
  from public.students s
  join public.quiz_results r on r.student_phone = s.phone
  where auth.uid() is not null
  group by s.phone, s.name, s.governorate
  order by count(distinct r.lesson_id) desc, coalesce(sum(r.score), 0) desc,
           case when coalesce(sum(r.total_questions), 0) > 0
             then 100.0 * sum(r.score) / sum(r.total_questions)
             else 0
           end desc;
$$;

revoke all on function public.register_or_restore_student(text, text, text, text) from public, anon;
revoke all on function public.request_device_transfer(text, text, text) from public, anon;
revoke all on function public.handle_device_transfer(text, text) from public, anon;
revoke all on function public.claim_activation_code(text) from public, anon;
revoke all on function public.update_student_name(text) from public, anon;
revoke all on function public.record_question_result(text, text, text, boolean) from public, anon;
revoke all on function public.get_leaderboard() from public, anon;
grant execute on function public.register_or_restore_student(text, text, text, text) to authenticated;
grant execute on function public.request_device_transfer(text, text, text) to authenticated;
grant execute on function public.handle_device_transfer(text, text) to authenticated;
grant execute on function public.claim_activation_code(text) to authenticated;
grant execute on function public.update_student_name(text) to authenticated;
grant execute on function public.record_question_result(text, text, text, boolean) to authenticated;
grant execute on function public.get_leaderboard() to authenticated;

drop policy if exists "Allow public uploads" on storage.objects;
drop policy if exists "biology_assets_admin_insert" on storage.objects;
drop policy if exists "biology_assets_admin_update" on storage.objects;
drop policy if exists "biology_assets_admin_delete" on storage.objects;
create policy "biology_assets_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'biology-assets'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "biology_assets_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'biology-assets'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'biology-assets'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "biology_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'biology-assets'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'video/mp4', 'video/webm'
    ]::text[]
where id = 'biology-assets';

commit;
