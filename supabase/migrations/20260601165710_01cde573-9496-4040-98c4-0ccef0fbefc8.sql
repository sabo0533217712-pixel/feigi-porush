-- (א) Drop FK that blocks manual clients from getting appointments
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;

-- (ב) Manual cascade trigger to replace the ON DELETE CASCADE behavior
CREATE OR REPLACE FUNCTION public.cascade_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.appointments WHERE client_id = OLD.user_id;
  DELETE FROM public.waitlist     WHERE client_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_profile_delete ON public.profiles;
CREATE TRIGGER trg_cascade_profile_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.cascade_profile_delete();