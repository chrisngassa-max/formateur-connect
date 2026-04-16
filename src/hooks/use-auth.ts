import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { callGrantFormateur } from '@/components/SignupForm';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

const isServer = typeof window === 'undefined';

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return (data as Profile | null) ?? null;
}

// Si l'utilisateur a été créé via le SignupForm avec un code formateur en attente
// et que son profil ne reflète pas encore le rôle formateur, on rejoue l'octroi.
async function maybeGrantPendingFormateur(user: User, profile: Profile | null): Promise<boolean> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const pendingCode = meta.pending_formateur_code;
  if (!pendingCode || typeof pendingCode !== 'string') return false;
  if (profile?.role === 'formateur') {
    await supabase.auth.updateUser({ data: { pending_formateur_code: null } }).catch(() => {});
    return false;
  }
  const res = await callGrantFormateur({
    signupCode: pendingCode,
    prenom: typeof meta.prenom === 'string' ? meta.prenom : undefined,
    nom: typeof meta.nom === 'string' ? meta.nom : undefined,
  });
  if (res.ok) {
    await supabase.auth.updateUser({ data: { pending_formateur_code: null } }).catch(() => {});
    return true;
  }
  return false;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!isServer);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const handleSession = async (sessionUser: User | null) => {
      setUser(sessionUser);
      if (!sessionUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      let p = await loadProfile(sessionUser.id);
      const granted = await maybeGrantPendingFormateur(sessionUser, p);
      if (granted) p = await loadProfile(sessionUser.id);
      setProfile(p);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void handleSession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return { user, profile, loading, signIn, signOut, isFormateur: profile?.role === 'formateur' };
}
