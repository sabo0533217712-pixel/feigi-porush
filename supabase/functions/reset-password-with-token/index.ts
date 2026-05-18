import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, new_password } = await req.json();

    if (!token || typeof token !== "string" || !new_password || typeof new_password !== "string") {
      return json({ error: "invalid_input" }, 400);
    }
    if (new_password.length < 6) {
      return json({ error: "password_too_short" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up token
    const { data: tok, error: tokErr } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used")
      .eq("token", token)
      .maybeSingle();

    if (tokErr || !tok) return json({ error: "invalid_token" }, 400);
    if (tok.used) return json({ error: "token_used" }, 400);
    if (new Date(tok.expires_at).getTime() < Date.now()) return json({ error: "token_expired" }, 400);

    // Update password
    const { error: upErr } = await supabase.auth.admin.updateUserById(tok.user_id, {
      password: new_password,
    });
    if (upErr) return json({ error: upErr.message }, 400);

    // Mark token used
    await supabase.from("password_reset_tokens").update({ used: true }).eq("id", tok.id);

    // Return user email so the client can sign them in automatically
    const { data: userInfo } = await supabase.auth.admin.getUserById(tok.user_id);

    return json({ success: true, email: userInfo?.user?.email ?? null });
  } catch (e) {
    return json({ error: (e as Error).message ?? "unknown_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
