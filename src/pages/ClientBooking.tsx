import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { getHebrewDateShort } from "@/lib/hebrew-date";
import { Clock, Sparkles, ChevronLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Treatment {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
  color: string;
  is_variable_duration: boolean;
}

interface PriceTier {
  min_minutes: number;
  max_minutes: number;
  price_per_minute: number;
}

interface DayBreak {
  start: string;
  end: string;
}
interface DaySchedule {
  start: string;
  end: string;
  breaks: DayBreak[];
}
type DaySchedules = Record<string, DaySchedule>;

interface BusinessSettings {
  working_days: number[];
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  slot_step_minutes?: number;
  advance_booking_days: number;
  business_name: string;
  day_schedules?: DaySchedules;
}

interface SlotSuggestion {
  time: string;
  isGapFiller: boolean;
  isPartial?: boolean;
  availableMinutes?: number;
}

export default function ClientBooking() {
  const { user } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [selectedTreatments, setSelectedTreatments] = useState<Treatment[]>([]);
  const [variableDurations, setVariableDurations] = useState<Record<string, number>>({});
  const [priceTiers, setPriceTiers] = useState<Record<string, PriceTier[]>>({});
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [bookedSlots, setBookedSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"treatment" | "date" | "time">("treatment");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [preferredTime, setPreferredTime] = useState<string>("10:00");
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [showMoreDays, setShowMoreDays] = useState(false);
  const [moreDaySuggestions, setMoreDaySuggestions] = useState<{ date: Date; slots: string[] }[]>([]);

  const getDuration = (t: Treatment) => (t.is_variable_duration ? variableDurations[t.id] || 15 : t.duration_minutes);
  const totalDuration = selectedTreatments.reduce((sum, t) => sum + getDuration(t), 0);

  const calculateTierPrice = (treatmentId: string, minutes: number): number => {
    const tiers = priceTiers[treatmentId];
    if (!tiers || tiers.length === 0) return 0;
    // Find the matching tier
    const tier = tiers.find((t) => minutes >= t.min_minutes && minutes <= t.max_minutes);
    if (tier) return Math.round(tier.price_per_minute * minutes);
    // If no exact match, use the last tier
    const lastTier = tiers[tiers.length - 1];
    return Math.round(lastTier.price_per_minute * minutes);
  };

  const getPrice = (t: Treatment): number => {
    if (t.is_variable_duration) {
      const dur = variableDurations[t.id];
      if (!dur) return 0;
      return calculateTierPrice(t.id, dur);
    }
    return t.price;
  };

  const totalPrice = selectedTreatments.reduce((sum, t) => sum + getPrice(t), 0);
  const hasVariableDuration = selectedTreatments.some((t) => t.is_variable_duration);
  const allDurationsSet = selectedTreatments.every((t) => !t.is_variable_duration || variableDurations[t.id]);

  useEffect(() => {
    fetchTreatments();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (selectedDate) fetchBookedSlots(selectedDate);
  }, [selectedDate]);

  // Realtime: refresh availability when other users book/cancel for the selected day
  useEffect(() => {
    if (!selectedDate) return;
    const channel = supabase
      .channel(`client-booking-realtime-${format(selectedDate, "yyyy-MM-dd")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchBookedSlots(selectedDate);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_blocks" },
        () => {
          fetchBookedSlots(selectedDate);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const fetchTreatments = async () => {
    const { data } = await supabase.from("treatments").select("*").eq("is_active", true);
    if (data) {
      setTreatments(data as Treatment[]);
      // Fetch price tiers for all variable duration treatments
      const variableTreatments = (data as Treatment[]).filter((t) => t.is_variable_duration);
      if (variableTreatments.length > 0) {
        const { data: tiersData } = await supabase
          .from("treatment_price_tiers")
          .select("*")
          .in(
            "treatment_id",
            variableTreatments.map((t) => t.id),
          )
          .order("min_minutes");
        if (tiersData) {
          const tiersMap: Record<string, PriceTier[]> = {};
          (tiersData as any[]).forEach((tier) => {
            if (!tiersMap[tier.treatment_id]) tiersMap[tier.treatment_id] = [];
            tiersMap[tier.treatment_id].push(tier);
          });
          setPriceTiers(tiersMap);
        }
      }
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("business_settings").select("*").limit(1).single();
    if (data) setSettings(data as unknown as BusinessSettings);
  };

  const fetchBookedSlots = async (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const [aptsRes, blocksRes] = await Promise.all([
      supabase.rpc("get_busy_slots", { _date: dateStr }),
      supabase.from("time_blocks").select("start_time, end_time").eq("block_date", dateStr),
    ]);
    if (aptsRes.data) setBookedSlots(aptsRes.data as { start_time: string; end_time: string }[]);
    if (blocksRes.data) setBlockedSlots(blocksRes.data);
  };

  const getAvailableSlots = (date: Date, booked: { start_time: string; end_time: string }[], duration: number) => {
    if (!settings) return [];
    const dayOfWeek = date.getDay();
    const daySchedule = settings.day_schedules?.[String(dayOfWeek)];

    // Use per-day schedule if available, else fall back to global
    const startTime = daySchedule?.start || settings.start_time;
    const endTime = daySchedule?.end || settings.end_time;
    const breaks: { start: string; end: string }[] =
      daySchedule?.breaks ||
      (settings.break_start && settings.break_end ? [{ start: settings.break_start, end: settings.break_end }] : []);

    const slots: string[] = [];
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    let current = startH * 60 + startM;
    const end = endH * 60 + endM;

    while (current + duration <= end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const slotEndMin = current + duration;
      const slotEndH = Math.floor(slotEndMin / 60);
      const slotEndM = slotEndMin % 60;
      const slotEnd = `${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}`;

      const inBreak = breaks.some((brk) => {
        const [bsH, bsM] = brk.start.split(":").map(Number);
        const [beH, beM] = brk.end.split(":").map(Number);
        const bStart = bsH * 60 + bsM;
        const bEnd = beH * 60 + beM;
        return current < bEnd && slotEndMin > bStart;
      });

      const isBooked = booked.some((b) => {
        const bStart = b.start_time.substring(0, 5);
        const bEnd = b.end_time.substring(0, 5);
        return slotStart < bEnd && slotEnd > bStart;
      });

      const isBlocked = blockedSlots.some((b) => {
        const bStart = b.start_time.substring(0, 5);
        const bEnd = b.end_time.substring(0, 5);
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (!inBreak && !isBooked && !isBlocked) {
        slots.push(slotStart);
      }

      current += settings.slot_step_minutes || 15;
    }

    return slots;
  };

  // Find empty gaps in the day's schedule (for variable-duration treatments)
  // Returns gaps SHORTER than the requested duration but at least 5 minutes
  const findShortGaps = (date: Date): { time: string; minutes: number }[] => {
    if (!settings) return [];
    const dayOfWeek = date.getDay();
    const daySchedule = settings.day_schedules?.[String(dayOfWeek)];
    const startTime = daySchedule?.start || settings.start_time;
    const endTime = daySchedule?.end || settings.end_time;
    const breaks: { start: string; end: string }[] =
      daySchedule?.breaks ||
      (settings.break_start && settings.break_end ? [{ start: settings.break_start, end: settings.break_end }] : []);

    const toMin = (s: string) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    };
    const fromMin = (n: number) =>
      `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

    const dayStart = toMin(startTime);
    const dayEnd = toMin(endTime);

    // Build list of busy intervals (bookings + breaks + blocks)
    const busy: { start: number; end: number }[] = [
      ...bookedSlots.map((b) => ({ start: toMin(b.start_time.substring(0, 5)), end: toMin(b.end_time.substring(0, 5)) })),
      ...blockedSlots.map((b) => ({ start: toMin(b.start_time.substring(0, 5)), end: toMin(b.end_time.substring(0, 5)) })),
      ...breaks.map((b) => ({ start: toMin(b.start), end: toMin(b.end) })),
    ].sort((a, b) => a.start - b.start);

    // Merge overlapping
    const merged: { start: number; end: number }[] = [];
    busy.forEach((iv) => {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
      else merged.push({ ...iv });
    });

    // Find gaps between busy intervals within the workday
    const gaps: { time: string; minutes: number }[] = [];
    let cursor = dayStart;
    for (const iv of merged) {
      if (iv.start > cursor) {
        const gapLen = iv.start - cursor;
        if (gapLen >= 5) gaps.push({ time: fromMin(cursor), minutes: gapLen });
      }
      cursor = Math.max(cursor, iv.end);
    }
    if (cursor < dayEnd) {
      const gapLen = dayEnd - cursor;
      if (gapLen >= 5) gaps.push({ time: fromMin(cursor), minutes: gapLen });
    }

    return gaps;
  };

  const availableSlots = useMemo(() => {
    if (!settings || !selectedDate || selectedTreatments.length === 0) return [];
    return getAvailableSlots(selectedDate, bookedSlots, totalDuration);
  }, [settings, selectedDate, selectedTreatments, bookedSlots, blockedSlots, totalDuration]);

  // Smart suggestions: 3 closest to preferred time + gap fillers
  const smartSuggestions = useMemo((): SlotSuggestion[] => {
    if (availableSlots.length === 0) return [];
    const [prefH, prefM] = preferredTime.split(":").map(Number);
    const prefMin = prefH * 60 + prefM;

    // Sort by distance from preferred time
    const sorted = [...availableSlots].sort((a, b) => {
      const [aH, aM] = a.split(":").map(Number);
      const [bH, bM] = b.split(":").map(Number);
      return Math.abs(aH * 60 + aM - prefMin) - Math.abs(bH * 60 + bM - prefMin);
    });

    // Find gap fillers: slots adjacent to booked slots
    const gapSlots = new Set<string>();
    bookedSlots.forEach((b) => {
      const bEnd = b.end_time.substring(0, 5);
      const bStart = b.start_time.substring(0, 5);
      if (availableSlots.includes(bEnd)) gapSlots.add(bEnd);
      // Also check slot ending right before booked slot
      const [bsH, bsM] = bStart.split(":").map(Number);
      const beforeMin = bsH * 60 + bsM - totalDuration;
      if (beforeMin >= 0) {
        const beforeSlot = `${String(Math.floor(beforeMin / 60)).padStart(2, "0")}:${String(beforeMin % 60).padStart(2, "0")}`;
        if (availableSlots.includes(beforeSlot)) gapSlots.add(beforeSlot);
      }
    });

    const suggestions: SlotSuggestion[] = [];
    const added = new Set<string>();

    // Add gap fillers first (priority)
    gapSlots.forEach((slot) => {
      if (suggestions.length < 3) {
        suggestions.push({ time: slot, isGapFiller: true });
        added.add(slot);
      }
    });

    // Fill remaining with closest slots
    for (const slot of sorted) {
      if (suggestions.length >= 3) break;
      if (!added.has(slot)) {
        suggestions.push({ time: slot, isGapFiller: false });
        added.add(slot);
      }
    }

    // Sort final suggestions chronologically (ascending by time)
    suggestions.sort((a, b) => {
      const [aH, aM] = a.time.split(":").map(Number);
      const [bH, bM] = b.time.split(":").map(Number);
      return aH * 60 + aM - (bH * 60 + bM);
    });

    return suggestions;
  }, [availableSlots, preferredTime, bookedSlots, totalDuration]);

  // Partial time suggestions for variable duration services
  const partialSuggestions = useMemo((): SlotSuggestion[] => {
    if (!hasVariableDuration || availableSlots.length > 0 || !settings || !selectedDate) return [];
    // Find shorter available windows
    const shortSlots: SlotSuggestion[] = [];
    const minDuration = 5;
    for (let dur = totalDuration - 5; dur >= minDuration; dur -= 5) {
      const slots = getAvailableSlots(selectedDate, bookedSlots, dur);
      if (slots.length > 0) {
        slots.slice(0, 3).forEach((slot) => {
          shortSlots.push({ time: slot, isGapFiller: false, isPartial: true, availableMinutes: dur });
        });
        break;
      }
    }
    return shortSlots;
  }, [hasVariableDuration, availableSlots, settings, selectedDate, bookedSlots, totalDuration]);

  // Gap suggestions: for variable-duration treatments, show empty windows in the day
  // that are NOT already in smart suggestions — sorted by largest first, max 3.
  const gapSuggestions = useMemo((): SlotSuggestion[] => {
    if (!hasVariableDuration || !settings || !selectedDate) return [];
    const gaps = findShortGaps(selectedDate);
    const taken = new Set(smartSuggestions.map((s) => s.time));
    // Only show gaps SMALLER than (or equal to) the requested duration —
    // gaps larger than the request are already covered by regular smart suggestions.
    const filtered = gaps
      .filter((g) => !taken.has(g.time) && g.minutes >= 5 && g.minutes < totalDuration)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3);
    return filtered.map((g) => ({
      time: g.time,
      isGapFiller: true,
      isPartial: true,
      availableMinutes: g.minutes,
    }));
  }, [hasVariableDuration, settings, selectedDate, bookedSlots, blockedSlots, smartSuggestions, totalDuration]);

  const isWorkingDay = (date: Date) => {
    if (!settings) return false;
    return settings.working_days.includes(date.getDay());
  };

  const toggleTreatment = (t: Treatment) => {
    setSelectedTreatments((prev) =>
      prev.find((s) => s.id === t.id) ? prev.filter((s) => s.id !== t.id) : [...prev, t],
    );
  };

  const handleBook = async (customDuration?: number) => {
    if (!user || selectedTreatments.length === 0 || !selectedDate || !selectedTime) return;
    setLoading(true);

    const duration = customDuration || totalDuration;
    const [h, m] = selectedTime.split(":").map(Number);
    const endMin = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    try {
      // Insert appointment with first treatment (for backwards compatibility)
      const { data: aptData, error } = await supabase
        .from("appointments")
        .insert({
          client_id: user.id,
          treatment_id: selectedTreatments[0].id,
          appointment_date: format(selectedDate, "yyyy-MM-dd"),
          start_time: selectedTime,
          end_time: endTime,
        })
        .select("id")
        .single();

      if (error) {
        if (error.message.includes("already booked")) {
          toast.error("השעה הזו כבר נתפסה על ידי לקוחה אחרת. בחרי שעה אחרת");
          setSelectedTime(null);
          if (selectedDate) await fetchBookedSlots(selectedDate);
        } else {
          toast.error("שגיאה בהזמנת התור");
        }
      } else if (aptData) {
        // Insert appointment_treatments for multi-treatment support
        if (selectedTreatments.length > 1) {
          const treatmentRows = selectedTreatments.map((t) => ({
            appointment_id: aptData.id,
            treatment_id: t.id,
            duration_minutes: t.duration_minutes,
            price: t.price,
          }));
          await supabase.from("appointment_treatments").insert(treatmentRows);
        }
        toast.success("התור נקבע בהצלחה! 🎉");
        setStep("treatment");
        setSelectedTreatments([]);
        setSelectedDate(undefined);
        setSelectedTime(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user || !selectedDate || selectedTreatments.length === 0) return;
    const [prefH, prefM] = preferredTime.split(":").map(Number);
    const startMin = Math.max(0, prefH * 60 + prefM - 60);
    const endMin = prefH * 60 + prefM + 60;
    const timeStart = `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
    const timeEnd = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    const { error } = await supabase.from("waitlist").insert({
      client_id: user.id,
      treatment_id: selectedTreatments[0].id,
      preferred_date: format(selectedDate, "yyyy-MM-dd"),
      preferred_time_start: timeStart,
      preferred_time_end: timeEnd,
    });
    if (error) toast.error("שגיאה בהצטרפות לרשימת המתנה");
    else toast.success("הצטרפת לרשימת המתנה! נעדכן אותך אם יתפנה תור 🎉");
  };

  // Find days within the next 14 days where the EXACT preferred time is available
  const fetchMoreDays = async () => {
    if (!settings || selectedTreatments.length === 0 || !selectedDate) return;
    setShowMoreDays(true);
    const results: { date: Date; slots: string[] }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = addDays(selectedDate, i);
      if (!isWorkingDay(d)) continue;
      if (isBefore(addDays(new Date(), settings.advance_booking_days), d)) break;
      const dateStr = format(d, "yyyy-MM-dd");
      const [aptsRes, blocksRes] = await Promise.all([
        supabase.rpc("get_busy_slots", { _date: dateStr }),
        supabase.from("time_blocks").select("start_time, end_time").eq("block_date", dateStr),
      ]);
      const dayBooked = (aptsRes.data || []) as { start_time: string; end_time: string }[];
      const dayBlocked = blocksRes.data || [];

      // Check 3 candidate times: -15min, exact, +15min
      const [prefH, prefM] = preferredTime.split(":").map(Number);
      const baseMin = prefH * 60 + prefM;
      const candidates = [baseMin - 15, baseMin, baseMin + 15].filter((m) => m >= 0 && m < 24 * 60);

      // Day schedule (working hours + breaks)
      const dayOfWeek = d.getDay();
      const daySchedule = settings.day_schedules?.[String(dayOfWeek)];
      const startTime = daySchedule?.start || settings.start_time;
      const endTime = daySchedule?.end || settings.end_time;
      const breaks: { start: string; end: string }[] =
        daySchedule?.breaks ||
        (settings.break_start && settings.break_end ? [{ start: settings.break_start, end: settings.break_end }] : []);
      const [sH, sM] = startTime.split(":").map(Number);
      const [eH, eM] = endTime.split(":").map(Number);
      const dayStart = sH * 60 + sM;
      const dayEnd = eH * 60 + eM;

      const availableSlots: string[] = [];
      for (const startMin of candidates) {
        const endMin = startMin + totalDuration;
        const startStr = `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
        const endStr = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

        if (startMin < dayStart || endMin > dayEnd) continue;

        const inBreak = breaks.some((brk) => {
          const [bsH, bsM] = brk.start.split(":").map(Number);
          const [beH, beM] = brk.end.split(":").map(Number);
          return startMin < beH * 60 + beM && endMin > bsH * 60 + bsM;
        });
        if (inBreak) continue;

        const isBooked = dayBooked.some((b) => {
          const bStart = b.start_time.substring(0, 5);
          const bEnd = b.end_time.substring(0, 5);
          return startStr < bEnd && endStr > bStart;
        });
        if (isBooked) continue;

        const isBlocked = dayBlocked.some((b) => {
          const bStart = b.start_time.substring(0, 5);
          const bEnd = b.end_time.substring(0, 5);
          return startStr < bEnd && endStr > bStart;
        });
        if (isBlocked) continue;

        availableSlots.push(startStr);
      }

      if (availableSlots.length === 0) continue;
      // Sort slots chronologically within the day
      availableSlots.sort((a, b) => {
        const [aH, aM] = a.split(":").map(Number);
        const [bH, bM] = b.split(":").map(Number);
        return aH * 60 + aM - (bH * 60 + bM);
      });
      results.push({ date: d, slots: availableSlots });
      if (results.length >= 5) break;
    }
    setMoreDaySuggestions(results);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-display font-bold text-foreground">{settings?.business_name || "קביעת תור"}</h1>
        <p className="text-muted-foreground mt-1">בחרי טיפולים, תאריך ושעה</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2">
        {["טיפולים", "תאריך", "שעה"].map((label, i) => {
          const stepNames = ["treatment", "date", "time"] as const;
          const isActive = step === stepNames[i];
          const isDone = stepNames.indexOf(step) > i;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isActive
                    ? "gradient-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "text-sm hidden sm:inline",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < 2 && <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Treatment Multi-Select */}
      {step === "treatment" && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {treatments.map((t) => {
              const isSelected = selectedTreatments.find((s) => s.id === t.id);
              return (
                <Card
                  key={t.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-elegant",
                    isSelected && "ring-2 ring-primary",
                  )}
                  onClick={() => toggleTreatment(t)}
                >
                  <CardContent className="p-4 space-y-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={!!isSelected} className="pointer-events-none" />
                        <div>
                          <h3 className="font-medium text-foreground">{t.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {t.is_variable_duration ? (
                              <span className="text-xs bg-accent px-2 py-0.5 rounded">משך גמיש</span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t.duration_minutes} דק׳
                              </span>
                            )}
                            {t.category && (
                              <Badge variant="secondary" className="text-xs">
                                {t.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || "#6366f1" }} />
                        {t.is_variable_duration ? (
                          <span className="text-sm text-muted-foreground">תמחור לפי דקות</span>
                        ) : (
                          <span className="text-lg font-semibold text-primary">₪{t.price}</span>
                        )}
                      </div>
                    </div>
                    {/* Inline duration picker for variable-duration treatments */}
                    {isSelected && t.is_variable_duration && (
                      <div className="mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <Label className="text-sm whitespace-nowrap">משך זמן:</Label>
                          <select
                            value={variableDurations[t.id] || ""}
                            onChange={(e) =>
                              setVariableDurations((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))
                            }
                            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background flex-1"
                          >
                            <option value="" disabled>
                              בחרי משך זמן
                            </option>
                            {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map((min) => (
                              <option key={min} value={min}>
                                {min} דקות
                              </option>
                            ))}
                          </select>
                          {variableDurations[t.id] && (
                            <span className="text-sm font-medium text-primary whitespace-nowrap">
                              ₪{calculateTierPrice(t.id, variableDurations[t.id])}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {treatments.length === 0 && <p className="text-center text-muted-foreground py-8">אין טיפולים זמינים כרגע</p>}

          {selectedTreatments.length > 0 && (
            <Card className="bg-secondary/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTreatments.length} טיפולים
                      {allDurationsSet && <> • {totalDuration} דק׳</>} • ₪{totalPrice}
                    </p>
                  </div>
                  <Button
                    className="gradient-primary text-primary-foreground"
                    onClick={() => setStep("date")}
                    disabled={!allDurationsSet}
                  >
                    {!allDurationsSet ? "בחרי משך זמן" : "המשיכי לבחירת תאריך"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Date */}
      {step === "date" && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">בחרי תאריך</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep("treatment")}>
                חזרה
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedTreatments.map((t) => t.name).join(", ")} • {totalDuration} דק׳
            </p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                if (date) setStep("time");
              }}
              disabled={(date) =>
                isBefore(date, startOfDay(new Date())) ||
                !isWorkingDay(date) ||
                isBefore(addDays(new Date(), settings?.advance_booking_days ?? 30), date)
              }
              locale={he}
              className="p-3 pointer-events-auto"
              classNames={{
                months: "flex flex-col",
                month: "space-y-6",
                caption: "flex justify-center pt-2 relative items-center",
                caption_label: "text-base font-semibold",
                nav_button: cn(
                  "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
                ),
                nav_button_previous: "absolute left-2",
                nav_button_next: "absolute right-2",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell:
                  "text-muted-foreground rounded-md w-10 md:w-14 h-8 md:h-10 font-medium text-xs md:text-sm flex items-center justify-center",
                row: "flex w-full mt-1",
                cell: "h-10 w-10 md:h-14 md:w-14 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-10 w-10 md:h-14 md:w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                day_selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
              components={{
                DayContent: ({ date }) => (
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-sm font-medium">{date.getDate()}</span>
                    <span className="text-[10px] text-muted-foreground">{getHebrewDateShort(date)}</span>
                  </div>
                ),
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Time with Smart Suggestions */}
      {step === "time" && selectedDate && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">בחרי שעה</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(selectedDate, "EEEE, d בMMMM yyyy", { locale: he })}
                  {" • "}
                  {getHebrewDateShort(selectedDate)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("date")}>
                חזרה
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preferred time input */}
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">שעה מועדפת:</Label>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
                dir="ltr"
              />
            </div>

            {/* Smart suggestions */}
            {smartSuggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-primary" /> הצעות לשעות
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {smartSuggestions.map((s) => (
                    <Button
                      key={s.time}
                      variant={selectedTime === s.time ? "default" : "outline"}
                      className={cn(
                        selectedTime === s.time && "gradient-primary text-primary-foreground",
                        s.isGapFiller && "border-primary/50",
                      )}
                      onClick={() => setSelectedTime(s.time)}
                    >
                      {s.time}
                      {s.isGapFiller && <span className="text-[10px] mr-1">⭐</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Partial time suggestions */}
            {partialSuggestions.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg bg-accent/50 border border-accent">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-primary" /> זמנים חלקיים זמינים
                </h4>
                <p className="text-xs text-muted-foreground">
                  אין חלון פנוי ל-{totalDuration} דקות, אבל יש אפשרויות קצרות יותר:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {partialSuggestions.map((s) => (
                    <Button
                      key={`${s.time}-${s.availableMinutes}`}
                      variant="outline"
                      className="justify-start text-right"
                      onClick={() => {
                        setSelectedTime(s.time);
                      }}
                    >
                      יש {s.availableMinutes} דקות פנויות בשעה {s.time} — מתאים לך?
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Gap suggestions for variable-duration treatments — empty windows in the day */}
            {gapSuggestions.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg bg-secondary/40 border border-border">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4 text-primary" /> חורים פנויים ביומן
                </h4>
                <p className="text-xs text-muted-foreground">
                  חלונות זמן ריקים נוספים ביום הזה (מסודרים לפי הגדול ביותר):
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {gapSuggestions.map((s) => (
                    <Button
                      key={`gap-${s.time}-${s.availableMinutes}`}
                      variant={selectedTime === s.time ? "default" : "outline"}
                      className={cn(
                        "justify-start text-right",
                        selectedTime === s.time && "gradient-primary text-primary-foreground",
                      )}
                      onClick={() => setSelectedTime(s.time)}
                    >
                      {s.time} • {s.availableMinutes} דקות פנויות
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {availableSlots.length > 0 && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllSlots(!showAllSlots)}
                  className="w-full text-sm border-primary/40 text-primary hover:bg-primary/10"
                >
                  {showAllSlots ? "הסתר שעות נוספות" : "הצגת כל השעות הפנויות ליום זה"}
                </Button>
                {showAllSlots && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        variant={selectedTime === slot ? "default" : "outline"}
                        size="sm"
                        className={cn(selectedTime === slot && "gradient-primary text-primary-foreground")}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {availableSlots.length === 0 && partialSuggestions.length === 0 && (
              <div className="text-center space-y-3 py-4">
                <p className="text-muted-foreground">אין שעות פנויות בתאריך זה</p>
              </div>
            )}

            {/* Alternative days - always show button in time step */}
            {!showMoreDays && (
              <Button variant="outline" size="sm" onClick={fetchMoreDays} className="w-full">
                🔍 הצע לי ימים אחרים עם השעה {preferredTime} פנויה
              </Button>
            )}

            {showMoreDays && moreDaySuggestions.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                <h4 className="text-base font-semibold text-foreground">
                  ימים נוספים עם שעות סמוכות ל-<span className="text-primary font-bold">{preferredTime}</span>:
                </h4>
                {moreDaySuggestions.map((ds) => (
                  <div key={ds.date.toISOString()} className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{format(ds.date, "EEEE d/M", { locale: he })}:</span>
                    {ds.slots.map((slot) => (
                      <Button
                        key={slot}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDate(ds.date);
                          setSelectedTime(slot);
                          fetchBookedSlots(ds.date);
                          setShowMoreDays(false);
                        }}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {showMoreDays && moreDaySuggestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                לא נמצאו ימים בשבועיים הקרובים שבהם השעה {preferredTime} פנויה
              </p>
            )}

            {/* Waitlist option */}
            <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center space-y-2">
              <p className="text-sm text-muted-foreground">לא מצאת שעה מתאימה?</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleJoinWaitlist}
                className="border-primary/50 text-primary"
              >
                📋 הצטרפי לרשימת המתנה — נעדכן אותך כשיתפנה מקום
              </Button>
            </div>

            {/* Booking summary */}
            {selectedTime && (
              <div className="mt-4 p-4 rounded-lg bg-secondary/50 space-y-2">
                <h4 className="font-medium text-foreground">סיכום הזמנה</h4>
                {selectedTreatments.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span>
                      {t.name} • {getDuration(t)} דק׳ • ₪{t.price}
                    </span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  תאריך: {format(selectedDate, "d/M/yyyy")} • {getHebrewDateShort(selectedDate)}
                </p>
                <p className="text-sm text-muted-foreground">שעה: {selectedTime}</p>
                <p className="text-sm font-medium text-primary">
                  סה״כ: {totalDuration} דק׳ • ₪{totalPrice}
                </p>
                <Button
                  className="w-full mt-3 gradient-primary text-primary-foreground"
                  onClick={() => {
                    const partial =
                      partialSuggestions.find((s) => s.time === selectedTime) ||
                      gapSuggestions.find((s) => s.time === selectedTime);
                    handleBook(partial?.availableMinutes);
                  }}
                  disabled={loading}
                >
                  {loading ? "מזמין..." : "אישור הזמנה"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
