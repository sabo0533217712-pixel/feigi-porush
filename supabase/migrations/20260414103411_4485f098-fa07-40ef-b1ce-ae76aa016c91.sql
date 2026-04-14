
-- 1. Add columns to existing tables
ALTER TABLE public.treatments 
  ADD COLUMN color text DEFAULT '#6366f1',
  ADD COLUMN is_variable_duration boolean NOT NULL DEFAULT false;

ALTER TABLE public.appointments 
  ADD COLUMN booked_by_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles 
  ADD COLUMN reminder_preference text NOT NULL DEFAULT 'email';

ALTER TABLE public.business_settings 
  ADD COLUMN primary_color text DEFAULT '#6366f1',
  ADD COLUMN secondary_color text DEFAULT '#ec4899',
  ADD COLUMN font_family text DEFAULT 'inherit',
  ADD COLUMN custom_texts jsonb DEFAULT '{}',
  ADD COLUMN admin_phone text DEFAULT '',
  ADD COLUMN admin_email text DEFAULT '';

-- 2. Create appointment_treatments junction table
CREATE TABLE public.appointment_treatments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES public.treatments(id),
  duration_minutes integer NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own appointment treatments"
  ON public.appointment_treatments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.appointments WHERE appointments.id = appointment_treatments.appointment_id AND appointments.client_id = auth.uid()
  ));

CREATE POLICY "Admins can view all appointment treatments"
  ON public.appointment_treatments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert appointment treatments"
  ON public.appointment_treatments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.appointments WHERE appointments.id = appointment_treatments.appointment_id AND appointments.client_id = auth.uid()
  ));

CREATE POLICY "Admins can insert appointment treatments"
  ON public.appointment_treatments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete appointment treatments"
  ON public.appointment_treatments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create waitlist table
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  treatment_id uuid REFERENCES public.treatments(id),
  preferred_date date,
  preferred_time_start time,
  preferred_time_end time,
  status text NOT NULL DEFAULT 'waiting',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own waitlist" ON public.waitlist FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert own waitlist" ON public.waitlist FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can delete own waitlist" ON public.waitlist FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "Admins can view all waitlist" ON public.waitlist FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update waitlist" ON public.waitlist FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete waitlist" ON public.waitlist FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all preferences" ON public.notification_preferences FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Create notification_log table
CREATE TABLE public.notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'reminder',
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  sent_at timestamptz,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notifications" ON public.notification_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert notifications" ON public.notification_log FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update notifications" ON public.notification_log FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 6. Update overlap check trigger to skip for admin-booked appointments
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip overlap check for admin-booked appointments
  IF NEW.booked_by_admin = true THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointment_date = NEW.appointment_date
      AND status = 'confirmed'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
      AND (
        (NEW.start_time >= start_time AND NEW.start_time < end_time)
        OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
        OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Time slot is already booked';
  END IF;
  RETURN NEW;
END;
$function$;

-- 7. Add admin insert policy for appointments (so admin can book for clients)
CREATE POLICY "Admins can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Add admin delete policy for appointments
CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Create storage bucket for gallery
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true);

CREATE POLICY "Anyone can view gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "Admins can upload gallery images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gallery images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));
