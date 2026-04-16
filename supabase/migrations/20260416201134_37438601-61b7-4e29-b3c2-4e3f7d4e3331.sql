CREATE OR REPLACE FUNCTION public.get_busy_slots(_date date)
RETURNS TABLE(start_time time without time zone, end_time time without time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT start_time, end_time
  FROM public.appointments
  WHERE appointment_date = _date
    AND status = 'confirmed';
$$;

GRANT EXECUTE ON FUNCTION public.get_busy_slots(date) TO authenticated;