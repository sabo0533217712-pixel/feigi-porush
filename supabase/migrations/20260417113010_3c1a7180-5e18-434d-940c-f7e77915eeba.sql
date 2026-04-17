-- Fix the overlap check trigger to skip cancelled/non-confirmed appointments
-- Problem: on UPDATE (e.g., cancellation), the trigger was checking overlap and
-- finding existing overlapping confirmed appointments (from prior bugs), which
-- raised "Time slot is already booked" — preventing cancellation entirely.

CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip overlap check entirely if the appointment is not (or no longer) confirmed
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Admins can override (e.g., when manually moving / rescheduling)
  IF NEW.booked_by_admin = true THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent bookings on the same date
  PERFORM pg_advisory_xact_lock(
    hashtext('appointment_date_' || NEW.appointment_date::text)
  );

  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE appointment_date = NEW.appointment_date
      AND status = 'confirmed'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time
  ) THEN
    RAISE EXCEPTION 'Time slot is already booked';
  END IF;

  RETURN NEW;
END;
$function$;