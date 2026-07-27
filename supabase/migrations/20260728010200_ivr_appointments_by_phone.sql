-- Appointments booked from the website only link client_id (no customer_phone), while
-- phone-originated bookings only set customer_phone. This RPC finds an appointment by
-- phone number regardless of which channel it was booked through, matching either
-- customer_phone directly or the phone on the linked profile — using normalize_phone()
-- on both sides so formatting differences (spaces, dashes, +972 vs 0) don't matter.
-- Restricted to service_role since it returns another client's appointment data.
create or replace function public.ivr_appointments_by_phone(_phone text)
returns table (
  id uuid,
  appointment_date date,
  start_time time,
  status text
)
language sql
stable
set search_path = public
as $$
  select a.id, a.appointment_date, a.start_time, a.status
  from public.appointments a
  left join public.profiles p on p.user_id = a.client_id
  where a.status = 'confirmed'
    and a.appointment_date >= current_date
    and (
      public.normalize_phone(a.customer_phone) = public.normalize_phone(_phone)
      or public.normalize_phone(p.phone) = public.normalize_phone(_phone)
    )
  order by a.appointment_date, a.start_time;
$$;

revoke all on function public.ivr_appointments_by_phone(text) from public, anon, authenticated;
grant execute on function public.ivr_appointments_by_phone(text) to service_role;

-- Same customer_phone-or-profile-phone matching, used to authorize cancellation
-- (replaces a plain "customer_phone = phone" check that misses website bookings).
create or replace function public.ivr_phone_owns_appointment(_phone text, _appointment_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    left join public.profiles p on p.user_id = a.client_id
    where a.id = _appointment_id
      and (
        public.normalize_phone(a.customer_phone) = public.normalize_phone(_phone)
        or public.normalize_phone(p.phone) = public.normalize_phone(_phone)
      )
  );
$$;

revoke all on function public.ivr_phone_owns_appointment(text, uuid) from public, anon, authenticated;
grant execute on function public.ivr_phone_owns_appointment(text, uuid) to service_role;
