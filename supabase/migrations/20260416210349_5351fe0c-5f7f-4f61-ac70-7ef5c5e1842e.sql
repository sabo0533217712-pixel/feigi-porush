CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.booked_by_admin = true THEN
    RETURN NEW;
  END IF;

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
$$;

DROP TRIGGER IF EXISTS check_overlap_before_insert ON public.appointments;
DROP TRIGGER IF EXISTS check_overlap_before_update ON public.appointments;
DROP TRIGGER IF EXISTS check_appointment_overlap_trigger ON public.appointments;

CREATE TRIGGER check_appointment_overlap_trigger
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_overlap();