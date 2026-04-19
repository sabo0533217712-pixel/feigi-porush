// Notify business owner of new appointments via Make.com webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HDate } from "https://esm.sh/@hebcal/core@5.4.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://hook.eu1.make.com/y1ydq0w5onkccb38lhk88yd5k50sukce";

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

// Convert Israeli phone to E.164 international format (+972...)
function toInternationalPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const appointment_id = body?.appointment_id;
    if (!appointment_id || typeof appointment_id !== "string") {
      return new Response(
        JSON.stringify({ error: "appointment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const [{ data: profile }, { data: treatment }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("user_id", apt.client_id)
        .maybeSingle(),
      supabase
        .from("treatments")
        .select("name, duration_minutes")
        .eq("id", apt.treatment_id)
        .maybeSingle(),
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
    const treatmentName = treatment?.name ?? "";
    const notesText = apt.notes?.trim() ?? "";

    // Pre-built message for the business owner (plain text — they forward it)
    const message_plain =
      `נקבע תור חדש ✨\n` +
      `לקוחה: ${clientName}\n` +
      `טלפון: ${clientPhone}${phoneIntl ? ` (${phoneIntl})` : ""}\n` +
      `${profile?.email ? `אימייל: ${profile.email}\n` : ""}` +
      `טיפול: ${treatmentName}\n` +
      `יום ${dayName}, ${dateGregorian}${dateHebrew ? ` (${dateHebrew})` : ""}\n` +
      `שעה: ${startTime}-${endTime} (${duration_minutes} דקות)` +
      `${notesText ? `\nהערות מהלקוחה: ${notesText}` : ""}`;

    const message_html =
      `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;">` +
      `<p><strong>נקבע תור חדש ✨</strong></p>` +
      `<p><strong>לקוחה:</strong> ${clientName}<br>` +
      `<strong>טלפון:</strong> ${clientPhone}${phoneIntl ? ` (${phoneIntl})` : ""}<br>` +
      `${profile?.email ? `<strong>אימייל:</strong> ${profile.email}<br>` : ""}` +
      `<strong>טיפול:</strong> ${treatmentName}</p>` +
      `<p><strong>מועד:</strong> יום ${dayName}, ${dateGregorian}${dateHebrew ? ` (${dateHebrew})` : ""}<br>` +
      `<strong>שעה:</strong> ${startTime}-${endTime} (${duration_minutes} דקות)</p>` +
      `${notesText ? `<p><strong>הערות מהלקוחה:</strong><br>${notesText.replace(/\n/g, "<br>")}</p>` : ""}` +
      `</div>`;

    const payload = {
      event: "appointment_created",
      title: "נקבע תור בהצלחה",
      actor: "client",
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
        notes: apt.notes ?? "",
      },
      message: {
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
    console.log("notify-business webhook:", res.status, text);

    return new Response(JSON.stringify({ success: res.ok, status: res.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-business error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
