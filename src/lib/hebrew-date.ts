import { greg, abs2hebrew } from '@hebcal/hdate';
import { HebrewCalendar, HDate, flags } from '@hebcal/core';
import { getCachedHolidaySettings, type HolidaySettingsMap } from '@/hooks/useHolidaySettings';

export interface HolidayInfo {
  name: string;
  isMajor: boolean;
  isErev: boolean;
  isCholHamoed: boolean;
  /** True if this day should block client booking */
  blocksBooking: boolean;
  desc: string;
}

// Fallback defaults if DB settings haven't loaded yet
// Israel-only holiday observance (diaspora-only days like Pesach II/VIII, Shavuot II,
// Sukkot II, Simchat Torah are intentionally excluded).
const FALLBACK_BLOCKED = new Set<string>([
  'Pesach I', 'Pesach VII',
  'Shavuot',
  'Sukkot I', 'Shmini Atzeret',
  'Rosh Hashana', 'Rosh Hashana I', 'Rosh Hashana II',
  'Yom Kippur',
  'Tish\'a B\'Av', 'Tzom Gedaliah', 'Asara B\'Tevet', 'Tzom Tammuz',
]);

// Holidays that exist only in the diaspora — always ignored, even if hebcal returns them.
const DIASPORA_ONLY = new Set<string>([
  'Pesach II', 'Pesach VIII',
  'Shavuot I', 'Shavuot II',
  'Sukkot II', 'Simchat Torah',
]);

// Map individual Chol HaMoed day descs (as returned by hebcal) to an aggregate
// holiday_settings row so a single toggle controls all CH"M days of that festival.
function normalizeDesc(desc: string): string {
  if (/^Pesach (III|IV|V|VI) \(CH'M\)$/.test(desc)) return 'Pesach Chol HaMoed';
  if (/^Sukkot (III|IV|V|VI) \(CH'M\)$/.test(desc)) return 'Sukkot Chol HaMoed';
  return desc;
}

export function getHolidayInfo(date: Date, settingsOverride?: HolidaySettingsMap | null): HolidayInfo | null {
  try {
    const hd = new HDate(date);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
    if (!events.length) return null;

    const settings = settingsOverride ?? getCachedHolidaySettings();

    // Filter by show_in_calendar from settings (or all if not loaded), excluding diaspora-only.
    const filtered = events.filter((ev) => {
      const desc = ev.getDesc();
      if (DIASPORA_ONLY.has(desc)) return false;
      if (settings) {
        const s = settings.get(normalizeDesc(desc));
        return s ? s.show_in_calendar : false;
      }
      return true;
    });
    if (!filtered.length) return null;

    const sorted = [...filtered].sort((a, b) => {
      const aMajor = (a.getFlags() & flags.CHAG) ? 1 : 0;
      const bMajor = (b.getFlags() & flags.CHAG) ? 1 : 0;
      return bMajor - aMajor;
    });
    const ev = sorted[0];
    const f = ev.getFlags();
    const desc = ev.getDesc();
    const key = normalizeDesc(desc);
    const isMajor = !!(f & flags.CHAG);
    const isErev = !!(f & flags.EREV);
    const isCholHamoed = !!(f & flags.CHOL_HAMOED);
    const setting = settings?.get(key);
    const blocksBooking = setting ? setting.blocks_booking : FALLBACK_BLOCKED.has(key);
    let name = setting?.display_name || '';
    if (!name) {
      try {
        name = ev.render('he-x-NoNikud') || ev.render('he') || desc;
      } catch {
        name = desc;
      }
    }
    return { name, isMajor, isErev, isCholHamoed, blocksBooking, desc };
  } catch {
    return null;
  }
}

export function isBookingBlockedDay(date: Date, settings?: HolidaySettingsMap | null): boolean {
  // Check ALL events on the date, not just the displayed one
  try {
    const hd = new HDate(date);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
    const map = settings ?? getCachedHolidaySettings();
    for (const ev of events) {
      const desc = ev.getDesc();
      if (DIASPORA_ONLY.has(desc)) continue;
      const key = normalizeDesc(desc);
      const s = map?.get(key);
      const blocks = s ? s.blocks_booking : FALLBACK_BLOCKED.has(key);
      if (blocks) return true;
    }
    return false;
  } catch {
    return false;
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
