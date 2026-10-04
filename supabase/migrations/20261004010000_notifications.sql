-- Notification system (in-app + web push).
--
-- target_role is a coarse bucket, not a real RBAC check — 'kitchen' means
-- "anyone with role 'head_chef' or a role starting with 'section_'". Kitchen
-- access here is mostly shared section tablets rather than individual chef
-- logins, so per-user targeting isn't meaningful yet; push_subscriptions.role
-- is a snapshot taken at subscribe time (refreshed on every app load) so the
-- send-push edge function can resolve a target_role to device endpoints
-- without joining back to the staff table.

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  staff_id   text,
  role       text,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions disable row level security;

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  target_role     text,
  target_staff_id text,
  event_id        text,
  kind            text not null,
  title           text not null,
  body            text,
  created_at      timestamptz not null default now(),
  read_by         jsonb not null default '[]'::jsonb
);
alter table public.notifications disable row level security;

alter publication supabase_realtime add table public.notifications;
