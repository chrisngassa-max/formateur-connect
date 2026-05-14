import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { title, contexts } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Définition des quotas et cases
    const QUOTAS = [
      { skill: 'CE', level: 'A1', count: 4, weight: 5 },
      { skill: 'CE', level: 'A2', count: 4, weight: 10 },
      { skill: 'CE', level: 'B1', count: 4, weight: 15 },
      { skill: 'CE', level: 'B2', count: 4, weight: 20 },
      { skill: 'CO', level: 'A1', count: 4, weight: 5 },
      { skill: 'CO', level: 'A2', count: 4, weight: 10 },
      { skill: 'CO', level: 'B1', count: 4, weight: 15 },
      { skill: 'CO', level: 'B2', count: 4, weight: 20 },
      { skill: 'EE', level: 'A1_A2', count: 1, weight: 0 },
      { skill: 'EE', level: 'A2_B1', count: 1, weight: 0 },
      { skill: 'EE', level: 'B1_B2', count: 1, weight: 0 },
      { skill: 'EO', level: 'A1_A2', count: 1, weight: 0 },
      { skill: 'EO', level: 'A2_B1', count: 1, weight: 0 },
      { skill: 'EO', level: 'B1_B2', count: 1, weight: 0 },
    ]

    // 2. Extraction de la banque (exercices statut 'publie' et formateur_id is null)
    const bankContext: any = {}
    for (const q of QUOTAS) {
      const { data: exercises } = await supabaseClient
        .from('exercices')
        .select('id, titre, consigne, competence, niveau_vise, contenu')
        .is('formateur_id', null)
        .eq('statut', 'publie')
        .eq('competence', q.skill.startsWith('E') ? q.skill : q.skill) // Gestion EE/EO/CE/CO
        .limit(10) // On en prend un peu plus pour laisser Claude choisir

      bankContext[`${q.skill}_${q.level}`] = exercises || []
    }

    // 3. Appel à Claude
    const prompt = `Tu es expert TCF IRN. Ton rôle est de générer un test de positionnement (38 items) en transformant des exercices issus d'une banque pédagogique.

CONTEXTE BANQUE :
${JSON.stringify(bankContext)}

CONSIGNES DE TRANSFORMATION :
- CE/CO : Transforme en QCM avec exactement 4 options (A, B, C, D). Une seule bonne réponse.
- CO : Ajoute obligatoirement un 'audio_script' (dialogue ou message vocal réaliste en France).
- EE/EO : Reformule la consigne pour une tâche de production claire (ex: écrire un mail, présenter son parcours).
- SI LA BANQUE EST VIDE pour une case : Génère un item 'from scratch' cohérent (vie en France).

RETOURNE UNIQUEMENT CE JSON (38 items exactement) :
{
  "title": "${title || 'Test Expert Banque V2'}",
  "items": [
    {
      "source_exercise_id": "uuid_de_la_banque_ou_null",
      "skill": "CE|CO|EE|EO",
      "level_cecrl": "A1|A2|B1|B2",
      "weight": 5|10|15|20,
      "context": "...",
      "support": "...",
      "question": "...",
      "options": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
      "correct_answer": "A|B|C|D",
      "audio_script": "..."
    }
  ]
}`

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const claudeData = await claudeRes.json()
    const content = JSON.parse(claudeData.content[0].text)

    // 4. Insertion Test & Items (avec TTS)
    const { data: test } = await supabaseClient.from('placement_tests').insert({
      title: content.title,
      status: 'draft',
      variant_name: 'Expert Banque V2',
      niveaux_couverts: ['A1', 'A2', 'B1', 'B2']
    }).select().single()

    const GOOGLE_TTS_API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY')
    const itemsToInsert = []

    for (const [idx, item] of content.items.entries()) {
      let audioUrl = null
      if (item.skill === 'CO' && item.audio_script && GOOGLE_TTS_API_KEY) {
        // Logique TTS simplifiée (identique à la v1 mais intégrée ici)
        try {
          const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({
              input: { text: item.audio_script },
              voice: { languageCode: 'fr-FR', name: 'fr-FR-Standard-C' },
              audioConfig: { audioEncoding: 'MP3' }
            })
          })
          const ttsData = await ttsRes.json()
          if (ttsData.audioContent) {
            const fileName = `${test.id}/item_${idx}.mp3`
            await supabaseClient.storage.from('test-audio').upload(fileName, Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0)), { contentType: 'audio/mpeg' })
            const { data: { publicUrl } } = supabaseClient.storage.from('test-audio').getPublicUrl(fileName)
            audioUrl = publicUrl
          }
        } catch (e) { console.error("TTS Failed", e) }
      }

      itemsToInsert.push({
        ...item,
        test_id: test.id,
        order_index: idx,
        audio_url: audioUrl
      })
    }

    await supabaseClient.from('placement_test_items').insert(itemsToInsert)

    return new Response(JSON.stringify({ success: true, testId: test.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
