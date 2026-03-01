import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../lib/supabase';

// Supabase redirige qui dopo OAuth; api/auth/callback.ts fa poi redirect al custom scheme
const OAUTH_REDIRECT_NATIVE = 'https://memofarmaci-wm25.vercel.app/auth/callback';
// Custom scheme ricevuto da appUrlOpen dopo che Chrome ha aperto l'intent URL
const APP_SCHEME_CALLBACK = 'it.memofarmaci.app://login';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profileCompleted: boolean;
  loading: boolean;
  setProfileCompleted: (v: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkProfileCompleted(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkProfileCompleted(session.user.id);
      } else {
        setProfileCompleted(false);
        setLoading(false);
      }
    });

    let appStateListener: { remove: () => void } | null = null;
    let appUrlListener: { remove: () => void } | null = null;

    if (Capacitor.isNativePlatform()) {
      // Aggiorna sessione quando l'app torna in foreground
      CapApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) return;
        const { data: { session: refreshed } } = await supabase.auth.getSession();
        setSession(refreshed);
        setUser(refreshed?.user ?? null);
        if (refreshed?.user) {
          checkProfileCompleted(refreshed.user.id);
        } else {
          setProfileCompleted(false);
          setLoading(false);
        }
      }).then(handle => { appStateListener = handle; });

      // Gestisce il custom scheme it.memofarmaci.app://login?code=xxx
      // Arriva dopo che Chrome ha processato l'intent URL da api/auth/callback.ts
      CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(APP_SCHEME_CALLBACK)) return;
        const searchString = url.split('?')[1] ?? '';
        const code = new URLSearchParams(searchString).get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            checkProfileCompleted(data.session.user.id);
          } else {
            console.error('[MF] exchangeCodeForSession error:', error?.message);
          }
        }
      }).then(handle => { appUrlListener = handle; });
    }

    return () => {
      subscription.unsubscribe();
      appStateListener?.remove();
      appUrlListener?.remove();
    };
  }, []);

  async function checkProfileCompleted(userId: string) {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('profile_completed')
        .eq('id', userId)
        .maybeSingle();
      setProfileCompleted(data?.profile_completed ?? false);
    } catch {
      setProfileCompleted(false);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT_NATIVE, skipBrowserRedirect: true },
      });
      if (!error && data?.url) {
        window.open(data.url, '_system');
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    }
  }

  async function signInWithFacebook() {
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: OAUTH_REDIRECT_NATIVE, skipBrowserRedirect: true },
      });
      if (!error && data?.url) {
        window.open(data.url, '_system');
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin },
      });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user, session, profileCompleted, loading,
      setProfileCompleted,
      signInWithGoogle, signInWithFacebook, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
