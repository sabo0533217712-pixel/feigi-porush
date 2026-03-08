import { greg, abs2hebrew } from '@hebcal/hdate';

const HEBREW_MONTHS = [
  '', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳'
];

const HEBREW_DAYS = [
  '', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳',
  'י׳', 'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט',
  'כ׳', 'כ״א', 'כ״ב', 'כ״ג', 'כ״ד', 'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל׳'
];

export function getHebrewDate(date: Date): string {
  const abs = greg.greg2abs(date);
  const hd = abs2hebrew(abs);
  const dayStr = HEBREW_DAYS[hd.dd] || String(hd.dd);
  const monthStr = HEBREW_MONTHS[hd.mm] || '';
  return `${dayStr} ${monthStr} ${gematriaYear(hd.yy)}`;
}

export function getHebrewDateShort(date: Date): string {
  const abs = greg.greg2abs(date);
  const hd = abs2hebrew(abs);
  const dayStr = HEBREW_DAYS[hd.dd] || String(hd.dd);
  const monthStr = HEBREW_MONTHS[hd.mm] || '';
  return `${dayStr} ${monthStr}`;
}

function gematriaYear(year: number): string {
  // Return last 3 digits in Hebrew gematria format  
  const shortYear = year % 1000;
  return `תש${getGematriaLetters(shortYear % 100)}`;
}

function getGematriaLetters(num: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  
  if (num === 15) return '״ו';
  if (num === 16) return '״ז';
  
  const t = Math.floor(num / 10);
  const o = num % 10;
  
  if (o === 0) return tens[t] + '״';
  return tens[t] + '״' + ones[o];
}
