import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Wand2, 
  FileText, 
  History, 
  Share2, 
  Trash2, 
  Play, 
  CheckCircle,
  Eye,
  Settings2,
  Rocket
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const Route = createFileRoute('/positionnement')({
  component: PositionnementPage,
});

function PositionnementPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('mes-tests');

  // Formulaire de génération
  const [genForm, setGenForm] = useState({
    title: 'Test de positionnement TCF IRN',
    levels: ['A0', 'A1', 'A2', 'B1'],
    skills: ['CE', 'CO', 'EE', 'EO'],
    contexts: ['préfecture', 'CAF', 'mairie', 'santé', 'logement']
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [testsRes, attemptsRes] = await Promise.all([
      supabase.from('placement_tests').select('*').order('created_at', { ascending: false }),
      supabase.from('placement_test_attempts').select('*, placement_tests(title)').order('started_at', { ascending: false })
    ]);
    
    setTests(testsRes.data || []);
    setAttempts(attemptsRes.data || []);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke('generate-placement-test', {
      body: genForm
    });

    if (error) {
      toast.error('Erreur de génération : ' + error.message);
    } else {
      toast.success('Test généré avec succès !');
      fetchData();
      setActiveTab('mes-tests');
    }
    setGenerating(false);
  };

  const handlePublish = async (testId: string) => {
    const { error } = await supabase
      .from('placement_tests')
      .update({ 
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', testId);

    if (error) toast.error(error.message);
    else {
      toast.success('Test publié et activé sur le site !');
      fetchData();
    }
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Supprimer ce test ?')) return;
    const { error } = await supabase.from('placement_tests').delete().eq('id', testId);
    if (error) toast.error(error.message);
    else {
      toast.success('Test supprimé');
      fetchData();
    }
  };

  const copyPublicLink = (token: string | null) => {
    const url = `${window.location.origin}/play-test/${token || 'latest'}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien public copié !');
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Test de Positionnement" 
        description="Gérez les tests de niveau CECRL pour les nouveaux arrivants." 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="mes-tests" className="gap-2">
            <FileText className="h-4 w-4" /> Mes tests
          </TabsTrigger>
          <TabsTrigger value="generer" className="gap-2">
            <Wand2 className="h-4 w-4" /> Générer
          </TabsTrigger>
          <TabsTrigger value="resultats" className="gap-2">
            <History className="h-4 w-4" /> Résultats
          </TabsTrigger>
        </TabsList>

        {/* ONGLET : MES TESTS */}
        <TabsContent value="mes-tests" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tests.map(test => (
              <Card key={test.id} className={`overflow-hidden border-2 transition-all ${test.status === 'published' ? 'border-primary/20 bg-primary/5 shadow-md' : 'border-border'}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge variant={test.status === 'published' ? 'default' : 'secondary'}>
                      {test.status === 'published' ? 'Actif' : 'Brouillon'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">v{test.version}</span>
                  </div>
                  <CardTitle className="text-lg mt-2">{test.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Niveaux : {test.niveaux_couverts.join(', ')}</p>
                    <p>Compétences : {test.competences.join(', ')}</p>
                    <p>Créé le : {format(new Date(test.created_at), 'dd MMMM yyyy', { locale: fr })}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                    {test.status !== 'published' ? (
                      <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 h-8" onClick={() => handlePublish(test.id)}>
                        <Rocket className="h-3.5 w-3.5" /> Publier
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => copyPublicLink(test.play_token)}>
                        <Share2 className="h-3.5 w-3.5" /> Lien
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(test.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {tests.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Aucun test généré pour le moment.</p>
                <Button variant="link" onClick={() => setActiveTab('generer')}>Créer votre premier test</Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ONGLET : GÉNÉRER */}
        <TabsContent value="generer">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Configuration du nouveau test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Titre du test</Label>
                <Input value={genForm.title} onChange={e => setGenForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Niveaux ciblés</Label>
                  <p className="text-[10px] text-muted-foreground italic">Le test couvrira une progression A0 à B1.</p>
                </div>
                <div className="space-y-2 text-right">
                  <Badge variant="outline">A0, A1, A2, B1</Badge>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <p className="text-sm font-medium">Contenus abordés</p>
                <div className="flex flex-wrap gap-2">
                  {genForm.contexts.map(ctx => (
                    <Badge key={ctx} variant="secondary" className="px-3 py-1">{ctx}</Badge>
                  ))}
                </div>
              </div>
              <Button 
                onClick={handleGenerate} 
                disabled={generating} 
                className="w-full h-12 gap-2 mt-6"
              >
                {generating ? (
                  <>Génération en cours (environ 30s)...</>
                ) : (
                  <><Wand2 className="h-5 w-5" /> Générer le test via Claude AI</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ONGLET : RÉSULTATS */}
        <TabsContent value="resultats">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-4">Étudiant</th>
                    <th className="text-left p-4">Test</th>
                    <th className="text-left p-4">Date</th>
                    <th className="text-center p-4">Niveau estimé</th>
                    <th className="text-right p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attempts.map(at => (
                    <tr key={at.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{at.student_name || 'Anonyme'}</td>
                      <td className="p-4 text-muted-foreground">{at.placement_tests?.title}</td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(at.started_at), 'dd/MM/yy HH:mm')}
                      </td>
                      <td className="p-4 text-center">
                        <Badge className="bg-blue-500">{at.estimated_level || 'N/A'}</Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => window.open(`/resultat-test/${at.id}`, '_blank')}>
                          <Eye className="h-3.5 w-3.5 mr-1.5" /> Voir
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {attempts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-20 text-center text-muted-foreground">
                        Aucun élève n'a encore passé le test.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
