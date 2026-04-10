import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Pas de X-Frame-Options pour permettre l'intégration en iframe
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Utilise la clé anon car la politique RLS "anon_play_token" autorise la lecture
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { play_token } = await req.json();

    if (!play_token) {
      return new Response(JSON.stringify({ error: 'play_token requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Lire l'exercice par play_token — uniquement si is_live_ready = true
    // Sélectionner uniquement les champs publics (pas formateur_id, pas play_token)
    const { data: exercice, error } = await supabase
      .from('exercices')
      .select('id, titre, consigne, competence, format, contenu, niveau_vise, difficulte')
      .eq('play_token', play_token)
      .eq('is_live_ready', true)
      .single();

    if (error || !exercice) {
      return new Response(JSON.stringify({ error: 'Exercice introuvable ou non disponible' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(exercice), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
