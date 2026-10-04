-- Ambria FnB — small admin-controlled global settings (key/value).
-- First use: a shared code admin sets in Access Manager that staff must
-- enter to re-open ("unlock") a Function Plan that's been marked final,
-- so a locked FP can't be edited just by tapping through the reason prompt.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
