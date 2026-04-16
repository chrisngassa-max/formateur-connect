import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import type { Resultat } from '@/types/database';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/resultats')({
  component: ResultatsPage,
});

function ResultatsPage() {
  const { profile } = useAuth();
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('resultats')
      .select('*, exercice:exercices(*), eleve:profiles(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setResultats((data as Resultat[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  return (
    <AppLayout>
      <PageHeader title="Résultats" description="Consultez les performances de vos élèves" />

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : resultats.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Aucun résultat disponible</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Élève</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Exercice</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Compétence</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Temps</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {resultats.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {(r.eleve as any)?.prenom} {(r.eleve as any)?.nom}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(r.exercice as any)?.titre || 'Exercice'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <CompetenceBadge competence={(r.exercice as any)?.competence || 'CO'} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${r.score >= 70 ? 'text-success' : r.score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                      {r.score}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">—</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
