## הבעיה

בלחיצה על יום בלוח השנה, כל הקריאות לשרת (`appointments`, `time_blocks`, `extra_shifts`, `profiles`) רצות **פעמיים**. זה לא בעיה ב-Realtime — זו כפילות מובנית בקוד.

### למה זה קורה
ב-`src/pages/admin/AdminCalendar.tsx` יש שני `useEffect` שמגיבים לשינוי `selectedDate`:

1. **שורה 163-165** — `useEffect([selectedDate])` קורא ישירות ל-`fetchDayData()`.
2. **שורה 179-232** — `useEffect([selectedDate, currentMonth])` יוצר ערוץ Realtime חדש, וב-callback של `SUBSCRIBED` (שורה 213-216) קורא ל-`refreshAll()` שקורא שוב ל-`fetchDayData()` + `fetchMonthCounts()`.

מכאן ה-4 קריאות הכפולות בכל מעבר יום, וגם `fetchMonthCounts` כפול (גם מ-`useEffect([currentMonth])` בשורה 167 וגם מה-SUBSCRIBED).

## השינוי

קובץ אחד: `src/pages/admin/AdminCalendar.tsx`

**להסיר את הקריאה ל-`refreshAll()` מתוך ה-`SUBSCRIBED` callback** (שורות 213-217). הטעינה הראשונית כבר נעשית ע"י ה-`useEffect` הייעודיים (`[selectedDate]` ו-`[currentMonth]`), אז אין צורך לטעון מחדש מתוך ה-subscribe.

לפני:
```ts
.subscribe((status) => {
  if (status === "SUBSCRIBED") {
    refreshAll();
  }
});
```

אחרי:
```ts
.subscribe();
```

`refreshAll` עדיין נחוץ ל-`visibilitychange` (חזרה ללשונית), אז הוא נשאר מוגדר.

## תוצאה

- לחיצה על יום: **4 קריאות במקום 8** (חיסכון 50%).
- Realtime ממשיך לעדכן בזמן אמת כשמשהו משתנה.
- רענון בחזרה ללשונית ממשיך לעבוד.
- שום פונקציונליות לא משתנה.
