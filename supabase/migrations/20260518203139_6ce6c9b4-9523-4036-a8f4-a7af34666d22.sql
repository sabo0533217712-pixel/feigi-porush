
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _q text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'security_question','')), '');
  _a text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'security_answer','')), '');
  _hash text := NULL;
BEGIN
  IF _q IS NOT NULL AND _a IS NOT NULL THEN
    _hash := encode(extensions.digest(lower(_a) || NEW.id::text, 'sha256'), 'hex');
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone, email, reminder_preference, security_question, security_answer_hash)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'reminder_preference', 'whatsapp'),
    _q,
    _hash
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$;
