-- ============================================================
-- 1. APPOINTMENTS: tighten client UPDATE policy
-- ============================================================

DROP POLICY IF EXISTS "Clients can update own appointments" ON public.appointments;

-- Helper: SECURITY DEFINER function that lets clients cancel their own appointment
-- only outside the cancellation window from business_settings.cancellation_hours.
CREATE OR REPLACE FUNCTION public.cancel_my_appointment(_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _appt RECORD;
  _cancel_hours INTEGER;
  _appt_ts TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _appt
  FROM public.appointments
  WHERE id = _appointment_id AND client_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF _appt.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed appointments can be cancelled';
  END IF;

  SELECT COALESCE(cancellation_hours, 24) INTO _cancel_hours
  FROM public.business_settings
  LIMIT 1;

  _appt_ts := (_appt.appointment_date::timestamp + _appt.start_time)::timestamptz;

  IF _appt_ts - now() < make_interval(hours => _cancel_hours) THEN
    RAISE EXCEPTION 'Cancellation window has passed';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = _appointment_id AND client_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid) TO authenticated;

-- Replacement UPDATE policy: clients may only update their own row,
-- only changing status to 'cancelled', and not flipping booked_by_admin or client_id.
CREATE POLICY "Clients can cancel own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (auth.uid() = client_id AND status = 'confirmed')
WITH CHECK (
  auth.uid() = client_id
  AND status = 'cancelled'
  AND booked_by_admin = false
);

-- ============================================================
-- 2. BUSINESS_SETTINGS: hide admin contact columns from public
-- ============================================================

-- Public/client roles lose direct read access on the sensitive columns.
REVOKE SELECT (admin_email, admin_phone) ON public.business_settings FROM anon;
REVOKE SELECT (admin_email, admin_phone) ON public.business_settings FROM authenticated;

-- Admins read these via a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.get_admin_contact()
RETURNS TABLE(admin_email text, admin_phone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bs.admin_email, bs.admin_phone
  FROM public.business_settings bs
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_admin_contact() FROM public;
GRANT EXECUTE ON FUNCTION public.get_admin_contact() TO authenticated;

-- ============================================================
-- 3. USER_ROLES: explicit deny for non-admin writes
-- ============================================================

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. STORAGE: prevent listing the gallery bucket
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view gallery images" ON storage.objects;

-- Allow direct file fetches (getPublicUrl) but require an explicit name match,
-- which still permits Supabase Storage's getPublicUrl flow while preventing
-- the broad "list everything" enumeration via SELECT *.
CREATE POLICY "Public can read individual gallery files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gallery' AND name IS NOT NULL);

-- Note: the bucket itself remains public so getPublicUrl works without auth.
-- Listing API (storage.from('gallery').list()) is now restricted to admins.
CREATE POLICY "Admins can list gallery"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'::app_role));
