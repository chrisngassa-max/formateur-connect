import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { scorePlacement } from "./scoring.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { attempt_id, answers } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // 1. Récupérer les items du test pour le barème et la correction
    const { data: attempt, error: attemptErr } = await supabaseClient
      .from("placement_test_attempts")
      .select("test_id, student_name")
      .eq("id", attempt_id)
      .single()

    if (attemptErr || !attempt) {
      throw new Error(`Placement test attempt not found: ${attemptErr?.message}`)
    }

    const { data: items, error: itemsErr } = await supabaseClient
      .from("placement_test_items")
      .select("*")
      .eq("test_id", attempt.test_id)

    if (itemsErr || !items) {
      throw new Error(`Placement test items not found: ${itemsErr?.message}`)
    }

    // 2. Calcul du score via les 10 Commandements V3
    const parsedAnswers = answers.map((ans: any) => ({
      item_id: ans.item_id,
      answer: ans.answer,
      time_spent: ans.time_spent ?? 0,
    }))

    const parsedItems = items.map((it: any) => ({
      id: it.id,
      skill: it.skill,
      level_cecrl: it.level_cecrl,
      weight: it.score ?? 1,
      correct_answer: it.correct_answer,
    }))

    const scores = scorePlacement(parsedItems, parsedAnswers)

    // 3. Correction Expert EE/EO via Anthropic (Sonnet)
    let expertAnalysis = { evaluations: [], strengths: [], weaknesses: [], confidence: 1.0 }
    const productions = answers.filter((a: any) => ["EE", "EO"].includes(items.find((i: any) => i.id === a.item_id)?.skill))

    if (productions.length > 0) {
      const productionContext = productions.map((p: any) => {
        const item = items.find((i: any) => i.id === p.item_id)
        return { skill: item.skill, subject: item.question || item.support, answer: p.answer }
      })

      const correctionPrompt = `Tu es expert FLE TCF IRN. Note ces productions (EE/EO) selon le CECRL.
        ${JSON.stringify(productionContext)}
        Retourne un JSON avec: evaluations (tableau par skill), strengths (array), weaknesses (array de lacunes précises), confidence.`

      // Utilisation unifiée de ANTHROPIC_API_KEY
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("CLAUDE_API_KEY")
      if (ANTHROPIC_API_KEY) {
        try {
          const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              messages: [{ role: "user", content: correctionPrompt }],
            }),
          })

          const claudeData = await claudeRes.json()
          const text = claudeData.content[0].text
          const cleanText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1)
          expertAnalysis = JSON.parse(cleanText)
        } catch (e) {
          console.error("Erreur lors de la correction Claude :", e)
        }
      }
    }

    // 4. Fusionner les forces/faiblesses comportementales et expertes
    const mergedStrengths = [...(expertAnalysis.strengths || [])]
    const mergedWeaknesses = [...(expertAnalysis.weaknesses || [])]

    if (scores.flags.includes("PROFIL_ASYMETRIQUE")) {
      mergedWeaknesses.push("Écart prononcé entre la compréhension orale et écrite.")
    }

    // 5. Funnel Commercial (Matching d'Offre)
    const { data: offers } = await supabaseClient
      .from("formation_offers")
      .select("*")
      .eq("is_active", true)

    const searchKeywords = mergedWeaknesses.map((w: string) => w.toLowerCase())
    let recommendedOffer = null

    for (const offer of (offers || [])) {
      const hasKeyword = offer.keywords?.some((kw: string) =>
        searchKeywords.some((w: string) => w.includes(kw.toLowerCase()))
      )
      if (hasKeyword) {
        recommendedOffer = offer
        break
      }
    }

    if (!recommendedOffer && offers && offers.length > 0) {
      // Fallback sur le niveau estimé
      recommendedOffer = offers.find(
        (o: any) => o.niveau_minimum <= scores.estimated_level && scores.estimated_level <= o.niveau_maximum
      ) || offers[0]
    }

    const profileMessage = scores.flags.includes("PROFIL_INCOHERENT")
      ? "Profil nécessitant un diagnostic approfondi par l'un de nos conseillers pédagogiques."
      : scores.estimated_level === "A0_pre_A1"
      ? "Votre niveau de base est en cours de construction. Nos experts peuvent vous accompagner dès maintenant."
      : scores.estimated_level === "A1"
      ? "Vous communiquez dans des situations simples. Pour la carte de séjour, le niveau A2 est requis."
      : scores.estimated_level === "A2"
      ? "Niveau A2 acquis ! Pour la carte de résident (10 ans), le niveau B1 est désormais exigé."
      : "Excellent niveau de base. Idéal pour préparer sereinement la citoyenneté française."

    // 6. Sauvegarde finale en base
    const upsertPayload = {
      attempt_id,
      global_level: scores.estimated_level,
      co_level: scores.rates_by_level.CO ? scores.estimated_level : null,
      ce_level: scores.rates_by_level.CE ? scores.estimated_level : null,
      global_score_pct: Math.min(100, Math.round((scores.total_score / 150) * 100)),
      strengths: mergedStrengths,
      weaknesses: mergedWeaknesses,
      recommended_offer_json: recommendedOffer,
      profile_message: profileMessage,
      flags: scores.flags,
      reliability_by_level: scores.reliability_by_level,
      time_metrics: scores.time_metrics,
      raw_analysis: {
        ...expertAnalysis,
        "10_commandements": scores,
      },
    }

    const { error: resultErr } = await supabaseClient
      .from("placement_test_results")
      .upsert(upsertPayload, { onConflict: "attempt_id" })

    if (resultErr) {
      throw new Error(`Failed to save placement test results: ${resultErr.message}`)
    }

    // 7. Mettre à jour le statut de la tentative
    await supabaseClient
      .from("placement_test_attempts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        total_score: scores.total_score,
        max_score: 150,
        estimated_level: scores.estimated_level,
      })
      .eq("id", attempt_id)

    return new Response(JSON.stringify({ success: true, attempt_id, estimated_level: scores.estimated_level }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
