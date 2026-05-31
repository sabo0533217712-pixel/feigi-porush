# סידור טיפולים לפי display_order ביומן האדמין

כיום, כשהאדמין קובעת תור ובוחרת סוג טיפול, רשימת הטיפולים מגיעה ללא סידור מפורש – לכן הסדר לא תואם את הסדר שנקבע במסך "ניהול טיפולים" (גרירה ושחרור ששומרת `display_order`).

## השינוי

קובץ: `src/pages/admin/AdminCalendar.tsx`, פונקציה `fetchTreatments` (סביב שורה 276).

החלפת השאילתה כך שתוסיף מיון לפי `display_order` (ואז לפי `created_at` כגיבוי, כמו במסך הטיפולים):

```ts
const { data } = await supabase
  .from("treatments")
  .select("id, name, color, duration_minutes, price, is_variable_duration, display_order")
  .eq("is_active", true)
  .order("display_order", { ascending: true })
  .order("created_at", { ascending: true });
```

זה הכל. אין שינוי ב-DB, אין שינוי בלוגיקה, אין שינוי במסכי הלקוח – רק סדר התצוגה בבורר הטיפול ב-Dialog של קביעת תור (וגם בכל מקום אחר ב-`AdminCalendar` שמשתמש ב-`treatments`, כי כולם קוראים מאותו state).
