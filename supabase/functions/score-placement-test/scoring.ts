// supabase/functions/score-placement-test/scoring.ts
// Algorithme 10 commandements — V3 finale

export type CecrlLevel = "A1" | "A2" | "B1" | "B2";
export type Skill = "CE" | "CO" | "EE" | "EO";

export interface Item {
  id: string;
  skill: Skill;
  level_cecrl: CecrlLevel;
  weight: number;
  correct_answer?: string;
}

export interface Answer {
  item_id: string;
  answer: string;
  time_spent: number; // en secondes
}

export interface ScoringResult {
  rates_by_level: Record<CecrlLevel, number>; // taux brut 0..1
  reliability_by_level: Record<CecrlLevel, number>; // 0.0 / 0.3 / 0.7 / 0.85 / 1.0
  level_scores: Record<CecrlLevel, number>; // score pondéré par fiabilité
  total_score: number;
  estimated_level: CecrlLevel | "A0_pre_A1";
  flags: string[];
  time_metrics: {
    medians_per_level_ms: Record<CecrlLevel, number>;
    total_active_time_ms: number;
    fatigue_indicators?: {
      time_drop_pct: number;
      success_drop_pts: number;
    };
  };
}

// --- Constantes des seuils validés ---
const LEVEL_WEIGHTS: Record<CecrlLevel, number> = { A1: 5, A2: 10, B1: 15, B2: 20 };
const RELIABILITY_THRESHOLDS = { high: 0.75, medium: 0.58, low: 0.42 };
const TIME_PENALTY_MULTIPLIER = 0.7; // si > 2x médiane

