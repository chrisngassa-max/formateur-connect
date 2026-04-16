import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import type { Exercice, Resultat } from '@/types/database';
import { useAuth } from '@/hooks/use-auth';
import { CheckCircle, Clock, Play } from 'lucide-react';

export const Route = createFileRoute('/eleve')({
  component: ElevePage,
});

type Tab = 'a_faire' | 'en_cours' | 'termine';

function ElevePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('a_faire');
  const [assignations, setAssignations] = useState<any[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [activeExercice, setActiveExercice] = useState<Exercice | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('exercise_assignments').select('*, exercice:exercices(*)').eq('learner_id', profile.id),
      supabase.from('resultats').select('*, exercice:exercices(*)').eq('eleve_id', profile.id),
    ]).then(([assRes, resRes]) => {
      setAssignations(assRes.data ?? []);
      setResultats((resRes.data as Resultat[]) ?? []);
    });
  }, [profile]);

  const completedIds = new Set(resultats.map(r => r.exercice_id));
  const aFaire = assignations.filter(a => !completedIds.has(a.exercise_id));
  const termines = resultats;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'a_faire', label: 'À faire', count: aFaire.length },
    { key: 'en_cours', label: 'En cours', count: activeExercice ? 1 : 0 },
    { key: 'termine', label: 'Terminé', count: termines.length },
  ];

  const startExercice = (ex: Exercice) => {
    setActiveExercice(ex);
    setAnswers({});
    setShowResult(false);
    setTab('en_cours');
  };

  const submitExercice = async () => {
    if (!activeExercice || !profile) return;
    const items = (activeExercice.contenu as any)?.items || [];
    const correct = items.filter((item: any, i: number) => answers[i] === item.reponse).length;
    const pct = items.length > 0 ? Math.round((correct / items.length) * 100) : 0;
    setScore(pct);
    setShowResult(true);

    await supabase.from('resultats').insert({
      exercice_id: activeExercice.id,
      eleve_id: profile.id,
      score: pct,
      reponses_eleve: answers,
    });
  };

  return (
    <AppLayout>
      <PageHeader title="Mes exercices" />

      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'a_faire' && (
        <div className="space-y-3">
          {aFaire.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun exercice à faire</p>
          ) : aFaire.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <CompetenceBadge competence={a.exercice?.competence} />
                  <div>
                    <p className="text-sm font-medium">{a.exercice?.titre || 'Exercice'}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.due_date ? `Avant le ${new Date(a.due_date).toLocaleDateString('fr-FR')}` : 'Pas de date limite'}
                    </p>
                  </div>
                </div>
                <Button size="sm" className="gap-1" onClick={() => startExercice(a.exercice)}>
                  <Play className="h-3 w-3" /> Commencer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'en_cours' && activeExercice && !showResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CompetenceBadge competence={activeExercice.competence} />
              {activeExercice.titre}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{activeExercice.consigne}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {((activeExercice.contenu as any)?.items || []).map((item: any, i: number) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium mb-3">{item.question}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(item.options || []).map((opt: string, j: number) => (
                    <button
                      key={j}
                      onClick={() => setAnswers(prev => ({ ...prev, [i]: j }))}
                      className={`text-left text-sm rounded-md px-3 py-2 border transition-colors ${
                        answers[i] === j
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={submitExercice} className="w-full gap-2">
              <CheckCircle className="h-4 w-4" /> Soumettre
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'en_cours' && showResult && (
        <Card>
          <CardContent className="text-center py-12">
            <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full mb-4 ${score >= 70 ? 'bg-success/10' : 'bg-warning/10'}`}>
              <span className={`text-3xl font-bold ${score >= 70 ? 'text-success' : 'text-warning'}`}>{score}%</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">Exercice terminé !</h3>
            <p className="text-sm text-muted-foreground">Score : {score}%</p>
            <Button variant="outline" className="mt-4" onClick={() => { setActiveExercice(null); setTab('termine'); }}>
              Retour
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'en_cours' && !activeExercice && (
        <p className="text-sm text-muted-foreground text-center py-12">Aucun exercice en cours</p>
      )}

      {tab === 'termine' && (
        <div className="space-y-3">
          {termines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun exercice terminé</p>
          ) : termines.map(r => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <CompetenceBadge competence={(r.exercice as any)?.competence || 'CO'} />
                  <div>
                    <p className="text-sm font-medium">{(r.exercice as any)?.titre || 'Exercice'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${r.score >= 70 ? 'text-success' : 'text-warning'}`}>{r.score}%</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
