// Scheduled appointment reminders → Make.com webhook
// Triggered every 15 minutes by pg_cron
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HDate, HebrewCalendar, flags } from "https://esm.sh/@hebcal/core@5.4.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://hook.eu1.make.com/wk5igpo7c9kyfpjbc769mu109cpb9hu8";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Days that block booking (same list as src/lib/hebrew-date.ts)
const BOOKING_BLOCKED_DESCS = new Set<string>([
  "Pesach I", "Pesach II", "Pesach VII", "Pesach VIII",
  "Shavuot", "Shavuot I", "Shavuot II",
  "Sukkot I", "Sukkot II", "Shmini Atzeret", "Simchat Torah",
  "Rosh Hashana", "Rosh Hashana I", "Rosh Hashana II",
  "Yom Kippur",
  "Tish'a B'Av", "Tzom Gedaliah", "Asara B'Tevet", "Tzom Tammuz",
  "Yom HaAtzma'ut",
]);

function isBlockedHoliday(date: Date): boolean {
  try {
    const hd = new HDate(date);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
    return events.some((ev) => BOOKING_BLOCKED_DESCS.has(ev.getDesc()));
  } catch {
    return false;
  }
}

function isShabbatOrHoliday(date: Date): boolean {
  return date.getDay() === 6 || isBlockedHoliday(date);
}

function buildHebrewDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const hd = new HDate(new Date(y, m - 1, d));
    return hd.renderGematriya();
  } catch {
    return "";
  }
}

function getHebrewDayName(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return HEBREW_DAYS[new Date(y, m - 1, d).getDay()];
  } catch {
    return "";
  }
}

function formatGregorian(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  } catch {
    return dateStr;
  }
}

function toInternationalPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

