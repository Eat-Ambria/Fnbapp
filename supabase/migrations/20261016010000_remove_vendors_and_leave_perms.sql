-- Vendor Directory is being removed entirely (no persistence, pure local
-- seed-data state per the code audit — never actually synced anywhere).
-- Leave request/approval is being removed too (attendance/leave tracking is
-- no longer part of this app). Code-side defaults (permissions.js) are
-- already updated; this strips the same entries from any row an admin may
-- already have customized via Manage Screens/Manage Roles, since those DB
-- rows overlay the code defaults and would otherwise keep the dead entries
-- alive for already-edited roles.

delete from public.screen_definitions where screen_key = 'vendors';

update public.role_definitions
set screens = screens - 'vendors'
where screens @> '["vendors"]'::jsonb;

update public.role_definitions
set elevated = (elevated - 'team.leave_approve') - 'team.attendance_mark'
where elevated @> '["team.leave_approve"]'::jsonb
   or elevated @> '["team.attendance_mark"]'::jsonb;
