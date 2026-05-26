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
  _win_start time;
  _win_end time;
  _in_window boolean := false;
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
  _dow := EXTRACT(DOW FROM NEW.appointment_date)::int;
  _day_sched := _settings.day_schedules -> _dow::text;

  -- (0) Must fall inside a working window: regular working day OR extra shift
  IF _settings.working_days IS NOT NULL AND _dow = ANY(_settings.working_days) THEN
    BEGIN
      _win_start := COALESCE((_day_sched ->> 'start')::time, _settings.start_time, '09:00'::time);
      _win_end   := COALESCE((_day_sched ->> 'end')::time,   _settings.end_time,   '18:00'::time);
    EXCEPTION WHEN OTHERS THEN
      _win_start := COALESCE(_settings.start_time, '09:00'::time);
      _win_end   := COALESCE(_settings.end_time, '18:00'::time);
    END;
    IF NEW.start_time >= _win_start AND NEW.end_time <= _win_end THEN
      _in_window := true;
    END IF;
  END IF;

  IF NOT _in_window THEN
    IF EXISTS (
      SELECT 1 FROM public.extra_shifts
      WHERE shift_date = NEW.appointment_date
        AND NEW.start_time >= start_time
        AND NEW.end_time <= end_time
    ) THEN
      _in_window := true;
    END IF;
  END IF;

  IF NOT _in_window THEN
    RAISE EXCEPTION 'Time slot is outside working hours';
  END IF;

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

  -- (b) Overlap with admin-defined time block
  IF EXISTS (
    SELECT 1 FROM public.time_blocks
    WHERE block_date = NEW.appointment_date
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time
  ) THEN
    RAISE EXCEPTION 'Time slot is blocked';
  END IF;

  -- (c) Overlap with recurring break from day_schedules
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

  -- (d) Legacy fallback
  IF _settings.break_start IS NOT NULL AND _settings.break_end IS NOT NULL THEN
    IF NEW.start_time < _settings.break_end
       AND NEW.end_time > _settings.break_start THEN
      RAISE EXCEPTION 'Time slot overlaps a break';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;