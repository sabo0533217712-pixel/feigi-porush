
-- 1. Add security question columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS security_question text,
  ADD COLUMN IF NOT EXISTS security_answer_hash text;

-- 2. Password reset tokens table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no policies => no public access)
CREATE POLICY "Admins can view reset tokens"
ON public.password_reset_tokens FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Failed attempts log (for basic rate limiting)
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwr_attempts_phone_time
  ON public.password_reset_attempts (phone, created_at DESC);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reset attempts"
ON public.password_reset_attempts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Normalize phone helper
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(_phone, ''), '[^0-9]', '', 'g');
$$;

-- 5. RPC: request password reset - returns the security question if phone exists & user set one
CREATE OR REPLACE FUNCTION public.request_password_reset(_phone text)
RETURNS TABLE(security_question text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text := public.normalize_phone(_phone);
  _q text;
  _recent_fails int;
BEGIN
  IF _norm = '' OR length(_norm) < 7 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  SELECT count(*) INTO _recent_fails
  FROM public.password_reset_attempts
  WHERE phone = _norm
    AND success = false
    AND created_at > now() - interval '15 minutes';

  IF _recent_fails >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT p.security_question INTO _q
  FROM public.profiles p
  WHERE public.normalize_phone(p.phone) = _norm
    AND p.security_question IS NOT NULL
    AND p.security_answer_hash IS NOT NULL
  LIMIT 1;

  IF _q IS NULL THEN
    -- Don't reveal whether phone exists
    RAISE EXCEPTION 'not_available';
  END IF;

  RETURN QUERY SELECT _q;
END;
$$;

-- 6. RPC: verify security answer; returns one-time token
CREATE OR REPLACE FUNCTION public.verify_security_answer(_phone text, _answer text)
RETURNS TABLE(token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _norm text := public.normalize_phone(_phone);
  _user_id uuid;
  _hash text;
  _ok boolean := false;
  _token text;
  _recent_fails int;
BEGIN
  IF _norm = '' OR _answer IS NULL OR length(trim(_answer)) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT count(*) INTO _recent_fails
  FROM public.password_reset_attempts
  WHERE phone = _norm
    AND success = false
    AND created_at > now() - interval '15 minutes';

  IF _recent_fails >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT p.user_id, p.security_answer_hash
    INTO _user_id, _hash
  FROM public.profiles p
  WHERE public.normalize_phone(p.phone) = _norm
    AND p.security_answer_hash IS NOT NULL
  LIMIT 1;

  IF _user_id IS NOT NULL AND _hash IS NOT NULL THEN
    -- Compare against sha256(lower(trim(answer)) || user_id)
    IF encode(extensions.digest(lower(trim(_answer)) || _user_id::text, 'sha256'), 'hex') = _hash THEN
      _ok := true;
    END IF;
  END IF;

  INSERT INTO public.password_reset_attempts(phone, success) VALUES (_norm, _ok);

  IF NOT _ok THEN
    RAISE EXCEPTION 'invalid_answer';
  END IF;

  _token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.password_reset_tokens(user_id, token, expires_at)
  VALUES (_user_id, _token, now() + interval '10 minutes');

  RETURN QUERY SELECT _token;
END;
$$;

-- 7. RPC: set security question for current user (helper for client profile / register)
CREATE OR REPLACE FUNCTION public.set_security_question(_question text, _answer text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _question IS NULL OR length(trim(_question)) < 3 THEN
    RAISE EXCEPTION 'invalid_question';
  END IF;
  IF _answer IS NULL OR length(trim(_answer)) < 2 THEN
    RAISE EXCEPTION 'invalid_answer';
  END IF;

  _hash := encode(extensions.digest(lower(trim(_answer)) || _uid::text, 'sha256'), 'hex');

  UPDATE public.profiles
  SET security_question = trim(_question),
      security_answer_hash = _hash,
      updated_at = now()
  WHERE user_id = _uid;
END;
$$;

-- 8. Ensure pgcrypto/digest available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

GRANT EXECUTE ON FUNCTION public.request_password_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_answer(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_security_question(text, text) TO authenticated;
