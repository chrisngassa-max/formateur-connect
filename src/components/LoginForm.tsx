import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, MailCheck, ArrowLeft, KeyRound } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_S = 60;

type Step = 'email' | 'code';

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('signups not allowed') || m.includes('not allowed') || m.includes('user not found')) {
    return "Cet email n'est pas autorisé à se connecter à Formateur Connect.";
  }
  if (m.includes('invalid') && (m.includes('otp') || m.includes('token'))) {
    return 'Code invalide ou expiré. Demandez un nouveau code.';
  }
  if (m.includes('expired')) {
    return 'Code expiré. Demandez un nouveau code.';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Trop de tentatives. Veuillez patienter quelques minutes.';
  }
  if (m.includes('email')) {
    return 'Adresse email invalide.';
  }
  return message;
}

export function LoginForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_S);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const sendCode = async (targetEmail: string): Promise<boolean> => {
    const trimmed = targetEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Adresse email invalide.');
      return false;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: false },
      });
      if (err) {
        console.error('[LoginForm] signInWithOtp failed', err);
        setError(friendlyError(err.message));
        return false;
      }
      setEmail(trimmed);
      setInfo(`Un code à 6 chiffres a été envoyé à ${trimmed}.`);
      startCooldown();
      return true;
    } catch (caught) {
      console.error('[LoginForm] signInWithOtp threw', caught);
      setError('Erreur réseau. Veuillez réessayer.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await sendCode(email);
    if (ok) {
      setStep('code');
      setCode('');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setCode('');
    await sendCode(email);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cleaned = code.trim();
    if (!/^\d{6}$/.test(cleaned)) {
      setError('Le code doit contenir 6 chiffres.');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: cleaned,
        type: 'email',
      });
      if (err) {
        console.error('[LoginForm] verifyOtp failed', err);
        setError(friendlyError(err.message));
        return;
      }
      // Session établie : useAuth (onAuthStateChange) prend le relais
      // et appliquera la garde de rôle formateur côté DashboardPage.
    } catch (caught) {
      console.error('[LoginForm] verifyOtp threw', caught);
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setError('');
    setInfo('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            {step === 'code' ? (
              <KeyRound className="h-6 w-6 text-primary" />
            ) : (
              <GraduationCap className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">Primo-Exercices</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 'email'
              ? 'Connectez-vous avec un code envoyé par email.'
              : `Saisissez le code reçu à ${email}.`}
          </p>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendEmail} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}
              {info && (
                <p className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2 flex items-center gap-2">
                  <MailCheck className="h-4 w-4 shrink-0" />
                  <span>{info}</span>
                </p>
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
                  maxLength={255}
                  disabled={loading}
                  inputMode="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi du code…
                  </>
                ) : (
                  'Envoyer le code'
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Accès réservé aux formateurs autorisés.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}
              {info && (
                <p className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2 flex items-center gap-2">
                  <MailCheck className="h-4 w-4 shrink-0" />
                  <span>{info}</span>
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="otp">Code de vérification</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading}
                  className="text-center text-lg tracking-[0.5em] font-mono"
                  placeholder="••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Vérification…
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Changer d'email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
