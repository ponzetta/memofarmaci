import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { supabase } from '../lib/supabase';

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

    // Su Android: aggiorna la sessione quando l'app torna in foreground
    let appStateListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
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
    }

    return () => {
      subscription.unsubscribe();
      appStateListener?.remove();
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
      try {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if (!idToken) { console.error('[MF] idToken Firebase mancante'); return; }
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (error) { console.error('[MF] Supabase signInWithIdToken error:', error.message); return; }
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          checkProfileCompleted(data.session.user.id);
        }
      } catch (e) {
        console.error('[MF] Errore signInWithGoogle:', e);
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    }
  }

  async function signInWithFacebook() {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut().catch(() => {});
    }
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
