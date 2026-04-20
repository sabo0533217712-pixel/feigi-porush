// Notify client of appointment changes via Make.com webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HDate } from "https://esm.sh/@hebcal/core@5.4.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://hook.eu1.make.com/5lldnxtw86mvk9d1a17o249wtt267v8u";

type EventType = "created" | "rescheduled" | "cancelled";
type Actor = "client" | "admin";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

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

function buildTitle(event: EventType, actor: Actor): string {
  if (event === "created" && actor === "client") return "התור נקבע בהצלחה";
  if (event === "created" && actor === "admin") return "נקבע לך תור בהצלחה";
  if (event === "rescheduled") return "התור שלך הועבר למועד חדש";
  if (event === "cancelled") return "התור שלך בוטל";
  return "עדכון לגבי התור שלך";
}

interface TreatmentItem {
  name: string;
  duration_minutes: number;
  price: number;
}

interface MessageContext {
  event: EventType;
  actor: Actor;
  clientName: string;
  treatmentName: string;
  treatments: TreatmentItem[];
  dayName: string;
  dateGregorian: string;
  dateHebrew: string;
  startTime: string;
  endTime: string;
  cancellationHours: number;
  previousLine?: string; // pre-formatted "מהמועד הקודם..." line, plain text
}

function treatmentLabelPlain(ctx: MessageContext): string {
  if (ctx.treatments.length > 1) {
    const list = ctx.treatments
      .map((t) => `• ${t.name}${t.duration_minutes ? ` (${t.duration_minutes} דק׳)` : ""}`)
      .join("\n");
    return `הטיפולים הכלולים בתור (${ctx.treatments.length}):\n${list}`;
  }
  return `טיפול: "${ctx.treatmentName}"`;
}

function treatmentLabelHtml(ctx: MessageContext): string {
  if (ctx.treatments.length > 1) {
    const items = ctx.treatments
      .map(
        (t) =>
          `<li>${t.name}${t.duration_minutes ? ` <span style="color:#888;">(${t.duration_minutes} דק׳)</span>` : ""}</li>`,
      )
      .join("");
    return `<p><strong>הטיפולים הכלולים בתור (${ctx.treatments.length}):</strong></p><ul style="margin:4px 0 8px 0;padding-right:20px;">${items}</ul>`;
  }
  return `<p><strong>טיפול:</strong> "${ctx.treatmentName}"</p>`;
}

function buildPlainMessage(ctx: MessageContext): string {
  const greeting = `שלום ${ctx.clientName},`;
  const slot = `יום ${ctx.dayName} ${ctx.dateGregorian}${ctx.dateHebrew ? ` (${ctx.dateHebrew})` : ""} בשעה ${ctx.startTime}`;
  const isMulti = ctx.treatments.length > 1;
  const treatmentLine = treatmentLabelPlain(ctx);
  let body = "";

  if (ctx.event === "created") {
    body = isMulti
      ? `${greeting}\n` +
        `נקבע לך תור ב${slot}.\n` +
        `${treatmentLine}\n` +
        `שימי לב: ניתן לבטל את התור עד ${ctx.cancellationHours} שעות לפני מועדו.`
      : `${greeting}\n` +
        `נקבע לך תור לטיפול ${ctx.treatmentName} ב${slot}.\n` +
        `שימי לב: ניתן לבטל את התור עד ${ctx.cancellationHours} שעות לפני מועדו.`;
  } else if (ctx.event === "rescheduled") {
    body = isMulti
      ? `${greeting}\n` +
        `התור שלך הועבר.\n` +
        `${treatmentLine}\n` +
        (ctx.previousLine ? `${ctx.previousLine}\n` : "") +
        `המועד החדש: ${slot}.`
      : `${greeting}\n` +
        `התור שלך לטיפול ${ctx.treatmentName} הועבר.\n` +
        (ctx.previousLine ? `${ctx.previousLine}\n` : "") +
        `המועד החדש: ${slot}.`;
  } else if (ctx.event === "cancelled") {
    body = isMulti
      ? `${greeting}\n` +
        `התור שלך שהיה אמור להתקיים ב${slot} בוטל.\n` +
        `${treatmentLine}\n` +
        `לקביעת תור חדש ניתן להיכנס למערכת.`
      : `${greeting}\n` +
        `התור שלך לטיפול ${ctx.treatmentName} שהיה אמור להתקיים ב${slot} בוטל.\n` +
        `לקביעת תור חדש ניתן להיכנס למערכת.`;
  }
  return body;
}

