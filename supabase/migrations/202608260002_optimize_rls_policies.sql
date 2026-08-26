-- Reduce per-row auth evaluation and avoid overlapping permissive policies.

begin;

drop policy if exists "students_select_own" on public.students;
drop policy if exists "students_admin_all" on public.students;
create policy "students_select_access" on public.students
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "students_admin_insert" on public.students
  for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "students_admin_update" on public.students
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "students_admin_delete" on public.students
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "quiz_results_insert_own" on public.quiz_results;
drop policy if exists "quiz_results_select_own" on public.quiz_results;
drop policy if exists "quiz_results_admin_all" on public.quiz_results;
create policy "quiz_results_insert_access" on public.quiz_results
  for insert to authenticated
  with check (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    or exists (
      select 1 from public.students s
      where s.user_id = (select auth.uid())
        and s.phone = student_phone
    )
  );
create policy "quiz_results_select_access" on public.quiz_results
  for select to authenticated
  using (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    or exists (
      select 1 from public.students s
      where s.user_id = (select auth.uid())
        and s.phone = student_phone
    )
  );
create policy "quiz_results_admin_update" on public.quiz_results
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "quiz_results_admin_delete" on public.quiz_results
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "activation_codes_admin_all" on public.activation_codes;
create policy "activation_codes_admin_all" on public.activation_codes
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "question_analytics_admin_all" on public.question_analytics;
create policy "question_analytics_admin_all" on public.question_analytics
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "transfer_requests_select_own" on public.device_transfer_requests;
drop policy if exists "transfer_requests_admin_all" on public.device_transfer_requests;
create policy "transfer_requests_select_access" on public.device_transfer_requests
  for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "transfer_requests_admin_insert" on public.device_transfer_requests
  for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "transfer_requests_admin_update" on public.device_transfer_requests
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "transfer_requests_admin_delete" on public.device_transfer_requests
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "system_settings_curriculum_read" on public.system_settings;
drop policy if exists "system_settings_admin_all" on public.system_settings;
create policy "system_settings_select_access" on public.system_settings
  for select to authenticated
  using (
    key = 'curriculum_data'
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "system_settings_admin_insert" on public.system_settings
  for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "system_settings_admin_update" on public.system_settings
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "system_settings_admin_delete" on public.system_settings
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

commit;
