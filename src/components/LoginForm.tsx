import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, MailCheck } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setInfo('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Veuillez saisir votre email.');
      return;
    }

    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: false,
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });
      if (err) {
        console.error('[LoginForm] signInWithOtp failed', err);
        setError(err.message);
        return;
      }
      setSent(true);
      setInfo(`Un lien de connexion a été envoyé à ${trimmed}. Vérifiez votre boîte mail.`);
    } catch (caught) {
      console.error('[LoginForm] signInWithOtp threw', caught);
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            {sent ? (
              <MailCheck className="h-6 w-6 text-primary" />
            ) : (
              <GraduationCap className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">Primo-Exercices</CardTitle>
          <p className="text-sm text-muted-foreground">
            {sent
              ? 'Cliquez sur le lien reçu par email pour vous connecter.'
              : 'Connexion par lien email (sans mot de passe).'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}
            {info && (
              <p className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2">{info}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi du lien…
                </>
              ) : sent ? (
                'Renvoyer le lien'
              ) : (
                'Recevoir un lien de connexion'
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              L'accès est réservé aux comptes formateurs autorisés.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
