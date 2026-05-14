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

    // 1. Quotas V2
    const CASES = [
      { skill: 'CE', level: 'A1', quota: 4, weight: 5 },
      { skill: 'CE', level: 'A2', quota: 4, weight: 10 },
      { skill: 'CE', level: 'B1', quota: 4, weight: 15 },
      { skill: 'CE', level: 'B2', quota: 4, weight: 20 },
      { skill: 'CO', level: 'A1', quota: 4, weight: 5 },
      { skill: 'CO', level: 'A2', quota: 4, weight: 10 },
      { skill: 'CO', level: 'B1', quota: 4, weight: 15 },
      { skill: 'CO', level: 'B2', quota: 4, weight: 20 },
      { skill: 'EE', level: 'A1_A2', levels: ['A1','A2'], quota: 1 },
      { skill: 'EE', level: 'A2_B1', levels: ['A2','B1'], quota: 1 },
      { skill: 'EE', level: 'B1_B2', levels: ['B1','B2'], quota: 1 },
      { skill: 'EO', level: 'A1_A2', levels: ['A1','A2'], quota: 1 },
      { skill: 'EO', level: 'A2_B1', levels: ['A2','B1'], quota: 1 },
      { skill: 'EO', level: 'B1_B2', levels: ['B1','B2'], quota: 1 },
    ]

    // 2. Fetch Bank Content
    const bankData: any = {}
    for (const c of CASES) {
      let query = supabaseClient
        .from('exercices')
        .select('id, titre, consigne, competence, niveau_vise, contenu')
        .is('formateur_id', null)
        .eq('statut', 'publie')
        .eq('competence', c.skill)
      
      if (c.levels) query = query.in('niveau_vise', c.levels)
      else query = query.eq('niveau_vise', c.level)

      const { data } = await query.limit(c.quota * 3)
      bankData[`${c.skill}_${c.level}`] = data || []
    }

    // 3. Claude Prompt V2
    const prompt = `SYSTEM: Tu es expert FLE / TCF IRN. Transforme ces exercices de banque en items de test.
RÈGLES :
- CE/CO : QCM 4 options (A/B/C/D), 1 seule bonne.
- CO : audio_script obligatoire.
- Distracteurs : Basés sur erreurs FLE classiques (phonétique, faux-amis, temps).
- Thématiques : Vie quotidienne, Travail, Administration, Citoyenneté.

BANQUE : ${JSON.stringify(bankData)}

RETOURNE UNIQUEMENT CE JSON (38 items) :
{
  "title": "${title || 'Test Expert Banque V2'}",
  "items": [
    {
      "source_exercise_id": "uuid_ou_null",
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

    // 4. Test Creation & Items Insert (with TTS)
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
