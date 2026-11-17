import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fromAccountLanguage, useLanguage } from '@/lib/i18n';
import { authApi, meApi, onSessionExpired, refreshSession, type Me } from '@/lib/api';

/** Minimal session shape (kept compatible with code that reads session.user.id). */
export type Session = { user: { id: string; email: string | null } };

type AuthContextType = {
  session: Session | null;
  /** The signed-in user's full private view (profile, photos, sports, prompts). */
  me: Me | null;
  /** Alias of `me`, for screens written against the old context. */
  profile: Me | null;
  loading: boolean;
  checkingProfile: boolean;
  refreshProfile: () => Promise<void>;
  /** Replace the cached `me` with a fresh server response (after a mutation). */
  setMe: (me: Me) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  /** Finishes the server-side Google flow with the one-time code from the redirect. */
  completeGoogleSignIn: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, onSignOut }: { children: React.ReactNode; onSignOut?: () => void }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLanguage } = useLanguage();
  const syncedFor = useRef<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const alive = useRef(true);

  const setMe = useCallback((next: Me | null) => {
    if (alive.current) setMeState(next);
  }, []);

  const loadMe = useCallback(async () => {
    setCheckingProfile(true);
    try {
      setMe(await meApi.get());
    } finally {
      if (alive.current) setCheckingProfile(false);
    }
  }, [setMe]);

  // Restore the session saved in secure storage.
  // Restore the language saved on the account once per sign-in (also on a new device).
  const accountLang = me?.profile.onboardingCompleted ? me.profile.language : null;
  useEffect(() => {
    if (!me) {
      syncedFor.current = null;
      return;
    }
    const lang = fromAccountLanguage(accountLang);
    if (lang && syncedFor.current !== me.id) {
      syncedFor.current = me.id;
      setLanguage(lang);
    }
  }, [me, accountLang, setLanguage]);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        if (await refreshSession()) await loadMe();
      } catch {
        setMe(null);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
    const unsubscribe = onSessionExpired(() => setMe(null));
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, [loadMe, setMe]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      await loadMe();
    },
    [loadMe],
  );

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      await authApi.register(email, password, name);
      await loadMe();
    },
    [loadMe],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      await authApi.google(idToken);
      await loadMe();
    },
    [loadMe],
  );

  const completeGoogleSignIn = useCallback(
    async (code: string) => {
      await authApi.googleExchange(code);
      await loadMe();
    },
    [loadMe],
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    setMe(null);
    onSignOut?.();
  }, [onSignOut, setMe]);

  const refreshProfile = useCallback(async () => {
    try {
      await loadMe();
    } catch {
      // keep the current data; screens show their own errors
    }
  }, [loadMe]);

  const value = useMemo<AuthContextType>(
    () => ({
      session: me ? { user: { id: me.id, email: me.email } } : null,
      me,
      profile: me,
      loading,
      checkingProfile,
      refreshProfile,
      setMe: (m: Me) => setMe(m),
      signIn,
      signUp,
      signInWithGoogle,
      completeGoogleSignIn,
      signOut,
    }),
    [me, loading, checkingProfile, refreshProfile, setMe, signIn, signUp, signInWithGoogle, completeGoogleSignIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