export function scorePlacement(items: Item[], answers: Answer[]): ScoringResult {
  // === Étape 1 — Taux bruts par niveau (CE + CO uniquement) ===
  const ratesByLevel: Record<CecrlLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const itemsByLevel: Record<CecrlLevel, Item[]> = { A1: [], A2: [], B1: [], B2: [] };
  const answersByLevel: Record<CecrlLevel, Answer[]> = { A1: [], A2: [], B1: [], B2: [] };

  for (const item of items) {
    if (item.skill !== "CE" && item.skill !== "CO") continue;
    itemsByLevel[item.level_cecrl].push(item);
  }

  for (const ans of answers) {
    const item = items.find((i) => i.id === ans.item_id);
    if (!item || (item.skill !== "CE" && item.skill !== "CO")) continue;
    answersByLevel[item.level_cecrl].push(ans);
  }

  for (const lvl of ["A1", "A2", "B1", "B2"] as CecrlLevel[]) {
    const total = itemsByLevel[lvl].length;
    if (total === 0) {
      ratesByLevel[lvl] = 0;
      continue;
    }
    const correct = answersByLevel[lvl].filter((a) => {
      const it = items.find((i) => i.id === a.item_id);
      return it && a.answer === it.correct_answer;
    }).length;
    ratesByLevel[lvl] = correct / total;
  }

  // === Étape 2 — Fiabilité par socle ===
  const flags: string[] = [];
  const reliability: Record<CecrlLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };

  for (const lvl of ["A1", "A2", "B1", "B2"] as CecrlLevel[]) {
    const r = ratesByLevel[lvl];
    if (r >= RELIABILITY_THRESHOLDS.high) reliability[lvl] = 1.0;
    else if (r >= RELIABILITY_THRESHOLDS.medium) reliability[lvl] = 0.7;
    else if (r >= RELIABILITY_THRESHOLDS.low) {
      reliability[lvl] = 0.3;
      flags.push(`FIABILITE_FAIBLE_${lvl}`);
    } else reliability[lvl] = 0.0;
  }

  // === Étape 3 — Remontée par preuve (1 niveau strict) ===
  const levels: CecrlLevel[] = ["A1", "A2", "B1", "B2"];
  for (let i = 1; i < levels.length; i++) {
    const N = levels[i];
    const Nminus1 = levels[i - 1];
    if (ratesByLevel[N] >= 0.75 && ratesByLevel[Nminus1] >= 0.5 && reliability[Nminus1] < 1.0) {
      reliability[N] = 1.0;
      reliability[Nminus1] = Math.max(0.85, reliability[Nminus1]);
      flags.push(`SOCLE_VALIDE_PAR_PREUVE_${Nminus1}`);
      // Suppression du flag FIABILITE_FAIBLE_<Nminus1> s'il existait
      const idx = flags.findIndex((f) => f === `FIABILITE_FAIBLE_${Nminus1}`);
      if (idx >= 0) flags.splice(idx, 1);
    }
  }

  // === Étape 4 — Pénalité temporelle SANS cascade ===
  const medianTimePerLevel: Record<CecrlLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const lvl of levels) {
    const times = answersByLevel[lvl].map((a) => a.time_spent).filter((t) => t > 0).sort((a, b) => a - b);
    medianTimePerLevel[lvl] = times.length > 0 ? times[Math.floor(times.length / 2)] : 0;
  }

  for (let i = 1; i < levels.length; i++) {
    const N = levels[i];
    const Nminus1 = levels[i - 1];
    const medPrev = medianTimePerLevel[Nminus1];
    if (medPrev > 0) {
      const timesN = answersByLevel[N].map((a) => a.time_spent);
      const avgN = timesN.length > 0 ? timesN.reduce((a, b) => a + b, 0) / timesN.length : 0;
      // Si le temps moyen au niveau N est > 2x la médiane du niveau N-1 → pénalité
      // (le candidat a galéré au niveau supérieur)
      if (avgN > 2 * medPrev) {
        reliability[N] = reliability[N] * TIME_PENALTY_MULTIPLIER;
        // Pas de cascade vers les niveaux supérieurs
      }
    }
  }

  // === Étape 5 — Incohérence verticale ===
  for (let i = 1; i < levels.length; i++) {
    const N = levels[i];
    const Nminus1 = levels[i - 1];
    if (reliability[Nminus1] === 0.0 && ratesByLevel[N] > 0.5) {
      if (!flags.includes("PROFIL_INCOHERENT")) flags.push("PROFIL_INCOHERENT");
    }
  }

  // === Étape 6 — Flags comportementaux ===
  // ALERTE_VITESSE_INCOHERENTE
  const timesB1B2 = [...answersByLevel.B1, ...answersByLevel.B2].map((a) => a.time_spent);
  if (timesB1B2.length > 0) {
    const allTimes = answers.map((a) => a.time_spent).sort((a, b) => a - b);
    const globalMedian = allTimes[Math.floor(allTimes.length / 2)];
    const avgB1B2 = timesB1B2.reduce((a, b) => a + b, 0) / timesB1B2.length;
    const successB1B2 = ratesByLevel.B1 + ratesByLevel.B2;
    if (globalMedian > 0 && avgB1B2 < globalMedian / 3 && successB1B2 > 1.2) {
      flags.push("ALERTE_VITESSE_INCOHERENTE");
    }
  }

  // FATIGUE_DETECTEE (chute entre 1er et 3e tiers)
  const sortedAnswers = [...answers].sort((a, b) => {
    const ia = items.findIndex((i) => i.id === a.item_id);
    const ib = items.findIndex((i) => i.id === b.item_id);
    return ia - ib;
  });
  const third = Math.floor(sortedAnswers.length / 3);
  if (third > 0) {
    const firstThird = sortedAnswers.slice(0, third);
    const lastThird = sortedAnswers.slice(-third);
    const t1 = firstThird.reduce((sum, a) => sum + a.time_spent, 0) / firstThird.length;
    const t3 = lastThird.reduce((sum, a) => sum + a.time_spent, 0) / lastThird.length;
    const s1 = firstThird.filter((a) => {
      const it = items.find((i) => i.id === a.item_id);
      return it && a.answer === it.correct_answer;
    }).length / firstThird.length;
    const s3 = lastThird.filter((a) => {
      const it = items.find((i) => i.id === a.item_id);
      return it && a.answer === it.correct_answer;
    }).length / lastThird.length;
    const timeDrop = t1 > 0 ? (t1 - t3) / t1 : 0;
    const successDrop = (s1 - s3) * 100;
    if (timeDrop > 0.6 && successDrop > 40) {
      flags.push("FATIGUE_DETECTEE");
    }
  }

  // PROFIL_ASYMETRIQUE (écart CO/CE > 25 pts)
  const ceItems = items.filter((i) => i.skill === "CE");
  const coItems = items.filter((i) => i.skill === "CO");
  const ceCorrect = answers.filter((a) => {
    const it = ceItems.find((i) => i.id === a.item_id);
    return it && a.answer === it.correct_answer;
  }).length;
  const coCorrect = answers.filter((a) => {
    const it = coItems.find((i) => i.id === a.item_id);
    return it && a.answer === it.correct_answer;
  }).length;
  const ceRate = ceItems.length > 0 ? ceCorrect / ceItems.length : 0;
  const coRate = coItems.length > 0 ? coCorrect / coItems.length : 0;
  if (Math.abs(ceRate - coRate) > 0.25) {
    flags.push("PROFIL_ASYMETRIQUE");
  }

  // === Étape 7 — Score final pondéré ===
  const levelScores: Record<CecrlLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  let totalScore = 0;
  for (const lvl of levels) {
    const raw = ratesByLevel[lvl] * LEVEL_WEIGHTS[lvl] * itemsByLevel[lvl].length;
    const final = raw * reliability[lvl];
    levelScores[lvl] = Math.round(final);
    totalScore += final;
  }

  // === Étape 8 — Classification finale ===
  let estimated_level: CecrlLevel | "A0_pre_A1" = "A0_pre_A1";
  for (const lvl of levels) {
    if (reliability[lvl] > 0.5) estimated_level = lvl;
  }

  // Calibrage prudent : si fragile, on descend d'un cran
  if (flags.includes(`FIABILITE_FAIBLE_${estimated_level}`) && estimated_level !== "A1") {
    const idx = levels.indexOf(estimated_level as CecrlLevel);
    if (idx > 0) estimated_level = levels[idx - 1];
  }

  return {
    rates_by_level: ratesByLevel,
    reliability_by_level: reliability,
    level_scores: levelScores,
    total_score: Math.round(totalScore),
    estimated_level,
    flags,
    time_metrics: {
      medians_per_level_ms: medianTimePerLevel,
      total_active_time_ms: answers.reduce((sum, a) => sum + a.time_spent * 1000, 0),
    },
  };
}
