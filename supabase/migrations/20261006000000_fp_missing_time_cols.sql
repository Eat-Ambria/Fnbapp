-- FunctionPlanTab.jsx's TIME_FIELDS lists 8 timing columns on
-- event_function_plans, but only 6 were ever created on the live table —
-- main_course_time and jaimala_time were missing entirely. saveFPField
-- upserts the WHOLE fp row on every field edit, so editing a column that
-- exists was fine, but as soon as anyone touched Main Course or Jaimala the
-- upsert sent a column PostgREST had never heard of and failed outright
-- (which also blocks every other field's autosave on that same FP, since
-- it's one upsert for the whole row).
alter table event_function_plans
  add column if not exists main_course_time text,
  add column if not exists jaimala_time text;