// Parse YYYY-MM-DD to local Date (avoid timezone offset)
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Get current time in Asia/Jerusalem as a comparable Date object
function nowInIsrael(): { year: number; month: number; day: number; hour: number; minute: number; dateYMD: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  return {
    year, month, day, hour, minute,
    dateYMD: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

// Minutes from midnight (Israel local)
function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

interface ReminderSchedule {
  reminderDate: Date;   // day (midnight local)
  reminderHour: number; // 0-23
  reminderMinute: number; // 0-59
}

// Given an appointment, compute when to send the reminder (Israel local time).
// Returns null if no valid reminder day could be found within 7 lookback steps.
function computeReminderTime(aptDateStr: string, aptStartTime: string): ReminderSchedule | null {
  const aptDate = parseDate(aptDateStr);
  const [sh, sm] = aptStartTime.split(":").map(Number);

  const aptBlocked = isShabbatOrHoliday(aptDate);
  const prevDay = addDays(aptDate, -1);
  const dayAfterBlocked = !aptBlocked && isShabbatOrHoliday(prevDay);

  let reminderDate: Date;
  let reminderHour: number;
  let reminderMinute: number;

  if (aptBlocked) {
    reminderDate = addDays(aptDate, -2);
    reminderHour = 20;
    reminderMinute = 0;
  } else if (dayAfterBlocked) {
    reminderDate = addDays(aptDate, -2);
    reminderHour = 12;
    reminderMinute = 0;
  } else {
    reminderDate = addDays(aptDate, -1);
    reminderHour = sh;
    reminderMinute = sm;
  }

  // Shift back until we land on a non-shabbat/holiday day
  let guard = 0;
  while (isShabbatOrHoliday(reminderDate) && guard < 7) {
    reminderDate = addDays(reminderDate, -1);
    guard++;
  }
  if (isShabbatOrHoliday(reminderDate)) return null;

  return { reminderDate, reminderHour, reminderMinute };
}

interface TreatmentItem {
  name: string;
  duration_minutes: number;
  price: number;
}

interface MsgCtx {
  clientName: string;
  treatmentName: string;
  treatments: TreatmentItem[];
  dayName: string;
  dateGregorian: string;
  dateHebrew: string;
  startTime: string;
  cancellationHours: number;
  isTomorrow: boolean; // true for "regular" appointments (reminder 1 day before)
}

function buildPlainMessage(ctx: MsgCtx): string {
  const greeting = `שלום ${ctx.clientName},`;
  const whenWord = ctx.isTomorrow ? "מחר" : "";
  const slot = `${whenWord ? whenWord + " " : ""}יום ${ctx.dayName} ${ctx.dateGregorian}${ctx.dateHebrew ? ` (${ctx.dateHebrew})` : ""} בשעה ${ctx.startTime}`;
  const isMulti = ctx.treatments.length > 1;
  const treatmentLine = isMulti
    ? `הטיפולים הכלולים בתור (${ctx.treatments.length}):\n` +
      ctx.treatments
        .map((t) => `• ${t.name}${t.duration_minutes ? ` (${t.duration_minutes} דק׳)` : ""}`)
        .join("\n")
    : `טיפול: "${ctx.treatmentName}"`;
  return (
    `${greeting}\n` +
    `זוהי תזכורת לתור שנקבע לך ב${slot}.\n` +
    `${treatmentLine}\n` +
    `במידה ולא תוכלי להגיע, ניתן לבטל עד ${ctx.cancellationHours} שעות לפני מועד התור.`
  );
}

function buildHtmlMessage(ctx: MsgCtx): string {
  const greeting = `שלום ${ctx.clientName},`;
  const whenWord = ctx.isTomorrow ? "<strong>מחר</strong> " : "";
  const slotHtml = `${whenWord}יום <strong>${ctx.dayName}</strong> ${ctx.dateGregorian}${ctx.dateHebrew ? ` (${ctx.dateHebrew})` : ""} בשעה <strong>${ctx.startTime}</strong>`;
  const isMulti = ctx.treatments.length > 1;
  const treatmentBlock = isMulti
    ? `<p><strong>הטיפולים הכלולים בתור (${ctx.treatments.length}):</strong></p><ul style="margin:4px 0 8px 0;padding-right:20px;">${
        ctx.treatments
          .map((t) => `<li>${t.name}${t.duration_minutes ? ` <span style="color:#888;">(${t.duration_minutes} דק׳)</span>` : ""}</li>`)
          .join("")
      }</ul>`
    : `<p><strong>טיפול:</strong> "${ctx.treatmentName}"</p>`;
  return (
    `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:600px;">` +
    `<p>${greeting}</p>` +
    `<p>זוהי תזכורת לתור שנקבע לך ב-${slotHtml}.</p>` +
    treatmentBlock +
    `<p style="background:#fff7ed;border-right:3px solid #f59e0b;padding:10px 14px;border-radius:6px;">` +
    `במידה ולא תוכלי להגיע, ניתן לבטל עד <strong>${ctx.cancellationHours} שעות</strong> לפני מועד התור.` +
    `</p>` +
    `</div>`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const il = nowInIsrael();
    const nowMinutes = minutesOfDay(il.hour, il.minute);
    // Window: ±8 minutes (covers 15-min cron cadence with slack)
    const WINDOW = 8;

    // Fetch upcoming confirmed appointments in the next 12h–7d range.
    // We filter to any appointment_date between today and today+7 to keep the set small,
    // then compute reminder time per-appointment and match by current window.
    const todayYMD = il.dateYMD;
    const sevenDaysLater = formatYMD(
      addDays(new Date(il.year, il.month - 1, il.day), 7),
    );

    const { data: upcoming, error: apErr } = await supabase
      .from("appointments")
      .select("id, appointment_date, start_time, end_time, notes, treatment_id, client_id")
      .eq("status", "confirmed")
      .gte("appointment_date", todayYMD)
      .lte("appointment_date", sevenDaysLater);

    if (apErr) {
      console.error("appointments fetch failed:", apErr);
      return new Response(JSON.stringify({ error: apErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upcoming || upcoming.length === 0) {
      return new Response(JSON.stringify({ ok: true, checked: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exclude appointments that already have a reminder log entry
    const ids = upcoming.map((a) => a.id);
    const { data: alreadySent } = await supabase
      .from("reminder_log")
      .select("appointment_id")
      .in("appointment_id", ids);
    const sentSet = new Set((alreadySent ?? []).map((r) => r.appointment_id));

    // Build due list: those whose reminder time falls in the current window
    type Due = { apt: typeof upcoming[number]; schedule: ReminderSchedule; classification: "regular" | "blocked" | "day_after" };
    const due: Due[] = [];

    for (const apt of upcoming) {
      if (sentSet.has(apt.id)) continue;
      const schedule = computeReminderTime(apt.appointment_date, apt.start_time);
      if (!schedule) continue;

      // Classify for message context
      const aptDate = parseDate(apt.appointment_date);
      const aptBlocked = isShabbatOrHoliday(aptDate);
      const dayAfter = !aptBlocked && isShabbatOrHoliday(addDays(aptDate, -1));
      const classification: Due["classification"] = aptBlocked ? "blocked" : dayAfter ? "day_after" : "regular";

      // Compare schedule date+time vs. current Israel time
      const schedYMD = formatYMD(schedule.reminderDate);
      if (schedYMD !== il.dateYMD) continue;

      const schedMinutes = minutesOfDay(schedule.reminderHour, schedule.reminderMinute);
      const diff = nowMinutes - schedMinutes;
      // Fire when now is within [-WINDOW, +WINDOW] of the scheduled time, but
      // prefer firing as soon as current time >= scheduled time (within +WINDOW).
      // To avoid missing due to cron jitter, accept slight earlier (-WINDOW).
      if (diff < -WINDOW || diff > WINDOW + 60) continue;
      // Only fire if we're at or past the scheduled minute (or within small pre-window)
      if (diff < -WINDOW) continue;

      due.push({ apt, schedule, classification });
    }

    if (due.length === 0) {
      return new Response(JSON.stringify({ ok: true, checked: upcoming.length, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich each due appointment with profile + treatments + settings
    const { data: settings } = await supabase
      .from("business_settings")
      .select("cancellation_hours")
      .limit(1)
      .maybeSingle();
    const cancellationHours = settings?.cancellation_hours ?? 24;

    const reminders: Record<string, unknown>[] = [];
    const successfulIds: string[] = [];
    const payloadsById: Record<string, Record<string, unknown>> = {};

    for (const { apt, classification } of due) {
      const [{ data: profile }, { data: treatment }, { data: aptTreatments }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, email, reminder_preference")
          .eq("user_id", apt.client_id)
          .maybeSingle(),
        supabase
          .from("treatments")
          .select("name, duration_minutes")
          .eq("id", apt.treatment_id)
          .maybeSingle(),
        supabase
          .from("appointment_treatments")
          .select("treatment_id, duration_minutes, price, treatments(name)")
          .eq("appointment_id", apt.id),
      ]);

      const [sh, sm] = apt.start_time.split(":").map(Number);
      const [eh, em] = apt.end_time.split(":").map(Number);
      const duration_minutes = eh * 60 + em - (sh * 60 + sm);
      const startTime = apt.start_time?.slice(0, 5) ?? apt.start_time;
      const endTime = apt.end_time?.slice(0, 5) ?? apt.end_time;
      const dateHebrew = buildHebrewDate(apt.appointment_date);
      const dateGregorian = formatGregorian(apt.appointment_date);
      const dayName = getHebrewDayName(apt.appointment_date);
      const clientName = profile?.full_name ?? "";
      const clientPhone = profile?.phone ?? "";
      const phoneIntl = toInternationalPhone(clientPhone);
      const pref = (profile?.reminder_preference ?? "whatsapp").toLowerCase();
      const channel = pref === "email" ? "email" : "whatsapp";

      type AT = { treatment_id: string; duration_minutes: number; price: number; treatments: { name: string } | null };
      const rawList = (aptTreatments ?? []) as unknown as AT[];
      const treatmentsList: TreatmentItem[] = rawList.length > 0
        ? rawList.map((r) => ({
            name: r.treatments?.name ?? "",
            duration_minutes: r.duration_minutes,
            price: Number(r.price ?? 0),
          }))
        : [{
            name: treatment?.name ?? "",
            duration_minutes: treatment?.duration_minutes ?? duration_minutes,
            price: 0,
          }];
      const treatmentName = treatmentsList.length > 1
        ? treatmentsList.map((t) => t.name).filter(Boolean).join(" + ")
        : (treatment?.name ?? "");

      const msgCtx: MsgCtx = {
        clientName,
        treatmentName,
        treatments: treatmentsList,
        dayName,
        dateGregorian,
        dateHebrew,
        startTime,
        cancellationHours,
        isTomorrow: classification === "regular",
      };

      const reminderObj = {
        client: {
          full_name: clientName,
          phone: clientPhone,
          phone_international: phoneIntl,
          email: profile?.email ?? "",
          channel,
        },
        appointment: {
          id: apt.id,
          date_gregorian: apt.appointment_date,
          date_hebrew: dateHebrew,
          day_name: dayName,
          start_time: startTime,
          end_time: endTime,
          duration_minutes,
          treatment_name: treatmentName,
          treatments: treatmentsList,
          treatments_count: treatmentsList.length,
          notes: apt.notes ?? "",
        },
        message: {
          html: buildHtmlMessage(msgCtx),
          plain: buildPlainMessage(msgCtx),
        },
      };

      reminders.push(reminderObj);
      successfulIds.push(apt.id);
      payloadsById[apt.id] = reminderObj;
    }

    if (reminders.length === 0) {
      return new Response(JSON.stringify({ ok: true, checked: upcoming.length, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchPayload = {
      event: "appointment_reminder",
      title: "תזכורת לתור",
      count: reminders.length,
      reminders,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPayload),
    });
    const text = await res.text().catch(() => "");
    console.log("send-reminders webhook:", res.status, text, "count:", reminders.length);

    if (res.ok) {
      // Log each reminder so we don't re-send
      const rows = successfulIds.map((id) => ({
        appointment_id: id,
        status: "sent",
        payload: payloadsById[id],
      }));
      const { error: logErr } = await supabase.from("reminder_log").insert(rows);
      if (logErr) console.error("reminder_log insert failed:", logErr);
    }

    return new Response(
      JSON.stringify({ ok: res.ok, checked: upcoming.length, sent: reminders.length, webhook_status: res.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-reminders error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
