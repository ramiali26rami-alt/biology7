-- Remove the integration-test students and all auth users still linked to them.

begin;

create temporary table recovery_test_users on commit drop as
select user_id as id
from public.students
where name = 'Recovery Flow Test' and governorate = 'Test'
union
select requester_user_id as id
from public.device_transfer_requests
where phone in (
  select phone from public.students
  where name = 'Recovery Flow Test' and governorate = 'Test'
);

delete from public.device_transfer_requests
where phone in (
  select phone from public.students
  where name = 'Recovery Flow Test' and governorate = 'Test'
);

delete from public.students
where name = 'Recovery Flow Test' and governorate = 'Test';

delete from auth.users
where id in (select id from recovery_test_users where id is not null);

commit;
