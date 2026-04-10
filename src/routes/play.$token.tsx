import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';

export const Route = createFileRoute('/play/$token')({
  component: PlayPage,
});

type ExerciceFormat = 'qcm' | 'vrai_faux' | 'texte_libre' | 'association' | 'ordre';

interface PlayExercice {
  id: string;
  titre: string;
  consigne: string;
  competence: string;
  format: ExerciceFormat;
  contenu: { items: PlayItem[] };
  niveau_vise: string;
  difficulte: number;
}

interface PlayItem {
  question: string;
  options?: string[];
  bonne_reponse: string | number;
  explication?: string;
}

interface ItemResult {
  question: string;
  reponse_donnee: string | number;
  bonne_reponse: string | number;
  correct: boolean;
  explication?: string;
}

interface AttemptResult {
  score_normalized: number;
  correct_count: number;
  total_items: number;
  feedback_text: string;
  item_results: Record<string, ItemResult>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function PlayPage() {
  const { token } = Route.useParams();
  const [exercice, setExercice] = useState<PlayExercice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const timerRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) { setNotFound(true); setLoading(false); return; }

    fetch(`${supabaseUrl}/functions/v1/play-exercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ play_token: token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); }
        else { setExercice(data); }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [token]);

  // Démarrer le chrono quand l'exercice est chargé
  useEffect(() => {
    if (!exercice || result) return;
    intervalRef.current = setInterval(() => {
      timerRef.current += 1;
      setElapsed(timerRef.current);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [exercice, result]);

  const handleSubmit = async () => {
    if (!exercice) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSubmitting(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const answersArray = Object.entries(answers).map(([idx, reponse]) => ({
      item_index: Number(idx),
      reponse,
    }));

    const res = await fetch(`${supabaseUrl}/functions/v1/auto-correct-exercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise_id: exercice.id,
        learner_id: 'anonymous',
        assignment_id: null,
        answers: answersArray,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (data.error) {
      alert('Erreur lors de la correction : ' + data.error);
      return;
    }

    setResult(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Chargement de l'exercice…</p>
        </div>
      </div>
    );
  }

  if (notFound || !exercice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2 max-w-sm px-4">
          <p className="text-2xl font-bold text-foreground">Exercice introuvable</p>
          <p className="text-sm text-muted-foreground">Ce lien est invalide ou l'exercice n'est pas encore disponible.</p>
        </div>
      </div>
    );
  }

  const items = exercice.contenu?.items ?? [];

  if (result) {
    const itemResultsArray = Object.values(result.item_results);
    return (
      <div className="min-h-screen bg-background flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-3">
            <div className={`inline-flex h-24 w-24 items-center justify-center rounded-full mx-auto ${result.score_normalized >= 70 ? 'bg-green-50' : result.score_normalized >= 50 ? 'bg-yellow-50' : 'bg-red-50'}`}>
              <span className={`text-3xl font-bold ${result.score_normalized >= 70 ? 'text-green-600' : result.score_normalized >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {result.score_normalized}%
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground">Exercice terminé</h2>
            <p className="text-sm text-muted-foreground">{result.correct_count} / {result.total_items} bonne{result.correct_count > 1 ? 's' : ''} réponse{result.correct_count > 1 ? 's' : ''}</p>
            <p className="text-sm font-medium text-foreground">{result.feedback_text}</p>
          </div>

          <div className="space-y-3">
            {itemResultsArray.map((ir, i) => (
              <div key={i} className={`rounded-lg border p-4 ${ir.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <p className="text-sm font-medium text-foreground mb-1">{ir.question}</p>
                {!ir.correct && (
                  <p className="text-xs text-muted-foreground">
                    Ta réponse : <span className="text-red-600 font-medium">{String(ir.reponse_donnee)}</span>
                    {' · '}Bonne réponse : <span className="text-green-600 font-medium">{String(ir.bonne_reponse)}</span>
                  </p>
                )}
                {ir.explication && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{ir.explication}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-xl space-y-6">
        {/* En-tête */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{exercice.competence} · {exercice.niveau_vise}</p>
            <h1 className="text-lg font-bold text-foreground mt-0.5">{exercice.titre}</h1>
            <p className="text-sm text-muted-foreground mt-1">{exercice.consigne}</p>
          </div>
          <div className="shrink-0 ml-4 text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1">
            {formatTime(elapsed)}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{i + 1}. {item.question}</p>

              {/* QCM */}
              {(exercice.format === 'qcm' || (item.options && item.options.length > 2)) && item.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {item.options.map((opt, j) => (
                    <button
                      key={j}
                      onClick={() => setAnswers(prev => ({ ...prev, [i]: String(j) }))}
                      className={`text-left text-sm rounded-md px-3 py-2 border transition-colors ${
                        answers[i] === String(j)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:bg-accent text-foreground'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Vrai / Faux */}
              {exercice.format === 'vrai_faux' && (!item.options || item.options.length <= 2) && (
                <div className="flex gap-2">
                  {['Vrai', 'Faux'].map((label) => (
                    <button
                      key={label}
                      onClick={() => setAnswers(prev => ({ ...prev, [i]: label }))}
                      className={`flex-1 text-sm rounded-md px-3 py-2 border transition-colors ${
                        answers[i] === label
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:bg-accent text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Texte libre / texte à trous */}
              {exercice.format === 'texte_libre' && (
                <input
                  type="text"
                  value={answers[i] ?? ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  placeholder="Votre réponse…"
                  className="w-full text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>
          ))}
        </div>

        {/* Bouton valider */}
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length < items.length}
          className="w-full rounded-lg bg-primary text-primary-foreground font-semibold py-3 text-sm transition-opacity disabled:opacity-50"
        >
          {submitting ? 'Correction en cours…' : 'Valider mes réponses'}
        </button>

        {Object.keys(answers).length < items.length && (
          <p className="text-center text-xs text-muted-foreground">
            {items.length - Object.keys(answers).length} réponse{items.length - Object.keys(answers).length > 1 ? 's' : ''} manquante{items.length - Object.keys(answers).length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
