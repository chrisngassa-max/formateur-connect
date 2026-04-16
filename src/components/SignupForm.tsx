import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, ArrowLeft } from 'lucide-react';

interface SignupFormProps {
  onBack: () => void;
}

export function SignupForm({ onBack }: SignupFormProps) {
  const navigate = useNavigate();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Pas de redirectTo absolu : Supabase utilise le Site URL configuré.
          data: {
            prenom: prenom.trim(),
            nom: nom.trim(),
          },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        setLoading(false);
        return;
      }

      // Si une session existe déjà (email confirm désactivée), on octroie le rôle immédiatement.
      if (signUpData.session) {
        const grantRes = await callGrantFormateur({
          prenom: prenom.trim(),
          nom: nom.trim(),
        });
        if (!grantRes.ok) {
          setError(grantRes.error ?? 'Erreur lors de l’attribution du rôle formateur.');
          setLoading(false);
          return;
        }
        setSuccess('Compte formateur créé ! Redirection…');
        setTimeout(() => window.location.assign('/'), 800);
      } else {
        setSuccess(
          'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis reconnectez-vous : le rôle formateur sera attribué automatiquement.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Créer un compte formateur</CardTitle>
          <p className="text-sm text-muted-foreground">
            Renseignez vos informations pour accéder à la plateforme.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2">{success}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={60} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </Button>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center gap-1.5 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper exporté pour réutilisation au moment du login post-confirmation email.
export async function callGrantFormateur(params: {
  prenom?: string;
  nom?: string;
} = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { ok: false, error: 'Session introuvable.' };

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ?? 'https://bqknyiyywhvkdngraazk.supabase.co';

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/grant-formateur-role`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prenom: params.prenom,
        nom: params.nom,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `Erreur ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}
