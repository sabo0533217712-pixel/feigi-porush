CREATE TABLE public.personal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_reminders TO authenticated;
GRANT ALL ON public.personal_reminders TO service_role;

ALTER TABLE public.personal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage personal reminders"
ON public.personal_reminders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_personal_reminders_date ON public.personal_reminders(reminder_date);