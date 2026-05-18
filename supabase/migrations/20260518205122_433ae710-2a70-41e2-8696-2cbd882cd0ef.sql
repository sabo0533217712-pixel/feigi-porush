ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS business_address text DEFAULT '';

DROP FUNCTION IF EXISTS public.get_public_business_settings();

CREATE OR REPLACE FUNCTION public.get_public_business_settings()
 RETURNS TABLE(id uuid, business_name text, business_address text, working_days integer[], start_time time without time zone, end_time time without time zone, break_start time without time zone, break_end time without time zone, slot_duration_minutes integer, slot_step_minutes integer, advance_booking_days integer, cancellation_hours integer, day_schedules jsonb, primary_color text, secondary_color text, font_family text, custom_texts jsonb, appointment_buffer_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, business_name, business_address, working_days, start_time, end_time,
    break_start, break_end, slot_duration_minutes, slot_step_minutes,
    advance_booking_days, cancellation_hours, day_schedules,
    primary_color, secondary_color, font_family, custom_texts,
    appointment_buffer_minutes
  FROM public.business_settings
  LIMIT 1;
$function$;