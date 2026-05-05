CREATE TABLE public.holiday_settings (
  holiday_desc TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  show_in_calendar BOOLEAN NOT NULL DEFAULT true,
  blocks_booking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.holiday_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view holiday settings" ON public.holiday_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert holiday settings" ON public.holiday_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update holiday settings" ON public.holiday_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete holiday settings" ON public.holiday_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_holiday_settings_updated_at BEFORE UPDATE ON public.holiday_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.holiday_settings (holiday_desc, display_name, category, show_in_calendar, blocks_booking) VALUES
('Pesach I', 'פסח א׳', 'major', true, true),
('Pesach II', 'פסח ב׳', 'major', true, true),
('Pesach VII', 'שביעי של פסח', 'major', true, true),
('Pesach VIII', 'אחרון של פסח', 'major', true, true),
('Shavuot', 'שבועות', 'major', true, true),
('Shavuot I', 'שבועות א׳', 'major', true, true),
('Shavuot II', 'שבועות ב׳', 'major', true, true),
('Sukkot I', 'סוכות א׳', 'major', true, true),
('Sukkot II', 'סוכות ב׳', 'major', true, true),
('Shmini Atzeret', 'שמיני עצרת', 'major', true, true),
('Simchat Torah', 'שמחת תורה', 'major', true, true),
('Rosh Hashana', 'ראש השנה', 'major', true, true),
('Rosh Hashana I', 'ראש השנה א׳', 'major', true, true),
('Rosh Hashana II', 'ראש השנה ב׳', 'major', true, true),
('Yom Kippur', 'יום כיפור', 'major', true, true),
('Erev Pesach', 'ערב פסח', 'erev', true, false),
('Erev Shavuot', 'ערב שבועות', 'erev', true, false),
('Erev Sukkot', 'ערב סוכות', 'erev', true, false),
('Erev Rosh Hashana', 'ערב ראש השנה', 'erev', true, false),
('Erev Yom Kippur', 'ערב יום כיפור', 'erev', true, false),
('Erev Purim', 'ערב פורים', 'erev', true, false),
('Erev Tish''a B''Av', 'ערב תשעה באב', 'erev', true, false),
('Pesach III (CH''M)', 'חוה״מ פסח', 'cholhamoed', true, false),
('Pesach IV (CH''M)', 'חוה״מ פסח', 'cholhamoed', true, false),
('Pesach V (CH''M)', 'חוה״מ פסח', 'cholhamoed', true, false),
('Pesach VI (CH''M)', 'חוה״מ פסח', 'cholhamoed', true, false),
('Sukkot III (CH''M)', 'חוה״מ סוכות', 'cholhamoed', true, false),
('Sukkot IV (CH''M)', 'חוה״מ סוכות', 'cholhamoed', true, false),
('Sukkot V (CH''M)', 'חוה״מ סוכות', 'cholhamoed', true, false),
('Sukkot VI (CH''M)', 'חוה״מ סוכות', 'cholhamoed', true, false),
('Sukkot VII (Hoshana Raba)', 'הושענא רבה', 'cholhamoed', true, false),
('Tish''a B''Av', 'תשעה באב', 'fast', true, true),
('Tzom Gedaliah', 'צום גדליה', 'fast', true, true),
('Asara B''Tevet', 'עשרה בטבת', 'fast', true, true),
('Tzom Tammuz', 'צום י״ז בתמוז', 'fast', true, true),
('Purim', 'פורים', 'rabbinic', true, false),
('Shushan Purim', 'שושן פורים', 'rabbinic', true, false),
('Tu BiShvat', 'ט״ו בשבט', 'rabbinic', true, false),
('Lag BaOmer', 'ל״ג בעומר', 'rabbinic', true, false),
('Chanukah: 1 Candle', 'חנוכה - נר 1', 'rabbinic', true, false),
('Chanukah: 2 Candles', 'חנוכה - נר 2', 'rabbinic', true, false),
('Chanukah: 3 Candles', 'חנוכה - נר 3', 'rabbinic', true, false),
('Chanukah: 4 Candles', 'חנוכה - נר 4', 'rabbinic', true, false),
('Chanukah: 5 Candles', 'חנוכה - נר 5', 'rabbinic', true, false),
('Chanukah: 6 Candles', 'חנוכה - נר 6', 'rabbinic', true, false),
('Chanukah: 7 Candles', 'חנוכה - נר 7', 'rabbinic', true, false),
('Chanukah: 8 Candles', 'חנוכה - נר 8', 'rabbinic', true, false),
('Chanukah: 8th Day', 'חנוכה - יום שמיני', 'rabbinic', true, false),
('Yom HaAtzma''ut', 'יום העצמאות', 'modern', true, false),
('Yom HaZikaron', 'יום הזיכרון', 'modern', true, false),
('Yom HaShoah', 'יום השואה', 'modern', true, false),
('Yom Yerushalayim', 'יום ירושלים', 'modern', true, false),
('Rosh Chodesh Nisan', 'ראש חודש ניסן', 'rosh_chodesh', false, false),
('Rosh Chodesh Iyyar', 'ראש חודש אייר', 'rosh_chodesh', false, false),
('Rosh Chodesh Sivan', 'ראש חודש סיוון', 'rosh_chodesh', false, false),
('Rosh Chodesh Tamuz', 'ראש חודש תמוז', 'rosh_chodesh', false, false),
('Rosh Chodesh Av', 'ראש חודש אב', 'rosh_chodesh', false, false),
('Rosh Chodesh Elul', 'ראש חודש אלול', 'rosh_chodesh', false, false),
('Rosh Chodesh Cheshvan', 'ראש חודש חשוון', 'rosh_chodesh', false, false),
('Rosh Chodesh Kislev', 'ראש חודש כסלו', 'rosh_chodesh', false, false),
('Rosh Chodesh Tevet', 'ראש חודש טבת', 'rosh_chodesh', false, false),
('Rosh Chodesh Sh''vat', 'ראש חודש שבט', 'rosh_chodesh', false, false),
('Rosh Chodesh Adar', 'ראש חודש אדר', 'rosh_chodesh', false, false),
('Rosh Chodesh Adar I', 'ראש חודש אדר א׳', 'rosh_chodesh', false, false),
('Rosh Chodesh Adar II', 'ראש חודש אדר ב׳', 'rosh_chodesh', false, false)
ON CONFLICT (holiday_desc) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_holiday_settings()
RETURNS TABLE(holiday_desc TEXT, display_name TEXT, category TEXT, show_in_calendar BOOLEAN, blocks_booking BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT holiday_desc, display_name, category, show_in_calendar, blocks_booking FROM public.holiday_settings;
$$;

ALTER TABLE public.treatment_price_tiers RENAME COLUMN price_per_minute TO total_price;

ALTER TABLE public.treatments ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
WITH ordered AS (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS rn FROM public.treatments)
UPDATE public.treatments t SET display_order = ordered.rn FROM ordered WHERE t.id = ordered.id;

CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));