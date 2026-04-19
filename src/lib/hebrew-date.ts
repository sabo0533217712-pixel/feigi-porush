import { greg, abs2hebrew } from '@hebcal/hdate';
import { HebrewCalendar, HDate, flags } from '@hebcal/core';

export interface HolidayInfo {
  name: string;
  isMajor: boolean;
  isErev: boolean;
  isCholHamoed: boolean;
  /** True if this day should block client booking (major holidays, fasts, Yom HaAtzmaut) */
  blocksBooking: boolean;
}

// Whitelist of holiday descriptors (English getDesc()) we want to display.
// Anything not in this list (Rosh Chodesh, modern memorials, Omer, Special Shabbat, etc.) is hidden.
const ALLOWED_DESCS = new Set<string>([
  // Three Pilgrimage festivals — Pesach
  'Erev Pesach', 'Pesach I', 'Pesach II', 'Pesach III (CH\'\'M)', 'Pesach IV (CH\'\'M)',
  'Pesach V (CH\'\'M)', 'Pesach VI (CH\'\'M)', 'Pesach VII', 'Pesach VIII',
  // Shavuot
  'Erev Shavuot', 'Shavuot', 'Shavuot I', 'Shavuot II',
  // Sukkot + Shmini Atzeret / Simchat Torah
  'Erev Sukkot', 'Sukkot I', 'Sukkot II',
  'Sukkot III (CH\'\'M)', 'Sukkot IV (CH\'\'M)', 'Sukkot V (CH\'\'M)',
  'Sukkot VI (CH\'\'M)', 'Sukkot VII (Hoshana Raba)',
  'Shmini Atzeret', 'Simchat Torah',
  // High Holy Days
  'Erev Rosh Hashana', 'Rosh Hashana', 'Rosh Hashana I', 'Rosh Hashana II',
  'Erev Yom Kippur', 'Yom Kippur',
  // Rabbinic holidays
  'Chanukah: 1 Candle', 'Chanukah: 2 Candles', 'Chanukah: 3 Candles',
  'Chanukah: 4 Candles', 'Chanukah: 5 Candles', 'Chanukah: 6 Candles',
  'Chanukah: 7 Candles', 'Chanukah: 8 Candles', 'Chanukah: 8th Day',
  'Purim', 'Shushan Purim', 'Erev Purim',
  'Tu BiShvat', 'Lag BaOmer',
  // Major fast
  'Tish\'a B\'Av', 'Erev Tish\'a B\'Av',
  // Minor fasts (requested)
  'Tzom Gedaliah', 'Asara B\'Tevet', 'Tzom Tammuz',
  // Modern (requested)
  'Yom HaAtzma\'ut',
]);

// Days that block clients from booking appointments.
const BOOKING_BLOCKED_DESCS = new Set<string>([
  // Yom Tov (full festival days where work is forbidden)
  'Pesach I', 'Pesach II', 'Pesach VII', 'Pesach VIII',
  'Shavuot', 'Shavuot I', 'Shavuot II',
  'Sukkot I', 'Sukkot II', 'Shmini Atzeret', 'Simchat Torah',
  'Rosh Hashana', 'Rosh Hashana I', 'Rosh Hashana II',
  'Yom Kippur',
  // Fasts
  'Tish\'a B\'Av', 'Tzom Gedaliah', 'Asara B\'Tevet', 'Tzom Tammuz',
  // National holiday
  'Yom HaAtzma\'ut',
]);

export function getHolidayInfo(date: Date): HolidayInfo | null {
  try {
    const hd = new HDate(date);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
    if (!events.length) return null;
    // Filter to whitelisted holidays only
    const filtered = events.filter((ev) => ALLOWED_DESCS.has(ev.getDesc()));
    if (!filtered.length) return null;
    // Prefer most significant (yom tov first)
    const sorted = [...filtered].sort((a, b) => {
      const aMajor = (a.getFlags() & flags.CHAG) ? 1 : 0;
      const bMajor = (b.getFlags() & flags.CHAG) ? 1 : 0;
      return bMajor - aMajor;
    });
    const ev = sorted[0];
    const f = ev.getFlags();
    const desc = ev.getDesc();
    const isMajor = !!(f & flags.CHAG);
    const isErev = !!(f & flags.EREV);
    const isCholHamoed = !!(f & flags.CHOL_HAMOED);
    const blocksBooking = BOOKING_BLOCKED_DESCS.has(desc);
    let name = '';
    try {
      name = ev.render('he-x-NoNikud') || ev.render('he') || desc;
    } catch {
      name = desc;
    }
    return { name, isMajor, isErev, isCholHamoed, blocksBooking };
  } catch {
    return null;
  }
}

/** Returns true if clients should be blocked from booking on this date due to a holiday/fast. */
export function isBookingBlockedDay(date: Date): boolean {
  const info = getHolidayInfo(date);
  return !!info?.blocksBooking;
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
