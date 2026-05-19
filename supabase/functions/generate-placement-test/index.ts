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
        .eq('statut', 'published')
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

    const CLAUDE_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('CLAUDE_API_KEY')
    let generated: any;
    try {
      if (!CLAUDE_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is not defined");
      }
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: `Génère 38 items basés sur cette banque : ${JSON.stringify(bankData)}. Format JSON : { items: [...] }` }]
        })
      })

      const claudeData = await claudeRes.json()
      console.log("Claude API Response status:", claudeRes.status, "Body:", JSON.stringify(claudeData))
      if (!claudeData.content || !claudeData.content[0]) {
        throw new Error(`Claude API Error (status ${claudeRes.status}): ${JSON.stringify(claudeData)}`)
      }
      generated = JSON.parse(claudeData.content[0].text)
    } catch (apiErr) {
      console.warn("Anthropic API failed or balance empty. Falling back to local deterministic generation. Error:", apiErr.message)
      
      const items: any[] = []
      for (const c of CASES) {
        const key = `${c.skill}_${c.level || c.levels?.join('_')}`
        const exercises = bankData[key] || []
        
        const selectedEx = exercises.slice(0, c.quota)
        
        while (selectedEx.length < c.quota) {
          selectedEx.push({
            id: `mock-${c.skill}-${c.level || c.levels?.join('_')}-${selectedEx.length}`,
            titre: `Exercice de secours ${c.skill} ${c.level || c.levels?.join('_')}`,
            consigne: c.skill === 'CE' ? "Lisez le texte et répondez à la question." : c.skill === 'CO' ? "Écoutez l'enregistrement et répondez." : "Rédigez votre réponse selon la consigne.",
            competence: c.skill,
            niveau_vise: c.level || c.levels?.[0] || 'A1',
            contenu: {
              texte: "Ceci est un exercice de secours généré automatiquement en raison de l'indisponibilité temporaire du moteur d'IA.",
              audio_script: "Bonjour, ceci est un message de secours.",
              options: ["Option A", "Option B", "Option C", "Option D"],
              bonne_reponse: 0
            }
          })
        }

        for (const ex of selectedEx) {
          const content = ex.contenu || {}
          
          const origOpts = Array.isArray(content.options) ? content.options : 
                           (content.options && typeof content.options === 'object') ? Object.values(content.options) : 
                           ["Option A", "Option B", "Option C", "Option D"]
          
          const optionKeys = ["A", "B", "C", "D"]
          const formattedOpts = origOpts.slice(0, 4).map((text: any, index: number) => ({
            id: optionKeys[index] || "A",
            text: String(text)
          }))

          const correctAnsMap = ["A", "B", "C", "D"]
          const corrIdx = typeof content.bonne_reponse === 'number' ? content.bonne_reponse : 0
          const correctAns = correctAnsMap[corrIdx] ?? "A"

          items.push({
            skill: c.skill,
            level_cecrl: c.level || c.levels?.[0] || 'A1',
            weight: c.weight || 10,
            context: ex.titre || "Situation",
            support: content.texte || content.audio_script || ex.consigne || "Consigne",
            question: ex.consigne || "Choisissez la bonne réponse :",
            options: formattedOpts,
            correct_answer: correctAns,
            audio_script: content.audio_script || null,
            source_exercise_id: ex.id.startsWith('mock-') ? null : ex.id
          })
        }
      }
      generated = { items }
    }

    // Deactivate previous active tests to avoid violating unique constraint "idx_placement_tests_one_active"
    await supabaseClient.from('placement_tests').update({ is_active: false }).eq('is_active', true)

    // 4. Création du test en base
    const { data: test, error: testErr } = await supabaseClient.from('placement_tests').insert({
      title: `Simulation TCF IRN - ${variant} - ${new Date().toLocaleDateString()}`,
      variant_name: variant,
      is_active: true,
      status: 'published'
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
      options: item.options,
      correct_answer: item.correct_answer,
      audio_script: item.audio_script,
      source_exercise_id: item.source_exercise_id
    }))

    const { error: itemsErr } = await supabaseClient.from('placement_test_items').insert(itemsToInsert)
    if (itemsErr) throw itemsErr

    return new Response(JSON.stringify({ success: true, test_id: test.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
