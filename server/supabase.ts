import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Request } from 'express';

const PLACEHOLDER_URLS = new Set([
  '',
  'https://your-project-ref.supabase.co',
  'MY_SUPABASE_URL',
]);

const PLACEHOLDER_KEYS = new Set([
  '',
  'MY_SUPABASE_ANON_KEY',
  'MY_SUPABASE_SERVICE_ROLE_KEY',
  'your-anon-key',
]);

function readClean(val: string | undefined): string {
  return (val ?? '').trim().replace(/^['"]+|['"]+$/g, '');
}

function normalizeSupabaseRootUrl(candidate: string): string {
  const cleaned = readClean(candidate);
  if (!cleaned || PLACEHOLDER_URLS.has(cleaned)) return '';

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    if (parsed.hostname === 'supabase.com' || parsed.pathname.includes('/dashboard')) {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

function getSupabaseUrl(): string {
  const raw = readClean(process.env.SUPABASE_URL) || readClean(process.env.VITE_SUPABASE_URL);
  return normalizeSupabaseRootUrl(raw);
}

function getSupabaseAnonKey(): string {
  const key =
    readClean(process.env.SUPABASE_ANON_KEY) ||
    readClean(process.env.VITE_SUPABASE_ANON_KEY) ||
    readClean(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    readClean(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return !PLACEHOLDER_KEYS.has(key) && key.length > 20 ? key : '';
}

function getSupabaseServiceRoleKey(): string {
  const key = readClean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return !PLACEHOLDER_KEYS.has(key) && key.length > 20 ? key : '';
}

export function getServerSupabaseConfigStatus() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return {
    configured: Boolean(url && (anonKey || serviceRoleKey)),
    urlPresent: Boolean(url),
    anonKeyPresent: Boolean(anonKey),
    serviceRoleConfigured: Boolean(serviceRoleKey),
  };
}

/**
 * Creates a request-scoped Supabase client using the anon key and caller JWT.
 * Enforces Supabase Row-Level Security (RLS) on all queries.
 */
export function createServerSupabaseUserClient(accessToken?: string): SupabaseClient | null {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'brandguard-ai-server',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    },
  });
}

/**
 * Strictly server-side privileged admin client using SUPABASE_SERVICE_ROLE_KEY.
 * NEVER import this module or expose this key in src/.
 */
export function getServerSupabaseAdminClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'brandguard-ai-server-admin',
      },
    },
  });
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export interface AuthenticatedSupabaseContext {
  user: User;
  accessToken: string;
  supabase: SupabaseClient;
}

/**
 * Verifies the caller's Supabase Auth JWT with Supabase Auth and returns
 * an RLS-scoped Supabase client bound to the verified user.
 * Never trusts user_id from request bodies.
 */
export async function authenticateSupabaseRequest(
  req: Request
): Promise<AuthenticatedSupabaseContext | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const client = createServerSupabaseUserClient(token);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return {
    user: data.user,
    accessToken: token,
    supabase: client,
  };
}

export function isMissingSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('could not find the table');
}

export async function verifyServerSupabaseConnection(): Promise<{
  configured: boolean;
  urlPresent: boolean;
  anonKeyPresent: boolean;
  serviceRoleConfigured: boolean;
  reachable: boolean;
  authHealthy: boolean | null;
  latencyMs: number | null;
  error?: string;
}> {
  const status = getServerSupabaseConfigStatus();
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const serviceKey = getSupabaseServiceRoleKey();
  const apiKey = anonKey || serviceKey;

  if (!status.configured || !url || !apiKey) {
    return {
      ...status,
      reachable: false,
      authHealthy: null,
      latencyMs: null,
      error: 'Supabase environment variables are not configured.',
    };
  }

  const start = Date.now();
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'supabase.com' || parsedUrl.pathname.includes('/dashboard')) {
      return {
        ...status,
        reachable: false,
        authHealthy: false,
        latencyMs: Date.now() - start,
        error:
          'Configured URL looks like a Supabase Dashboard URL rather than the Project API URL (https://<project-ref>.supabase.co).',
      };
    }

    const baseOrigin = parsedUrl.origin;
    const response = await Promise.race([
      fetch(`${baseOrigin}/auth/v1/settings`, {
        method: 'GET',
        headers: {
          apikey: apiKey,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase health check timed out after 5000ms')), 5000)
      ),
    ]);

    const latencyMs = Date.now() - start;
    return {
      ...status,
      reachable: response.ok,
      authHealthy: response.ok,
      latencyMs,
      ...(response.ok ? {} : { error: `HTTP ${response.status} from Supabase Auth settings endpoint` }),
    };
  } catch (err: unknown) {
    return {
      ...status,
      reachable: false,
      authHealthy: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unable to reach Supabase.',
    };
  }
}
