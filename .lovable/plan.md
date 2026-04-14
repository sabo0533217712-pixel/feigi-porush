

# תיקון פרטי לקוחה חסרים (טלפון ואימייל)

## הבעיה

1. **טלפון ריק בפרופילים** — ה-trigger `handle_new_user` שומר רק `full_name` אבל לא את `phone`, למרות שהלקוחה מזינה טלפון בהרשמה. כל הפרופילים במסד הנתונים מכילים טלפון ריק.
2. **אין עמודת אימייל בפרופילים** — האימייל נמצא רק ב-`auth.users` ולא נגיש דרך ה-SDK הרגיל.

## שינויים נדרשים

### 1. Migration — תיקון trigger + הוספת עמודת email
- הוספת עמודת `email` (text, nullable) לטבלת `profiles`
- עדכון ה-trigger `handle_new_user` כך שיכתוב גם `phone` (מ-`raw_user_meta_data`) וגם `email` (מ-`NEW.email`)
- עדכון חד-פעמי של כל הפרופילים הקיימים: משיכת phone מ-`raw_user_meta_data` ו-email מ-`auth.users`

### 2. AdminCalendar.tsx
- עדכון ה-type של `Appointment.profiles` לכלול `email`
- עדכון ה-queries של profiles לכלול `email`
- הצגת האימייל בחלונית פרטי לקוחה ובמסך עריכת תור
- שימוש באימייל האמיתי בכפתור המייל

### 3. קבצים שישתנו

| קובץ | שינוי |
|---|---|
| Migration SQL | הוספת עמודת email, תיקון trigger, עדכון נתונים קיימים |
| `AdminCalendar.tsx` | הוספת email ל-types ול-queries, הצגה ב-UI |

