## תכנית שינויים

### 1) ניהול חגים בהגדרות אדמין
**מצב נוכחי:** רשימת חגים מוגדרת קשיח בקוד (`src/lib/hebrew-date.ts`) — `ALLOWED_DESCS` (תצוגה) ו-`BOOKING_BLOCKED_DESCS` (חסימת הזמנות).

**שינוי:**
- טבלה חדשה `holiday_settings` ב-DB:
  - `desc` (PK, text) — שם פנימי באנגלית של החג מ-hebcal
  - `display_name` (text) — שם בעברית להצגה (נקבע אוטומטית בעת ה-seed)
  - `show_in_calendar` (bool, default true)
  - `blocks_booking` (bool, default לפי הקבוצה הקיימת)
  - `category` (text) — לקיבוץ בתצוגה: 'major' / 'erev' / 'cholhamoed' / 'minor_fast' / 'modern' / 'rabbinic' / 'rosh_chodesh'
- Seed ראשוני שמכניס את כל החגים הקיימים + ראשי חודש (`Rosh Chodesh *`).
- RLS: כולם רואים (`SELECT` ל-public), רק אדמין `INSERT/UPDATE/DELETE`.
- פונקציה `get_holiday_settings()` (security definer) לטעינה מהירה ב-client.

**שינויי קוד:**
- `src/lib/hebrew-date.ts`: `getHolidayInfo` יקבל אופציונלית `settings` (Map of desc→{show, blocks}). אם לא סופק — fallback להתנהגות הקיימת.
- `useHolidaySettings` hook (`src/hooks/useHolidaySettings.tsx`) — טוען פעם אחת ב-app, חושף Map. רענון ע"י realtime או חזרה ל-mount.
- `ClientBooking.tsx` ו-`AdminCalendar.tsx`: שימוש ב-hook להעברת ההגדרות ל-`getHolidayInfo`/`isBookingBlockedDay`.
- `AdminSettings.tsx`: כרטיס חדש "ניהול חגים ומועדים" — רשימה מקובצת לפי category, כל שורה עם שני Switch: "הצג בלוח שנה" + "חסום הזמנה". שמירה לכל שינוי או כפתור שמירה גלובלי.
- `supabase/functions/send-reminders/index.ts`: לקרוא את הטבלה במקום הסט הקבוע.

### 2) עריכה ומחיקה של לקוחות בלוח בקרה
**מצב נוכחי:** טבלת לקוחות קיימת ב-`AdminDashboard.tsx` — תצוגה בלבד.

**שינוי:**
- כפתור "עריכה" → Dialog עם שדות `full_name`, `phone`, `email`, `reminder_preference`. שמירה דרך update ל-`profiles`.
- כפתור "מחיקה" עם `AlertDialog` אישור. מחיקה מוחקת את המשתמש מ-`auth.users` (cascade ל-profiles ויתר הטבלאות).
  - טכני: edge function חדשה `delete-user` (verify_jwt + בדיקת `has_role(admin)` בתוך ה-function דרך service role) שמבצעת `admin.deleteUser(userId)`. לא ניתן למחוק auth users ישירות מה-client.
- הוספת RLS policies על `profiles`: `Admins can update/delete profiles`. ועל `user_roles` כבר קיים.

### 3) תמחור גמיש = מחיר סופי לטווח (לא פר-דקה)
**מצב נוכחי:** `treatment_price_tiers` עם `price_per_minute`. החישוב ב-`ClientBooking.tsx`: `Math.round(price_per_minute * minutes)`. בחירת משך — dropdown של כל מכפלות 5 עד 120 דק'.

**שינוי:**
- migration: rename `price_per_minute` → `total_price` (numeric). או הוספת עמודה חדשה ושמירת תאימות. אבחר ב-rename — שום קוד חוץ נוסף משתמש בה.
- `AdminTreatments.tsx`:
  - תווית התווית מ"₪ לדקה" ל"מחיר סה"כ (₪)".
  - שדה `price_per_minute` בטופס → `total_price`.
- `ClientBooking.tsx`:
  - `calculateTierPrice` יחזיר `tier.total_price` (לא כפל).
  - **בחירת משך** — במקום dropdown של כל 5 דק', הצגת רשימת הטווחים שהוגדרו (כל tier = אופציה אחת = `min-max דק' • ₪total_price`). הלקוחה תבחר טווח, ו-`variableDurations[t.id]` יוגדר ל-`max_minutes` של הטווח שנבחר (כדי לתפוס את כל הזמן בלוח).
- עדכון `PriceTier` interface בכל הקבצים.

### 4) הצגת תיאור טיפול ללקוחה
**שינוי ב-`ClientBooking.tsx`:**
- הוספת `description` ל-interface `Treatment`.
- הצגתו מתחת ל-`{t.name}` בכרטיס הטיפול (`<p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>` כשקיים).

### 5) גרירת סדר טיפולים
**שינוי DB:** הוספת עמודה `display_order` (int, default 0) לטבלת `treatments`. כל הטיפולים הקיימים יקבלו ערך לפי `created_at`.

**ספריה:** התקנת `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

**`AdminTreatments.tsx`:**
- עטיפת רשימת הטיפולים ב-`DndContext` + `SortableContext`.
- כל כרטיס הופך ל-`SortableItem` עם ידית גרירה (אייקון `GripVertical` משמאל).
- בסיום גרירה — חישוב מחדש של `display_order` לכל הטיפולים שהושפעו, update ב-DB.
- ב-`fetchTreatments`: `.order('display_order', { ascending: true })`.

**`ClientBooking.tsx`:**
- `fetchTreatments`: `.order('display_order', { ascending: true })`.

### קבצים שיתעדכנו / יווצרו
- חדש: `supabase/migrations/<timestamp>_holidays_and_treatment_changes.sql`
- חדש: `supabase/functions/delete-user/index.ts` + ערך ב-`supabase/config.toml`
- חדש: `src/hooks/useHolidaySettings.tsx`
- עריכה: `src/lib/hebrew-date.ts`, `src/pages/ClientBooking.tsx`, `src/pages/admin/AdminSettings.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/AdminTreatments.tsx`, `src/pages/admin/AdminCalendar.tsx`, `supabase/functions/send-reminders/index.ts`
- התקנה: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### הערות
- שום שינוי בלוגיקת זמינות, התראות, או UI כללי שלא מוזכר.
- ה-rename של `price_per_minute` ל-`total_price` הוא שינוי שובר; וידאתי שאין שימוש נוסף בקוד.
- מחיקת לקוח מחיקה מלאה (auth + cascade). ניתן בעתיד לעבור ל-soft delete אם נדרש.
