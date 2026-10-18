-- The Timings panel gained a "Function start" field, paired with Wind-up to
-- bookend the whole function in the reorganized Timings layout.
alter table event_function_plans
  add column if not exists function_start_time text;
