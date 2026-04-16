
-- 1) Fix booked_by_admin bypass: clients cannot set booked_by_admin = true
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
CREATE POLICY "Authenticated users can insert appointments"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND booked_by_admin = false
  );

-- 2) Restrict business_settings public read - remove admin contact exposure
DROP POLICY IF EXISTS "Everyone can view business settings" ON public.business_settings;

-- Public can read non-sensitive settings via a SECURITY DEFINER function instead
CREATE OR REPLACE FUNCTION public.get_public_business_settings()
RETURNS TABLE(
  id uuid,
  business_name text,
  working_days integer[],
  start_time time without time zone,
  end_time time without time zone,
  break_start time without time zone,
  break_end time without time zone,
  slot_duration_minutes integer,
  slot_step_minutes integer,
  advance_booking_days integer,
  cancellation_hours integer,
  day_schedules jsonb,
  primary_color text,
  secondary_color text,
  font_family text,
  custom_texts jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, business_name, working_days, start_time, end_time,
    break_start, break_end, slot_duration_minutes, slot_step_minutes,
    advance_booking_days, cancellation_hours, day_schedules,
    primary_color, secondary_color, font_family, custom_texts
  FROM public.business_settings
  LIMIT 1;
$$;

-- Allow admins to read full row including admin contact
CREATE POLICY "Admins can view all business settings"
  ON public.business_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Realtime authorization: restrict channel subscriptions on appointments
-- Enable RLS on realtime.messages (idempotent)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to receive realtime messages only on appointment channels
-- scoped to their own user id, OR admins for the global "appointments" channel
DROP POLICY IF EXISTS "Users receive own appointment realtime" ON realtime.messages;
CREATE POLICY "Users receive own appointment realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can subscribe to all appointment channels
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Clients can only subscribe to their own user-scoped channel
    realtime.topic() = 'appointments:user:' || auth.uid()::text
  );
