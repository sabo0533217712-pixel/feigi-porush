# תיקון תצוגת מובייל

## תיקונים שיבוצעו

### 1. מסך "חגים ומועדים" (`src/pages/admin/HolidaySettings.tsx`)
הוספת תוויות זעירות מתחת לכל סוויץ' במובייל (`text-[10px] text-muted-foreground sm:hidden`) כדי שיהיה ברור מי "הצג בלוח" ומי "חסום הזמנה". הכותרות העליונות נשארות לדסקטופ.

### 2. אינדיקטור שלבים בהזמנה (`src/pages/ClientBooking.tsx`, שורה ~701)
הסרת `hidden sm:inline` מתוויות "טיפול / מועד / אישור" כדי שיופיעו גם במובייל. הקטנה במובייל: `text-xs sm:text-sm`.

### 3. תמיכה ב-safe area של אייפון
- `src/components/AppLayout.tsx`: הוספת `pb-[env(safe-area-inset-bottom)]` לניווט התחתון, והחלפת `pb-20` ב-`pb-[calc(5rem+env(safe-area-inset-bottom))]` ב-`<main>`.
- `index.html`: הוספת `viewport-fit=cover` ל-meta viewport.

## קבצים שישתנו
1. `src/pages/admin/HolidaySettings.tsx`
2. `src/pages/ClientBooking.tsx`
3. `src/components/AppLayout.tsx`
4. `index.html`

ללא שינויי DB וללא שינוי לוגיקה — שינויי CSS/presentation בלבד.
סעיף טבלת הלקוחות בלוח הבקרה הוסר לפי בקשתך.
