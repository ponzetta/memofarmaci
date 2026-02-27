/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY non configurate');
}

// Bypassa navigator.locks per evitare timeout "LockManager timed out 10000ms"
// che si verificano con Service Worker o tab multiple aperte.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
  },
});
