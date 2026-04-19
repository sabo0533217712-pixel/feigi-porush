import { greg, abs2hebrew } from '@hebcal/hdate';
import { HebrewCalendar, HDate, flags } from '@hebcal/core';

export interface HolidayInfo {
  name: string;
  isMajor: boolean;
  isErev: boolean;
  isCholHamoed: boolean;
}

export function getHolidayInfo(date: Date): HolidayInfo | null {
  try {
    const hd = new HDate(date);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
    if (!events.length) return null;
    // Prefer the most significant event (yom tov first)
    const sorted = [...events].sort((a, b) => {
      const aMajor = (a.getFlags() & flags.CHAG) ? 1 : 0;
      const bMajor = (b.getFlags() & flags.CHAG) ? 1 : 0;
      return bMajor - aMajor;
    });
    const ev = sorted[0];
    const f = ev.getFlags();
    const isMajor = !!(f & flags.CHAG);
    const isErev = !!(f & flags.EREV);
    const isCholHamoed = !!(f & flags.CHOL_HAMOED);
    let name = '';
    try {
      name = ev.render('he-x-NoNikud') || ev.render('he') || ev.getDesc();
    } catch {
      name = ev.getDesc();
    }
    return { name, isMajor, isErev, isCholHamoed };
  } catch {
    return null;
  }
}

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
