-- Remove the single disposable account created while verifying the production fix.

begin;

do $$
declare
  test_user_id uuid;
begin
  select user_id into test_user_id
  from public.students
  where phone = '990772766376'
    and name = 'اختبار كودكس';

  delete from public.students
  where phone = '990772766376'
    and name = 'اختبار كودكس';

  if test_user_id is not null
     and not exists (select 1 from public.students where user_id = test_user_id) then
    delete from auth.users where id = test_user_id;
  end if;
end;
$$;

commit;
