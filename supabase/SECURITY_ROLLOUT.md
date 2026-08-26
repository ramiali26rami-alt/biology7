# Security rollout checklist

This migration is intentionally not applied automatically.

1. Enable anonymous sign-ins in Supabase Authentication. Student devices use anonymous Auth identities so RLS can distinguish their rows.
2. Create or choose the owner's email/password Auth user.
3. Set the owner's server-controlled app metadata from the Supabase SQL editor, replacing the placeholder email:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = '<OWNER_EMAIL>';
   ```

4. Sign out and sign in again so the owner's JWT contains the new role.
5. Apply `migrations/202608260001_secure_auth_and_rls.sql` in a maintenance window.
6. Deploy the matching frontend/server code immediately after the migration. The old frontend is not compatible with the new RLS policies.
7. Verify registration, existing-device restoration, activation, quiz sync, leaderboard, admin login, admin writes, and Storage upload.
8. Rotate the Android release signing key according to the distribution channel; removing the key from the latest commit does not remove it from Git history.

Rollback should be prepared from a database backup. Do not disable RLS as a routine rollback.
