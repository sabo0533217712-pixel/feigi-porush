## שינויים מתוכננים

### 1. קולאפס סגור כברירת מחדל במסך הגדרות
ב-`src/pages/admin/AdminSettings.tsx` להחליף את `defaultValue={["business","schedule",...]}` ב-`defaultValue={[]}` כך שכל הסקשנים יהיו סגורים בעת טעינת המסך.

### 2. שחזור סיסמה במסך הכניסה
ב-`src/pages/Auth.tsx` להוסיף קישור "שכחתי סיסמה" מתחת לטופס ההתחברות שיפתח דיאלוג קטן (Dialog) המבקש מייל, ושולח קישור איפוס באמצעות:
```ts
supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?reset=true` })
```
בנוסף ניצור עמוד/מצב חדש: כאשר המשתמש חוזר עם token (event `PASSWORD_RECOVERY`), נציג טופס "סיסמה חדשה" שקורא ל-`supabase.auth.updateUser({ password })`.

### 3. זמן חיץ (buffer) בין תורים — ניתן להגדרה
**Backend (migration):**
- להוסיף עמודה `appointment_buffer_minutes integer NOT NULL DEFAULT 5` לטבלה `business_settings`.
- לעדכן את הפונקציה `get_public_business_settings` כך שתחזיר גם שדה זה.
- לעדכן את `check_appointment_overlap` להתחשב ב-buffer: בעת בדיקת חפיפה, להשוות מול `end_time + buffer` של תורים קיימים (או להזיז את הסוף בעת ההכנסה — נעדיף לוגיקת בדיקה כי אז נתוני התור עצמו נשארים נקיים והבאפר הוא רק חיץ).

**גישה מועדפת:** לאחסן את `end_time` כפי שהוא (זמן הטיפול בפועל), ולהוסיף את ה-buffer בכל מקום שמחשב סלוטים פנויים / חפיפות:
- `check_appointment_overlap`: בעת חישוב חפיפה להוסיף את ה-buffer בשני הצדדים.
- `get_busy_slots`: להחזיר את `end_time + buffer` כסוף "תפוס" כדי שהקליינט יראה אותו כתפוס.

**Frontend:**
- `AdminSettings.tsx` — להוסיף שדה "דקות חיץ בין תורים" בסקשן "הגדרות תורים".
- `ClientBooking.tsx` — בחישוב `getAvailableSlots` להוסיף את ה-buffer לסוף כל תור תפוס.
- `AdminCalendar.tsx` — בעת הצגה ויצירת תור חדש להחיל אותה לוגיקה.

### קבצים שיתעדכנו
- `supabase/migrations/...` (חדש) — עמודה + עדכון פונקציות
- `src/pages/admin/AdminSettings.tsx`
- `src/pages/Auth.tsx`
- `src/pages/ClientBooking.tsx`
- `src/pages/admin/AdminCalendar.tsx`
