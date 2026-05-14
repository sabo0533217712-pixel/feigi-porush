// IVR / Make REST API + Webhooks
// Auth: Authorization: Bearer <IVR_API_KEY>
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { HDate, HebrewCalendar, greg } from "npm:@hebcal/core@5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("IVR_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const HEBREW_MONTHS = ["", "ניסן", "אייר", "סיוון", "תמוז", "אב", "אלול",
  "תשרי", "חשוון", "כסלו", "טבת", "שבט", "אדר", "אדר ב׳"];
const HEBREW_DAYS = ["", "א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ז׳","ח׳","ט׳",
  "י׳","י״א","י״ב","י״ג","י״ד","ט״ו","ט״ז","י״ז","י״ח","י״ט",
  "כ׳","כ״א","כ״ב","כ״ג","כ״ד","כ״ה","כ״ו","כ״ז","כ״ח","כ״ט","ל׳"];
const DAY_NAMES = ["יום ראשון","יום שני","יום שלישי","יום רביעי","יום חמישי","יום שישי","שבת"];

function gematriaYear(year: number): string {
  const shortYear = year % 100;
  const ones = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  if (shortYear === 15) return "תש״ו";
  if (shortYear === 16) return "תש״ז";
  const t = Math.floor(shortYear / 10);
  const o = shortYear % 10;
  if (o === 0) return "תש" + tens[t] + "״";
  return "תש" + tens[t] + "״" + ones[o];
}

function hebrewDate(d: Date): string {
  try {
    const hd = new HDate(d);
    const dd = HEBREW_DAYS[hd.getDate()] || String(hd.getDate());
    const mm = HEBREW_MONTHS[hd.getMonth()] || "";
    return `${dd} ב${mm} ${gematriaYear(hd.getFullYear())}`;
  } catch { return ""; }
}

function ttsTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "בבוקר" : h < 18 ? "בצהריים" : "בערב";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12} ו-${m} דקות ${period}`;
}

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number); return h * 60 + m;
}
function minToTime(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`;
}

async function getSettings() {
  const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
  return data;
}

// Get busy intervals (appointments + holds + time_blocks) for a date, with buffer
async function getBusyIntervals(date: string, buffer: number) {
  const intervals: Array<[number, number]> = [];

  const { data: appts } = await supabase
    .from("appointments")
    .select("start_time,end_time")
    .eq("appointment_date", date)
    .eq("status", "confirmed");
  for (const a of appts || []) {
    intervals.push([timeToMin(a.start_time), timeToMin(a.end_time) + buffer]);
  }

  const { data: holds } = await supabase
    .from("slot_holds")
    .select("start_time,end_time,expires_at")
    .eq("hold_date", date)
    .gt("expires_at", new Date().toISOString());
  for (const h of holds || []) {
    intervals.push([timeToMin(h.start_time), timeToMin(h.end_time) + buffer]);
  }

  const { data: blocks } = await supabase
    .from("time_blocks")
    .select("start_time,end_time")
    .eq("block_date", date);
  for (const b of blocks || []) {
    intervals.push([timeToMin(b.start_time), timeToMin(b.end_time)]);
  }

  return intervals;
}

// Working windows for date (returns [startMin, endMin][])
function getWorkWindows(date: Date, settings: any): Array<[number, number]> {
  const dow = date.getDay();
  const daySchedules = settings.day_schedules || {};
  const ds = daySchedules[String(dow)];

  let working = settings.working_days?.includes(dow);
  let start = settings.start_time, end = settings.end_time;
  let bs = settings.break_start, be = settings.break_end;

  if (ds) {
    if (typeof ds.is_working === "boolean") working = ds.is_working;
    if (ds.start_time) start = ds.start_time;
    if (ds.end_time) end = ds.end_time;
    if (ds.break_start !== undefined) bs = ds.break_start;
    if (ds.break_end !== undefined) be = ds.break_end;
  }

  if (!working) return [];
  const sM = timeToMin(start), eM = timeToMin(end);
  if (bs && be) {
    const bsM = timeToMin(bs), beM = timeToMin(be);
    if (bsM > sM && beM < eM) return [[sM, bsM], [beM, eM]];
  }
  return [[sM, eM]];
}

async function isHolidayBlocked(date: Date): Promise<boolean> {
  const { data: hs } = await supabase.from("holiday_settings").select("holiday_desc,blocks_booking");
  const blockMap = new Map((hs || []).map(h => [h.holiday_desc, h.blocks_booking]));
  try {
    const events = HebrewCalendar.getHolidaysOnDate(new HDate(date), true) || [];
    for (const ev of events) {
      if (blockMap.get(ev.getDesc())) return true;
    }
  } catch {}
  return false;
}

