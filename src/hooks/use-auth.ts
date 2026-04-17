import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

const BYPASS_AUTH = (import.meta.env.VITE_BYPASS_AUTH ?? 'true') !== 'false';

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'bypass@formateur.local',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User;

const MOCK_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'bypass@formateur.local',
  prenom: 'Formateur',
  nom: 'Bypass',
  role: 'formateur',
  status: 'approved',
  created_at: new Date().toISOString(),
} as unknown as Profile;

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return (data as Profile | null) ?? null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(BYPASS_AUTH ? MOCK_USER : null);
  const [profile, setProfile] = useState<Profile | null>(BYPASS_AUTH ? MOCK_PROFILE : null);
  const [loading, setLoading] = useState(!BYPASS_AUTH);
  const initialized = useRef(false);

  useEffect(() => {
    if (BYPASS_AUTH) return;
    if (initialized.current) return;
    initialized.current = true;

    const handleSession = async (sessionUser: User | null) => {
      setUser(sessionUser);
      if (!sessionUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const p = await loadProfile(sessionUser.id);
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

  const signOut = async () => {
    if (BYPASS_AUTH) return { error: null };
    return supabase.auth.signOut();
  };

  const signIn = async () => {
    if (BYPASS_AUTH) return { error: null };
    return { error: null };
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isFormateur: BYPASS_AUTH ? true : profile?.role === 'formateur',
  };
}
