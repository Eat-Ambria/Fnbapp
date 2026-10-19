-- The Timings panel gained Valet start/end, alongside Live start/end.
alter table event_function_plans
  add column if not exists valet_start_time text,
  add column if not exists valet_end_time text;
