# הגדרת טווח שעות לתצוגת היומן (אדמין בלבד)

מטרה: בעלת העסק תוכל לראות ביומן הניהול טווח שעות רחב יותר משעות העבודה (לדוגמה 07:00–23:00), כדי שתוכל לקבוע תורים גם מחוצה להן. **אין שום שינוי בלוגיקה** – זו תוספת תצוגתית בלבד.

## 1. SQL (כבר רץ)

```sql
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS calendar_view_start time NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS calendar_view_end   time NOT NULL DEFAULT '22:00';
```

זה הכל בצד ה-DB. אין שינוי בפונקציות, ב-RLS, בטריגרים או בחישובי החפיפה (`check_appointment_overlap`, `get_busy_slots`).

## 2. מסך הגדרות אדמין (`AdminSettings.tsx`)

ב-state של `settings` נוספים `calendar_view_start` ו-`calendar_view_end`, נטענים ונשמרים יחד עם שאר ההגדרות.

בראש האקורדיון של **"ימי ושעות עבודה"** – בלוק חדש, לפני רשימת הימים:

- כותרת קטנה: "טווח תצוגת היומן (לך בלבד)"
- שני שדות `type="time"` בגריד `grid-cols-2 gap-3`: "מ-" ו-"עד-"
- טקסט עזר ב-`text-xs text-muted-foreground`: "השעות שמוצגות ללקוחות נקבעות לפי שעות העבודה למטה."

עיצוב באייפון: אותו pattern קיים של inputs (`h-10 text-sm`, `dir="ltr"`) שכבר עובד היום במסך הזה – ה-`font-size:16px` של iOS כבר מטופל ב-`index.css`.

## 3. יומן אדמין (`AdminCalendar.tsx`)

א. הרחבת ה-`BusinessSettings` interface ב-`calendar_view_start?: string` ו-`calendar_view_end?: string`, והוספתם ל-`select(...)` ב-`fetchSettings`.

ב. ב-`daySchedule` (סביב שורה 390):
- נחשב `workStartHour`/`workEndHour` – שעות העבודה האמיתיות של היום (כמו היום, כולל הרחבה למשמרות).
- נחשב `startHour`/`endHour` הסופיים = ה-`min/max` בין שעות העבודה לבין `calendar_view_start/end`. כך השעות הנוספות מופיעות מעל/מתחת לשעות העבודה, אבל אם המשמרת רחבה יותר מטווח התצוגה – לא נחתוך אותה.
- מחזירים את `workStartHour`/`workEndHour` בנוסף, לשימוש בסימון.

ג. בתוך ה-`timeline` (שורה ~851), לפני שורות השעות, מוסיפים שכבת רקע עדינה לשעות שמחוץ ל-`workStartHour..workEndHour`:
```tsx
<div className="absolute inset-x-0 pointer-events-none bg-muted/40"
     style={{ top: 0, height: (workStartHour - startHour) * HOUR_HEIGHT }} />
<div className="absolute inset-x-0 pointer-events-none bg-muted/40"
     style={{ top: (workEndHour - startHour) * HOUR_HEIGHT,
              height: (endHour - workEndHour) * HOUR_HEIGHT }} />
```
הקליק על שורות השעה נשאר עובד (השכבה `pointer-events-none`), כך שהאדמין יכולה ללחוץ עליהן ולקבוע תור גם בשעות "מחוץ לעבודה". זה מתאפשר כי לוגיקת `check_appointment_overlap` כבר מאפשרת לאדמין לעקוף (`booked_by_admin = true`) – ללא שינוי בלוגיקה.

ד. ה-`RescheduleView` (העברת תור קיים) נשאר כמו שהוא – הוא משתמש בשעות העבודה לצורך חישוב חלונות פנויים, וזו לוגיקה שלא ניגעים בה.

## 4. רספונסיביות לאייפון

- בלוק ההגדרה משתמש ב-`grid grid-cols-2 gap-3` – אותו pattern של שעות פתיחה/סגירה הקיים, שכבר נבדק על מובייל.
- השכבה האפורה ביומן היא `absolute inset-x-0` – נצמדת לרוחב הקיים של ה-timeline, ללא overflow.

## 5. מה לא משתנה (חשוב!)

- `ClientBooking.tsx`, `get_public_business_settings`, חישובי סלוטים, חסימות זמן, משמרות נוספות – כולם זהים.
- שעות שמוצגות ללקוחות = שעות העבודה הקבועות בלבד.
- הטריגרים בבסיס הנתונים – ללא שינוי.
