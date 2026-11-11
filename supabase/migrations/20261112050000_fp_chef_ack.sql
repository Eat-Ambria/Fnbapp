-- Head Chef acknowledgement of a Function Plan: a one-way "I've seen this"
-- stamp a head_chef-role user presses from the FP print view, surfaced to
-- sales in BookedFunctionsView's own list and on the public FP Hub's
-- calendar cards (both already read event_function_plans for "Made By").
alter table public.event_function_plans
  add column if not exists chef_ack_by text,
  add column if not exists chef_ack_at timestamptz;
