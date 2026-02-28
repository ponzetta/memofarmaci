import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '../lib/supabase';

// URL ponte su Vercel che riceve il code da Supabase e redirige al custom scheme.
// Vercel lo accetta perché è sotto il Site URL già autorizzato in Supabase.
const OAUTH_REDIRECT_NATIVE = 'https://memofarmaci-wm25.vercel.app/api/auth/callback';
// Custom scheme intercettato da Android dopo il redirect del ponte Vercel.
const OAUTH_DEEP_LINK_PREFIX = 'it.memofarmaci.app://login';

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
    // Carica sessione iniziale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkProfileCompleted(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Ascolta cambi di stato auth
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

    // Diagnostic: verifica che AuthContext sia montato e Capacitor sia nativo
    console.log('[MF] AuthContext montato, isNative:', Capacitor.isNativePlatform(), 'platform:', Capacitor.getPlatform());

    // Su Android/iOS: quando l'app torna in foreground dopo OAuth o refresh, ricarica la sessione
    let appStateListener: { remove: () => void } | null = null;
    let appUrlListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) return;
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        setSession(refreshedSession);
        setUser(refreshedSession?.user ?? null);
        if (refreshedSession?.user) {
          checkProfileCompleted(refreshedSession.user.id);
        } else {
          setProfileCompleted(false);
          setLoading(false);
        }
      }).then(handle => { appStateListener = handle; });

      // Gestisce il deep link OAuth: it.memofarmaci.app://login?code=xxx
      CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(OAUTH_DEEP_LINK_PREFIX)) return;
        // Chiude il browser in-app se aperto
        await Browser.close().catch(() => {});
        // Estrae il code e lo scambia con la sessione
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            checkProfileCompleted(data.session.user.id);
          }
        } else {
          // Prova a caricare la sessione direttamente (flusso implicito)
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            setSession(s);
            setUser(s.user);
            checkProfileCompleted(s.user.id);
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
      // Su Android/iOS: apre il browser in-app e usa il custom URL scheme per il redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT_NATIVE, skipBrowserRedirect: true },
      });
      if (!error && data?.url) {
        await Browser.open({ url: data.url });
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
        await Browser.open({ url: data.url });
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
