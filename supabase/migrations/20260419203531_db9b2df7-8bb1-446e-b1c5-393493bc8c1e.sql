-- Update existing 'sms' rows to 'whatsapp'
UPDATE public.profiles SET reminder_preference = 'whatsapp' WHERE reminder_preference = 'sms';

-- Update default for new rows
ALTER TABLE public.profiles ALTER COLUMN reminder_preference SET DEFAULT 'whatsapp';

-- Update handle_new_user trigger to set reminder_preference explicitly to whatsapp by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, email, reminder_preference)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'reminder_preference', 'whatsapp')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$function$;