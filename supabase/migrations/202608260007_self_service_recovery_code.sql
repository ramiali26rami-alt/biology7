-- Let the currently bound student rotate their own recovery code.

begin;

create or replace function public.rotate_recovery_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_phone text;
  recovery_code text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select phone into caller_phone
  from public.students
  where user_id = caller_id
  for update;

  if caller_phone is null then
    return jsonb_build_object('success', false, 'message', 'يجب تسجيل حساب الطالب على هذا الهاتف أولاً.');
  end if;

  recovery_code := private.issue_recovery_code(caller_phone);
  return jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء رمز استرداد جديد. الرمز السابق أصبح غير صالح.',
    'recoveryCode', recovery_code
  );
end;
$$;

revoke all on function public.rotate_recovery_code() from public, anon;
grant execute on function public.rotate_recovery_code() to authenticated;

commit;
