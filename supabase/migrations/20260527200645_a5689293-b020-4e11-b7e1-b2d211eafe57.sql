CREATE OR REPLACE FUNCTION public.cleanup_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cutoff_date date := (now() - interval '1 year')::date;
  _cutoff_ts timestamptz := now() - interval '1 year';
BEGIN
  -- Delete linked rows first to avoid orphans
  DELETE FROM public.appointment_treatments
  WHERE appointment_id IN (
    SELECT id FROM public.appointments WHERE appointment_date < _cutoff_date
  );

  DELETE FROM public.reminder_log
  WHERE appointment_id IN (
    SELECT id FROM public.appointments WHERE appointment_date < _cutoff_date
  );

  DELETE FROM public.appointments WHERE appointment_date < _cutoff_date;
  DELETE FROM public.time_blocks WHERE block_date < _cutoff_date;
  DELETE FROM public.extra_shifts WHERE shift_date < _cutoff_date;
  DELETE FROM public.webhook_events WHERE created_at < _cutoff_ts;
END;
$$;