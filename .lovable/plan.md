# הוספת תזכורות אישיות + שיפור קונטרסט בטיימליין

## 1. טבלה חדשה ב-DB: `personal_reminders`

טבלה נפרדת לתזכורות אישיות של האדמין. **לא משפיעה על לוגיקת זמינות, חפיפות או חסימות** — מוצגת רק ביומן האדמין.

עמודות: `id`, `reminder_date` (date), `start_time` (time), `end_time` (time), `notes` (text), `created_at`.

RLS: רק אדמין (`has_role(auth.uid(), 'admin')`) יכול לקרוא/לכתוב/למחוק. GRANT ל-`authenticated` ול-`service_role`.

**חשוב:** הטריגר `check_appointment_overlap` ופונקציית `get_busy_slots` **לא ייגעו** — תזכורות לא חוסמות תורים, השעות נשארות זמינות ללקוחות.

## 2. שינויים ב-`AdminCalendar.tsx`

### כפתור חדש בתצוגת היום
ליד "חסימת זמן" — כפתור "תזכורת אישית" עם אייקון `Bell`. פותח Dialog במבנה זהה לפופאפ חסימת זמן (שעת התחלה, שעת סיום, הערה). מותאם לאייפון.

### Dialog חדש
בעת שמירה — `INSERT` ל-`personal_reminders` עם התאריך הנבחר. בלי שום בדיקת חפיפה.

### תצוגה בטיימליין — עיצוב מובחן
הוספת fetch ל-`personal_reminders` ליום הנבחר ורינדור על הטיימליין בעיצוב **שונה ויזואלית מתורים רגילים ומחסימות**:
- צבע ייעודי (גוון ענברי/חרדל רך — לדוגמה רקע `bg-amber-100/60 dark:bg-amber-500/15`, border שמאלי `border-l-4 border-amber-500`, טקסט `text-amber-900 dark:text-amber-100`).
- אייקון פעמון (`Bell`) בתחילת הכרטיס + תווית "תזכורת" קטנה.
- עיצוב שונה מתור (שהוא צבעוני לפי טיפול) ומחסימה (שהיא אפורה/מקווקוות).
- כפתור מחיקה (X) למחיקה מהירה.
- שעות התזכורת **לא נחשבות כתפוסות** ללקוחות.

## 3. שיפור קונטרסט בטיימליין

- שעות בציר הזמן (hour labels): מ-`text-muted-foreground` ל-`text-foreground` (או `text-foreground/85`).
- טקסט בתוך כרטיסי התורים (שעה, שם לקוחה, טיפול): שדרוג ל-`text-foreground` במקום `text-muted-foreground`/אופציות בהירות.

## פרטים טכניים

**SQL migration:**
```sql
CREATE TABLE public.personal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_reminders TO authenticated;
GRANT ALL ON public.personal_reminders TO service_role;

ALTER TABLE public.personal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage personal reminders"
ON public.personal_reminders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_personal_reminders_date ON public.personal_reminders(reminder_date);
```

## קבצים שייערכו
- `supabase/migrations/<new>.sql` — יצירת טבלה
- `src/pages/admin/AdminCalendar.tsx` — כפתור, Dialog, fetch, רינדור בעיצוב ענברי, החלפת צבעי טקסט
