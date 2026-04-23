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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Identifier l'utilisateur depuis le JWT
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { recoveryCode } = await req.json();
    if (!recoveryCode) return new Response(JSON.stringify({ error: "Missing recoveryCode" }), { status: 400, headers: corsHeaders });

    // Hasher le code
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(recoveryCode.trim().toUpperCase()));
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

    // Trouver le facteur TOTP via admin
    const { data: factors, error: factorsErr } = await supabaseAdmin.auth.admin.listFactors({ userId: user.id });
    if (factorsErr) return new Response(JSON.stringify({ error: "Erreur récupération facteurs" }), { status: 500, headers: corsHeaders });
    const totp = factors?.find((f: any) => f.factor_type === "totp" && f.status === "verified");
    if (!totp) return new Response(JSON.stringify({ error: "Aucun facteur TOTP actif" }), { status: 400, headers: corsHeaders });

    // Marquer le code utilisé
    await supabaseAdmin
      .from("mfa_recovery_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", rows[0].id);

    // Désactiver le facteur
    const { error: unenrollErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: totp.id,
    });
    if (unenrollErr) return new Response(JSON.stringify({ error: unenrollErr.message }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
