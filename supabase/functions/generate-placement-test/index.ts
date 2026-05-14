import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, levels, skills, contexts } = await req.json()
    
    // Auth & Client
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Non autorisé')

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const GOOGLE_TTS_API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY')
    
    // 1. Prompt Expert V2 (16 CO + 16 CE + 3 EE + 3 EO)
    const prompt = `Expert TCF IRN. Génère un test de positionnement pédagogique semi-officiel pour adultes allophones.
Niveaux : A1 à B2 (nouveau référentiel).
Contextes : ${contexts?.join(', ') || 'vie quotidienne, administration, travail'}.

Structure demandée (exactement 38 items) :
- CE (Compréhension Écrite) : 16 QCM (4×A1, 4×A2, 4×B1, 4×B2)
- CO (Compréhension Orale) : 16 QCM (4×A1, 4×A2, 4×B1, 4×B2) -> Fournis un "audio_script" riche.
- EE (Expression Écrite) : 3 tâches (1×A1/A2 descriptif, 1×A2/B1 récit, 1×B1/B2 opinion)
- EO (Expression Orale) : 3 tâches (1×A1/A2 présentation, 1×A2/B1 interaction, 1×B1/B2 point de vue)

Règles strictes :
- QCM : 4 options (A, B, C, D) avec une seule bonne réponse.
- Pondération : A1=5pts, A2=10pts, B1=15pts, B2=20pts.
- Les supports doivent être réalistes (emails, SMS, annonces, scripts de dialogues).

Retourne UNIQUEMENT ce JSON :
{
  "title": "${title || 'Test de positionnement Expert TCF'}",
  "items": [
    {
      "skill": "CE",
      "level_cecrl": "A1",
      "weight": 5,
      "context": "...",
      "support": "...", 
      "question": "...",
      "options": [{"id": "A", "text": "..."}, {"id": "B", "text": "..."}, {"id": "C", "text": "..."}, {"id": "D", "text": "..."}],
      "correct_answer": "A",
      "audio_script": null
    }
  ]
}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const claudeData = await claudeRes.json()
    if (!claudeData.content) throw new Error("Erreur Claude: " + JSON.stringify(claudeData))
    const content = JSON.parse(claudeData.content[0].text)

    // 2. Création du test
    const { data: test, error: testError } = await supabaseClient
      .from('placement_tests')
      .insert({
        title: content.title,
        created_by: user.id,
        status: 'draft',
        niveaux_couverts: ['A1', 'A2', 'B1', 'B2'],
        competences: ['CE', 'CO', 'EE', 'EO'],
        variant_name: 'Expert V2'
      })
      .select().single()

    if (testError) throw testError

    // 3. Traitement des items & TTS pour la CO
    const processedItems = []
    for (const [index, item] of content.items.entries()) {
      let audioUrl = null

      // Si c'est de la CO et qu'on a un script + clé Google
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
            const fileName = `${test.id}/${item.skill}_${index}.mp3`
            const { data: uploadData } = await supabaseClient.storage
              .from('test-audio')
              .upload(fileName, Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0)), {
                contentType: 'audio/mpeg',
                upsert: true
              })
            
            if (uploadData) {
              const { data: { publicUrl } } = supabaseClient.storage.from('test-audio').getPublicUrl(fileName)
              audioUrl = publicUrl
            }
          }
        } catch (e) {
          console.error("TTS Failed for item", index, e)
        }
      }

      processedItems.push({
        ...item,
        test_id: test.id,
        order_index: index,
        audio_url: audioUrl
      })
    }

    const { error: itemsError } = await supabaseClient
      .from('placement_test_items')
      .insert(processedItems)

    if (itemsError) throw itemsError

    return new Response(JSON.stringify({ success: true, testId: test.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
