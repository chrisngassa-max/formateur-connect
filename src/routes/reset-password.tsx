import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [
      { title: 'Réinitialiser le mot de passe — Primo-Exercices' },
      { name: 'description', content: 'Définissez un nouveau mot de passe pour votre compte.' },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Supabase parse automatiquement le hash (#access_token=...&type=recovery)
  // et déclenche un événement PASSWORD_RECOVERY. On vérifie qu'on a bien une session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionOk(!!session);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionOk(!!session);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess(true);
    // Déconnecter pour forcer une reconnexion propre avec le nouveau mot de passe
    await supabase.auth.signOut();
    setTimeout(() => {
      void navigate({ to: '/login' });
    }, 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">Chargement…</p>
          ) : success ? (
            <p className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2 text-center">
              Mot de passe mis à jour. Redirection vers la connexion…
            </p>
          ) : !sessionOk ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                Lien invalide ou expiré. Veuillez recommencer la procédure.
              </p>
              <Button className="w-full" onClick={() => void navigate({ to: '/login' })}>
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
