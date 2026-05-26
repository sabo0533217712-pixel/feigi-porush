## הבעיה
שינויים שהאדמין עושה ב־`business_settings` (ימי עבודה, שעות פתיחה/סגירה, הפסקה, `day_schedules`, `slot_duration`, וכו') לא משתקפים אצל לקוחות פתוחים בדף ההזמנה — רק לאחר רענון. כיום ה־Realtime ב־`src/pages/ClientBooking.tsx` מאזין רק ל־`appointments`, `time_blocks`, ו־`extra_shifts`.

## הפתרון — שינוי נקודתי אחד
קובץ יחיד: **`src/pages/ClientBooking.tsx`** (Frontend בלבד, ללא DB/RPC/Backend).

### הוספת ערוץ Realtime נפרד ל־`business_settings`
מכיוון שההגדרות גלובליות (לא תלויות ב־`selectedDate`), נוסיף `useEffect` נפרד שרץ פעם אחת לכל חיי הקומפוננטה:

```tsx
useEffect(() => {
  const channel = supabase
    .channel("client-booking-settings-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "business_settings" }, () => {
      fetchSettings();
      fetchConfirmationText();
      if (selectedDateRef.current) fetchBookedSlots(selectedDateRef.current);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

### שימוש ב־`useRef` לתאריך הנבחר
כדי שה־callback של הערוץ יקרא תמיד את התאריך העדכני בלי לפתוח ולסגור את הערוץ בכל שינוי תאריך:
```tsx
const selectedDateRef = useRef<Date | undefined>(selectedDate);
useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
```

### למה לא לצרף לערוץ הקיים?
הערוץ הקיים נפתח/נסגר בכל בחירת תאריך (`[selectedDate]`). ערוץ נפרד ל־`business_settings` נשאר יציב לאורך כל הסשן — פחות overhead של פתיחה/סגירת subscriptions.

## השפעה על הביצועים בפרודקשן
- **ערוץ Realtime יחיד נוסף** לכל לקוח פתוח — עלות זניחה (Supabase Realtime מוקצה ממילא).
- **הקריאות `fetchSettings`/`fetchConfirmationText` רצות רק כשאדמין משנה הגדרות** (אירוע נדיר ביותר), לא בפולינג.
- **אין שינוי במבני נתונים, אינדקסים, או queries** — אותו עומס DB.
- **ה־`useRef` חוסך re-subscribe** בכל שינוי תאריך — שיפור קל לעומת חלופה נאיבית.

## מה לא משתנה
- שום קריאת DB, RPC, RLS, או edge function.
- שום לוגיקה עסקית, חישוב slots, או UI.
- אין נגיעה בלוגיקה של `appointments`/`time_blocks`/`extra_shifts` שכבר עובדת.

מאשרת ואעבור למצב Build?