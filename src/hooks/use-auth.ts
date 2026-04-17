import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return (data as Profile | null) ?? null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
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
    return supabase.auth.signOut();
  };

  return { user, profile, loading, signOut, isFormateur: profile?.role === 'formateur' };
}
