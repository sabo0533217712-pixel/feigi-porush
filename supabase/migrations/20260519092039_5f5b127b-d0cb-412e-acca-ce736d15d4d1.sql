-- Sync holiday_settings to the canonical 53-row Israel-only state.
-- Safe to run on environments that already match — it's an upsert + filtered delete.

INSERT INTO public.holiday_settings (holiday_desc, display_name, category, show_in_calendar, blocks_booking) VALUES
('Pesach I', 'פסח א׳', 'major', true, true),
('Pesach VII', 'שביעי של פסח', 'major', true, true),
('Shavuot', 'שבועות', 'major', true, true),
('Sukkot I', 'סוכות א׳', 'major', true, true),
('Shmini Atzeret', 'שמיני עצרת / שמחת תורה', 'major', true, true),
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
('Pesach Chol HaMoed', 'חול המועד פסח', 'cholhamoed', true, true),
('Sukkot Chol HaMoed', 'חול המועד סוכות', 'cholhamoed', true, false),
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
('Rosh Chodesh Nisan', 'ראש חודש ניסן', 'rosh_chodesh', true, false),
('Rosh Chodesh Iyyar', 'ראש חודש אייר', 'rosh_chodesh', true, false),
('Rosh Chodesh Sivan', 'ראש חודש סיוון', 'rosh_chodesh', true, false),
('Rosh Chodesh Tamuz', 'ראש חודש תמוז', 'rosh_chodesh', true, false),
('Rosh Chodesh Av', 'ראש חודש אב', 'rosh_chodesh', true, false),
('Rosh Chodesh Elul', 'ראש חודש אלול', 'rosh_chodesh', true, false),
('Rosh Chodesh Cheshvan', 'ראש חודש חשוון', 'rosh_chodesh', true, false),
('Rosh Chodesh Kislev', 'ראש חודש כסלו', 'rosh_chodesh', true, false),
('Rosh Chodesh Tevet', 'ראש חודש טבת', 'rosh_chodesh', true, false),
('Rosh Chodesh Sh''vat', 'ראש חודש שבט', 'rosh_chodesh', true, false),
('Rosh Chodesh Adar', 'ראש חודש אדר', 'rosh_chodesh', true, false),
('Rosh Chodesh Adar I', 'ראש חודש אדר א׳', 'rosh_chodesh', true, false),
('Rosh Chodesh Adar II', 'ראש חודש אדר ב׳', 'rosh_chodesh', true, false)
ON CONFLICT (holiday_desc) DO UPDATE
SET display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    show_in_calendar = EXCLUDED.show_in_calendar,
    blocks_booking = EXCLUDED.blocks_booking,
    updated_at = now();

-- Remove obsolete diaspora-only rows and per-day Chol HaMoed rows that were
-- consolidated into Pesach Chol HaMoed / Sukkot Chol HaMoed.
DELETE FROM public.holiday_settings
WHERE holiday_desc IN (
  'Pesach II', 'Pesach VIII',
  'Shavuot I', 'Shavuot II',
  'Sukkot II', 'Simchat Torah',
  'Pesach III (CH''M)', 'Pesach IV (CH''M)', 'Pesach V (CH''M)', 'Pesach VI (CH''M)',
  'Sukkot III (CH''M)', 'Sukkot IV (CH''M)', 'Sukkot V (CH''M)', 'Sukkot VI (CH''M)'
);