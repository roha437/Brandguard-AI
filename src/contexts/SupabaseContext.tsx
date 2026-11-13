import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigStatus,
  verifySupabaseConnection,
  type SupabaseConnectionCheck,
} from '../lib/supabase';
import type {
  BrandProfile,
  BrandProfileInput,
  UserProfile,
} from '../types/brandguard';

export interface AuthActionResult {
  error?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

interface SupabaseContextValue {
  supabase: SupabaseClient | null;
  isConfigured: boolean;
  configStatus: typeof supabaseConfigStatus;
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  isInitializing: boolean;
  isRecoveryMode: boolean;
  clearRecoveryMode: () => void;
  authNotice: string | null;
  clearAuthNotice: () => void;
  connectionStatus: SupabaseConnectionCheck | null;
  refreshConnectionStatus: () => Promise<SupabaseConnectionCheck>;
  profile: UserProfile | null;
  profileLoading: boolean;
  schemaError: string | null;
  brandProfiles: BrandProfile[];
  brandProfilesLoading: boolean;
  activeBrandProfileId: string | null;
  activeBrandProfile: BrandProfile | null;
  setActiveBrandProfileId: (id: string | null) => void;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthActionResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  updateProfile: (fullName: string) => Promise<AuthActionResult>;
  refreshBrandProfiles: () => Promise<void>;
  createBrandProfile: (input: BrandProfileInput) => Promise<{ profile?: BrandProfile; error?: string }>;
  updateBrandProfile: (
    id: string,
    input: Partial<BrandProfileInput>
  ) => Promise<{ profile?: BrandProfile; error?: string }>;
  deleteBrandProfile: (id: string) => Promise<{ error?: string }>;
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

const ACTIVE_BRAND_STORAGE_KEY = 'brandguard_active_brand_profile_id';

function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '0.0.0.0';
}

function toSafeDeployedOrigin(candidate: string | null | undefined): string | undefined {
  const trimmed = (candidate ?? '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !isLocalhostHostname(parsed.hostname)
    ) {
      return parsed.origin;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function resolveAuthRedirectUrl(serverAppUrl?: string | null): string | undefined {
  if (typeof window !== 'undefined' && window.location) {
    const liveOrigin = toSafeDeployedOrigin(window.location.href);
    if (liveOrigin) {
      return liveOrigin;
    }
  }

  const viteAppOrigin = toSafeDeployedOrigin(import.meta.env.VITE_APP_URL);
  if (viteAppOrigin) {
    return viteAppOrigin;
  }

  return toSafeDeployedOrigin(serverAppUrl);
}

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(isSupabaseConfigured);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [deployedAppUrl, setDeployedAppUrl] = useState<string | null>(() => {
    return toSafeDeployedOrigin(import.meta.env.VITE_APP_URL) ?? null;
  });
  const [connectionStatus, setConnectionStatus] = useState<SupabaseConnectionCheck | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([]);
  const [brandProfilesLoading, setBrandProfilesLoading] = useState<boolean>(false);
  const [activeBrandProfileId, setActiveBrandProfileIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveBrandProfileId = useCallback((id: string | null) => {
    setActiveBrandProfileIdState(id);
    try {
      if (id) {
        localStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_BRAND_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access errors in restricted iframes
    }
  }, []);

  const refreshConnectionStatus = useCallback(async (): Promise<SupabaseConnectionCheck> => {
    const status = await verifySupabaseConnection();
    setConnectionStatus(status);
    return status;
  }, []);

  const loadAccountData = useCallback(
    async (accessToken: string) => {
      setProfileLoading(true);
      setBrandProfilesLoading(true);
      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };

        const [meRes, bpRes] = await Promise.all([
          fetch('/api/me', { headers }),
          fetch('/api/brand-profiles', { headers }),
        ]);

        const meJson = await meRes.json().catch(() => ({}));
        const bpJson = await bpRes.json().catch(() => ({}));

        if (meJson?.code === 'SCHEMA_NOT_INITIALIZED' || bpJson?.code === 'SCHEMA_NOT_INITIALIZED') {
          setSchemaError(
            meJson?.error ||
              bpJson?.error ||
              'Database tables are not initialized yet. Run supabase/migrations/001_initial_schema.sql in your Supabase SQL Editor.'
          );
          setProfile(null);
          setBrandProfiles([]);
          return;
        }

        setSchemaError(null);

        if (meRes.ok && meJson.profile) {
          setProfile(meJson.profile as UserProfile);
        }

        if (bpRes.ok && Array.isArray(bpJson.profiles)) {
          const list = bpJson.profiles as BrandProfile[];
          setBrandProfiles(list);
          setActiveBrandProfileIdState((prev) => {
            if (prev && list.some((p) => p.id === prev)) {
              return prev;
            }
            const nextId = list.length > 0 ? list[0].id : null;
            try {
              if (nextId) localStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, nextId);
              else localStorage.removeItem(ACTIVE_BRAND_STORAGE_KEY);
            } catch {
              // ignore
            }
            return nextId;
          });
        }
      } catch (err) {
        console.error('Failed to load Supabase account data:', err);
      } finally {
        setProfileLoading(false);
        setBrandProfilesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!supabase) {
      setIsInitializing(false);
      setConnectionStatus({
        configured: false,
        reachable: false,
        latencyMs: null,
        error: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not configured.',
      });
      return;
    }

    let isMounted = true;

    // Warm deployedAppUrl from /api/health if not already resolved from window/env
    if (!resolveAuthRedirectUrl(deployedAppUrl)) {
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => {
          if (isMounted && typeof d?.appUrl === 'string') {
            const safe = toSafeDeployedOrigin(d.appUrl);
            if (safe) setDeployedAppUrl(safe);
          }
        })
        .catch(() => {
          // ignore
        });
    }

    // Inspect URL for returning Supabase email confirmation / recovery callback params
    let hasAuthRedirectCallback = false;
    let isSignupConfirmation = false;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashStr = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);

      const errorDesc =
        hashParams.get('error_description') || searchParams.get('error_description');
      const callbackType = hashParams.get('type') || searchParams.get('type');
      const hasTokenOrCode = Boolean(
        hashParams.get('access_token') || searchParams.get('code') || callbackType
      );

      if (errorDesc) {
        setAuthNotice(errorDesc);
        hasAuthRedirectCallback = true;
      } else if (hasTokenOrCode) {
        hasAuthRedirectCallback = true;
        isSignupConfirmation = callbackType === 'signup' || Boolean(searchParams.get('code'));
        if (callbackType === 'recovery') {
          setIsRecoveryMode(true);
        }
      }
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (!error) {
          setSession(data.session ?? null);
          if (data.session && isSignupConfirmation) {
            setAuthNotice('Email confirmed! Your BrandGuard AI workspace is now active.');
          }
        }
        setConnectionStatus({
          configured: true,
          reachable: !error,
          latencyMs: null,
          ...(error ? { error: error.message } : {}),
        });
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setConnectionStatus({
          configured: true,
          reachable: false,
          latencyMs: null,
          error: err instanceof Error ? err.message : 'Supabase session probe failed.',
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsInitializing(false);
          if (hasAuthRedirectCallback && typeof window !== 'undefined') {
            setTimeout(() => {
              if (window.location.search || window.location.hash) {
                window.history.replaceState(null, '', window.location.pathname);
              }
            }, 350);
          }
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
      if (event === 'SIGNED_IN' && isSignupConfirmation) {
        setAuthNotice('Email confirmed! Your BrandGuard AI workspace is now active.');
      }
      if (!nextSession) {
        setProfile(null);
        setBrandProfiles([]);
        setSchemaError(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const token = session?.access_token;
    if (token) {
      loadAccountData(token);
    } else {
      setProfile(null);
      setBrandProfiles([]);
      setSchemaError(null);
    }
  }, [session?.access_token, loadAccountData]);

  const getEffectiveRedirectOrigin = useCallback(async (): Promise<string | undefined> => {
    const immediate = resolveAuthRedirectUrl(deployedAppUrl);
    if (immediate) return immediate;

    try {
      const res = await fetch('/api/health');
      const data = await res.json().catch(() => ({}));
      if (typeof data?.appUrl === 'string') {
        const safe = toSafeDeployedOrigin(data.appUrl);
        if (safe) {
          setDeployedAppUrl(safe);
          return safe;
        }
      }
    } catch {
      // ignore network error; Supabase will use configured Site URL
    }
    return undefined;
  }, [deployedAppUrl]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<AuthActionResult> => {
      if (!supabase) {
        return { error: 'Supabase is not configured.' };
      }

      const trimmedName = fullName.trim();
      const redirectOrigin = await getEffectiveRedirectOrigin();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
          ...(redirectOrigin ? { emailRedirectTo: redirectOrigin } : {}),
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.session) {
        return {
          requiresEmailConfirmation: true,
          message:
            'Account created. Check your inbox for a confirmation link before signing in.',
        };
      }

      return { message: 'Account created and signed in.' };
    },
    [getEffectiveRedirectOrigin]
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { message: 'Signed in successfully.' };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setBrandProfiles([]);
    setIsRecoveryMode(false);
  }, []);

  const sendPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!supabase) {
        return { error: 'Supabase is not configured.' };
      }

