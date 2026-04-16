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
import { Wand2, Eye, Check, Pencil, X, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/generateur')({
  component: GenerateurPage,
});

function GenerateurPage() {
  const { user } = useAuth();
  const [gabarits, setGabarits] = useState<GabaritPedagogique[]>([]);
  const [form, setForm] = useState({
    gabarit_id: '',
    competence: '' as CompetenceType | '',
    niveau: '' as NiveauCECR | '',
    theme: '',
    difficulte: '3',
    nb_items: '5',
    point_a_maitriser_id: '',
  });
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSuggestions, setReviewSuggestions] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  // TODO: retirer ce panneau de diagnostic après résolution du problème Edge Functions
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  const handleDebugEnv = async () => {
    setDebugLoading(true);
    setDebugInfo(null);
    const { data, error: fnError } = await supabase.functions.invoke('debug-env-check', { body: {} });
    setDebugLoading(false);
    setDebugInfo(fnError ? { error: fnError.message } : data);
    console.log('[debug-env-check]', { data, error: fnError });
  };

  const handleFullDiagnostic = async () => {
    setDiagnosticLoading(true);
    setDiagnostic(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://bqknyiyywhvkdngraazk.supabase.co';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
    const projectRefMatch = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/);
    const projectRef = projectRefMatch?.[1] ?? null;
    const maskedUrl = supabaseUrl.replace(/^(https:\/\/)([^.]{4})[^.]*(\.supabase\.co)/, '$1$2***$3');

    const callFn = async (name: string, body: any) => {
      const url = `${supabaseUrl}/functions/v1/${name}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let parsed: any = text;
        try { parsed = JSON.parse(text); } catch { /* not JSON */ }
        return { status: res.status, ok: res.ok, body: parsed };
      } catch (e: any) {
        return { status: 0, ok: false, body: { error: `Network error: ${e?.message ?? String(e)}` } };
      }
    };

    const debugRes = await callFn('debug-env-check', {});
    const claudeRes = await callFn('claude-generate-exercise', { _diagnostic: true });

    let verdict = 'Indéterminé';
    const d = debugRes.status;
    const c = claudeRes.status;
    if (d === 404 && c !== 404) verdict = 'Cas A — debug-env-check NON DÉPLOYÉE (les autres functions existent)';
    else if ((d === 401 || d === 403) && (c === 401 || c === 403)) verdict = 'Cas B — Problème de clé / permissions (anon key invalide ou JWT requis)';
    else if (d === 404 && c === 404) verdict = 'Cas C — Mauvais backend / project_ref (aucune function trouvée)';
    else if (d === 500) verdict = 'Cas D — Bug interne dans debug-env-check';
    else if (d === 0) verdict = 'Erreur réseau / CORS / DNS sur l\'URL Supabase';
    else if (d >= 200 && d < 300) verdict = 'debug-env-check fonctionne ✅';

    const report = {
      env: {
        VITE_SUPABASE_URL: maskedUrl,
        project_ref: projectRef,
        VITE_SUPABASE_ANON_KEY_present: Boolean(anonKey),
      },
      calls: {
        'debug-env-check': debugRes,
        'claude-generate-exercise': claudeRes,
      },
      verdict,
    };

    setDiagnostic(report);
    setDiagnosticLoading(false);
    console.log('[diagnostic-functions]', report);
  };

  const handleCopyReport = async () => {
    if (!diagnostic) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
      console.log('[diagnostic] rapport copié');
    } catch (e) {
      console.error('[diagnostic] copie impossible', e);
    }
  };

  useEffect(() => {
    supabase.from('gabarits_pedagogiques').select('*').then(({ data }) => {
      setGabarits((data as GabaritPedagogique[]) ?? []);
    });
  }, []);

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setReviewSuggestions(null);

    const { data, error: fnError } = await supabase.functions.invoke('claude-generate-exercise', {
      body: {
        skill_type: form.competence || 'CO',
        format: 'qcm',
        level: form.niveau || 'A1',
        theme: form.theme,
        gabarit_id: form.gabarit_id || null,
        nombre_items: Number(form.nb_items),
        difficulte: Number(form.difficulte),
        formateur_id: user.id,
        point_a_maitriser_id: form.point_a_maitriser_id || null,
      },
    });

    setLoading(false);

    if (fnError || data?.error) {
      setError(fnError?.message ?? data?.error ?? 'Erreur lors de la génération');
      return;
    }

    setPreview(data);
  };

  const handleReview = async () => {
    if (!preview?.id) return;
    setReviewLoading(true);
    setReviewSuggestions(null);

    const { data, error: fnError } = await supabase.functions.invoke('claude-review-exercise', {
      body: { exercise_id: preview.id },
    });

    setReviewLoading(false);

    if (fnError || data?.error) {
      setError(fnError?.message ?? data?.error ?? 'Erreur lors de la relecture');
      return;
    }

    setReviewSuggestions(data);
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

            <div className="space-y-1.5">
              <Label>Point à maîtriser (ID, optionnel)</Label>
              <Input value={form.point_a_maitriser_id} onChange={(e) => setForm(p => ({ ...p, point_a_maitriser_id: e.target.value }))} placeholder="UUID du point à maîtriser" />
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

            {error && (
              <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">{error}</p>
            )}

            <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? 'Génération en cours…' : "Générer l'exercice"}
            </Button>

            <div className="pt-2 border-t border-border space-y-2">
              <Button onClick={handleDebugEnv} disabled={debugLoading} variant="outline" size="sm" className="w-full gap-2">
                {debugLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Debug env (vérifier projet & clé Anthropic)
              </Button>
              {debugInfo && (
                <pre className="text-xs bg-muted rounded-md p-2 overflow-auto max-h-48">
{JSON.stringify(debugInfo, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
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
                    <StatutBadge statut="en_attente" />
                  </div>
                  <h3 className="font-semibold text-foreground">{preview.titre}</h3>
                  <p className="text-sm text-muted-foreground">{preview.consigne}</p>

                  <div className="space-y-3">
                    {(preview.contenu?.items ?? []).map((item: any, i: number) => (
                      <div key={i} className="rounded-md border border-border p-3">
                        <p className="text-sm font-medium mb-2">{item.question}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(item.options ?? []).map((opt: string, j: number) => (
                            <div key={j} className={`text-xs rounded px-2 py-1.5 border ${String(j) === String(item.bonne_reponse) ? 'border-success bg-success/10 text-success' : 'border-border text-muted-foreground'}`}>
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => { setPreview(null); setReviewSuggestions(null); }}>
                      <X className="h-3 w-3" /> Rejeter
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={handleReview} disabled={reviewLoading}>
                      {reviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                      Relecture Claude
                    </Button>
                    <Button size="sm" className="gap-1">
                      <Check className="h-3 w-3" /> Valider
                    </Button>
                  </div>

                  {preview.justification_pedagogique && (
                    <p className="text-xs text-muted-foreground italic border-t border-border pt-2 mt-2">{preview.justification_pedagogique}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {reviewSuggestions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Suggestions de relecture
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${reviewSuggestions.niveau_ok ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {reviewSuggestions.niveau_ok ? 'Niveau adapté' : 'Niveau à vérifier'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviewSuggestions.suggestions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Suggestions</p>
                    <ul className="space-y-1">
                      {reviewSuggestions.suggestions.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-foreground flex gap-2"><span className="text-muted-foreground">•</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {reviewSuggestions.corrections?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Corrections par item</p>
                    <div className="space-y-2">
                      {reviewSuggestions.corrections.map((c: any, i: number) => (
                        <div key={i} className="rounded-md border border-warning/30 bg-warning/5 p-2 text-sm">
                          <p className="font-medium text-warning">Item {c.item_index + 1} : {c.probleme}</p>
                          <p className="text-muted-foreground mt-0.5">{c.correction}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
