-- One-off data fix, not a schema change: "Golgappe with varieties of water"'s
-- sub-step "2e" (step_2_sub_4) was stuck oscillating between done/undone on
-- every page load, causing a runaway write storm (1M+ writes) as every fresh
-- client re-"corrected" it differently. This pins it to a single stable,
-- completed state (matching its sibling sub-steps, which are all done) so
-- there's nothing left to oscillate.
update public.kitchen_tracking
set data = jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(data, '{manual,step_2_sub_4}', 'true', true),
                 '{starts,step_2_sub_4}', to_jsonb((extract(epoch from now())*1000)::bigint - 120000), true
               ),
               '{manualAt,step_2_sub_4}', to_jsonb(to_char(now(), 'DD Mon HH12:MI am')), true
             ),
             '{doneElapsed,step_2_sub_4}', '120', true
           ),
    client_id = 'server-fix-stable'
where ev_id = 'LMS-V-00701-2026-10-09' and dish_key = 'LMS-V-00701-2026-10-09|31';

update public.kitchen_tracking
set data = jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(data, '{manual,step_2_sub_4}', 'true', true),
                 '{starts,step_2_sub_4}', to_jsonb((extract(epoch from now())*1000)::bigint - 120000), true
               ),
               '{manualAt,step_2_sub_4}', to_jsonb(to_char(now(), 'DD Mon HH12:MI am')), true
             ),
             '{doneElapsed,step_2_sub_4}', '120', true
           ),
    client_id = 'server-fix-stable'
where ev_id = '__combined_2026-10-09' and dish_key = 'dish|Golgappe with varieties of water';
