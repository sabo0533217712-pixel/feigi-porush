BEGIN;

-- Cleanup: remove the duplicate test profile (aa@aa.aa) so the unique index can be created.
DELETE FROM public.user_roles
WHERE user_id = 'b26813a9-71b8-44bd-8bad-c51663155b19';

DELETE FROM public.profiles
WHERE id = '7abc06c7-91f0-496e-bfec-bb7c666981d5';

DELETE FROM auth.users
WHERE id = 'b26813a9-71b8-44bd-8bad-c51663155b19';

ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_norm_unique
  ON public.profiles (public.normalize_phone(phone))
  WHERE phone IS NOT NULL AND phone <> '';

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

CREATE OR REPLACE FUNCTION public.admin_create_manual_client(
  _name  text,
  _phone text,
  _email text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm     text;
  _existing uuid;
  _new_uid  uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  _norm := public.normalize_phone(_phone);
  IF _norm = '' OR length(_norm) < 7 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  SELECT user_id INTO _existing
  FROM public.profiles
  WHERE public.normalize_phone(phone) = _norm
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  _new_uid := gen_random_uuid();

  INSERT INTO public.profiles (user_id, full_name, phone, email, reminder_preference)
  VALUES (_new_uid, trim(_name), _phone, COALESCE(_email, ''), 'whatsapp');

  RETURN _new_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_manual_client(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_manual_client(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _q           text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'security_question','')), '');
  _a           text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'security_answer','')), '');
  _hash        text := NULL;
  _full_name   text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _phone       text := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  _reminder    text := COALESCE(NEW.raw_user_meta_data->>'reminder_preference', 'whatsapp');
  _norm        text := public.normalize_phone(_phone);
  _existing_id uuid;
  _old_uid     uuid;
BEGIN
  IF _q IS NOT NULL AND _a IS NOT NULL THEN
    _hash := encode(extensions.digest(lower(_a) || NEW.id::text, 'sha256'), 'hex');
  END IF;

  IF _norm <> '' AND length(_norm) >= 7 THEN
    SELECT id, user_id INTO _existing_id, _old_uid
    FROM public.profiles
    WHERE public.normalize_phone(phone) = _norm
    LIMIT 1;
  END IF;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id              = NEW.id,
        full_name            = CASE WHEN COALESCE(full_name,'') = '' THEN _full_name ELSE full_name END,
        email                = CASE WHEN COALESCE(email,'')     = '' THEN COALESCE(NEW.email,'') ELSE email END,
        reminder_preference  = COALESCE(reminder_preference, _reminder),
        security_question    = COALESCE(security_question, _q),
        security_answer_hash = COALESCE(security_answer_hash, _hash),
        updated_at           = now()
    WHERE id = _existing_id;

    IF _old_uid IS NOT NULL AND _old_uid <> NEW.id THEN
      UPDATE public.appointments
      SET client_id = NEW.id, updated_at = now()
      WHERE client_id = _old_uid;
    END IF;
  ELSE
    INSERT INTO public.profiles (user_id, full_name, phone, email, reminder_preference, security_question, security_answer_hash)
    VALUES (NEW.id, _full_name, _phone, COALESCE(NEW.email, ''), _reminder, _q, _hash);
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;