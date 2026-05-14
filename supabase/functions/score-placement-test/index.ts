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

    // 3. Appel à Claude pour correction experte EE/EO
    const productions = answers.filter(a => ['EE', 'EO'].includes(items.find(i => i.id === a.item_id)?.skill))
    const productionContext = productions.map(p => {
      const item = items.find(i => i.id === p.item_id)
      return {
        skill: item.skill,
        level: item.level_cecrl,
        subject: item.question || item.support,
        answer: p.answer,
        word_count: (p.answer || "").split(/\s+/).length
      }
    })

    const correctionPrompt = `Tu es un expert en évaluation FLE et correcteur officiel certifié pour le TCF IRN. 
Ta mission est de noter les productions suivantes de manière strictement objective selon les échelles du CECRL.

CRITÈRES :
1. Adéquation à la tâche (respect consigne, longueur).
2. Capacité linguistique (grammaire, conjugaison, lexique).
3. Cohérence et cohésion (connecteurs logiques).
4. Pragmatique (pour EO : fluidité, argumentation).

PRODUCTIONS À ÉVALUER :
${JSON.stringify(productionContext)}

FORMAT DE SORTIE (JSON strict) :
{
  "evaluations": [
    {
      "skill": "EE|EO",
      "niveau_estime": "A1|A2|B1|B2",
      "score_sur_20": 0.0,
      "statut": "acquis|fragile|non_atteint",
      "analyse_detaillee": {
        "consigne": "...",
        "points_forts": ["..."],
        "lacunes": ["..."],
        "remediation": "Conseil précis (ex: travailler le passé composé)."
      },
      "fiabilite_correction": "haute|moyenne"
    }
  ],
  "global_feedback": "Synthèse pédagogique globale",
  "confidence": "haute|moyenne"
}`

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: correctionPrompt }]
      })
    })
    const claudeData = await claudeRes.json()
    const expertAnalysis = JSON.parse(claudeData.content[0].text)

    // 4. Calcul du niveau global (Logique par paliers + Détection d'anomalies)
    let finalLevel = 'A0'
    let anomalyDetected = false

    const a1_ratio = resultsByLevel.A1.m > 0 ? resultsByLevel.A1.s / resultsByLevel.A1.m : 0
    const a2_ratio = resultsByLevel.A2.m > 0 ? resultsByLevel.A2.s / resultsByLevel.A2.m : 0
    const b1_ratio = resultsByLevel.B1.m > 0 ? resultsByLevel.B1.s / resultsByLevel.B1.m : 0
    const b2_ratio = resultsByLevel.B2.m > 0 ? resultsByLevel.B2.s / resultsByLevel.B2.m : 0

    if (a1_ratio > 0.5) {
      finalLevel = 'A1'
      if (a2_ratio > 0.6) {
        finalLevel = 'A2'
        if (b1_ratio > 0.65) {
          finalLevel = 'B1'
          if (b2_ratio > 0.65) finalLevel = 'B2'
        }
      }
    }

    // Calcul du Score de Fiabilité
    const reliabilityFlag = a1_ratio < 0.7
      ? 'Socle A1 insuffisant — scores B1/B2 non représentatifs'
      : null

    // Détection d'anomalie : B2 réussi mais A1/A2 échoué
    if (b2_ratio > 0.7 && (a1_ratio < 0.4 || a2_ratio < 0.4)) {
      anomalyDetected = true
    }

    // 5. Ranking d'offre (Sales Funnel)
    const { data: offers } = await supabaseClient.from('training_offers').select('*')
    let recommendedOfferId = null
    
    if (finalLevel === 'A1' && a1_ratio < 0.6) {
      recommendedOfferId = offers?.find(o => o.code === 'PACK_ALPHA')?.id
    } else if (a1_ratio >= 0.7 && finalLevel === 'A2') {
      recommendedOfferId = offers?.find(o => o.code === 'CARTE_SEJOUR_A2')?.id
    } else if (finalLevel === 'B1' && expertAnalysis.evaluations.some((e: any) => e.statut === 'fragile')) {
      recommendedOfferId = offers?.find(o => o.code === 'RESIDENCE_B1')?.id
    } else if (finalLevel === 'B1' && a1_ratio > 0.9) {
      recommendedOfferId = offers?.find(o => o.code === 'NATIO_B2')?.id
    } else if (expertAnalysis.evaluations.some((e: any) => e.analyse_detaillee.lacunes.some((l: string) => l.toLowerCase().includes('admin') || l.toLowerCase().includes('caf')))) {
      recommendedOfferId = offers?.find(o => o.code === 'ADMIN_BOOSTER')?.id
    }
    const { data: attempt_meta } = await supabaseClient.from('placement_test_attempts').select('student_name').eq('id', attempt_id).single()
    
    const { error: insertError } = await supabaseClient.from('placement_test_results').insert({
      attempt_id,
      estimated_level: finalLevel,
      global_score_pct: Math.round((totalScore / maxScore) * 100),
      recommended_offer_id: recommendedOfferId,
      strengths: expertAnalysis.evaluations.flatMap((e: any) => e.analyse_detaillee.points_forts),
      weaknesses: expertAnalysis.evaluations.flatMap((e: any) => e.analyse_detaillee.lacunes),
      detailed_analysis: {
        ...expertAnalysis,
        anomaly_detected: anomalyDetected,
        reliability_flag: reliabilityFlag,
        phonetics_note: "Évaluation basée sur la structure et le lexique. La phonétique n'a pas été mesurée par ce simulateur.",
        ratios: { a1_ratio, a2_ratio, b1_ratio, b2_ratio }
      },
      confidence_level: (anomalyDetected || reliabilityFlag) ? "Faible" : expertAnalysis.confidence
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
