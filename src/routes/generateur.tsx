import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompetenceBadge } from '@/components/CompetenceBadge';
import { StatutBadge } from '@/components/StatutBadge';
import type { GabaritPedagogique, CompetenceType, NiveauCECR } from '@/types/database';
import { Wand2, Eye, Check, Pencil, X } from 'lucide-react';

export const Route = createFileRoute('/generateur')({
  component: GenerateurPage,
});

function GenerateurPage() {
  const [gabarits, setGabarits] = useState<GabaritPedagogique[]>([]);
  const [form, setForm] = useState({
    gabarit_id: '',
    competence: '' as CompetenceType | '',
    niveau: '' as NiveauCECR | '',
    theme: '',
    difficulte: '3',
    nb_items: '5',
  });
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    supabase.from('gabarits_pedagogiques').select('*').then(({ data }) => {
      setGabarits((data as GabaritPedagogique[]) ?? []);
    });
  }, []);

  const handleGenerate = () => {
    // Mock preview — will be replaced by AI generation later
    setPreview({
      titre: `Exercice ${form.competence} - ${form.theme || 'Thème'}`,
      competence: form.competence || 'CO',
      niveau_vise: form.niveau || 'A1',
      difficulte: Number(form.difficulte),
      format: 'qcm',
      consigne: 'Écoutez le document et répondez aux questions suivantes.',
      items: Array.from({ length: Number(form.nb_items) }, (_, i) => ({
        id: i + 1,
        question: `Question ${i + 1} — (générée par IA)`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        reponse: 0,
      })),
    });
  };

  return (
    <AppLayout>
      <PageHeader title="Générateur d'exercices" description="Créez un exercice à partir d'un gabarit" />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Paramètres</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Gabarit pédagogique</Label>
              <Select value={form.gabarit_id} onValueChange={(v) => setForm(p => ({ ...p, gabarit_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un gabarit" /></SelectTrigger>
                <SelectContent>
                  {gabarits.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>
                  ))}
                  {gabarits.length === 0 && <SelectItem value="_none" disabled>Aucun gabarit</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Compétence</Label>
                <Select value={form.competence} onValueChange={(v) => setForm(p => ({ ...p, competence: v as CompetenceType }))}>
                  <SelectTrigger><SelectValue placeholder="Compétence" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CO">CO — Compréhension orale</SelectItem>
                    <SelectItem value="CE">CE — Compréhension écrite</SelectItem>
                    <SelectItem value="EE">EE — Expression écrite</SelectItem>
                    <SelectItem value="EO">EO — Expression orale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Niveau CECR</Label>
                <Select value={form.niveau} onValueChange={(v) => setForm(p => ({ ...p, niveau: v as NiveauCECR }))}>
                  <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
                  <SelectContent>
                    {(['A1','A2','B1','B2','C1','C2'] as NiveauCECR[]).map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Thème</Label>
              <Input value={form.theme} onChange={(e) => setForm(p => ({ ...p, theme: e.target.value }))} placeholder="Ex: La vie quotidienne" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Difficulté (1-5)</Label>
                <Select value={form.difficulte} onValueChange={(v) => setForm(p => ({ ...p, difficulte: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nombre d'items</Label>
                <Input type="number" min={1} max={20} value={form.nb_items} onChange={(e) => setForm(p => ({ ...p, nb_items: e.target.value }))} />
              </div>
            </div>

            <Button onClick={handleGenerate} className="w-full gap-2">
              <Wand2 className="h-4 w-4" /> Générer l'exercice
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Aperçu</CardTitle></CardHeader>
          <CardContent>
            {!preview ? (
              <p className="text-sm text-muted-foreground text-center py-12">Remplissez le formulaire et cliquez sur « Générer » pour voir l'aperçu.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CompetenceBadge competence={preview.competence} />
                  <span className="text-xs font-medium text-muted-foreground">{preview.niveau_vise}</span>
                  <StatutBadge statut="brouillon" />
                </div>
                <h3 className="font-semibold text-foreground">{preview.titre}</h3>
                <p className="text-sm text-muted-foreground">{preview.consigne}</p>

                <div className="space-y-3">
                  {preview.items.map((item: any) => (
                    <div key={item.id} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium mb-2">{item.question}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {item.options.map((opt: string, i: number) => (
                          <div key={i} className={`text-xs rounded px-2 py-1.5 border ${i === item.reponse ? 'border-success bg-success/10 text-success' : 'border-border text-muted-foreground'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="destructive" size="sm" className="gap-1"><X className="h-3 w-3" /> Rejeter</Button>
                  <Button variant="outline" size="sm" className="gap-1"><Pencil className="h-3 w-3" /> Modifier</Button>
                  <Button size="sm" className="gap-1"><Check className="h-3 w-3" /> Valider</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
