## מטרה
החלפת ה-fetch הידני ב-`AdminCalendar.tsx` ל-React Query, **בלי שינוי לוגיקה עסקית**, עם שיפור הטיפול ב-race conditions. ביצוע בשני שלבים נפרדים.

## קווים אדומים
1. אין שינוי בלוגיקה עסקית (חפיפות, overrides, validations, redirects, toasts).
2. אין שינוי ב-`ClientBooking.tsx` (טיפול בכמה לקוחות בו-זמנית נשאר).
3. אין שינוי ב-DB / RLS / Edge Functions.
4. שינוי מקומי לקובץ אחד: `src/pages/admin/AdminCalendar.tsx`.

---

## שלב 1 — החלפה בסיסית ל-React Query (ללא prefetch)

### 1.1 הוספת `useQuery`
```ts
const dateKey = format(selectedDate, 'yyyy-MM-dd');

const { data: dayData, isLoading: isDayLoading } = useQuery({
  queryKey: ['admin-day', dateKey],
  queryFn: async ({ signal }) => {
    // אותן 3 קריאות בדיוק מ-fetchDayData הקיים:
    //   appointments + time_blocks + extra_shifts
    // כל אחת עם .abortSignal(signal)
    // אותו merge ל-Appointment[] — מילה במילה
    return { appointments, timeBlocks, extraShifts };
  },
  staleTime: 30_000,
  gcTime: 5 * 60_000,
});

const appointments = dayData?.appointments ?? [];
const timeBlocks   = dayData?.timeBlocks   ?? [];
const extraShifts  = dayData?.extraShifts  ?? [];
```

### 1.2 החלפת כל קריאה ל-`fetchDayData()` ב:
```ts
queryClient.invalidateQueries({
  queryKey: ['admin-day', dateKey],
  refetchType: 'active',   // רק היום שנצפה עכשיו, לא ה-cache כולו
});
```
כל ~10 המיקומים (יצירה / ביטול / חסימה / הזזה / realtime). **התנאים, הסדר, ה-toasts, ה-validations וה-redirects לא משתנים.**

### 1.3 מה נמחק
- `useState` עבור `appointments`, `timeBlocks`, `extraShifts`, `isDayLoading`.
- הפונקציה `fetchDayData` וה-`useEffect` שמפעיל אותה.

### 1.4 מה לא משתנה
- `daySchedule` (מחושב מ-`extraShifts`).
- מיזוג `appointments + timeBlocks` ל-`Appointment[]`.
- Realtime subscription — נשאר; ה-callback קורא ל-`invalidateQueries` במקום `fetchDayData`.
- כל ה-mutations — קוד זהה לחלוטין, רק השורה הסוגרת מוחלפת.
- ה-skeleton/spinner הקיים — נשאר, עם `isDayLoading` מ-React Query.

### 1.5 בדיקות לפני מעבר לשלב 2
1. מעבר ימים → ← → ← מהיר — אין הבהוב, אין נתונים מיום קודם.
2. יצירת תור → מופיע מיד.
3. ביטול תור → נעלם מיד.
4. חסימת זמן → מופיעה מיד.
5. הזזת תור → מתעדכנת מיד.
6. Realtime: שינוי מטלפון → מתעדכן באדמין.
7. ClientBooking: שתי הזמנות במקביל — עדיין נחסם ע"י הקוד הקיים שם.

**רק אחרי שכל 7 הבדיקות עוברות — עוברים לשלב 2.**

---

## שלב 2 — Prefetch ליום קודם/הבא

```ts
useEffect(() => {
  const t = setTimeout(() => {
    [addDays(selectedDate, 1), addDays(selectedDate, -1)].forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      queryClient.prefetchQuery({
        queryKey: ['admin-day', key],
        queryFn: ...,           // אותו queryFn כמו בשלב 1
        staleTime: 30_000,
      });
    });
  }, 300);
  return () => clearTimeout(t);
}, [selectedDate]);
```

### בדיקות שלב 2
1. כל בדיקות שלב 1 ממשיכות לעבוד.
2. לחיצה על "→" אחרי 300ms = מיידי (ללא spinner).
3. אין בקשות מיותרות בכלי הפיתוח כשנעמדים על יום.

---

## סיכון
**נמוך.** שינוי מקומי לקובץ אחד, ללא DB, ללא מסך לקוחה. ה-race conditions משתפרים (queryKey-per-date + AbortController + dedup).