// Compute total duration for requested services
async function computeTotalDuration(services: Array<{ serviceId: string; durationMinutes?: number }>) {
  const ids = services.map(s => s.serviceId);
  const { data: rows } = await supabase
    .from("treatments")
    .select("id,duration_minutes,is_variable_duration,is_active")
    .in("id", ids);
  if (!rows || rows.length !== ids.length) return null;
  let total = 0;
  for (const s of services) {
    const t = rows.find(r => r.id === s.serviceId);
    if (!t || !t.is_active) return null;
    if (t.is_variable_duration) {
      if (!s.durationMinutes || s.durationMinutes <= 0) return null;
      total += s.durationMinutes;
    } else {
      total += t.duration_minutes;
    }
  }
  return total;
}

// Find free contiguous slots of given duration on a date (returns start times in min)
function findSlots(windows: Array<[number, number]>, busy: Array<[number, number]>, durationWithBuffer: number, step: number): number[] {
  // Subtract busy from windows
  const free: Array<[number, number]> = [];
  for (const [ws, we] of windows) {
    let cursor = ws;
    const sortedBusy = [...busy].filter(([bs,be]) => be > ws && bs < we).sort((a,b) => a[0]-b[0]);
    for (const [bs, be] of sortedBusy) {
      const s = Math.max(bs, ws), e = Math.min(be, we);
      if (s > cursor) free.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (cursor < we) free.push([cursor, we]);
  }
  const starts: number[] = [];
  for (const [fs, fe] of free) {
    // align to step from window start
    let s = Math.ceil(fs / step) * step;
    while (s + durationWithBuffer <= fe + 0) {
      // need duration without trailing buffer to fit before window end
      starts.push(s);
      s += step;
    }
  }
  return starts;
}

async function authCheck(req: Request) {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;
  return auth.slice(7) === API_KEY;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!(await authCheck(req))) return err("Unauthorized", 401);

  const url = new URL(req.url);
  // Path comes as /ivr-api/<rest>
  const path = url.pathname.replace(/^\/ivr-api/, "").replace(/\/+$/, "") || "/";

  try {
    // 1. GET /services
    if (req.method === "GET" && path === "/services") {
      const { data } = await supabase
        .from("treatments")
        .select("id,name,duration_minutes,is_variable_duration,is_active,price")
        .eq("is_active", true)
        .order("display_order");
      const settings = await getSettings();
      const step = settings?.slot_step_minutes || 5;
      const services = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        ttsText: t.name,
        durationType: t.is_variable_duration ? "dynamic" : "fixed",
        ...(t.is_variable_duration
          ? { minDurationMinutes: 5, maxDurationMinutes: 120, durationStepMinutes: step }
          : { fixedDurationMinutes: t.duration_minutes }),
        active: t.is_active,
        price: Number(t.price),
      }));
      return ok({ services });
    }

    // 2. POST /availability/dates
    if (req.method === "POST" && path === "/availability/dates") {
      const body = await req.json();
      const totalDur = await computeTotalDuration(body.services || []);
      if (totalDur == null) return err("Invalid services");
      const settings = await getSettings();
      if (!settings) return err("No settings");
      const buffer = settings.appointment_buffer_minutes || 5;
      const step = settings.slot_step_minutes || 15;
      const advance = settings.advance_booking_days || 30;
      const need = totalDur + buffer;

      const today = new Date(); today.setHours(0,0,0,0);
      const result: any[] = [];
      for (let i = 0; i <= advance; i++) {
        const d = new Date(today); d.setDate(d.getDate() + i);
        const windows = getWorkWindows(d, settings);
        if (!windows.length) continue;
        if (await isHolidayBlocked(d)) continue;
        const dateStr = d.toISOString().slice(0,10);
        const busy = await getBusyIntervals(dateStr, buffer);
        const starts = findSlots(windows, busy, need, step);
        if (!starts.length) continue;
        const dayName = DAY_NAMES[d.getDay()];
        const heb = hebrewDate(d);
        result.push({
          date: dateStr,
          hebrewDate: heb,
          dayName,
          ttsText: `${dayName} ${heb}`,
        });
      }
      return ok({ availableDates: result });
    }

    // 3. POST /availability/slots
    if (req.method === "POST" && path === "/availability/slots") {
      const body = await req.json();
      const totalDur = await computeTotalDuration(body.services || []);
      if (totalDur == null) return err("Invalid services");
      if (!body.date) return err("date required");
      const settings = await getSettings();
      if (!settings) return err("No settings");
      const buffer = settings.appointment_buffer_minutes || 5;
      const step = settings.slot_step_minutes || 15;
      const need = totalDur + buffer;

      const d = new Date(body.date + "T00:00:00");
      const windows = getWorkWindows(d, settings);
      if (!windows.length || await isHolidayBlocked(d)) return ok({ slots: [] });
      const busy = await getBusyIntervals(body.date, buffer);
      const starts = findSlots(windows, busy, need, step);
      const slots = starts.map(s => {
        const startT = minToTime(s).slice(0,5);
        const endT = minToTime(s + totalDur).slice(0,5);
        return {
          id: `${body.date}_${startT}_${totalDur}`,
          start: startT,
          end: endT,
          totalDurationMinutes: totalDur,
          ttsText: ttsTime(startT),
        };
      });
      return ok({ slots });
    }

    // 4. POST /appointments/check-availability
    if (req.method === "POST" && path === "/appointments/check-availability") {
      const body = await req.json();
      const totalDur = await computeTotalDuration(body.services || []);
      if (totalDur == null) return err("Invalid services");
      const [date, startT] = String(body.slotId || "").split("_");
      if (!date || !startT) return err("Invalid slotId");
      const settings = await getSettings();
      const buffer = settings.appointment_buffer_minutes || 5;
      const startMin = timeToMin(startT + ":00");
      const endMin = startMin + totalDur;
      const busy = await getBusyIntervals(date, buffer);
      const conflict = busy.some(([bs, be]) => startMin < be && endMin + buffer > bs);
      return ok({ available: !conflict });
    }

    // 5. POST /appointments/hold
    if (req.method === "POST" && path === "/appointments/hold") {
      const body = await req.json();
      const parts = String(body.slotId || "").split("_");
      if (parts.length < 3) return err("Invalid slotId");
      const [date, startT, durStr] = parts;
      const dur = parseInt(durStr, 10);
      const settings = await getSettings();
      const buffer = settings.appointment_buffer_minutes || 5;
      const startMin = timeToMin(startT + ":00");
      const endMin = startMin + dur;
      const busy = await getBusyIntervals(date, buffer);
      const conflict = busy.some(([bs, be]) => startMin < be && endMin + buffer > bs);
      if (conflict) return err("Slot not available");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("slot_holds").insert({
        hold_date: date, start_time: minToTime(startMin), end_time: minToTime(endMin),
        phone: body.phone || null, expires_at: expiresAt,
      }).select("id").single();
      if (error) return err(error.message, 500);
      return ok({ holdId: data.id, holdExpiresIn: 300 });
    }

    // 6. POST /appointments/book
    if (req.method === "POST" && path === "/appointments/book") {
      const body = await req.json();
      if (!body.customerName || !body.phone) return err("customerName and phone required");
      const totalDur = await computeTotalDuration(body.services || []);
      if (totalDur == null) return err("Invalid services");
      const parts = String(body.slotId || "").split("_");
      if (parts.length < 3) return err("Invalid slotId");
      const [date, startT] = parts;
      const settings = await getSettings();
      const buffer = settings.appointment_buffer_minutes || 5;
      const startMin = timeToMin(startT + ":00");
      const endMin = startMin + totalDur;

      // Find or create profile by phone
      let { data: existing } = await supabase
        .from("profiles").select("user_id").eq("phone", body.phone).maybeSingle();
      let userId = existing?.user_id;
      if (!userId) {
        // Create auth user
        const fakeEmail = `phone_${body.phone.replace(/\D/g, "")}@ivr.local`;
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: fakeEmail,
          email_confirm: true,
          user_metadata: { full_name: body.customerName, phone: body.phone, source: "phone" },
        });
        if (authErr || !authUser.user) return err(authErr?.message || "User create failed", 500);
        userId = authUser.user.id;
      } else {
        await supabase.from("profiles").update({ full_name: body.customerName }).eq("user_id", userId);
      }

      // Final availability check (real busy + buffer)
      const busy = await getBusyIntervals(date, buffer);
      const conflict = busy.filter(([bs,be]) => {
        // Allow overlap with our own hold (matching exact times)
        return startMin < be && endMin + buffer > bs;
      }).some(([bs, be]) => {
        // Permit if exact match to a hold for this phone
        return !(bs === startMin && be === endMin + buffer);
      });
      if (conflict) return err("Slot already booked");

      // Insert appointment (use first service as treatment_id for legacy field)
      const firstSvc = body.services[0];
      const { data: appt, error: aErr } = await supabase.from("appointments").insert({
        appointment_date: date,
        start_time: minToTime(startMin),
        end_time: minToTime(endMin),
        client_id: userId,
        treatment_id: firstSvc.serviceId,
        status: "confirmed",
        booked_by_admin: true, // bypass overlap trigger; we already validated
        source: "phone",
        customer_phone: body.phone,
        customer_name: body.customerName,
        notes: body.notes || "",
      }).select("id").single();
      if (aErr) return err(aErr.message, 500);

      // Insert appointment_treatments
      const { data: trtRows } = await supabase
        .from("treatments").select("id,duration_minutes,is_variable_duration,price")
        .in("id", body.services.map((s: any) => s.serviceId));
      const atRows = body.services.map((s: any) => {
        const t = trtRows!.find(x => x.id === s.serviceId)!;
        const dur = t.is_variable_duration ? s.durationMinutes : t.duration_minutes;
        return {
          appointment_id: appt.id, treatment_id: s.serviceId,
          duration_minutes: dur, price: Number(t.price),
        };
      });
      await supabase.from("appointment_treatments").insert(atRows);

      // Release any matching holds
      await supabase.from("slot_holds").delete()
        .eq("hold_date", date).eq("start_time", minToTime(startMin));

      return ok({ appointmentId: appt.id });
    }

    // 7. GET /appointments/by-phone?phone=...
    if (req.method === "GET" && path === "/appointments/by-phone") {
      const phone = url.searchParams.get("phone");
      if (!phone) return err("phone required");
      const { data: appts } = await supabase
        .from("appointments")
        .select("id,appointment_date,start_time,status,customer_phone,client_id")
        .eq("customer_phone", phone)
        .eq("status", "confirmed")
        .gte("appointment_date", new Date().toISOString().slice(0,10))
        .order("appointment_date");
      const ids = (appts || []).map(a => a.id);
      const { data: ats } = ids.length ? await supabase
        .from("appointment_treatments")
        .select("appointment_id,duration_minutes,treatments(name)")
        .in("appointment_id", ids) : { data: [] as any[] };
      const result = (appts || []).map(a => {
        const d = new Date(a.appointment_date + "T00:00:00");
        return {
          id: a.id,
          date: a.appointment_date,
          hebrewDate: hebrewDate(d),
          time: a.start_time.slice(0,5),
          services: (ats || []).filter((x: any) => x.appointment_id === a.id).map((x: any) => ({
            name: x.treatments?.name, durationMinutes: x.duration_minutes,
          })),
        };
      });
      return ok({ appointments: result });
    }

    // 8. POST /appointments/cancel
    if (req.method === "POST" && path === "/appointments/cancel") {
      const body = await req.json();
      if (!body.appointmentId || !body.phone) return err("appointmentId and phone required");
      const { data: appt } = await supabase.from("appointments")
        .select("id,customer_phone,status").eq("id", body.appointmentId).maybeSingle();
      if (!appt) return err("Appointment not found", 404);
      if (appt.customer_phone !== body.phone) return err("Phone mismatch", 403);
      if (appt.status !== "confirmed") return err("Already cancelled");
      const { error } = await supabase.from("appointments")
        .update({ status: "cancelled" }).eq("id", body.appointmentId);
      if (error) return err(error.message, 500);
      return ok({});
    }

    // 9. GET /webhooks/events?since=ISO  -- pull queue for Make
    if (req.method === "GET" && path === "/webhooks/events") {
      const since = url.searchParams.get("since");
      let q = supabase.from("webhook_events").select("*")
        .eq("delivered", false).order("created_at").limit(100);
      if (since) q = q.gte("created_at", since);
      const { data } = await q;
      return ok({ events: data || [] });
    }

    // 9b. POST /webhooks/ack  { ids: [...] }
    if (req.method === "POST" && path === "/webhooks/ack") {
      const body = await req.json();
      if (!Array.isArray(body.ids)) return err("ids[] required");
      await supabase.from("webhook_events").update({ delivered: true }).in("id", body.ids);
      return ok({});
    }

    return err("Not found", 404);
  } catch (e: any) {
    console.error("ivr-api error:", e);
    return err(e?.message || "Internal error", 500);
  }
});
