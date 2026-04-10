import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import type { Exercice, Profile, Group } from '@/types/database';
import { useAuth } from '@/hooks/use-auth';
import { Send } from 'lucide-react';

export const Route = createFileRoute('/assignation')({
  component: AssignationPage,
});

function AssignationPage() {
  const { profile } = useAuth();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [eleves, setEleves] = useState<Profile[]>([]);
  const [groupes, setGroupes] = useState<Group[]>([]);
  const [form, setForm] = useState({
    exercice_id: '',
    mode: 'individuel' as 'individuel' | 'groupe',
    eleve_id: '',
    group_id: '',
    date_limite: '',
  });

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('exercices').select('*').eq('statut', 'valide').eq('formateur_id', profile.id),
      supabase.from('profiles').select('*').eq('role', 'eleve'),
      supabase.from('groups').select('*').eq('formateur_id', profile.id),
    ]).then(([exRes, elRes, grRes]) => {
      setExercices((exRes.data as Exercice[]) ?? []);
      setEleves((elRes.data as Profile[]) ?? []);
      setGroupes((grRes.data as Group[]) ?? []);
    });
  }, [profile]);

  const selectedExercice = exercices.find(e => e.id === form.exercice_id);

  const handleAssign = async () => {
    const payload: any = {
      exercice_id: form.exercice_id,
      mode: form.mode,
      date_limite: form.date_limite || null,
    };
    if (form.mode === 'individuel') payload.eleve_id = form.eleve_id;
    else payload.group_id = form.group_id;

    await supabase.from('assignations').insert(payload);
    setForm({ exercice_id: '', mode: 'individuel', eleve_id: '', group_id: '', date_limite: '' });
  };

  return (
    <AppLayout>
      <PageHeader title="Assignation" description="Attribuez des exercices aux élèves ou groupes" />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Nouvelle assignation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Exercice</Label>
              <Select value={form.exercice_id} onValueChange={(v) => setForm(p => ({ ...p, exercice_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un exercice validé" /></SelectTrigger>
                <SelectContent>
                  {exercices.map(ex => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.titre || 'Sans titre'} ({ex.competence} - {ex.niveau_vise})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm(p => ({ ...p, mode: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individuel">Individuel</SelectItem>
                  <SelectItem value="groupe">Groupe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.mode === 'individuel' ? (
              <div className="space-y-1.5">
                <Label>Élève</Label>
                <Select value={form.eleve_id} onValueChange={(v) => setForm(p => ({ ...p, eleve_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                  <SelectContent>
                    {eleves.map(el => (
                      <SelectItem key={el.id} value={el.id}>{el.prenom} {el.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Groupe</Label>
                <Select value={form.group_id} onValueChange={(v) => setForm(p => ({ ...p, group_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
                  <SelectContent>
                    {groupes.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Date limite (optionnel)</Label>
              <Input type="date" value={form.date_limite} onChange={(e) => setForm(p => ({ ...p, date_limite: e.target.value }))} />
            </div>

            <Button onClick={handleAssign} className="w-full gap-2" disabled={!form.exercice_id}>
              <Send className="h-4 w-4" /> Assigner
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aperçu de l'exercice</CardTitle></CardHeader>
          <CardContent>
            {!selectedExercice ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sélectionnez un exercice pour voir l'aperçu</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CompetenceBadge competence={selectedExercice.competence} />
                  <span className="text-xs text-muted-foreground">{selectedExercice.niveau_vise}</span>
                </div>
                <h3 className="font-semibold">{selectedExercice.titre}</h3>
                <p className="text-sm text-muted-foreground">{selectedExercice.consigne}</p>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-40">
                  {JSON.stringify(selectedExercice.contenu, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
