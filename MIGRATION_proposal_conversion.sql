-- Ambria FnB — proposal-to-booking conversion tracking
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Tracks which event a "won" proposal was converted into, so Convert to Booking
-- runs once per proposal and the UI can show "already booked" afterwards.

alter table public.proposals add column if not exists converted_event_id text references public.events(id);
