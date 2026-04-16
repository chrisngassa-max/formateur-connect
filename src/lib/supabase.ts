import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
    !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
  ]
    .filter(Boolean)
    .join(', ');
  // Fail-fast explicite — message clair en dev et en prod.
  throw new Error(
    `[supabase] Configuration manquante : ${missing}. ` +
      `Définissez ces variables d'environnement avant de démarrer l'app.`,
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
