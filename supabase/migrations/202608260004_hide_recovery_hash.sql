-- Keep recovery hashes out of PostgREST responses, including the admin UI.

begin;

revoke select on table public.students from authenticated;
grant select (
  phone,
  name,
  governorate,
  device_id,
  is_premium,
  created_at,
  user_id,
  recovery_code_created_at,
  device_bound_at
) on table public.students to authenticated;

create index if not exists device_transfer_requests_reviewed_by_idx
  on public.device_transfer_requests (reviewed_by)
  where reviewed_by is not null;

commit;
