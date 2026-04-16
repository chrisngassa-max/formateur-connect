import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SignupForm } from '@/components/SignupForm';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, ArrowLeft } from 'lucide-react';

export function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');

  if (mode === 'signup') {
    return <SignupForm onBack={() => setMode('login')} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      // Log clair en console pour debug + message utilisateur explicite
      console.error('[LoginForm] signIn failed', {
        code: (err as any).code,
        status: (err as any).status,
        message: err.message,
        name: err.name,
      });
      const code = (err as any).code as string | undefined;
      const friendly =
        code === 'invalid_credentials'
          ? 'Email ou mot de passe incorrect.'
          : code === 'email_not_confirmed'
          ? 'Email non confirmé. Vérifiez votre boîte mail.'
          : err.message;
      setError(`${friendly}${code ? ` (${code})` : ''}`);
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email) {
      setError('Veuillez saisir votre email.');
      return;
    }
    setLoading(true);
    // Pas de redirectTo absolu : Supabase utilise le Site URL configuré côté backend.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) {
      console.error('[LoginForm] resetPasswordForEmail failed', err);
    }
    setInfo('Si cet email existe, un lien de réinitialisation a été envoyé.');
  };

  if (mode === 'forgot') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
            <p className="text-sm text-muted-foreground">
              Entrez votre email pour recevoir un lien de réinitialisation.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgot} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}
              {info && (
                <p className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2">{info}</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email-forgot">Email</Label>
                <Input
                  id="email-forgot"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setInfo('');
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Retour à la connexion
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Primo-Exercices</CardTitle>
          <p className="text-sm text-muted-foreground">Connectez-vous pour accéder à la plateforme</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setInfo('');
                }}
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="font-medium text-primary hover:underline"
              >
                Créer un compte formateur
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
