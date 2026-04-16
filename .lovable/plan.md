
## הבעיה
שתי לקוחות מצליחות לקבוע תור על אותה שעה במקביל. הטריגר `check_appointment_overlap` קיים אבל לא מסונכרן בין טרנזקציות מקבילות — שתי בקשות INSERT שרצות בו-זמנית עוברות את בדיקת ה-EXISTS לפני ש-COMMIT של אחת מהן הסתיים.

## הפתרון
הוספת **Advisory Lock** ברמת התאריך בתוך הפונקציה `check_appointment_overlap()`. זה מבטיח שכל בקשת הזמנה לאותו תאריך תחכה בתור עד שהקודמת תסיים — וכך הבדיקה השנייה תראה את ההזמנה הראשונה ותיכשל כראוי.

### שינוי במסד הנתונים (מיגרציה)
עדכון הפונקציה `check_appointment_overlap()`:

```sql
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.booked_by_admin = true THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent bookings on the same date
  PERFORM pg_advisory_xact_lock(
    hashtext('appointment_date_' || NEW.appointment_date::text)
  );

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointment_date = NEW.appointment_date
      AND status = 'confirmed'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
      AND (
        (NEW.start_time >= start_time AND NEW.start_time < end_time)
        OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
        OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Time slot is already booked';
  END IF;
  RETURN NEW;
END;
$$;
```

### בנוסף — וידוא שהטריגר באמת מחובר
בבדיקה ראיתי ש-`<db-triggers>` מציין "There are no triggers in the database" — מה שאומר שהפונקציה קיימת אבל **הטריגר עצמו לא מחובר לטבלה**! זה למעשה הסיבה האמיתית שכלום לא חוסם. צריך להוסיף:

```sql
DROP TRIGGER IF EXISTS check_appointment_overlap_trigger ON public.appointments;
CREATE TRIGGER check_appointment_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_overlap();
```

## תוצאה
- כל ניסיון הזמנה לאותו תאריך יסונכרן ברמת מסד הנתונים
- הלקוחה השנייה תקבל את ההודעה "השעה הזו כבר נתפסה על ידי לקוחה אחרת" (הטיפול בצד הלקוח כבר קיים ב-`ClientBooking.tsx`)
- בעלת העסק לא תוכל לקבל שני תורים על אותה שעה לעולם
