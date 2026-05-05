import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HolidaySetting {
  holiday_desc: string;
  display_name: string;
  category: string;
  show_in_calendar: boolean;
  blocks_booking: boolean;
}

export type HolidaySettingsMap = Map<string, HolidaySetting>;

let cachedMap: HolidaySettingsMap | null = null;
let cachePromise: Promise<HolidaySettingsMap> | null = null;
const listeners = new Set<(m: HolidaySettingsMap) => void>();

async function loadHolidaySettings(): Promise<HolidaySettingsMap> {
  if (cachedMap) return cachedMap;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { data } = await (supabase.rpc as any)("get_holiday_settings");
    const map = new Map<string, HolidaySetting>();
    if (Array.isArray(data)) {
      data.forEach((row: HolidaySetting) => map.set(row.holiday_desc, row));
    }
    cachedMap = map;
    return map;
  })();
  return cachePromise;
}

export function invalidateHolidayCache() {
  cachedMap = null;
  cachePromise = null;
  loadHolidaySettings().then((m) => listeners.forEach((l) => l(m)));
}

export function useHolidaySettings(): HolidaySettingsMap | null {
  const [map, setMap] = useState<HolidaySettingsMap | null>(cachedMap);
  useEffect(() => {
    let active = true;
    loadHolidaySettings().then((m) => {
      if (active) setMap(m);
    });
    listeners.add(setMap);
    return () => {
      active = false;
      listeners.delete(setMap);
    };
  }, []);
  return map;
}

// Synchronous getter for use in pure functions (calendar predicates).
// Returns null if not loaded yet — callers should fallback to defaults.
export function getCachedHolidaySettings(): HolidaySettingsMap | null {
  if (!cachedMap) {
    // Kick off load for next time
    loadHolidaySettings();
  }
  return cachedMap;
}
