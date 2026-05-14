import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { attempt_id, answers, student_name } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Récupération des items pour correction
    const { data: attempt } = await supabaseClient
      .from('placement_test_attempts')
      .select('*, placement_tests(*)')
      .eq('id', attempt_id)
      .single()

    const { data: items } = await supabaseClient
      .from('placement_test_items')
      .select('*')
      .eq('test_id', attempt.test_id)

    // 2. Correction QCM (CE/CO) et préparation EE/EO
    let totalScore = 0
    let maxScore = 0
    const resultsByLevel = { A1: { s: 0, m: 0 }, A2: { s: 0, m: 0 }, B1: { s: 0, m: 0 }, B2: { s: 0, m: 0 } }
    const ee_responses = []
    const eo_responses = []

    for (const item of items) {
      const studentAnswer = answers.find(a => a.item_id === item.id)?.answer
      const isCorrect = studentAnswer === item.correct_answer
      const weight = item.weight || (item.level_cecrl === 'A1' ? 5 : item.level_cecrl === 'A2' ? 10 : item.level_cecrl === 'B1' ? 15 : 20)

      if (['CE', 'CO'].includes(item.skill)) {
        maxScore += weight
        if (isCorrect) {
          totalScore += weight
          resultsByLevel[item.level_cecrl].s += weight
        }
        resultsByLevel[item.level_cecrl].m += weight
      } else if (item.skill === 'EE') {
        ee_responses.push({ question: item.question, response: studentAnswer, level: item.level_cecrl })
      } else if (item.skill === 'EO') {
        eo_responses.push({ question: item.question, response: studentAnswer, level: item.level_cecrl })
      }
    }

    // 3. Analyse Expert via Claude (EE / EO)
    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const analysisPrompt = `Tu es un évaluateur expert TCF IRN. Analyse les productions suivantes :
ÉCRIT : ${JSON.stringify(ee_responses)}
ORAL (Transcription) : ${JSON.stringify(eo_responses)}

Critères : Respect consigne, Grammaire, Vocabulaire, Cohérence.
Donne une estimation CECRL globale et par compétence.

Réponds UNIQUEMENT en JSON :
{
  "global_level": "...",
  "ee_level": "...",
  "eo_level": "...",
  "confidence": "Forte",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "analysis": "..."
}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: analysisPrompt }]
      })
    })
    const claudeData = await claudeRes.json()
    const expertAnalysis = JSON.parse(claudeData.content[0].text)

    // 4. Calcul du niveau global (Logique par paliers)
    let finalLevel = 'A0'
    if (resultsByLevel.A1.s / resultsByLevel.A1.m > 0.5) {
      finalLevel = 'A1'
      if (resultsByLevel.A2.s / resultsByLevel.A2.m > 0.6) {
        finalLevel = 'A2'
        if (resultsByLevel.B1.s / resultsByLevel.B1.m > 0.65) {
          finalLevel = 'B1'
          if (resultsByLevel.B2.s / resultsByLevel.B2.m > 0.65) finalLevel = 'B2'
        }
      }
    }

    // 5. Sauvegarde des résultats
    await supabaseClient.from('placement_test_results').insert({
      attempt_id,
      global_level: finalLevel,
      co_level: resultsByLevel.B1.s / resultsByLevel.B1.m > 0.5 ? 'B1' : 'A2', // Simplifié
      ce_level: resultsByLevel.B1.s / resultsByLevel.B1.m > 0.5 ? 'B1' : 'A2',
      ee_level: expertAnalysis.ee_level,
      eo_level: expertAnalysis.eo_level,
      global_score_pct: Math.round((totalScore / maxScore) * 100),
      strengths: expertAnalysis.strengths,
      weaknesses: expertAnalysis.weaknesses,
      confidence_level: expertAnalysis.confidence,
      detailed_analysis: expertAnalysis
    })

    await supabaseClient.from('placement_test_attempts').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_score: totalScore,
      max_score: maxScore,
      estimated_level: finalLevel
    }).eq('id', attempt_id)

    return new Response(JSON.stringify({ success: true, attempt_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
