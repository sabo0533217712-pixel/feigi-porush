## אבחון

מצאתי שתי בעיות נפרדות, ולא — זה לא קשור ל-React Query (בקובץ `ClientBooking.tsx` בכלל אין שימוש ב-React Query).

### בעיה 1: ה-Realtime ל-`business_settings` לא עובד בכלל
בדקתי את ה-publication של Realtime במסד הנתונים:
```
supabase_realtime → appointments, time_blocks, extra_shifts
```
**`business_settings` לא נמצא ב-publication.** לכן ה-`useEffect` החדש שהוספנו אף פעם לא מקבל אירוע — לא משנה איזה קוד נכתוב בצד הלקוח, ה-Postgres פשוט לא משדר את השינויים. אותו דבר ככל הנראה ל-`holiday_settings`.

### בעיה 2: השרת לא חוסם הזמנה שמתנגשת עם הפסקה / חסימת זמן
ה-trigger הקיים `check_appointment_overlap` בודק **רק** התנגשות מול תורים אחרים. הוא לא בודק:
- חסימות ב-`time_blocks` (הפסקות חד-פעמיות שהאדמין מוסיפה ליום ספציפי)
- הפסקות קבועות ב-`business_settings.day_schedules`

לכן גם אם הלקוחה רואה ב-UI את ההפסקה, ויש מצב מרוץ (race) שהיא בחרה שעה רגע לפני שהאדמין שמרה את ההפסקה — ה-`INSERT` עובר ללא בעיה. זו ההתנהגות שתיארת ("ניסיתי לקבוע תור, בדיוק בשעה הזו האדמין הגדירה הפסקה, והוא נתן").

---

## הפתרון

### שינוי 1 — Migration: הוספת טבלאות ל-publication של Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holiday_settings;
ALTER TABLE public.business_settings REPLICA IDENTITY FULL;
ALTER TABLE public.holiday_settings REPLICA IDENTITY FULL;
```
זה מה שגורם ל-Realtime לשדר UPDATE/INSERT/DELETE על הטבלאות הללו. בלי זה, הקוד בצד הלקוח שכבר קיים פשוט לא מקבל אירועים.

### שינוי 2 — Migration: הרחבת `check_appointment_overlap`
הוספת בדיקות בתוך אותו trigger קיים (ללא קריאות נוספות מהקליינט, ללא איטיות מורגשת):
1. בדיקת חפיפה מול `time_blocks` ליום הרלוונטי.
2. בדיקת חפיפה מול ההפסקות ב-`business_settings.day_schedules` ליום בשבוע הרלוונטי (וגם `break_start`/`break_end` הישנים כ-fallback).
3. כמו היום — מי שמזמינה היא אדמין (`booked_by_admin = true`), הבדיקה מדולגת (האדמין מורשית לדרוס).

תוצאה: גם אם יש race condition, ה-`INSERT` ייכשל בשרת והלקוחה תקבל הודעה ("השעה כבר אינה זמינה") במקום שהתור ייכנס.

### שינוי 3 — שיפור הודעת שגיאה ב-UI (אופציונלי, נקודתי)
ב-`handleBook` ב-`ClientBooking.tsx`: אם השרת מחזיר שגיאת חפיפה (הודעה מכילה "already booked" / "break" / "blocked"), להציג טוסט בעברית ולרענן את ה-slots אוטומטית במקום השגיאה הגנרית. **זה לא משנה לוגיקה עסקית, רק חוויית משתמש.**

---

## השפעה על הביצועים בפרודקשן

| שינוי | עלות |
|---|---|
| הוספת 2 טבלאות ל-publication | Realtime כבר רץ; שינויים ב-business_settings/holiday_settings נדירים מאוד (פעולות אדמין בלבד). זניח. |
| הרחבת ה-trigger | שאילתות מקומיות על אותה רשומת `business_settings` (LIMIT 1) ועל `time_blocks` עם אינדקס על `block_date`. תוספת מילישניות ספורות בלבד פר-`INSERT`. |
| שינוי UI | אפס השפעה על השרת. |

## מה לא נוגעים בו

- אין שינוי ב-RLS, אין שינוי ב-RPC קיימות, אין שינוי ב-edge functions.
- הלוגיקה של חישוב ה-slots בצד הלקוח (`getAvailableSlots`) נשארת זהה.
- כל המנגנון הקיים ל-`appointments`/`extra_shifts`/`time_schedules` שעובד — לא נוגעים בו.

מאשרת לעבור ל-Build?
