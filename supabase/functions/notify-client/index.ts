// Notify client of appointment changes via Make.com webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HDate } from "https://esm.sh/@hebcal/core@5.4.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://hook.eu1.make.com/5lldnxtw86mvk9d1a17o249wtt267v8u";

type EventType = "created" | "rescheduled" | "cancelled";
type Actor = "client" | "admin";

function buildHebrewDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const hd = new HDate(new Date(y, m - 1, d));
    return hd.renderGematriya();
  } catch {
    return "";
  }
}

function buildTitle(event: EventType, actor: Actor): string {
  if (event === "created" && actor === "client") return "התור נקבע בהצלחה";
  if (event === "created" && actor === "admin") return "נקבע לך תור בהצלחה";
  if (event === "rescheduled") return "התור שלך הועבר למועד חדש";
  if (event === "cancelled") return "התור שלך בוטל";
  return "עדכון לגבי התור שלך";
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
    const previous: {
      date_gregorian?: string;
      start_time?: string;
      end_time?: string;
    } | undefined = body?.previous;

    if (!appointment_id || !event || !actor) {
      return new Response(
        JSON.stringify({ error: "appointment_id, event and actor are required" }),
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
        .select("full_name, phone, email, reminder_preference")
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

    // Map reminder_preference → channel (email | whatsapp). Legacy 'sms' → whatsapp.
    const pref = (profile?.reminder_preference ?? "whatsapp").toLowerCase();
    const channel = pref === "email" ? "email" : "whatsapp";

    const previousBlock = previous
      ? {
          date_gregorian: previous.date_gregorian ?? null,
          date_hebrew: previous.date_gregorian ? buildHebrewDate(previous.date_gregorian) : "",
          start_time: previous.start_time?.slice(0, 5) ?? previous.start_time ?? null,
          end_time: previous.end_time?.slice(0, 5) ?? previous.end_time ?? null,
        }
      : undefined;

    const payload: Record<string, unknown> = {
      event: `appointment_${event}`,
      title: buildTitle(event, actor),
      actor,
      channel,
      client: {
        full_name: profile?.full_name ?? "",
        phone: profile?.phone ?? "",
        email: profile?.email ?? "",
      },
      appointment: {
        id: apt.id,
        date_gregorian: apt.appointment_date,
        date_hebrew: buildHebrewDate(apt.appointment_date),
        start_time: apt.start_time?.slice(0, 5) ?? apt.start_time,
        end_time: apt.end_time?.slice(0, 5) ?? apt.end_time,
        duration_minutes,
        treatment_name: treatment?.name ?? "",
        notes: apt.notes ?? "",
        ...(previousBlock ? { previous: previousBlock } : {}),
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
