

## הבקשה
1. **תזכורות**: SMS → WhatsApp (הרשמה + פרופיל)
2. **Webhook לבעלת העסק** (Make.com): נשלח רק בעת קביעת תור חדש על ידי לקוחה
3. **Webhook ללקוחה** (Make.com): נשלח בכל אירוע — קביעה (לקוחה/אדמין), שינוי, ביטול — בפורמט JSON אחיד הכולל ערוץ נשלח (email/whatsapp לפי העדפה)

## ארכיטקטורה
שני Edge Functions ייעודיים שנקראים מהפרונט אחרי כל פעולה רלוונטית:

```text
notify-business  →  https://hook.eu1.make.com/y1ydq0w5onkccb38lhk88yd5k50sukce
notify-client    →  https://hook.eu1.make.com/5lldnxtw86mvk9d1a17o249wtt267v8u
```

**למה Edge Functions ולא קריאה ישירה מהדפדפן?**
- מסתיר את כתובת הוובוק מהקליינט
- מאפשר טעינת פרטי לקוחה/טיפול מלאים מצד-שרת (גם כשאדמין פועל על תור של מישהו אחר)
- בונה תאריך עברי + מקבץ הכל ל-JSON אחיד

## מבנה JSON אחיד (לשני הוובוקים)

```json
{
  "event": "appointment_created",            // created | rescheduled | cancelled
  "title": "נקבע לך תור בהצלחה",             // כותרת בעברית מתאימה לאירוע
  "actor": "client",                          // client | admin (מי ביצע את הפעולה)
  "channel": "whatsapp",                      // email | whatsapp (ל-notify-client בלבד; לפי reminder_preference)
  "client": {
    "full_name": "...",
    "phone": "...",
    "email": "..."
  },
  "appointment": {
    "id": "uuid",
    "date_gregorian": "2026-04-22",
    "date_hebrew": "ה׳ באייר תשפ״ו",
    "start_time": "10:00",
    "end_time": "10:45",
    "duration_minutes": 45,
    "treatment_name": "פנים מלא",
    "notes": "...",
    "previous": {                             // יופיע רק ב-rescheduled
      "date_gregorian": "...",
      "date_hebrew": "...",
      "start_time": "...",
      "end_time": "..."
    }
  }
}
```

## מטריצת אירועים → וובוקים

| מי פעל | פעולה | notify-business | notify-client |
|---|---|---|---|
| לקוחה | קביעת תור | ✅ "נקבע תור בהצלחה" | ✅ "התור נקבע בהצלחה" |
| אדמין | קביעת תור | — | ✅ "נקבע לך תור בהצלחה" |
| אדמין | שינוי תור (תאריך/שעה) | — | ✅ "תור שלך עודכן" + previous |
| אדמין | ביטול תור | — | ✅ "תור שלך בוטל" |

## כותרות מדויקות
- `client_created` → "התור נקבע בהצלחה"
- `admin_created` → "נקבע לך תור בהצלחה"
- `admin_rescheduled` → "התור שלך הועבר למועד חדש"
- `admin_cancelled` → "התור שלך בוטל"
- (ל-notify-business) → "נקבע תור בהצלחה"

## קבצים שיתעדכנו / יווצרו

### חדשים
- `supabase/functions/notify-business/index.ts` — מקבל `appointment_id`, טוען מה-DB את כל הפרטים (לקוחה + טיפול), בונה JSON, שולח ל-Make
- `supabase/functions/notify-client/index.ts` — מקבל `appointment_id` + `event` + `actor` + `previous?`, טוען פרטי לקוחה והעדפת תזכורות (email/whatsapp), שולח ל-Make
- `supabase/config.toml` — הגדרת `verify_jwt = false` עבור שתי הפונקציות (קריאה פנימית מהקליינט עם ה-anon key מספיקה; ולידציה של appointment_id מצד-שרת)

### עדכונים
- `src/pages/ClientBooking.tsx` — אחרי `handleBook` מוצלח: לקרוא ל-`notify-business` + `notify-client` עם `event: "created", actor: "client"`
- `src/pages/admin/AdminCalendar.tsx`:
  - אחרי קביעת תור (שורה ~387): `notify-client` עם `actor: "admin", event: "created"`
  - אחרי `handleEditSave` (שורה ~444): אם השעה/התאריך השתנו → `notify-client` עם `event: "rescheduled"` + previous
  - אחרי `handleAdminCancel` (שורה ~462): `notify-client` עם `event: "cancelled"`
  - אחרי `handleMoveToSlot` (שורה ~485): `notify-client` עם `event: "rescheduled"` + previous
- `src/pages/ClientProfile.tsx` (שורות 136-140): שינוי תווית "SMS" → "WhatsApp", value `sms` → `whatsapp`, אייקון → `MessageCircle`
- `src/hooks/useAuth.tsx` (signUp): הוספת `reminder_preference: 'whatsapp'` ל-meta OR עדכון `handle_new_user` trigger
- **מיגרציה**: עדכון `handle_new_user` כך שתשבץ `reminder_preference = 'whatsapp'` כברירת מחדל לרשומות פרופיל חדשות; וכן עדכון רשומות קיימות שערכן 'sms' → 'whatsapp'

## הערות טכניות
- שתי הפונקציות יעבדו ללא JWT (`verify_jwt = false`) — קריאה אנונימית מותרת. הן מקבלות רק `appointment_id` ושולפות מה-DB עם `service_role`, כך שהקליינט לא מזריק נתונים רגישים.
- כשלון בשליחת וובוק לא יחסום את הפעולה ב-UI (נשתמש ב-`.catch(console.error)` ולא ב-`await` חוסם, או נציג טוסט אזהרה רך).
- התאריך העברי נבנה בפונקציה עם `@hebcal/hdate` — נשכפל את הלוגיקה הקיימת מ-`src/lib/hebrew-date.ts` בתוך ה-Edge Function (אין import חוצה גבולות).

