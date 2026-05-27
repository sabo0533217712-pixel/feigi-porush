## מטרה

ניקוי אוטומטי חודשי של נתונים מעל גיל שנה, כולל רשומות מקושרות, כדי שהמסד לא יתפח.

## מתי זה רץ

ב־1 לכל חודש בלילה (02:00 שעון ישראל / 00:00 UTC) — משימת `pg_cron`.

## מה נמחק

כל הרשומות שתאריכן ישן מ־`now() - interval '1 year'`:

| טבלה | תנאי מחיקה |
|------|------------|
| `appointments` | `appointment_date < today - 1 year` |
| `appointment_treatments` | מקושר ל־appointment שנמחק |
| `reminder_log` | מקושר ל־appointment שנמחק |
| `time_blocks` | `block_date < today - 1 year` |
| `extra_shifts` | `shift_date < today - 1 year` |
| `webhook_events` | `created_at < today - 1 year` (ניקוי כללי, מתפחים מהר) |

`appointment_treatments` ו־`reminder_log` יימחקו **לפני** ה־appointments כדי שלא יישארו יתומים (אין FK cascade בטבלאות האלה).

## איך זה ייושם

1. **Migration**: פונקציה חדשה `public.cleanup_old_records()` (SECURITY DEFINER, search_path=public) שמבצעת את ה־DELETE-ים בסדר הנכון בתוך טרנזקציה אחת.
2. **Cron job** דרך כלי insert (לא migration, כי תלוי ב־project ref/anon key): `cron.schedule('cleanup-old-records', '0 0 1 * *', $$ SELECT public.cleanup_old_records(); $$)` — קריאה ישירה ל־SQL, ללא net.http_post (לא צריך edge function כי הכל ב־DB).

## הערות

- **המחיקה בלתי הפיכה.** אין שחזור לרשומות שנמחקו.
- אם בעתיד תרצי לשמור תקופה אחרת (שנתיים, חצי שנה) — שינוי של מספר אחד בפונקציה.
- הריצה הראשונה תהיה ב־1.7.2026; אם תרצי שגם תתבצע ריצה ראשונית מיידית על הנתונים הקיימים — אפשר להוסיף.
