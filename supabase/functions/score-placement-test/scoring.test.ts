// supabase/functions/score-placement-test/scoring.test.ts
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { scorePlacement, Item, Answer } from "./scoring.ts"

// Générateur d'items mockés
function createMockItems(): Item[] {
  const items: Item[] = []
  const levels = ["A1", "A2", "B1", "B2"] as const
  const skills = ["CE", "CO"] as const
  
  let idCounter = 1
  for (const lvl of levels) {
    for (const skill of skills) {
      for (let i = 0; i < 4; i++) {
        items.push({
          id: `item_${lvl}_${skill}_${idCounter++}`,
          skill,
          level_cecrl: lvl,
          weight: lvl === "A1" ? 5 : lvl === "A2" ? 10 : lvl === "B1" ? 15 : 20,
          correct_answer: "A"
        })
      }
    }
  }
  return items
}

// 1. Profil standard : Normal A1
Deno.test("Profil 1 : Normal A1", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // A1 : tout juste
  items.filter(i => i.level_cecrl === "A1").forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 30 })
  })
  // Autres niveaux : tout faux
  items.filter(i => i.level_cecrl !== "A1").forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 30 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.estimated_level, "A1")
  assertEquals(results.flags.includes("PROFIL_INCOHERENT"), false)
})

// 2. Profil standard : Normal A2
Deno.test("Profil 2 : Normal A2", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // A1 et A2 : tout juste
  items.filter(i => ["A1", "A2"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 40 })
  })
  // B1 et B2 : tout faux
  items.filter(i => ["B1", "B2"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 30 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.estimated_level, "A2")
})

// 3. Profil standard : Normal B1
Deno.test("Profil 3 : Normal B1", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // A1, A2, B1 : tout juste
  items.filter(i => ["A1", "A2", "B1"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 45 })
  })
  // B2 : tout faux
  items.filter(i => i.level_cecrl === "B2").forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 30 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.estimated_level, "B1")
})

// 4. Profil standard : Normal B2
Deno.test("Profil 4 : Normal B2", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // Tout juste
  items.forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 50 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.estimated_level, "B2")
})

// 5. Profil Incohérent : Miraculé (Échec A1 mais réussite B2)
Deno.test("Profil 5 : Incohérent (Échec A1 mais réussite B2)", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // Échec cuisant sur A1
  items.filter(i => i.level_cecrl === "A1").forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 40 })
  })
  // Réussite totale B2
  items.filter(i => i.level_cecrl === "B2").forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 40 })
  })
  // Reste faux
  items.filter(i => ["A2", "B1"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 40 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.flags.includes("PROFIL_INCOHERENT"), true)
})

// 6. Profil Lecteur Lent (Pénalité temporelle)
Deno.test("Profil 6 : Lecteur Lent (temps de réponse excessif)", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // A1, A2, B1 : correct et rapide (10s)
  items.filter(i => ["A1", "A2", "B1"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 10 })
  })
  // B2 : correct et très lent (120s > 2x médiane B1 de 10s)
  items.filter(i => i.level_cecrl === "B2").forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 120 })
  })

  const results = scorePlacement(items, answers)
  // B2 doit être pénalisé à 0.7
  assertEquals(results.reliability_by_level.B2, 0.7)
  // B1 doit rester intact à 1.0
  assertEquals(results.reliability_by_level.B1, 1.0)
})

// 7. Profil Tricheur (Vitesse suspecte B1/B2 correcte)
Deno.test("Profil 7 : Tricheur (temps suspect rapide avec réussite B1/B2)", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // A1 et A2 : 30 secondes
  items.filter(i => ["A1", "A2"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 30 })
  })
  // B1 et B2 : 2 secondes (très suspect) avec réponse correcte
  items.filter(i => ["B1", "B2"].includes(i.level_cecrl)).forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 2 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.flags.includes("ALERTE_VITESSE_INCOHERENTE"), true)
})

// 8. Profil Fatigue (Dégradation rapide sur le dernier tiers)
Deno.test("Profil 8 : Fatigue (Chute brutale de performance et temps de réponse)", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // On trie les items par ordre pour simuler la chronologie
  const A1items = items.filter(i => i.level_cecrl === "A1")
  const A2items = items.filter(i => i.level_cecrl === "A2")
  const B1items = items.filter(i => i.level_cecrl === "B1")
  const B2items = items.filter(i => i.level_cecrl === "B2")

  // Tiers 1 et 2 (début et milieu) : Concentré, réponses lentes (60s) et correctes
  ;[...A1items, ...A2items, ...B1items].forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 60 })
  })
  // Tiers 3 (fin) : Épuisé, répond au hasard hyper vite (5s) et tout faux
  B2items.forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 5 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.flags.includes("FATIGUE_DETECTEE"), true)
})

// 9. Profil Miraculé (Échec A2 mais réussite B1)
Deno.test("Profil 9 : Miraculé (Échec A2 mais réussite B1)", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // A1 : tout juste
  items.filter(i => i.level_cecrl === "A1").forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 30 })
  })
  // A2 : seulement 2 réponses correctes sur 8 (25% < 50% de preuve)
  const a2Items = items.filter(i => i.level_cecrl === "A2")
  a2Items.forEach((i, idx) => {
    answers.push({ item_id: i.id, answer: idx < 2 ? "A" : "B", time_spent: 30 })
  })
  // B1 : 7 réponses correctes sur 8 (87.5% >= 75%)
  const b1Items = items.filter(i => i.level_cecrl === "B1")
  b1Items.forEach((i, idx) => {
    answers.push({ item_id: i.id, answer: idx < 7 ? "A" : "B", time_spent: 30 })
  })
  // B2 : tout faux
  items.filter(i => i.level_cecrl === "B2").forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 30 })
  })

  const results = scorePlacement(items, answers)
  // Pas de preuve sur A2 car le taux A2 est trop faible (25% < 50%)
  assertEquals(results.flags.includes("SOCLE_VALIDE_PAR_PREUVE_A2"), false)
  // Le profil doit être marqué comme incohérent
  assertEquals(results.flags.includes("PROFIL_INCOHERENT"), true)
})

// 10. Profil Asymétrique CE/CO
Deno.test("Profil 10 : Asymétrique CE/CO (> 25% écart)", () => {
  const items = createMockItems()
  const answers: Answer[] = []

  // CE : Réussite totale
  items.filter(i => i.skill === "CE").forEach(i => {
    answers.push({ item_id: i.id, answer: "A", time_spent: 30 })
  })
  // CO : Échec total
  items.filter(i => i.skill === "CO").forEach(i => {
    answers.push({ item_id: i.id, answer: "B", time_spent: 30 })
  })

  const results = scorePlacement(items, answers)
  assertEquals(results.flags.includes("PROFIL_ASYMETRIQUE"), true)
})
