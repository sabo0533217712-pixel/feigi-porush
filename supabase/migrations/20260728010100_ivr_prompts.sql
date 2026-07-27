-- Recording path for each treatment's spoken name in the IVR (recorded by the business,
-- uploaded to ימות המשיח, referenced by path — no TTS). A treatment without a path set
-- will not be offered over the phone.
alter table public.treatments add column if not exists ivr_recording_path text;

-- Script/paths for every fixed IVR prompt. `key` is referenced from the ivr-api edge
-- function code; `script_text` is the exact text to record; `path` is filled in by the
-- business after recording + uploading to ימות המשיח (via the admin screen).
create table public.ivr_prompts (
  key text primary key,
  category text not null,
  label text not null,
  script_text text not null,
  path text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ivr_prompts enable row level security;

create policy "Admins can view ivr prompts"
  on public.ivr_prompts for select
  using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can update ivr prompts"
  on public.ivr_prompts for update
  using (public.has_role(auth.uid(), 'admin'::app_role));

create trigger update_ivr_prompts_updated_at
  before update on public.ivr_prompts
  for each row execute function public.update_updated_at_column();

insert into public.ivr_prompts (key, category, label, script_text, sort_order) values
  ('press_word', 'connectors', 'מילת "הקישי" — לפני כל מספר בחירה דינמי', 'הקישי', 10),
  ('on_date_word', 'connectors', 'מילת "בתאריך" — לפני תאריך דינמי', 'בתאריך', 20),
  ('at_time_word', 'connectors', 'מילת "בשעה" — לפני שעה דינמית', 'בשעה', 30),
  ('and_word', 'connectors', 'מילית חיבור "ו" — לחיבור שמות טיפולים ברשימה', 'ו', 40),

  ('menu.welcome', 'menu', 'ברכת פתיחה', 'שלום, הגעת אל [שם העסק].', 100),
  ('menu.main_options', 'menu', 'תפריט ראשי', 'לקביעת תור הקישי 1. לביטול תור הקישי 2. לשמיעת התורים שלך הקישי 3.', 110),
  ('menu.invalid_input', 'menu', 'קלט לא תקין', 'לא הבנתי את הבחירה, נסי שוב.', 120),
  ('menu.timeout', 'menu', 'לא התקבל קלט', 'לא התקבל קלט, נסי שוב.', 130),
  ('menu.generic_error', 'menu', 'שגיאה כללית', 'מצטערים, אירעה תקלה זמנית. אנא נסי להתקשר שוב מאוחר יותר. להתראות.', 140),
  ('menu.max_attempts', 'menu', 'יותר מדי ניסיונות שגויים', 'לא הצלחנו לזהות את הבחירה שלך. להתראות.', 150),

  ('treatment.intro', 'treatment', 'פתיח לבחירת טיפול', 'כעת נבחר את סוג הטיפול.', 200),
  ('treatment.more_options', 'treatment', 'עוד אפשרויות טיפולים', 'לעוד אפשרויות הקישי 9.', 210),
  ('treatment.phone_only_notice', 'treatment', 'הודעת טיפול טלפוני בלבד', 'שימי לב, טיפול זה ניתן לקביעה בהזמנה טלפונית בלבד.', 220),
  ('treatment.ask_variable_duration', 'treatment', 'בקשת משך זמן לטיפול גמיש', 'טיפול זה הוא במשך גמיש. הקישי את מספר הדקות הרצוי, בין 5 ל-120 דקות.', 230),
  ('treatment.duration_invalid', 'treatment', 'משך זמן לא תקין', 'משך הזמן שהוקש אינו תקין, נסי שוב.', 240),
  ('treatment.add_another', 'treatment', 'הצעה להוסיף טיפול נוסף', 'להוספת טיפול נוסף לאותו תור הקישי 1. להמשך לקביעת תאריך הקישי 2.', 250),

  ('nearest.intro_prefix', 'nearest', 'פתיח להצעת התור הקרוב ביותר', 'מצאתי עבורך תור פנוי הכי קרוב, ל', 300),
  ('nearest.options', 'nearest', 'אפשרויות אחרי הצעת התור הקרוב', 'לקביעת התור הזה הקישי 1. לשמיעת אפשרות נוספת הקישי 2. לבחירת תאריך אחר בעצמך הקישי 3.', 310),
  ('nearest.no_more_options', 'nearest', 'אין עוד אפשרויות קרובות', 'אין אפשרויות נוספות זמינות בטווח הקרוב. נסי לבחור תאריך בעצמך.', 320),

  ('manual_date.ask', 'manual_date', 'בקשת תאריך ידני', 'הקישי את התאריך הרצוי: שתי ספרות ליום ושתי ספרות לחודש. לדוגמה, ל-15 באוגוסט הקישי 1508.', 400),
  ('manual_date.invalid', 'manual_date', 'תאריך לא תקין', 'התאריך שהוקש אינו תקין, או שאינו בטווח ההזמנה האפשרי. נסי שוב.', 410),
  ('manual_date.no_slots', 'manual_date', 'אין שעות פנויות בתאריך שנבחר', 'אין תורים פנויים בתאריך שבחרת.', 420),
  ('manual_date.chosen_prefix', 'manual_date', 'פתיח לפני הקראת התאריך שנבחר', 'בחרת בתאריך', 430),
  ('manual_time.intro', 'manual_date', 'פתיח לרשימת שעות פנויות', 'השעות הפנויות ביום זה הן:', 440),
  ('manual_time.more_options', 'manual_date', 'עוד שעות פנויות', 'לשמיעת שעות נוספות הקישי 9.', 450),

  ('confirm.prefix', 'confirm', 'פתיח לסיכום ההזמנה', 'לסיכום, קבעת את הטיפולים:', 500),
  ('confirm.options', 'confirm', 'אפשרויות אישור/ביטול', 'לאישור התור הקישי 1. לביטול וחזרה הקישי 2.', 510),
  ('confirm.slot_taken', 'confirm', 'השעה נתפסה בינתיים', 'מצטערים, השעה הזו נתפסה ממש עכשיו. נחפש עבורך תור חדש.', 520),
  ('booking.success', 'confirm', 'הצלחה בקביעת תור', 'התור שלך נקבע בהצלחה! מחכות לך. להתראות!', 530),
  ('booking.failed', 'confirm', 'כשלון בקביעת תור', 'אירעה שגיאה בקביעת התור. אנא נסי שוב מאוחר יותר. להתראות.', 540),

  ('cancel.none_found', 'cancel', 'לא נמצאו תורים לביטול', 'לא נמצאו תורים עתידיים במספר הטלפון הזה. להתראות.', 600),
  ('cancel.list_intro', 'cancel', 'פתיח לרשימת תורים לביטול', 'אלו התורים הקרובים שלך:', 610),
  ('cancel.confirm_prompt', 'cancel', 'אישור ביטול', 'לאישור ביטול התור הזה הקישי 1. לחזרה לרשימה הקישי 2.', 620),
  ('cancel.success', 'cancel', 'ביטול הצליח', 'התור בוטל בהצלחה. להתראות.', 630),

  ('hear.list_intro', 'hear', 'פתיח לשמיעת תורים קיימים', 'אלו התורים הקרובים שלך:', 700),
  ('hear.none_found', 'hear', 'לא נמצאו תורים לשמיעה', 'לא נמצאו תורים עתידיים במספר הטלפון הזה. להתראות.', 710),
  ('hear.outro', 'hear', 'סיום שמיעת תורים', 'זהו, אלו כל התורים הקרובים שלך. להתראות.', 720)
on conflict (key) do nothing;
