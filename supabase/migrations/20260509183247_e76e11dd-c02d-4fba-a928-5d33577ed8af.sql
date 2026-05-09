
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS appointment_buffer_minutes integer NOT NULL DEFAULT 5;

DROP FUNCTION IF EXISTS public.get_public_business_settings();

CREATE OR REPLACE FUNCTION public.get_public_business_settings()
 RETURNS TABLE(id uuid, business_name text, working_days integer[], start_time time without time zone, end_time time without time zone, break_start time without time zone, break_end time without time zone, slot_duration_minutes integer, slot_step_minutes integer, advance_booking_days integer, cancellation_hours integer, day_schedules jsonb, primary_color text, secondary_color text, font_family text, custom_texts jsonb, appointment_buffer_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, business_name, working_days, start_time, end_time,
    break_start, break_end, slot_duration_minutes, slot_step_minutes,
    advance_booking_days, cancellation_hours, day_schedules,
    primary_color, secondary_color, font_family, custom_texts,
    appointment_buffer_minutes
  FROM public.business_settings
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_busy_slots(_date date)
 RETURNS TABLE(start_time time without time zone, end_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.start_time,
    (a.end_time + make_interval(mins => COALESCE((SELECT appointment_buffer_minutes FROM public.business_settings LIMIT 1), 5)))::time AS end_time
  FROM public.appointments a
  WHERE a.appointment_date = _date
    AND a.status = 'confirmed';
$function$;

CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _buffer integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF NEW.booked_by_admin = true THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('appointment_date_' || NEW.appointment_date::text)
  );

  SELECT COALESCE(appointment_buffer_minutes, 5) INTO _buffer
  FROM public.business_settings LIMIT 1;

  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE appointment_date = NEW.appointment_date
      AND status = 'confirmed'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.start_time < (end_time + make_interval(mins => _buffer))::time
      AND (NEW.end_time + make_interval(mins => _buffer))::time > start_time
  ) THEN
    RAISE EXCEPTION 'Time slot is already booked';
  END IF;

  RETURN NEW;
END;
$function$;
