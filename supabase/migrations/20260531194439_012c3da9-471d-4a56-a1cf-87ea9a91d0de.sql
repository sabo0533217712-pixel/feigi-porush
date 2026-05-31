ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS calendar_view_start time NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS calendar_view_end   time NOT NULL DEFAULT '22:00';