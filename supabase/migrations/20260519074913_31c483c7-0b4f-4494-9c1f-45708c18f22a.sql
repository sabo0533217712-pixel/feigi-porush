CREATE OR REPLACE FUNCTION public.verify_security_answer(_phone text, _answer text)
 RETURNS TABLE(token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _norm text := public.normalize_phone(_phone);
  _user_id uuid;
  _hash text;
  _ok boolean := false;
  _token text;
  _recent_fails int;
  _expected text;
  _ans_norm text := lower(trim(COALESCE(_answer, '')));
BEGIN
  IF _norm = '' OR _ans_norm = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT count(*) INTO _recent_fails
  FROM public.password_reset_attempts
  WHERE phone = _norm AND success = false
    AND created_at > now() - interval '15 minutes';
  IF _recent_fails >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT p.user_id, p.security_answer_hash INTO _user_id, _hash
  FROM public.profiles p
  WHERE public.normalize_phone(p.phone) = _norm
    AND p.security_answer_hash IS NOT NULL
  LIMIT 1;

  IF _user_id IS NOT NULL AND _hash IS NOT NULL THEN
    _expected := encode(extensions.digest(_ans_norm || _user_id::text, 'sha256'), 'hex');
    IF _expected = _hash THEN
      _ok := true;
    ELSIF length(_hash) <> 64 AND lower(trim(_hash)) = _ans_norm THEN
      -- Legacy plaintext storage: accept and upgrade to hash
      _ok := true;
      UPDATE public.profiles SET security_answer_hash = _expected, updated_at = now()
      WHERE user_id = _user_id;
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
$function$;