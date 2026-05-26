-- 1. Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holiday_settings;
ALTER TABLE public.business_settings REPLICA IDENTITY FULL;
ALTER TABLE public.holiday_settings REPLICA IDENTITY FULL;

-- 2. Extend appointment overlap trigger to enforce breaks + time_blocks for non-admin bookings
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _buffer integer;
  _settings RECORD;
  _dow int;
  _day_sched jsonb;
  _breaks jsonb;
  _brk jsonb;
  _bstart time;
  _bend time;
BEGIN
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF NEW.booked_by_admin = true THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('appointment_date_' || NEW.appointment_date::text));

  SELECT * INTO _settings FROM public.business_settings LIMIT 1;
  _buffer := COALESCE(_settings.appointment_buffer_minutes, 5);

  -- (a) Overlap with another confirmed appointment
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointment_date = NEW.appointment_date
      AND status = 'confirmed'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.start_time < (end_time + make_interval(mins => _buffer))::time
      AND (NEW.end_time + make_interval(mins => _buffer))::time > start_time
  ) THEN
    RAISE EXCEPTION 'Time slot is already booked';
  END IF;

  -- (b) Overlap with an admin-defined time block for that date
  IF EXISTS (
    SELECT 1 FROM public.time_blocks
    WHERE block_date = NEW.appointment_date
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time
  ) THEN
    RAISE EXCEPTION 'Time slot is blocked';
  END IF;

  -- (c) Overlap with a recurring break from day_schedules (per weekday)
  _dow := EXTRACT(DOW FROM NEW.appointment_date)::int;
  _day_sched := _settings.day_schedules -> _dow::text;
  IF _day_sched IS NOT NULL THEN
    _breaks := _day_sched -> 'breaks';
    IF _breaks IS NOT NULL AND jsonb_typeof(_breaks) = 'array' THEN
      FOR _brk IN SELECT * FROM jsonb_array_elements(_breaks) LOOP
        BEGIN
          _bstart := (_brk ->> 'start')::time;
          _bend := (_brk ->> 'end')::time;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE;
        END;
        IF _bstart IS NOT NULL AND _bend IS NOT NULL
           AND NEW.start_time < _bend
           AND NEW.end_time > _bstart THEN
          RAISE EXCEPTION 'Time slot overlaps a break';
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- (d) Fallback: legacy single break_start/break_end on business_settings
  IF _settings.break_start IS NOT NULL AND _settings.break_end IS NOT NULL THEN
    IF NEW.start_time < _settings.break_end
       AND NEW.end_time > _settings.break_start THEN
      RAISE EXCEPTION 'Time slot overlaps a break';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists (it may have been added by an earlier migration; re-create defensively)
DROP TRIGGER IF EXISTS appointments_check_overlap ON public.appointments;
CREATE TRIGGER appointments_check_overlap
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.check_appointment_overlap();