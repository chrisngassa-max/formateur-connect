import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/auth/callback')({
  head: () => ({
    meta: [
      { title: 'Connexion en cours — Primo-Exercices' },
      { name: 'description', content: "Validation de votre lien de connexion." },
    ],
  }),
  component: AuthCallbackPage,
});

type State =
  | { kind: 'loading' }
  | { kind: 'unauthorized'; reason: string }
  | { kind: 'ok' };

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Supabase parse automatiquement le hash (#access_token=...) et établit la session.
      // On attend ensuite la session et on vérifie le rôle formateur.
      const start = Date.now();
      let session = (await supabase.auth.getSession()).data.session;
      while (!session && Date.now() - start < 4000) {
        await new Promise((r) => setTimeout(r, 150));
        session = (await supabase.auth.getSession()).data.session;
      }

      if (cancelled) return;

      if (!session?.user) {
        setState({
          kind: 'unauthorized',
          reason: 'Lien invalide ou expiré. Veuillez redemander un lien de connexion.',
        });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        await supabase.auth.signOut();
        setState({ kind: 'unauthorized', reason: `Erreur de profil : ${error.message}` });
        return;
      }

      if (!profile || profile.role !== 'formateur') {
        await supabase.auth.signOut();
        setState({
          kind: 'unauthorized',
          reason:
            "Compte non autorisé sur Formateur Connect. Cet espace est réservé aux formateurs approuvés.",
        });
        return;
      }

      setState({ kind: 'ok' });
      void navigate({ to: '/' });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            {state.kind === 'unauthorized' ? (
              <ShieldAlert className="h-6 w-6 text-destructive" />
            ) : (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            )}
          </div>
          <CardTitle className="text-xl">
            {state.kind === 'unauthorized' ? 'Accès refusé' : 'Connexion en cours…'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.kind === 'loading' && (
            <p className="text-sm text-muted-foreground text-center">
              Validation de votre lien…
            </p>
          )}
          {state.kind === 'unauthorized' && (
            <>
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {state.reason}
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Retour à la connexion</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
