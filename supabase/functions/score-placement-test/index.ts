import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { attempt_id, answers } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Récupérer les items du test pour le barème
    const { data: attempt } = await supabaseClient
      .from('placement_test_attempts')
      .select('test_id, student_name')
      .eq('id', attempt_id)
      .single()

    const { data: items } = await supabaseClient
      .from('placement_test_items')
      .select('*')
      .eq('test_id', attempt.test_id)

    // 2. Calcul des scores par niveau
    const resultsByLevel: any = { A1: { s:0, m:0 }, A2: { s:0, m:0 }, B1: { s:0, m:0 }, B2: { s:0, m:0 } }
    let totalScore = 0, maxScore = 0

    answers.forEach((ans: any) => {
      const item = items.find(i => i.id === ans.item_id)
      if (!item || !['CE', 'CO'].includes(item.skill)) return
      
      resultsByLevel[item.level_cecrl].m += item.weight
      if (ans.answer === item.correct_answer) {
        resultsByLevel[item.level_cecrl].s += item.weight
        totalScore += item.weight
      }
      maxScore += item.weight
    })

    // 3. Correction Expert EE/EO
    const productions = answers.filter(a => ['EE', 'EO'].includes(items.find(i => i.id === a.item_id)?.skill))
    const productionContext = productions.map(p => {
      const item = items.find(i => i.id === p.item_id)
      return { skill: item.skill, subject: item.question || item.support, answer: p.answer }
    })

    const correctionPrompt = `Tu es expert FLE TCF IRN. Note ces productions (EE/EO) selon le CECRL.
      ${JSON.stringify(productionContext)}
      Retourne un JSON avec: evaluations (tableau par skill), strengths (array), weaknesses (array de lacunes précises), confidence.`

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

    // 4. Calcul Niveau & Fiabilité
    const a1_ratio = resultsByLevel.A1.m > 0 ? resultsByLevel.A1.s / resultsByLevel.A1.m : 0
    let finalLevel = 'A0'
    if (a1_ratio > 0.5) finalLevel = 'A1'
    if (a1_ratio > 0.5 && (resultsByLevel.A2.s / resultsByLevel.A2.m) > 0.6) finalLevel = 'A2'
    if (finalLevel === 'A2' && (resultsByLevel.B1.s / resultsByLevel.B1.m) > 0.65) finalLevel = 'B1'
    if (finalLevel === 'B1' && (resultsByLevel.B2.s / resultsByLevel.B2.m) > 0.65) finalLevel = 'B2'

    const reliabilityFlag = a1_ratio < 0.7

    // 5. Funnel Commercial (Matching d'Offre)
    const { data: offers } = await supabaseClient.from('formation_offers').select('*').eq('is_active', true)
    const weaknesses = expertAnalysis.weaknesses.map((w: string) => w.toLowerCase())
    
    let recommendedOffer = null
    for (const offer of (offers || [])) {
      const hasKeyword = offer.keywords.some((kw: string) => 
        weaknesses.some((w: string) => w.includes(kw.toLowerCase())) ||
        (reliabilityFlag && kw.includes('socle a1'))
      )
      if (hasKeyword) { recommendedOffer = offer; break }
    }
    if (!recommendedOffer && offers) {
      recommendedOffer = offers.find(o => o.niveau_minimum <= finalLevel && finalLevel <= o.niveau_maximum) || offers[0]
    }

    const profileMessage = reliabilityFlag || finalLevel === 'A0'
      ? `Votre niveau de base est en cours de construction. Nos experts peuvent vous accompagner dès maintenant.`
      : finalLevel === 'A1'
      ? `Vous communiquez dans des situations simples. Pour la carte de séjour, le niveau A2 est requis.`
      : finalLevel === 'A2'
      ? `Niveau A2 acquis ! Pour la carte de résident (10 ans), le niveau B1 est désormais exigé.`
      : `Excellente maîtrise. Pour viser la nationalité, le niveau B2 est recommandé.`

    // 6. Sauvegarde finale
    await supabaseClient.from('placement_test_results').insert({
      attempt_id,
      estimated_level: finalLevel,
      global_score_pct: Math.round((totalScore / maxScore) * 100),
      recommended_offer_json: recommendedOffer,
      profile_message: profileMessage,
      strengths: expertAnalysis.strengths,
      weaknesses: expertAnalysis.weaknesses,
      detailed_analysis: {
        ...expertAnalysis,
        reliability_flag: reliabilityFlag ? 'Socle A1 insuffisant' : null,
        phonetics_note: "La phonétique n'a pas été mesurée par ce simulateur."
      }
    })

    return new Response(JSON.stringify({ success: true, attempt_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
