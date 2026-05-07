CREATE TABLE public.extra_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extra_shifts_date ON public.extra_shifts(shift_date);

ALTER TABLE public.extra_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view extra shifts"
ON public.extra_shifts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert extra shifts"
ON public.extra_shifts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update extra shifts"
ON public.extra_shifts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete extra shifts"
ON public.extra_shifts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));