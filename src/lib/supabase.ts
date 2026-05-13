import { createClient } from '@supabase/supabase-js';

// Valeurs publiques (anon key) — utilisées en fallback si les env vars Vite ne sont pas injectées.
const FALLBACK_URL = 'https://jjhnaxuyunpocuuswvyb.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaG5heHV5dW5wb2N1dXN3dnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc4NTIsImV4cCI6MjA4OTM1Mzg1Mn0.RQISiZebKc7QMuEkJ1jfIuMaWQw57NSamPxYb7a6OFs';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? FALLBACK_URL;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? FALLBACK_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquante — utilisation du fallback intégré.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
