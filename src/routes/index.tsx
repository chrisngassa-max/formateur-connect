import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import { StatutBadge } from '@/components/StatutBadge';
import { useAuth } from '@/hooks/use-auth';
import { LoginForm } from '@/components/LoginForm';
import type { Exercice, Resultat } from '@/types/database';
import { FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const [exRes, resRes] = await Promise.all([
        supabase.from('exercices').select('*').eq('formateur_id', profile!.id).order('updated_at', { ascending: false }),
        supabase.from('resultats').select('*, exercice:exercices(*), eleve:profiles(*)').order('created_at', { ascending: false }).limit(10),
      ]);
      setExercices((exRes.data as Exercice[]) ?? []);
      setResultats((resRes.data as Resultat[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Chargement…</p></div>;
  if (!profile) return <LoginForm />;

  const counts = {
    brouillon: exercices.filter(e => e.statut === 'brouillon').length,
    en_attente: exercices.filter(e => e.statut === 'en_attente').length,
    valide: exercices.filter(e => e.statut === 'valide').length,
    total: exercices.length,
  };

  const pendingExercices = exercices.filter(e => e.statut === 'en_attente').slice(0, 5);

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Vue d'ensemble de vos exercices" />

      {loading ? (
        <p className="text-muted-foreground">Chargement des données…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={FileText} label="Total" value={counts.total} />
            <StatCard icon={Clock} label="Brouillons" value={counts.brouillon} />
            <StatCard icon={AlertTriangle} label="En attente" value={counts.en_attente} />
            <StatCard icon={CheckCircle} label="Validés" value={counts.valide} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Exercices à valider</CardTitle></CardHeader>
              <CardContent>
                {pendingExercices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun exercice en attente</p>
                ) : (
                  <div className="space-y-3">
                    {pendingExercices.map(ex => (
                      <div key={ex.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div className="flex items-center gap-2">
                          <CompetenceBadge competence={ex.competence} />
                          <span className="text-sm font-medium">{ex.titre || 'Sans titre'}</span>
                        </div>
                        <StatutBadge statut={ex.statut} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Dernières tentatives</CardTitle></CardHeader>
              <CardContent>
                {resultats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun résultat récent</p>
                ) : (
                  <div className="space-y-3">
                    {resultats.map(r => (
                      <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">{(r.eleve as any)?.prenom} {(r.eleve as any)?.nom}</p>
                          <p className="text-xs text-muted-foreground">{(r.exercice as any)?.titre || 'Exercice'}</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">{r.score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
