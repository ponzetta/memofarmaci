import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
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

    return () => subscription.unsubscribe();
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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithFacebook() {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin },
    });
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
