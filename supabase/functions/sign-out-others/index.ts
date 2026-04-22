// Edge Function : déconnecte toutes les sessions de l'utilisateur sauf celle en cours
// Appelée après un changement de mot de passe pour invalider les éventuelles sessions
// compromises sur d'autres appareils.
//
// À déployer avec :  supabase functions deploy sign-out-others
// Dans supabase/config.toml :
//   [functions.sign-out-others]
//   verify_jwt = false   # ← UNE SEULE ligne, vérification faite dans le code

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Client admin (service_role) pour vérifier le token et déconnecter
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Vérifier que le JWT est valide et récupérer l'user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Déconnecter toutes les autres sessions (scope = 'others')
    // → la session courante (celle qui a fait la requête) reste active
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user.id, 'others')
    if (signOutError) {
      console.error('Error signing out others:', signOutError)
      return new Response(JSON.stringify({ error: signOutError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
