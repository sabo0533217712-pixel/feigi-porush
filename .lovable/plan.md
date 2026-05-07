## תכנית שינויים

### 1) כפתור WhatsApp בפופאפ "פרטי לקוחה" (יצירת קשר)
ב-`AdminCalendar.tsx` בדיאלוג `showClientInfo` (סביב שורות 1289–1390) מוצגים כפתורי "התקשרי / SMS / מייל". הוספת כפתור WhatsApp ירוק (כמו בדיאלוג הצעת תור מרשימת המתנה — שורות 1421–1431), עם נרמול מספר ל-`972XXXXXXXXX` (חיתוך 0 קידומת אם יש).

### 2) שעת סיום מתעדכנת אוטומטית בעריכת תור
בדיאלוג עריכת תור (שורות 1186–1205) ה-`onChange` של "שעת התחלה" רק מעדכן את `start_time`. שינוי: בעת שינוי שעת ההתחלה — חישוב משך התור הקיים (`end_time - start_time` של ה-`editForm` הנוכחי) והגדרת `end_time` חדש בהתאם, כך שהמשך נשמר. שינוי שעת הסיום ידנית עדיין יישאר כפי שהוא.

### 3) טקסט בעת קביעת תור + פופאפ ללקוחה
- **הגדרות**: ב-`AdminSettings.tsx` בכרטיס "טקסטים מותאמים" (שורה 495) הוספת שדה `Textarea` חדש `booking_confirmation` עם תווית "טקסט בעת קביעת תור" (ברירת מחדל: "ניתן לבטל עד 24 שעות לפני התור"). נשמר ל-`custom_texts.booking_confirmation` בטבלת `business_settings` (לא נדרש שינוי סכמה — `custom_texts` הוא jsonb).
- **לקוחה**: ב-`ClientBooking.tsx` כרגע יש שלב `success` (שורה 1041). הוספת `Dialog` שיוצג מיד לאחר הצלחת `setStep("success")` ומציג את הטקסט שהאדמין הגדירה (אם קיים). הדיאלוג ייסגר בלחיצה על "אישור" והמשתמשת תישאר במסך ה-success הקיים.
- טעינת `custom_texts` קיימת כבר דרך הגדרות ה-business — נוודא שהשדה נטען.

### 4) חיפוש טקסטואלי בבחירת לקוחה (אדמין → תור חדש)
בדיאלוג "קביעת תור חדש" (שורות 977–994), החלפת ה-`Select` הפשוט של לקוחה ב-`Popover` + `Command` (`@/components/ui/command` קיים) כך שניתן להקליד שם/טלפון/מייל ולסנן את `profiles` בזמן אמת. שמירה על אותו `bookForm.client_id` כתוצאה.

### 5) "הוספת משמרת" באותו יום
**DB**: טבלה חדשה `extra_shifts`:
```
id uuid pk default gen_random_uuid()
shift_date date not null
start_time time not null
end_time time not null
notes text default ''
created_at timestamptz default now()
```
RLS: `SELECT` ל-`authenticated` (לקוחות צריכות לראות כדי שהזמינות תיפתח), `INSERT/UPDATE/DELETE` רק לאדמין (`has_role`).

**UI אדמין** (`AdminCalendar.tsx`, סביב שורות 677–699):
- כפתור שלישי "הוספת משמרת" בשורת הפעולות של ה-Timeline.
- דיאלוג חדש `showShiftDialog` עם שעת התחלה / סיום / הערה, שמירה ל-`extra_shifts` עבור `selectedDate`.
- ב-`fetchDayData` הוספת `extra_shifts` לתאריך, והרחבת `daySchedule` כך ששעות הציר (`startHour`/`endHour`) יכסו גם את טווח המשמרות הנוספות. תצוגה ויזואלית של המשמרת ברצועת רקע עדינה (למשל ירקרק) על ה-timeline, עם כפתור מחיקה.

**UI לקוחה** (`ClientBooking.tsx`, `getAvailableSlots` בשורה 181 ו-`fetchMoreDays` בשורה ~494):
- שליפת `extra_shifts` לתאריך הרלוונטי.
- אלגוריתם הסלוטים יורחב כך שלכל יום יחושבו טווחי עבודה = [טווח רגיל מ-`day_schedules`/`start_time`/`end_time`] ∪ [כל המשמרות הנוספות לאותו יום]. הסלוטים נוצרים בכל אחד מהטווחים, תוך שמירה על אותה לוגיקת חסימות/הפסקות/תורים תפוסים.
- בדיקת ימי עבודה (`working_days`): אם יש משמרת נוספת ביום שאינו רגיל — היום ייפתח להזמנה רק לטווח של המשמרת.

### 6) כפתור "חזרה ליומן" בתצוגת היום
ב-`Dialog` של ה-Timeline (שורה 667) הוספת כפתור-אייקון קטן (`CalendarIcon`) ב-`DialogHeader` משמאל לכותרת, שב-onClick מבצע `setShowTimeline(false)` — סוגר את התצוגה וחושף את היומן החודשי שמתחת.

---

## קבצים שיתעדכנו / יווצרו
- חדש: `supabase/migrations/<timestamp>_extra_shifts.sql` (טבלה + RLS)
- עריכה: `src/pages/admin/AdminCalendar.tsx` (סעיפים 1, 2, 4, 5, 6)
- עריכה: `src/pages/admin/AdminSettings.tsx` (סעיף 3 — שדה טקסט חדש)
- עריכה: `src/pages/ClientBooking.tsx` (סעיף 3 — פופאפ; סעיף 5 — שילוב משמרות נוספות בלוגיקת הסלוטים)

## הערות
- אין שינוי בלוגיקת התראות, חגים, תמחור או UI כללי שלא הוזכר.
- הטבלה `extra_shifts` לא משפיעה על `check_appointment_overlap` הקיים — בדיקת חפיפה בין תורים נשארת זהה; המשמרת רק מרחיבה את חלון הזמינות שמוצג ללקוחה.
- כפתור החיפוש (סעיף 4) משתמש ברכיבי `Command` הקיימים ב-shadcn — אין צורך בהתקנות נוספות.
