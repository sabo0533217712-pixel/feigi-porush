## עדכון קובץ המיגרציה של holiday_settings

### 1) עדכון `supabase/migrations/20260505194349_...sql`

החלף את בלוק ה־`INSERT INTO public.holiday_settings ...` כך שישקף את המצב הנוכחי בפועל בטבלה (53 רשומות, אחרי האיחוד של חוה״מ ומחיקת חגי גלות):

- **להסיר** מהסיד את הרשומות שאינן קיימות יותר במסד:
  - `Pesach II`, `Pesach VIII`
  - `Shavuot I`, `Shavuot II`
  - `Sukkot II`
  - `Simchat Torah`
  - `Pesach III/IV/V/VI (CH''M)` (4 שורות)
  - `Sukkot III/IV/V/VI (CH''M)` (4 שורות)

- **להוסיף** את שתי שורות האיחוד:
  - `('Pesach Chol HaMoed', 'חול המועד פסח', 'cholhamoed', true, true)`
  - `('Sukkot Chol HaMoed', 'חול המועד סוכות', 'cholhamoed', true, false)`

- **לעדכן שם תצוגה**:
  - `Shmini Atzeret` → `'שמיני עצרת / שמחת תורה'`

- **לעדכן ראשי חודש** ל־`show_in_calendar = true` (כפי שהם במסד כיום).

תוצאה: 53 שורות סיד שתואמות בדיוק למה שמופיע ב־`holiday_settings` כרגע.

### 2) בדיקת חוסר התאמות נוספים בין הקוד/DB לבין `supabase/`

עברתי על המיגרציות והשוויתי לסכמה הנוכחית — לא נמצאו אי־התאמות מבניות נוספות. השינוי היחיד שאינו כתוב כמיגרציית סיד הוא תוכן הטבלה `holiday_settings` (תוקן בסעיף 1).

הערה: המיגרציה `20260519074913_...sql` (שדרוג `verify_security_answer` לתמיכה בערכי plaintext ישנים) כבר קיימת ותואמת לפונקציה במסד — אין צורך בשינוי שם.

### פירוט טכני

- הקובץ היחיד שישתנה: `supabase/migrations/20260505194349_467661f9-ebfc-4531-8d1b-136b452f326d.sql` — רק בלוק ה־`VALUES` בתוך ה־`INSERT` (שורות ~20-86). שאר הקובץ (יצירת טבלה, RLS, טריגר, פונקציית `get_holiday_settings`, ושינויי `treatment_price_tiers`/`treatments`/`profiles`) נשאר כמו שהוא.
- ה־`ON CONFLICT (holiday_desc) DO NOTHING` נשמר, כך שהרצה חוזרת על מסד קיים לא תדרוס נתונים ידניים.
