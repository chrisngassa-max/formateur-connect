// Edge Function: grant-formateur-role
// Vérifie le JWT de l'appelant puis octroie le rôle 'formateur' (idempotent)
// dans user_roles + profiles.role.
//
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // --- 1. Auth: vérifier le JWT de l'appelant ---
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Non authentifié' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: 'Token invalide' }, 401);
    }
    const userId = userData.user.id;
    const email = userData.user.email ?? '';

    // --- 2. Lire le body (optionnel: prenom/nom pour profile) ---
    let body: { prenom?: string; nom?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body vide accepté
    }

    // --- 3. Upsert user_roles (idempotent) ---
    const { error: roleErr } = await admin
      .from('user_roles')
      .upsert(
        { user_id: userId, role: 'formateur' },
        { onConflict: 'user_id,role', ignoreDuplicates: true },
      );
    if (roleErr) {
      console.error('user_roles upsert failed:', roleErr.message);
      return json({ error: 'Impossible d’attribuer le rôle', detail: roleErr.message }, 500);
    }

    // --- 4. Upsert profiles.role pour cohérence ---
    const prenom = (body.prenom ?? userData.user.user_metadata?.prenom ?? '').toString();
    const nom = (body.nom ?? userData.user.user_metadata?.nom ?? '').toString();

    const { error: profileErr } = await admin
      .from('profiles')
      .upsert(
        { id: userId, email, prenom, nom, role: 'formateur' },
        { onConflict: 'id' },
      );
    if (profileErr) {
      console.error('profiles upsert failed:', profileErr.message);
    }

    return json({ ok: true, role: 'formateur' });
  } catch (e) {
    console.error('grant-formateur-role error:', e);
    return json({ error: 'Erreur serveur' }, 500);
  }
});
