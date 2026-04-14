
CREATE TABLE public.treatment_price_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  min_minutes INTEGER NOT NULL DEFAULT 0,
  max_minutes INTEGER NOT NULL,
  price_per_minute NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage price tiers" ON public.treatment_price_tiers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view price tiers" ON public.treatment_price_tiers FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX idx_price_tiers_treatment ON public.treatment_price_tiers(treatment_id);