function buildHtmlMessage(ctx: MessageContext): string {
  const greeting = `שלום ${ctx.clientName},`;
  const slotHtml = `יום <strong>${ctx.dayName}</strong> ${ctx.dateGregorian}${ctx.dateHebrew ? ` (${ctx.dateHebrew})` : ""} בשעה <strong>${ctx.startTime}</strong>`;
  const isMulti = ctx.treatments.length > 1;
  const treatmentBlock = treatmentLabelHtml(ctx);
  const wrap = (inner: string) =>
    `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:600px;">${inner}</div>`;

  if (ctx.event === "created") {
    return wrap(
      `<p>${greeting}</p>` +
        (isMulti
          ? `<p>נקבע לך תור ב-${slotHtml}.</p>${treatmentBlock}`
          : `<p>נקבע לך תור לטיפול <strong>${ctx.treatmentName}</strong>,<br>${slotHtml}.</p>`) +
        `<p style="background:#fff7ed;border-right:3px solid #f59e0b;padding:10px 14px;border-radius:6px;">` +
        `שימי לב: ניתן לבטל את התור עד <strong>${ctx.cancellationHours} שעות</strong> לפני מועדו.` +
        `</p>`,
    );
  }
  if (ctx.event === "rescheduled") {
    return wrap(
      `<p>${greeting}</p>` +
        (isMulti
          ? `<p>התור שלך הועבר למועד חדש.</p>${treatmentBlock}`
          : `<p>התור שלך לטיפול <strong>${ctx.treatmentName}</strong> הועבר למועד חדש.</p>`) +
        (ctx.previousLine ? `<p style="color:#888;text-decoration:line-through;">${ctx.previousLine}</p>` : "") +
        `<p><strong>המועד החדש:</strong><br>${slotHtml}.</p>`,
    );
  }
  if (ctx.event === "cancelled") {
    return wrap(
      `<p>${greeting}</p>` +
        (isMulti
          ? `<p>התור שלך שהיה אמור להתקיים ${slotHtml} <strong>בוטל</strong>.</p>${treatmentBlock}`
          : `<p>התור שלך לטיפול <strong>${ctx.treatmentName}</strong> שהיה אמור להתקיים ${slotHtml} <strong>בוטל</strong>.</p>`) +
        `<p>לקביעת תור חדש ניתן להיכנס למערכת.</p>`,
    );
  }
  return wrap(`<p>${greeting}</p>`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const appointment_id: string | undefined = body?.appointment_id;
    const event: EventType | undefined = body?.event;
    const actor: Actor | undefined = body?.actor;
    const previous:
      | {
          date_gregorian?: string;
          start_time?: string;
          end_time?: string;
        }
      | undefined = body?.previous;

    if (!appointment_id || !event || !actor) {
      return new Response(JSON.stringify({ error: "appointment_id, event and actor are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select("id, appointment_date, start_time, end_time, notes, treatment_id, client_id")
      .eq("id", appointment_id)
      .single();

    if (aptErr || !apt) {
      console.error("Appointment not found:", aptErr);
      return new Response(JSON.stringify({ error: "appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: treatment }, { data: settings }, { data: aptTreatments }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, email, reminder_preference")
        .eq("user_id", apt.client_id)
        .maybeSingle(),
      supabase.from("treatments").select("name, duration_minutes").eq("id", apt.treatment_id).maybeSingle(),
      supabase.from("business_settings").select("cancellation_hours").limit(1).maybeSingle(),
      supabase
        .from("appointment_treatments")
        .select("treatment_id, duration_minutes, price, treatments(name)")
        .eq("appointment_id", apt.id),
    ]);

    const [sh, sm] = apt.start_time.split(":").map(Number);
    const [eh, em] = apt.end_time.split(":").map(Number);
    const duration_minutes = eh * 60 + em - (sh * 60 + sm);

    const pref = (profile?.reminder_preference ?? "whatsapp").toLowerCase();
    const channel = pref === "email" ? "email" : "whatsapp";

    const startTime = apt.start_time?.slice(0, 5) ?? apt.start_time;
    const endTime = apt.end_time?.slice(0, 5) ?? apt.end_time;
    const dateHebrew = buildHebrewDate(apt.appointment_date);
    const dateGregorian = formatGregorian(apt.appointment_date);
    const dayName = getHebrewDayName(apt.appointment_date);
    const clientName = profile?.full_name ?? "";
    const clientPhone = profile?.phone ?? "";
    const phoneIntl = toInternationalPhone(clientPhone);
    const cancellationHours = settings?.cancellation_hours ?? 24;

    // Build treatments list — fallback to single treatment when no rows in appointment_treatments
    type AT = { treatment_id: string; duration_minutes: number; price: number; treatments: { name: string } | null };
    const rawList = (aptTreatments ?? []) as unknown as AT[];
    const treatmentsList: TreatmentItem[] =
      rawList.length > 0
        ? rawList.map((r) => ({
            name: r.treatments?.name ?? "",
            duration_minutes: r.duration_minutes,
            price: Number(r.price ?? 0),
          }))
        : [
            {
              name: treatment?.name ?? "",
              duration_minutes: treatment?.duration_minutes ?? duration_minutes,
              price: 0,
            },
          ];
    const treatmentName =
      treatmentsList.length > 1
        ? treatmentsList
            .map((t) => t.name)
            .filter(Boolean)
            .join(" + ")
        : (treatment?.name ?? "");

    const previousBlock = previous
      ? {
          date_gregorian: previous.date_gregorian ?? null,
          date_hebrew: previous.date_gregorian ? buildHebrewDate(previous.date_gregorian) : "",
          start_time: previous.start_time?.slice(0, 5) ?? previous.start_time ?? null,
          end_time: previous.end_time?.slice(0, 5) ?? previous.end_time ?? null,
        }
      : undefined;

    const previousLine = previousBlock?.date_gregorian
      ? `המועד הקודם: יום ${getHebrewDayName(previousBlock.date_gregorian)} ${formatGregorian(previousBlock.date_gregorian)}${previousBlock.date_hebrew ? ` (${previousBlock.date_hebrew})` : ""} בשעה ${previousBlock.start_time}`
      : undefined;

    const msgCtx: MessageContext = {
      event,
      actor,
      clientName,
      treatmentName,
      treatments: treatmentsList,
      dayName,
      dateGregorian,
      dateHebrew,
      startTime,
      endTime,
      cancellationHours,
      previousLine,
    };

    const message_plain = buildPlainMessage(msgCtx);
    const message_html = buildHtmlMessage(msgCtx);

    const payload: Record<string, unknown> = {
      event: `appointment_${event}`,
      title: buildTitle(event, actor),
      actor,
      channel,
      client: {
        full_name: clientName,
        phone: clientPhone,
        phone_international: phoneIntl,
        email: profile?.email ?? "",
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
        ...(previousBlock ? { previous: previousBlock } : {}),
      },
      message: {
        // For email channel — use html. For whatsapp — use plain.
        html: message_html,
        plain: message_plain,
      },
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    console.log("notify-client webhook:", res.status, text);

    return new Response(JSON.stringify({ success: res.ok, status: res.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-client error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
