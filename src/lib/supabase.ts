import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Supabase calls will fail.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new Proxy({} as ReturnType<typeof createClient>, {
      get: (_target, prop) => {
        if (prop === 'auth') return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase non configuré' } }),
          signOut: () => Promise.resolve({ error: null }),
        };
        if (prop === 'from') return () => ({
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }), order: () => Promise.resolve({ data: [], error: null }) }),
          insert: () => Promise.resolve({ data: null, error: { message: 'Supabase non configuré' } }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'Supabase non configuré' } }) }),
        });
        return () => {};
      },
    }));
