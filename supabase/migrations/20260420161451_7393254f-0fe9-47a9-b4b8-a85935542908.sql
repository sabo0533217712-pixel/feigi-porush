-- Enable pg_cron and pg_net for scheduled webhook calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reminder log to prevent duplicate reminder sends
CREATE TABLE IF NOT EXISTS public.reminder_log (
  appointment_id uuid PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  payload jsonb
);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reminder log"
  ON public.reminder_log
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));