      const redirectOrigin = await getEffectiveRedirectOrigin();
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        redirectOrigin ? { redirectTo: redirectOrigin } : undefined
      );

      if (error) {
        return { error: error.message };
      }

      return {
        message: 'Password reset instructions sent. Check your email to continue.',
      };
    },
    [getEffectiveRedirectOrigin]
  );

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    setIsRecoveryMode(false);
    return { message: 'Password updated successfully.' };
  }, []);

  const updateProfile = useCallback(
    async (fullName: string): Promise<AuthActionResult> => {
      if (!session?.access_token) {
        return { error: 'You must be signed in to update your profile.' };
      }

      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: fullName.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: data.error || 'Could not update profile.' };
      }

      if (data.profile) {
        setProfile(data.profile as UserProfile);
      }
      return { message: 'Profile updated.' };
    },
    [session?.access_token]
  );

  const refreshBrandProfiles = useCallback(async () => {
    if (!session?.access_token) return;
    setBrandProfilesLoading(true);
    try {
      const res = await fetch('/api/brand-profiles', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (json?.code === 'SCHEMA_NOT_INITIALIZED') {
        setSchemaError(json.error);
        return;
      }
      if (res.ok && Array.isArray(json.profiles)) {
        setSchemaError(null);
        setBrandProfiles(json.profiles as BrandProfile[]);
      }
    } finally {
      setBrandProfilesLoading(false);
    }
  }, [session?.access_token]);

  const createBrandProfile = useCallback(
    async (input: BrandProfileInput): Promise<{ profile?: BrandProfile; error?: string }> => {
      if (!session?.access_token) {
        return { error: 'Sign in required to save brand profiles.' };
      }

      const res = await fetch('/api/brand-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'SCHEMA_NOT_INITIALIZED') setSchemaError(data.error);
        return { error: data.error || 'Failed to create brand profile.' };
      }

      const created = data.profile as BrandProfile;
      setBrandProfiles((prev) => [created, ...prev]);
      setActiveBrandProfileId(created.id);
      return { profile: created };
    },
    [session?.access_token, setActiveBrandProfileId]
  );

  const updateBrandProfile = useCallback(
    async (
      id: string,
      input: Partial<BrandProfileInput>
    ): Promise<{ profile?: BrandProfile; error?: string }> => {
      if (!session?.access_token) {
        return { error: 'Sign in required to update brand profiles.' };
      }

      const res = await fetch(`/api/brand-profiles/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'SCHEMA_NOT_INITIALIZED') setSchemaError(data.error);
        return { error: data.error || 'Failed to update brand profile.' };
      }

      const updated = data.profile as BrandProfile;
      setBrandProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return { profile: updated };
    },
    [session?.access_token]
  );

  const deleteBrandProfile = useCallback(
    async (id: string): Promise<{ error?: string }> => {
      if (!session?.access_token) {
        return { error: 'Sign in required to delete brand profiles.' };
      }

      const res = await fetch(`/api/brand-profiles/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: data.error || 'Failed to delete brand profile.' };
      }

      setBrandProfiles((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (activeBrandProfileId === id) {
          setActiveBrandProfileId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
      return {};
    },
    [session?.access_token, activeBrandProfileId, setActiveBrandProfileId]
  );

  const activeBrandProfile = useMemo(
    () => brandProfiles.find((p) => p.id === activeBrandProfileId) ?? null,
    [brandProfiles, activeBrandProfileId]
  );

  const value = useMemo<SupabaseContextValue>(
    () => ({
      supabase,
      isConfigured: isSupabaseConfigured,
      configStatus: supabaseConfigStatus,
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      isInitializing,
      isRecoveryMode,
      clearRecoveryMode: () => setIsRecoveryMode(false),
      authNotice,
      clearAuthNotice: () => setAuthNotice(null),
      connectionStatus,
      refreshConnectionStatus,
      profile,
      profileLoading,
      schemaError,
      brandProfiles,
      brandProfilesLoading,
      activeBrandProfileId,
      activeBrandProfile,
      setActiveBrandProfileId,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      refreshBrandProfiles,
      createBrandProfile,
      updateBrandProfile,
      deleteBrandProfile,
    }),
    [
      session,
      isInitializing,
      isRecoveryMode,
      authNotice,
      connectionStatus,
      refreshConnectionStatus,
      profile,
      profileLoading,
      schemaError,
      brandProfiles,
      brandProfilesLoading,
      activeBrandProfileId,
      activeBrandProfile,
      setActiveBrandProfileId,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      refreshBrandProfiles,
      createBrandProfile,
      updateBrandProfile,
      deleteBrandProfile,
    ]
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
};

export function useSupabase(): SupabaseContextValue {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error('useSupabase must be used within a SupabaseProvider.');
  }
  return ctx;
}
