-- Slot holds table for IVR temporary reservations
CREATE TABLE public.slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  phone text,
  source text NOT NULL DEFAULT 'phone',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slot_holds_date_time ON public.slot_holds(hold_date, start_time, end_time);
CREATE INDEX idx_slot_holds_expires ON public.slot_holds(expires_at);

ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage slot holds"
ON public.slot_holds FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Webhook deliveries log (for future Make integration)
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
ON public.webhook_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add source column to appointments to track phone bookings
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_name text;

-- Update overlap check to also consider active slot holds
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

  PERFORM pg_advisory_xact_lock(hashtext('appointment_date_' || NEW.appointment_date::text));

  SELECT COALESCE(appointment_buffer_minutes, 5) INTO _buffer
  FROM public.business_settings LIMIT 1;

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

  RETURN NEW;
END;
$function$;

-- Webhook trigger function
CREATE OR REPLACE FUNCTION public.emit_appointment_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _event text;
  _row RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _event := 'appointment.created';
    _row := NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      _event := 'appointment.cancelled';
    ELSE
      _event := 'appointment.updated';
    END IF;
    _row := NEW;
  END IF;

  INSERT INTO public.webhook_events(event, payload)
  VALUES (_event, jsonb_build_object(
    'event', _event,
    'appointmentId', _row.id,
    'date', _row.appointment_date,
    'time', _row.start_time,
    'endTime', _row.end_time,
    'status', _row.status,
    'customerPhone', _row.customer_phone,
    'customerName', _row.customer_name,
    'source', _row.source
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointment_webhook
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.emit_appointment_webhook();