/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY non configurate');
}

// Il bypass del lock serve solo nel browser per evitare timeout "LockManager timed out 10000ms"
// con Service Worker o tab multiple. Su Capacitor (Android/iOS) il lock standard funziona
// correttamente e garantisce il refresh del token senza race conditions.
const isNative = typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: isNative ? {} : {
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
  },
});
