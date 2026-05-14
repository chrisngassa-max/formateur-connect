import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  Award, 
  Target, 
  BarChart, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Share2,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer 
} from 'recharts';

export const Route = createFileRoute('/resultat-test/$attemptId')({
  component: PositionnementResultat,
});

function PositionnementResultat() {
  const { attemptId } = Route.useParams();

  const { data: result, isLoading } = useQuery({
    queryKey: ['placement-result', attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('placement_test_results')
        .select(`
          *,
          placement_test_attempts (
            student_name,
            estimated_level,
            placement_tests (title)
          )
        `)
        .eq('attempt_id', attemptId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" /> Analyse de vos résultats...</div>;
  if (!result) return <div className="p-20 text-center">Résultat introuvable.</div>;

  const chartData = [
    { subject: 'Compréhension Écrite', A: result.ce_score_pct || 0, fullMark: 100 },
    { subject: 'Compréhension Orale', A: result.co_score_pct || 0, fullMark: 100 },
    { subject: 'Expression Écrite', A: result.ee_score_pct || 0, fullMark: 100 },
    { subject: 'Expression Orale', A: result.eo_score_pct || 0, fullMark: 100 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-[#0b234a]">Bilan de Positionnement</h1>
            <p className="text-slate-500">{result.placement_test_attempts?.placement_tests?.title} — {result.placement_test_attempts?.student_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 h-11"><Download className="h-4 w-4" /> PDF</Button>
            <Button className="gap-2 h-11 bg-amber-500 hover:bg-amber-600 text-white"><Share2 className="h-4 w-4" /> Partager</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Level Card */}
          <Card className="lg:col-span-1 border-none shadow-xl bg-[#0b234a] text-white overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Award className="h-32 w-32" />
            </div>
            <CardHeader className="text-center pb-0">
              <CardTitle className="text-lg font-medium opacity-80 uppercase tracking-widest">Niveau Estimé</CardTitle>
            </CardHeader>
            <CardContent className="text-center p-10 space-y-4">
              <div className="text-8xl font-black">{result.global_level || 'A1'}</div>
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white px-4 py-1 text-sm border-none">
                {result.global_level?.includes('A1') ? 'Débutant' : result.global_level?.includes('A2') ? 'Élémentaire' : 'Intermédiaire'}
              </Badge>
              <p className="text-sm opacity-70 pt-4 leading-relaxed">
                Ce niveau correspond à une maîtrise des bases de la langue française dans des contextes de la vie quotidienne et administrative.
              </p>
            </CardContent>
          </Card>

          {/* Radar Chart Card */}
          <Card className="lg:col-span-2 border-none shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0b234a]">
                <BarChart className="h-5 w-5 text-amber-500" />
                Détail des compétences
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Radar
                    name="Score"
                    dataKey="A"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Strengths & Weaknesses */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b bg-green-50/50">
              <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" /> Points forts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {result.strengths?.map((s: string, i: number) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-2 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b bg-amber-50/50">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
                <Target className="h-5 w-5" /> Axes d'amélioration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {result.weaknesses?.map((w: string, i: number) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Remediation Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#0b234a] flex items-center gap-3">
            <Rocket className="h-7 w-7 text-amber-500" />
            Parcours de remédiation suggéré
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(result.remediation_exercises?.suggested_ids || []).map((exId: string, idx: number) => (
              <Card key={exId} className="border-none shadow-md hover:shadow-xl transition-all cursor-pointer group">
                <CardContent className="p-6 space-y-4">
                  <Badge variant="secondary">Exercice {idx + 1}</Badge>
                  <h4 className="font-bold text-[#0b234a] group-hover:text-amber-600 transition-colors">Renforcement des bases</h4>
                  <p className="text-xs text-slate-500">Focus sur les points identifiés lors du test.</p>
                  <Button variant="link" className="p-0 h-auto text-amber-600 gap-1 font-bold">
                    Commencer <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
