import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URLS = new Set([
  '',
  'https://your-project-ref.supabase.co',
  'MY_SUPABASE_URL',
]);

const PLACEHOLDER_KEYS = new Set([
  '',
  'MY_SUPABASE_ANON_KEY',
  'your-anon-key',
]);

function readCleanEnv(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]+|['"]+$/g, '');
}

function normalizeSupabaseRootUrl(candidate: string): string {
  const cleaned = readCleanEnv(candidate);
  if (!cleaned || PLACEHOLDER_URLS.has(cleaned)) return '';

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    if (parsed.hostname === 'supabase.com' || parsed.pathname.includes('/dashboard')) {
      return '';
    }
    // Supabase client requires the project root URL (e.g. https://<ref>.supabase.co)
    // without /rest/v1, /auth/v1, trailing slashes, query strings, or hash fragments.
    return parsed.origin;
  } catch {
    return '';
  }
}

const rawSupabaseUrl = readCleanEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseUrl = normalizeSupabaseRootUrl(rawSupabaseUrl);
const rawSupabaseAnonKey = readCleanEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const hasValidUrl = Boolean(supabaseUrl);
const hasValidAnonKey =
  !PLACEHOLDER_KEYS.has(rawSupabaseAnonKey) && rawSupabaseAnonKey.length > 20;

export const isSupabaseConfigured = hasValidUrl && hasValidAnonKey;

export const supabaseConfigStatus = {
  configured: isSupabaseConfigured,
  urlPresent: hasValidUrl,
  anonKeyPresent: hasValidAnonKey,
} as const;

/**
 * Centralized browser-safe Supabase client.
 * Uses strictly public anon/publishable key (`VITE_SUPABASE_ANON_KEY`) — never service_role.
 * Normalizes the URL to the Supabase project root origin so SDK endpoints like
 * `/auth/v1/signup` resolve cleanly even if `/rest/v1/` was included in env config.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, rawSupabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'brandguard-ai-auth',
      },
      global: {
        headers: {
          'X-Client-Info': 'brandguard-ai-web',
        },
      },
    })
  : null;

/**
 * Strict accessor for future authenticated & database-backed modules.
 */
export function requireSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

export interface SupabaseConnectionCheck {
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
  error?: string;
}

/**
 * Lightweight connectivity check against Supabase Auth session & REST endpoint.
 * Never logs or returns API keys.
 */
export async function verifySupabaseConnection(): Promise<SupabaseConnectionCheck> {
  if (!supabase || !isSupabaseConfigured) {
    return {
      configured: false,
      reachable: false,
      latencyMs: null,
      error: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not configured.',
    };
  }

  const start = performance.now();
  try {
    const { error } = await supabase.auth.getSession();
    const latencyMs = Math.round(performance.now() - start);
    if (error) {
      return {
        configured: true,
        reachable: false,
        latencyMs,
        error: error.message,
      };
    }

    return {
      configured: true,
      reachable: true,
      latencyMs,
    };
  } catch (err: unknown) {
    return {
      configured: true,
      reachable: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : 'Unable to reach Supabase.',
    };
  }
}
