import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import type { Exercice } from '@/types/database';
import { useAuth } from '@/hooks/use-auth';
import { Check, FileText, X } from 'lucide-react';

export const Route = createFileRoute('/validation')({
  component: ValidationPage,
});

function ValidationPage() {
  const { profile } = useAuth();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [selected, setSelected] = useState<Exercice | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editConsigne, setEditConsigne] = useState('');

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('exercices')
      .select('*')
      .eq('statut', 'en_attente')
      .eq('formateur_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setExercices((data as Exercice[]) ?? []));
  }, [profile]);

  const selectExercice = (ex: Exercice) => {
    setSelected(ex);
    setEditTitle(ex.titre || '');
    setEditConsigne(ex.consigne || '');
  };

  const updateStatut = async (statut: 'rejete' | 'brouillon' | 'valide') => {
    if (!selected) return;
    await (supabase as any)
      .from('exercices')
      .update({ statut, titre: editTitle, consigne: editConsigne })
      .eq('id', selected.id);
    setExercices(prev => prev.filter(e => e.id !== selected.id));
    setSelected(null);
  };

  return (
    <AppLayout>
      <PageHeader title="Validation" description="Relisez et validez les exercices en attente" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-2">{exercices.length} exercice(s) en attente</p>
          {exercices.map(ex => (
            <button
              key={ex.id}
              onClick={() => selectExercice(ex)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                selected?.id === ex.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CompetenceBadge competence={ex.competence} />
                <span className="text-xs text-muted-foreground">{ex.niveau_vise}</span>
              </div>
              <p className="text-sm font-medium truncate">{ex.titre || 'Sans titre'}</p>
            </button>
          ))}
          {exercices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun exercice en attente de validation</p>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sélectionnez un exercice à valider</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CompetenceBadge competence={selected.competence} />
                  Édition de l'exercice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Titre</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Consigne</Label>
                  <Textarea value={editConsigne} onChange={(e) => setEditConsigne(e.target.value)} rows={3} />
                </div>

                <div>
                  <Label className="mb-2 block">Contenu (JSON)</Label>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-60">
                    {JSON.stringify(selected.contenu, null, 2)}
                  </pre>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="destructive" size="sm" className="gap-1" onClick={() => updateStatut('rejete')}>
                    <X className="h-3 w-3" /> Rejeter
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => updateStatut('brouillon')}>
                    <FileText className="h-3 w-3" /> Brouillon
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => updateStatut('valide')}>
                    <Check className="h-3 w-3" /> Valider et publier
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
