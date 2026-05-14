import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { variant = 'Expert' } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Définition des quotas V2 (38 items total)
    const CASES = [
      { skill: 'CE', level: 'A1', quota: 4, weight: 5 },
      { skill: 'CE', level: 'A2', quota: 4, weight: 10 },
      { skill: 'CE', level: 'B1', quota: 4, weight: 15 },
      { skill: 'CE', level: 'B2', quota: 4, weight: 20 },
      { skill: 'CO', level: 'A1', quota: 4, weight: 5 },
      { skill: 'CO', level: 'A2', quota: 4, weight: 10 },
      { skill: 'CO', level: 'B1', quota: 4, weight: 15 },
      { skill: 'CO', level: 'B2', quota: 4, weight: 20 },
      { skill: 'EE', levels: ['A1','A2'], quota: 1 },
      { skill: 'EE', levels: ['A2','B1'], quota: 1 },
      { skill: 'EE', levels: ['B1','B2'], quota: 1 },
      { skill: 'EO', levels: ['A1','A2'], quota: 1 },
      { skill: 'EO', levels: ['A2','B1'], quota: 1 },
      { skill: 'EO', levels: ['B1','B2'], quota: 1 },
    ]

    // 2. Fetch de la banque d'exercices (statut = 'publie')
    const bankData: any = {}
    for (const c of CASES) {
      const query = supabaseClient.from('exercices').select('id, titre, consigne, competence, niveau_vise, contenu')
        .is('formateur_id', null)
        .eq('statut', 'publie')
        .eq('competence', c.skill)
      
      if (c.level) query.eq('niveau_vise', c.level)
      else if (c.levels) query.in('niveau_vise', c.levels)
      
      const { data } = await query.limit(c.quota * 3)
      bankData[`${c.skill}_${c.level || c.levels?.join('_')}`] = data || []
    }

    // 3. Appel Claude 3.5 Sonnet pour transformation experte
    const systemPrompt = `Tu es expert FLE TCF IRN. Transforme ces exercices de banque en items de test V2.
    RÈGLES : 
    - CE/CO -> QCM 4 options (A/B/C/D). Une seule bonne réponse.
    - CO -> audio_script obligatoire (dialogue/message fr-FR).
    - EE/EO -> Consigne claire et contextualisée.
    - DISTRACTEURS : Basés sur les confusions phonétiques ("ils ont/sont"), faux-amis, ou conjugaison.
    - THÉMATIQUES : Vie quotidienne, Travail, Administration, Citoyenneté.
    - Traçabilité : Renvoie source_exercise_id si issu de la banque.`

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: `Génère 38 items basés sur cette banque : ${JSON.stringify(bankData)}. Format JSON : { items: [...] }` }]
      })
    })

    const claudeData = await claudeRes.json()
    const generated = JSON.parse(claudeData.content[0].text)

    // 4. Création du test en base
    const { data: test, error: testErr } = await supabaseClient.from('placement_tests').insert({
      title: `Simulation TCF IRN - ${variant} - ${new Date().toLocaleDateString()}`,
      variant_name: variant,
      is_active: true
    }).select().single()

    if (testErr) throw testErr

    // 5. Insertion des items
    const itemsToInsert = generated.items.map((item: any) => ({
      test_id: test.id,
      skill: item.skill,
      level_cecrl: item.level_cecrl,
      weight: item.weight || 10,
      context: item.context,
      support: item.support,
      question: item.question,
      options_v2: item.options,
      correct_answer: item.correct_answer,
      audio_script: item.audio_script,
      source_exercise_id: item.source_exercise_id
    }))

    await supabaseClient.from('placement_test_items').insert(itemsToInsert)

    return new Response(JSON.stringify({ success: true, test_id: test.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
