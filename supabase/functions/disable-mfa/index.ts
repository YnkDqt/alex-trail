// Edge Function: disable-mfa
// Valide un code de récupération et désactive la 2FA via l'API admin

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const jsonResponse = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== disable-mfa invoked ===");

    // 1. Auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("ERROR: Missing Authorization header");
      return jsonResponse({ error: "Missing auth" }, 401);
    }
    const userJwt = authHeader.replace("Bearer ", "");

    // 2. Identifier l'utilisateur via l'API REST (plus fiable que le SDK dans Deno)
    console.log("Step 1: fetching user from JWT...");
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${userJwt}`,
      },
    });
    if (!userRes.ok) {
      const t = await userRes.text();
      console.log("ERROR: user fetch failed:", userRes.status, t);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const user = await userRes.json();
    if (!user?.id) {
      console.log("ERROR: no user id in response", JSON.stringify(user));
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.log("User id:", user.id);

    // 3. Body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.log("ERROR: invalid JSON body", e.message);
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
    const { recoveryCode } = body;
    if (!recoveryCode) {
      console.log("ERROR: missing recoveryCode");
      return jsonResponse({ error: "Missing recoveryCode" }, 400);
    }
    console.log("Recovery code received (length):", recoveryCode.length);

    // 4. Hasher le code (SHA-256)
    const normalized = recoveryCode.trim().toUpperCase();
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    console.log("Hash computed:", hashHex.substring(0, 10) + "...");

    // 5. Chercher le code en base via REST
    console.log("Step 2: searching code in DB...");
    const codeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/mfa_recovery_codes?user_id=eq.${user.id}&code_hash=eq.${hashHex}&select=id,used&limit=1`,
      {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!codeRes.ok) {
      const t = await codeRes.text();
      console.log("ERROR: DB query failed:", codeRes.status, t);
      return jsonResponse({ error: "DB error: " + t }, 500);
    }
    const rows = await codeRes.json();
    console.log("Rows found:", rows.length);

    if (!rows.length) return jsonResponse({ error: "Code invalide" }, 400);
    if (rows[0].used) return jsonResponse({ error: "Code déjà utilisé" }, 400);

    // 6. Lister les facteurs de l'utilisateur
    console.log("Step 3: listing user factors...");
    const factorsRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${user.id}/factors`,
      {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!factorsRes.ok) {
      const t = await factorsRes.text();
      console.log("ERROR: list factors failed:", factorsRes.status, t);
      return jsonResponse({ error: "List factors failed: " + t }, 500);
    }
    const factorsData = await factorsRes.json();
    console.log("Factors response:", JSON.stringify(factorsData).substring(0, 500));

    // Selon la version de l'API, la réponse peut être { factors: [...] } ou [...]
    const factorsArr = Array.isArray(factorsData) ? factorsData : (factorsData.factors || []);
    const totp = factorsArr.find((f: any) => f.factor_type === "totp" && f.status === "verified");
    if (!totp) {
      console.log("ERROR: no verified totp factor");
      return jsonResponse({ error: "Aucun facteur TOTP actif" }, 400);
    }
    console.log("TOTP factor id:", totp.id);

    // 7. Marquer le code utilisé
    console.log("Step 4: marking code used...");
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/mfa_recovery_codes?id=eq.${rows[0].id}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
      }
    );
    if (!updateRes.ok) {
      const t = await updateRes.text();
      console.log("WARN: update code used failed:", updateRes.status, t);
      // non bloquant
    }

    // 8. Supprimer le facteur
    console.log("Step 5: deleting factor...");
    const delRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${user.id}/factors/${totp.id}`,
      {
        method: "DELETE",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!delRes.ok) {
      const t = await delRes.text();
      console.log("ERROR: delete factor failed:", delRes.status, t);
      return jsonResponse({ error: "Suppression facteur échouée: " + t }, 500);
    }

    console.log("=== SUCCESS ===");
    return jsonResponse({ success: true });
  } catch (err) {
    console.log("UNCAUGHT ERROR:", err?.message, err?.stack);
    return jsonResponse({ error: err?.message || "Internal error" }, 500);
  }
});
