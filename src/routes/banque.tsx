import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import { StatutBadge } from '@/components/StatutBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Exercice, CompetenceType, ExerciceStatut, NiveauCECR } from '@/types/database';
import { useAuth } from '@/hooks/use-auth';
import { Search, Copy, Pencil, ExternalLink } from 'lucide-react';

export const Route = createFileRoute('/banque')({
  component: BanquePage,
});

function BanquePage() {
  const { profile } = useAuth();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompetence, setFilterCompetence] = useState<CompetenceType | 'all'>('all');
  const [filterStatut, setFilterStatut] = useState<ExerciceStatut | 'all'>('all');
  const [filterNiveau, setFilterNiveau] = useState<NiveauCECR | 'all'>('all');

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('exercices')
      .select('*')
      .eq('formateur_id', profile.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setExercices((data as Exercice[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  const filtered = exercices.filter(ex => {
    if (filterCompetence !== 'all' && ex.competence !== filterCompetence) return false;
    if (filterStatut !== 'all' && ex.statut !== filterStatut) return false;
    if (filterNiveau !== 'all' && ex.niveau_vise !== filterNiveau) return false;
    if (search && !(ex.titre || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <PageHeader title="Banque d'exercices" description={`${exercices.length} exercice(s) au total`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCompetence} onValueChange={(v) => setFilterCompetence(v as any)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Compétence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="CO">CO</SelectItem>
            <SelectItem value="CE">CE</SelectItem>
            <SelectItem value="EE">EE</SelectItem>
            <SelectItem value="EO">EO</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterNiveau} onValueChange={(v) => setFilterNiveau(v as any)}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {(['A1','A2','B1','B2','C1','C2'] as NiveauCECR[]).map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={(v) => setFilterStatut(v as any)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="valide">Validé</SelectItem>
            <SelectItem value="rejete">Rejeté</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Aucun exercice trouvé</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Titre</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Compétence</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Niveau</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ex => (
                <tr key={ex.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 sm:hidden mb-1">
                      <CompetenceBadge competence={ex.competence} />
                    </div>
                    <span className="font-medium text-foreground">{ex.titre || 'Sans titre'}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><CompetenceBadge competence={ex.competence} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{ex.niveau_vise}</td>
                  <td className="px-4 py-3"><StatutBadge statut={ex.statut} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><ExternalLink className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
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
