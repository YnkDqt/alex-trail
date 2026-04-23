import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });

    // Client user (pour identifier l'utilisateur)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Client admin (pour unenroll sans contrainte AAL)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupérer l'utilisateur depuis le JWT
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { recoveryCode, factorId } = await req.json();
    if (!recoveryCode || !factorId) {
      return new Response(JSON.stringify({ error: "Missing recoveryCode or factorId" }), { status: 400, headers: corsHeaders });
    }

    // Hasher le code côté serveur (même algo que le client)
    const encoder = new TextEncoder();
    const data = encoder.encode(recoveryCode.trim().toUpperCase());
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Vérifier le code en base
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("mfa_recovery_codes")
      .select("id, used")
      .eq("user_id", user.id)
      .eq("code_hash", hashHex)
      .limit(1);

    if (fetchErr) return new Response(JSON.stringify({ error: "DB error" }), { status: 500, headers: corsHeaders });
    if (!rows?.length) return new Response(JSON.stringify({ error: "Code invalide" }), { status: 400, headers: corsHeaders });
    if (rows[0].used) return new Response(JSON.stringify({ error: "Code déjà utilisé" }), { status: 400, headers: corsHeaders });

    // Marquer le code comme utilisé
    await supabaseAdmin
      .from("mfa_recovery_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", rows[0].id);

    // Désactiver le facteur TOTP via admin (pas de contrainte AAL)
    const { error: unenrollErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: factorId,
    });

    if (unenrollErr) return new Response(JSON.stringify({ error: unenrollErr.message }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
