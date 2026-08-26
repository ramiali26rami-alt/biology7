-- Production hotfix marker.
-- The corrected function bodies live in 202608260003_secure_device_recovery.sql,
-- so a fresh database already receives the fix before reaching this migration.

begin;
select 1;
commit;
