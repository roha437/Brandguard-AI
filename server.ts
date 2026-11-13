import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  authenticateSupabaseRequest,
  getServerSupabaseConfigStatus,
  isMissingSchemaError,
  verifyServerSupabaseConnection,
} from './server/supabase';
import {
  analyzeVideoPipeline,
  checkFfmpegAvailable,
  type BrandContextForVideo,
} from './server/videoAnalysis';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

const PORT = process.env.PORT || 3000;
const MAX_VIDEO_UPLOAD_BYTES = 75 * 1024 * 1024; // 75 MB

const videoUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() === '.mp4' ? '.mp4' : '.mp4';
    cb(null, `videoguard-upload-${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const uploadVideoMiddleware = multer({
  storage: videoUploadStorage,
  limits: {
    fileSize: MAX_VIDEO_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isMp4Mime = mime === 'video/mp4' || mime === 'application/mp4';
    const isMp4Fallback = mime === 'application/octet-stream' && ext === '.mp4';
    if (isMp4Mime || isMp4Fallback || ext === '.mp4') {
      cb(null, true);
      return;
    }
    cb(new Error('Unsupported video format. Please upload an MP4 (.mp4 / video/mp4) file.'));
  },
});

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeStringArray(input: unknown, maxItems = 100, maxLength = 80): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const cleaned = item.trim().slice(0, maxLength);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
    if (result.length >= maxItems) break;
  }
  return result;
}

function normalizeToneRules(input: unknown): {
  formality: number;
  authoritative: number;
  technical: number;
  customGuidelines?: string;
} {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const clamp = (v: unknown, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  };
  const customGuidelines =
    typeof obj.customGuidelines === 'string' && obj.customGuidelines.trim()
      ? obj.customGuidelines.trim().slice(0, 1000)
      : undefined;

  return {
    formality: clamp(obj.formality, 75),
    authoritative: clamp(obj.authoritative, 60),
    technical: clamp(obj.technical, 85),
    ...(customGuidelines ? { customGuidelines } : {}),
  };
}

function computeAuditHash(params: {
  userId: string;
  brandProfileId: string | null;
  channel: string | null;
  originalContent: string;
  overallScore: number;
}): string {
  const canonical = JSON.stringify({
    u: params.userId,
    b: params.brandProfileId || null,
    c: (params.channel || '').trim().toLowerCase(),
    t: params.originalContent.trim(),
    s: Math.round(params.overallScore),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function handleSupabaseError(
  res: express.Response,
  err: { code?: string; message?: string },
  migrationFile: string = '001_initial_schema.sql'
) {
  if (isMissingSchemaError(err)) {
    return res.status(503).json({
      error: `Database tables are not initialized yet. Run supabase/migrations/${migrationFile} in your Supabase SQL Editor.`,
      code: 'SCHEMA_NOT_INITIALIZED',
    });
  }
  return res.status(400).json({
    error: err.message || 'Database operation failed.',
    code: err.code || 'SUPABASE_ERROR',
  });
}

// Helper to check if a real GEMINI_API_KEY is configured (never exposes the key)
function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

function getGeminiClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseJsonSafely<T>(rawText: string): T {
  const trimmed = rawText.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(unfenced) as T;
}

function sanitizeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]');
}

export interface BrandContextPayload {
  brandName?: string;
  industry?: string;
  brandVoice?: string;
  approvedWords?: string[];
  restrictedWords?: string[];
  toneRules?: {
    formality?: number;
    authoritative?: number;
    technical?: number;
    customGuidelines?: string;
  };
  customRules?: Array<{
    name: string;
    patternOrTerm: string;
    recommendedFix: string;
    severity: 'critical' | 'warning' | 'nominal';
  }>;
}

export interface AuditRequest {
  content: string;
  channel?: string;
  brandProfileId?: string | null;
  brandContext?: BrandContextPayload;
}

// Fallback deterministic rule evaluator for offline / keyless testing
function evaluateWithHeuristics(
  content: string,
  channel: string = 'general',
  brandContext?: BrandContextPayload
) {
  const defaultForbidden = [
    { term: 'revolutionary', replacement: 'advanced', reason: 'Hyperbolic claim violates tone guideline §3.2', severity: 'warning' as const },
    { term: '100% guaranteed', replacement: 'rigorously verified', reason: 'Absolute legal liability guarantee', severity: 'critical' as const },
    { term: 'cheap', replacement: 'cost-efficient', reason: 'Brand value devaluation', severity: 'warning' as const },
    { term: 'disrupting', replacement: 'modernizing', reason: 'Overused clichéd terminology', severity: 'warning' as const },
    { term: 'Brandguard', replacement: 'BrandGuard AI™', reason: 'Missing trademark and capitalization syntax', severity: 'critical' as const },
    { term: 'magic', replacement: 'algorithmic inference', reason: 'Unscientific claim', severity: 'warning' as const },
    { term: 'unbeatable', replacement: 'industry-leading', reason: 'Unsubstantiated comparative superiority', severity: 'warning' as const },
  ];

  const violations: Array<{
    id: string;
    ruleName: string;
    severity: 'critical' | 'warning' | 'nominal';
    snippet: string;
    issue: string;
    remediation: string;
    replacement: string;
  }> = [];

  let remediated = content;
  const brandDisplayName = brandContext?.brandName?.trim() || 'BrandGuard AI™';

  defaultForbidden.forEach((item, idx) => {
    const regex = new RegExp(`\\b${escapeRegExp(item.term)}\\b`, 'gi');
    if (regex.test(content)) {
      violations.push({
        id: `v-${idx + 1}`,
        ruleName: item.term.includes('Brandguard') ? 'Trademark Protection' : 'Tone & Vocabulary Governance',
        severity: item.severity,
        snippet: item.term,
        issue: item.reason,
        remediation: `Replace "${item.term}" with authorized corporate terminology "${item.replacement}".`,
        replacement: item.replacement,
      });
      remediated = remediated.replace(regex, item.replacement);
    }
  });

  // Enforce Brand Profile restricted words
  const restricted = normalizeStringArray(brandContext?.restrictedWords);
  restricted.forEach((term, idx) => {
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    if (regex.test(content)) {
      const replacement = brandContext?.approvedWords?.[0] || '[approved terminology]';
      violations.push({
        id: `bp-restricted-${idx + 1}`,
        ruleName: `${brandDisplayName} Restricted Vocabulary`,
        severity: 'critical',
        snippet: term,
        issue: `"${term}" is explicitly prohibited in the "${brandDisplayName}" Brand Profile.`,
        remediation: `Replace "${term}" with "${replacement}" aligned with your ${brandDisplayName} guidelines.`,
        replacement,
      });
      remediated = remediated.replace(regex, replacement);
    }
  });

  // Enforce active custom rules if supplied
  if (Array.isArray(brandContext?.customRules)) {
    brandContext.customRules.forEach((rule, idx) => {
      if (!rule.patternOrTerm) return;
      const parts = rule.patternOrTerm
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        const regex = new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi');
        if (regex.test(content) && !violations.some((v) => v.snippet.toLowerCase() === part.toLowerCase())) {
          violations.push({
            id: `custom-${idx + 1}`,
            ruleName: rule.name || 'Custom Brand Rule',
            severity: rule.severity || 'warning',
            snippet: part,
            issue: `Matched forbidden pattern "${part}" from active rule "${rule.name}".`,
            remediation: `Replace "${part}" with "${rule.recommendedFix || 'approved phrasing'}".`,
            replacement: rule.recommendedFix || 'approved phrasing',
          });
          remediated = remediated.replace(regex, rule.recommendedFix || 'approved phrasing');
        }
      }
    });
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const criticalCount = violations.filter((v) => v.severity === 'critical').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  let baseScore = 96;
  baseScore -= criticalCount * 22;
  baseScore -= warningCount * 9;
  const overallScore = Math.max(28, Math.min(99, baseScore));

  const status: 'compliant' | 'warning' | 'critical' =
    overallScore >= 88 ? 'compliant' : overallScore >= 68 ? 'warning' : 'critical';

  return {
    overallScore,
    status,
    channel,
    wordCount,
    brandName: brandDisplayName,
    tokenDrift: {
      formalDeviation: 0,
      authoritativeDeviation: 0,
      hyperboleFactor: criticalCount > 0 ? 32 : warningCount > 0 ? 14 : 3,
      vocabularyPrecision: Math.max(70, 100 - (criticalCount * 18 + warningCount * 8)),
    },
    summary:
      violations.length === 0
        ? `All ${brandDisplayName} brand tokens, trademark designations, and tone criteria successfully passed.`
        : `Detected ${violations.length} divergence(s) against ${brandDisplayName} rules: ${criticalCount} critical violation(s) and ${warningCount} advisory drift warning(s).`,
    violations,
    remediatedText: remediated,
    channelSpecificTips: [
      `${channel.toUpperCase()}: Maintain concise syntax and verify clear attribution.`,
      `Adhere to ${brandDisplayName} tone and approved terminology guidelines.`,
    ],
  };
}

const GEMINI_MODEL_CANDIDATES = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
] as const;

async function generateContentWithResilience(
  ai: GoogleGenAI,
  contents: string,
  config: Record<string, unknown>
): Promise<{ text: string; modelUsed: string; attemptErrors: string[] }> {
  const attemptErrors: string[] = [];

  for (const model of GEMINI_MODEL_CANDIDATES) {
    const timeoutMs = model === 'gemini-3.8-flash' ? 8000 : 20000;
    try {
      const modelConfig =
        model === 'gemini-3.8-flash'
          ? { ...config, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : config;

      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents,
          config: modelConfig,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms on ${model}`)), timeoutMs)
        ),
      ]);

      const text = response.text;
      if (!text || !text.trim()) {
        throw new Error(`Empty response from ${model}`);
      }

      return { text, modelUsed: model, attemptErrors };
    } catch (err: unknown) {
      const msg = sanitizeErrorMessage(err);
      attemptErrors.push(`${model}: ${msg}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(attemptErrors.join(' | '));
}

function formatBrandContextForPrompt(brandContext?: BrandContextPayload): string {
  if (!brandContext) {
    return 'Brand Name: BrandGuard AI™\nIndustry: Enterprise Governance SaaS\nBrand Voice: Authoritative, precise, and enterprise-grade.';
  }

  const lines: string[] = [
    `Brand Name: ${brandContext.brandName || 'BrandGuard AI™'}`,
    `Industry: ${brandContext.industry || 'Enterprise Technology'}`,
    `Brand Voice: ${brandContext.brandVoice || 'Authoritative, precise, and enterprise-grade.'}`,
  ];

  if (brandContext.approvedWords && brandContext.approvedWords.length > 0) {
    lines.push(`Approved Preferred Vocabulary: ${brandContext.approvedWords.join(', ')}`);
  }
  if (brandContext.restrictedWords && brandContext.restrictedWords.length > 0) {
    lines.push(
      `Strictly Restricted/Forbidden Words (flag every occurrence as a critical or warning violation and replace with approved alternatives): ${brandContext.restrictedWords.join(', ')}`
    );
  }
  if (brandContext.toneRules) {
    lines.push(
      `Tone Calibration Targets (0-100 scale): Formality=${brandContext.toneRules.formality ?? 75}%, Authoritative=${brandContext.toneRules.authoritative ?? 60}%, Technical Depth=${brandContext.toneRules.technical ?? 85}%`
    );
    if (brandContext.toneRules.customGuidelines) {
      lines.push(`Additional Guidelines: ${brandContext.toneRules.customGuidelines}`);
    }
  }
  if (brandContext.customRules && brandContext.customRules.length > 0) {
    lines.push(
      `Additional Active Rules:\n${brandContext.customRules
        .map((r) => `- ${r.name} [${r.severity}]: avoid "${r.patternOrTerm}", prefer "${r.recommendedFix}"`)
        .join('\n')}`
    );
  }

  return lines.join('\n');
}

// ============================================================================
// Authenticated User Profile & Brand Governance Endpoints (Supabase RLS)
// ============================================================================

app.get('/api/me', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { data, error } = await auth.supabase
      .from('profiles')
      .select('id, full_name, created_at, updated_at')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error);
    }

    if (!data) {
      const derivedName =
        (typeof auth.user.user_metadata?.full_name === 'string' &&
          auth.user.user_metadata.full_name.trim()) ||
        auth.user.email?.split('@')[0] ||
        'BrandGuard User';

      const { data: inserted, error: insertError } = await auth.supabase
        .from('profiles')
        .upsert(
          {
            id: auth.user.id,
            full_name: derivedName.slice(0, 120),
          },
          { onConflict: 'id' }
        )
        .select('id, full_name, created_at, updated_at')
        .single();

      if (insertError) {
        return handleSupabaseError(res, insertError);
      }

      return res.json({ profile: inserted, email: auth.user.email });
    }

    return res.json({ profile: data, email: auth.user.email });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.patch('/api/me', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
    if (!fullName || fullName.length > 120) {
      return res.status(400).json({ error: 'full_name must be between 1 and 120 characters.' });
    }

    const { data, error } = await auth.supabase
      .from('profiles')
      .upsert(
        {
          id: auth.user.id,
          full_name: fullName,
        },
        { onConflict: 'id' }
      )
      .select('id, full_name, created_at, updated_at')
      .single();

    if (error) {
      return handleSupabaseError(res, error);
    }

    return res.json({ profile: data });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Brand Profiles CRUD
app.get('/api/brand-profiles', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { data, error } = await auth.supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      return handleSupabaseError(res, error);
    }

    return res.json({ profiles: data || [] });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.post('/api/brand-profiles', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const brandName = typeof req.body?.brand_name === 'string' ? req.body.brand_name.trim() : '';
    if (!brandName || brandName.length > 120) {
      return res.status(400).json({ error: 'Brand name is required (max 120 characters).' });
    }

    const industry =
      typeof req.body?.industry === 'string' && req.body.industry.trim()
        ? req.body.industry.trim().slice(0, 100)
        : 'Enterprise Technology';
    const brandVoice =
      typeof req.body?.brand_voice === 'string' && req.body.brand_voice.trim()
        ? req.body.brand_voice.trim().slice(0, 1500)
        : 'Authoritative, precise, and enterprise-grade.';

    const payload = {
      user_id: auth.user.id,
      brand_name: brandName,
      industry,
      brand_voice: brandVoice,
      approved_words: normalizeStringArray(req.body?.approved_words),
      restricted_words: normalizeStringArray(req.body?.restricted_words),
      tone_rules: normalizeToneRules(req.body?.tone_rules),
    };

    const { data, error } = await auth.supabase
      .from('brand_profiles')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return handleSupabaseError(res, error);
    }

    return res.status(201).json({ profile: data });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.patch('/api/brand-profiles/:id', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid brand profile ID.' });
    }

    const updates: Record<string, unknown> = {};

    if (req.body?.brand_name !== undefined) {
      const bn = typeof req.body.brand_name === 'string' ? req.body.brand_name.trim() : '';
      if (!bn || bn.length > 120) {
        return res.status(400).json({ error: 'Brand name must be between 1 and 120 characters.' });
      }
      updates.brand_name = bn;
    }

    if (req.body?.industry !== undefined) {
      updates.industry =
        typeof req.body.industry === 'string' && req.body.industry.trim()
          ? req.body.industry.trim().slice(0, 100)
          : 'Enterprise Technology';
    }

    if (req.body?.brand_voice !== undefined) {
      updates.brand_voice =
        typeof req.body.brand_voice === 'string' && req.body.brand_voice.trim()
          ? req.body.brand_voice.trim().slice(0, 1500)
          : 'Authoritative, precise, and enterprise-grade.';
    }

    if (req.body?.approved_words !== undefined) {
      updates.approved_words = normalizeStringArray(req.body.approved_words);
    }

    if (req.body?.restricted_words !== undefined) {
      updates.restricted_words = normalizeStringArray(req.body.restricted_words);
    }

    if (req.body?.tone_rules !== undefined) {
      updates.tone_rules = normalizeToneRules(req.body.tone_rules);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided.' });
    }

    const { data, error } = await auth.supabase
      .from('brand_profiles')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error);
    }

    if (!data) {
      return res.status(404).json({ error: 'Brand profile not found or access denied.' });
    }

    return res.json({ profile: data });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.delete('/api/brand-profiles/:id', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid brand profile ID.' });
    }

    const { data, error } = await auth.supabase
      .from('brand_profiles')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error);
    }

    if (!data) {
      return res.status(404).json({ error: 'Brand profile not found or access denied.' });
    }

    return res.json({ deleted: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Persistent Audits CRUD
app.get('/api/audits', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : '';
    const brandProfileId =
      typeof req.query.brandProfileId === 'string' ? req.query.brandProfileId.trim() : '';

    let query = auth.supabase
      .from('audits')
      .select('*, brand_profiles(brand_name)')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && ['compliant', 'warning', 'critical'].includes(status)) {
      query = query.eq('status', status);
    }

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel);
    }

    if (brandProfileId && isValidUuid(brandProfileId)) {
      query = query.eq('brand_profile_id', brandProfileId);
    }

    const { data, error } = await query;
    if (error) {
      return handleSupabaseError(res, error);
    }

    const rows = (data || []).filter((row) => {
      if (!search) return true;
      const hay = `${row.id} ${row.title || ''} ${row.original_content || ''} ${row.channel || ''}`.toLowerCase();
      return hay.includes(search);
    });

    return res.json({ audits: rows });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.post('/api/audits', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const originalContent =
      typeof req.body?.original_content === 'string' ? req.body.original_content.trim() : '';
    if (!originalContent) {
      return res.status(400).json({ error: 'original_content is required.' });
    }

    const rawScore = Number(req.body?.overall_score);
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
      return res.status(400).json({ error: 'overall_score must be between 0 and 100.' });
    }
    const overallScore = Math.round(rawScore);

    const status = req.body?.status;
    if (!['compliant', 'warning', 'critical'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    let brandProfileId: string | null = null;
    if (req.body?.brand_profile_id !== null && req.body?.brand_profile_id !== undefined && req.body?.brand_profile_id !== '') {
      if (!isValidUuid(req.body.brand_profile_id)) {
        return res.status(400).json({ error: 'Invalid brand_profile_id.' });
      }
      const { data: bp, error: bpError } = await auth.supabase
        .from('brand_profiles')
        .select('id')
        .eq('id', req.body.brand_profile_id)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (bpError) {
        return handleSupabaseError(res, bpError);
      }
      if (!bp) {
        return res.status(403).json({ error: 'Selected brand profile does not belong to your account.' });
      }
      brandProfileId = bp.id;
    }

    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim().slice(0, 200)
        : 'Brand Compliance Audit';
    const channel =
      typeof req.body?.channel === 'string' && req.body.channel.trim()
        ? req.body.channel.trim().slice(0, 50)
        : null;
    const correctedContent =
      typeof req.body?.corrected_content === 'string' ? req.body.corrected_content : null;
    const violations = Array.isArray(req.body?.violations) ? req.body.violations : [];

    const contentHash = computeAuditHash({
      userId: auth.user.id,
      brandProfileId,
      channel,
      originalContent,
      overallScore,
    });

    // Prevent accidental duplicate saves within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await auth.supabase
      .from('audits')
      .select('*, brand_profiles(brand_name)')
      .eq('user_id', auth.user.id)
      .eq('content_hash', contentHash)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError && !isMissingSchemaError(existingError)) {
      return handleSupabaseError(res, existingError);
    }

    if (existing) {
      return res.status(200).json({ audit: existing, deduplicated: true });
    }

    const { data, error } = await auth.supabase
      .from('audits')
      .insert({
        user_id: auth.user.id,
        brand_profile_id: brandProfileId,
        title,
        original_content: originalContent,
        corrected_content: correctedContent,
        overall_score: overallScore,
        status,
        violations,
        channel,
        content_hash: contentHash,
      })
      .select('*, brand_profiles(brand_name)')
      .single();

    if (error) {
      return handleSupabaseError(res, error);
    }

    return res.status(201).json({ audit: data, deduplicated: false });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.delete('/api/audits/:id', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid audit ID.' });
    }

    const { data, error } = await auth.supabase
      .from('audits')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error);
    }

    if (!data) {
      return res.status(404).json({ error: 'Audit record not found or access denied.' });
    }

    return res.json({ deleted: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ============================================================================
// AI Audit & Remediation Endpoints (Server-Side Gemini API)
// ============================================================================

// POST /api/audit - AI Brand Compliance Inspector
app.post('/api/audit', async (req, res) => {
  try {
    const { content, channel = 'marketing', brandProfileId, brandContext: clientBrandContext } =
      req.body as AuditRequest;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required for brand audit.' });
    }

    // If an authenticated user references a saved brandProfileId, load the authoritative row via RLS
    let effectiveBrandContext: BrandContextPayload | undefined = clientBrandContext;
    let resolvedBrandProfileId: string | null = null;

    if (brandProfileId && isValidUuid(brandProfileId)) {
      const auth = await authenticateSupabaseRequest(req);
      if (auth) {
        const { data: bp, error: bpError } = await auth.supabase
          .from('brand_profiles')
          .select('*')
          .eq('id', brandProfileId)
          .eq('user_id', auth.user.id)
          .maybeSingle();

        if (!bpError && bp) {
          resolvedBrandProfileId = bp.id;
          effectiveBrandContext = {
            brandName: bp.brand_name,
            industry: bp.industry,
            brandVoice: bp.brand_voice,
            approvedWords: Array.isArray(bp.approved_words) ? bp.approved_words : [],
            restrictedWords: Array.isArray(bp.restricted_words) ? bp.restricted_words : [],
            toneRules: bp.tone_rules || undefined,
            customRules: clientBrandContext?.customRules,
          };
        }
      }
    }

    if (!hasValidGeminiKey()) {
      const localResult = evaluateWithHeuristics(content, channel, effectiveBrandContext);
      return res.json({
        ...localResult,
        brandProfileId: resolvedBrandProfileId,
        engine: 'heuristic-fallback',
        notice: 'GEMINI_API_KEY is not configured; using local rule engine.',
      });
    }

    const ai = getGeminiClient();
    const brandRulesBlock = formatBrandContextForPrompt(effectiveBrandContext);

    const prompt = `You are the lead Brand Compliance Engine for BrandGuard AI, an enterprise governance platform.
Evaluate the following text for brand guideline adherence, tone drift, forbidden/restricted vocabulary, approved vocabulary usage, legal liabilities, and trademark compliance.

Brand Profile & Governance Context:
${brandRulesBlock}

Channel Context: ${channel}

Text to inspect:
"""
${content}
"""`;

    const { text: textOutput, modelUsed, attemptErrors } = await generateContentWithResilience(
      ai,
      prompt,
      {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER, description: 'Overall compliance score from 0 to 100.' },
            status: { type: Type.STRING, enum: ['compliant', 'warning', 'critical'] },
            wordCount: { type: Type.INTEGER },
            channel: { type: Type.STRING },
            tokenDrift: {
              type: Type.OBJECT,
              properties: {
                formalDeviation: { type: Type.INTEGER, description: 'Integer percentage drift from formal baseline (-50 to +50).' },
                authoritativeDeviation: { type: Type.INTEGER, description: 'Integer percentage drift from authoritative baseline (-50 to +50).' },
                hyperboleFactor: { type: Type.INTEGER, description: 'Integer percentage of hyperbolic language from 0 to 100.' },
                vocabularyPrecision: { type: Type.INTEGER, description: 'Integer percentage of corporate vocabulary precision from 0 to 100.' },
              },
              required: ['formalDeviation', 'authoritativeDeviation', 'hyperboleFactor', 'vocabularyPrecision'],
            },
            summary: { type: Type.STRING },
            violations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  ruleName: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['critical', 'warning', 'nominal'] },
                  snippet: { type: Type.STRING },
                  issue: { type: Type.STRING },
                  remediation: { type: Type.STRING },
                  replacement: { type: Type.STRING },
                },
                required: ['id', 'ruleName', 'severity', 'snippet', 'issue', 'remediation', 'replacement'],
              },
            },
            remediatedText: { type: Type.STRING },
            channelSpecificTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['overallScore', 'status', 'wordCount', 'tokenDrift', 'summary', 'violations', 'remediatedText', 'channelSpecificTips'],
        },
      }
    );

    const parsed = parseJsonSafely<Record<string, unknown>>(textOutput);
    return res.json({
      ...parsed,
      channel: parsed.channel || channel,
      brandProfileId: resolvedBrandProfileId,
      brandName: effectiveBrandContext?.brandName || 'BrandGuard AI™',
      engine: 'gemini',
      model: modelUsed,
      ...(attemptErrors.length > 0 ? { fallbackWarnings: attemptErrors } : {}),
    });
  } catch (error: unknown) {
    const safeMessage = sanitizeErrorMessage(error);
    console.error('Error during AI brand audit:', safeMessage);
    const fallback = evaluateWithHeuristics(
      req.body?.content || '',
      req.body?.channel || 'marketing',
      req.body?.brandContext
    );
    return res.json({
      ...fallback,
      engine: 'heuristic-fallback',
      notice: `Audit generated via BrandGuard Local Rule Engine (Gemini error: ${safeMessage}).`,
      apiError: safeMessage,
    });
  }
});

// POST /api/generate-fix - Generate alternate variations
app.post('/api/generate-fix', async (req, res) => {
  try {
    const { content, tone = 'executive', brandContext } = req.body as {
      content?: string;
      tone?: string;
      brandContext?: BrandContextPayload;
    };
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    if (!hasValidGeminiKey()) {
      return res.json({
        engine: 'heuristic-fallback',
        variations: [
          {
            title: 'Executive & Rigorous',
            text: content.replace(/revolutionary|cheap|magic/gi, 'rigorously tested'),
            toneDelta: 'Balanced and authoritative',
          },
          {
            title: 'Customer-Centric & Modern',
            text: content.replace(/Brandguard/gi, brandContext?.brandName || 'BrandGuard AI™'),
            toneDelta: 'Accessible without hyperbole',
          },
        ],
      });
    }

    const ai = getGeminiClient();
    const brandRulesBlock = formatBrandContextForPrompt(brandContext);

    const prompt = `Rewrite this draft into 3 high-impact, 100% brand-compliant variations adhering strictly to these brand guidelines.

${brandRulesBlock}

Draft:
"""
${content}
"""

Target Tone: ${tone}`;

    const { text: textOutput, modelUsed, attemptErrors } = await generateContentWithResilience(
      ai,
      prompt,
      {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  text: { type: Type.STRING },
                  toneDelta: { type: Type.STRING },
                },
                required: ['title', 'text', 'toneDelta'],
              },
            },
          },
          required: ['variations'],
        },
      }
    );

    const parsed = parseJsonSafely<Record<string, unknown>>(textOutput);
    return res.json({
      ...parsed,
      engine: 'gemini',
      model: modelUsed,
      ...(attemptErrors.length > 0 ? { fallbackWarnings: attemptErrors } : {}),
    });
  } catch (err: unknown) {
    const safeMessage = sanitizeErrorMessage(err);
    console.error('Error in generate-fix:', safeMessage);
    return res.status(502).json({
      error: 'Could not generate brand copy variations.',
      details: safeMessage,
    });
  }
});

// ============================================================================
// VideoGuard AI Endpoints (MP4 Upload, FFmpeg Extraction & Multimodal Gemini)
// ============================================================================

app.get('/api/video-audit/capabilities', async (_req, res) => {
  const ffmpegAvailable = await checkFfmpegAvailable();
  return res.json({
    ffmpegAvailable,
    geminiConfigured: hasValidGeminiKey(),
    maxFileSizeBytes: MAX_VIDEO_UPLOAD_BYTES,
    supportedFormats: ['video/mp4'],
    storageBucket: 'videoguard-videos',
  });
});

app.post('/api/video-audit', uploadVideoMiddleware.single('video'), async (req, res) => {
  const uploadedFile = req.file;
  try {
    if (!uploadedFile) {
      return res.status(400).json({ error: 'An MP4 video file is required under field "video".' });
    }

    if (!hasValidGeminiKey()) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Multimodal video analysis cannot run.',
      });
    }

    let clientBrandContext: BrandContextForVideo | undefined;
    if (typeof req.body?.brandContext === 'string' && req.body.brandContext.trim()) {
      try {
        clientBrandContext = JSON.parse(req.body.brandContext) as BrandContextForVideo;
      } catch {
        return res.status(400).json({ error: 'Invalid JSON in brandContext field.' });
      }
    }

    let resolvedBrandProfileId: string | null = null;
    let effectiveBrandContext: BrandContextForVideo | undefined = clientBrandContext;

    const requestedBrandId =
      typeof req.body?.brandProfileId === 'string' ? req.body.brandProfileId.trim() : '';

    if (requestedBrandId && isValidUuid(requestedBrandId)) {
      const auth = await authenticateSupabaseRequest(req);
      if (auth) {
        const { data: bp, error: bpError } = await auth.supabase
          .from('brand_profiles')
          .select('*')
          .eq('id', requestedBrandId)
          .eq('user_id', auth.user.id)
          .maybeSingle();

        if (!bpError && bp) {
          resolvedBrandProfileId = bp.id;
          effectiveBrandContext = {
            brandName: bp.brand_name,
            industry: bp.industry,
            brandVoice: bp.brand_voice,
            approvedWords: Array.isArray(bp.approved_words) ? bp.approved_words : [],
            restrictedWords: Array.isArray(bp.restricted_words) ? bp.restricted_words : [],
            toneRules: bp.tone_rules || undefined,
          };
        }
      }
    }

    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim().slice(0, 200)
        : (uploadedFile.originalname || 'Video Compliance Audit').slice(0, 200);

    const sidecarCaptions =
      typeof req.body?.sidecarCaptions === 'string'
        ? req.body.sidecarCaptions.trim().slice(0, 12000)
        : '';

    const storageBucket =
      typeof req.body?.storageBucket === 'string' && req.body.storageBucket.trim()
        ? req.body.storageBucket.trim().slice(0, 100)
        : null;
    const storagePath =
      typeof req.body?.storagePath === 'string' && req.body.storagePath.trim()
        ? req.body.storagePath.trim().slice(0, 500)
        : null;

    const ai = getGeminiClient();
    const report = await analyzeVideoPipeline({
      ai,
      videoFilePath: uploadedFile.path,
      fileName: uploadedFile.originalname || 'uploaded-video.mp4',
      fileSizeBytes: uploadedFile.size,
      title,
      sidecarCaptions,
      brandProfileId: resolvedBrandProfileId,
      brandContext: effectiveBrandContext,
      storageBucket,
      storagePath,
    });

    return res.json(report);
  } catch (err: unknown) {
    const safeMessage = sanitizeErrorMessage(err);
    console.error('Error during VideoGuard AI audit:', safeMessage);
    return res.status(500).json({
      error: safeMessage || 'Video compliance analysis failed.',
    });
  } finally {
    if (uploadedFile?.path) {
      await fs.unlink(uploadedFile.path).catch(() => undefined);
    }
  }
});

// Persistent Video Audits CRUD (Authenticated + RLS)
app.get('/api/video-audits', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { data, error } = await auth.supabase
      .from('video_audits')
      .select('*, brand_profiles(brand_name)')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }

    return res.json({ videoAudits: data || [] });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.post('/api/video-audits', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const report = req.body?.report;
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'report payload is required.' });
    }

    const metadata = (report.metadata || {}) as Record<string, unknown>;
    const fileName =
      typeof metadata.fileName === 'string' && metadata.fileName.trim()
        ? metadata.fileName.trim().slice(0, 255)
        : 'video.mp4';
    const fileSizeBytes = Math.max(0, Math.round(Number(metadata.fileSizeBytes) || 0));
    const durationSeconds = Math.max(0, Number(metadata.durationSeconds) || 0);

    let brandProfileId: string | null = null;
    if (report.brandProfileId && isValidUuid(report.brandProfileId)) {
      const { data: bp, error: bpError } = await auth.supabase
        .from('brand_profiles')
        .select('id')
        .eq('id', report.brandProfileId)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (bpError) {
        return handleSupabaseError(res, bpError, '001_initial_schema.sql');
      }
      if (!bp) {
        return res.status(403).json({ error: 'Selected brand profile does not belong to your account.' });
      }
      brandProfileId = bp.id;
    }

    const normalizeNullableScore = (val: unknown): number | null => {
      if (val === null || val === undefined) return null;
      const n = Number(val);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(100, Math.round(n)));
    };

    const status = ['processing', 'completed', 'partial', 'failed'].includes(report.status)
      ? report.status
      : 'completed';

    const compactReportPayload = {
      title: report.title,
      brandName: report.brandName,
      metadata: report.metadata,
      visual: report.visual,
      text: report.text,
      audio: report.audio,
      overallScore: report.overallScore ?? null,
      severityCounts: report.severityCounts,
      totalViolations: report.totalViolations ?? 0,
      combinedViolations: Array.isArray(report.combinedViolations) ? report.combinedViolations : [],
      summary: report.summary || '',
      status,
      createdAt: report.createdAt || new Date().toISOString(),
    };

    const insertPayload = {
      user_id: auth.user.id,
      brand_profile_id: brandProfileId,
      title:
        typeof report.title === 'string' && report.title.trim()
          ? report.title.trim().slice(0, 200)
          : 'Video Compliance Audit',
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      duration_seconds: Number(durationSeconds.toFixed(2)),
      storage_bucket:
        typeof report.storageBucket === 'string' && report.storageBucket.trim()
          ? report.storageBucket.trim().slice(0, 100)
          : null,
      storage_path:
        typeof report.storagePath === 'string' && report.storagePath.trim()
          ? report.storagePath.trim().slice(0, 500)
          : null,
      overall_score: normalizeNullableScore(report.overallScore),
      visual_score: normalizeNullableScore(report.visual?.score),
      text_score: normalizeNullableScore(report.text?.score),
      audio_score: normalizeNullableScore(report.audio?.score),
      status,
      module_statuses: {
        visual: report.visual?.status || 'unavailable',
        text: report.text?.status || 'unavailable',
        audio: report.audio?.status || 'unavailable',
      },
      violations: Array.isArray(report.combinedViolations) ? report.combinedViolations : [],
      extracted_transcript:
        typeof report.audio?.fullTranscript === 'string' ? report.audio.fullTranscript : null,
      extracted_subtitles:
        typeof report.text?.extractedSubtitles === 'string' ? report.text.extractedSubtitles : null,
      ocr_text: Array.isArray(report.text?.ocrSamples) ? report.text.ocrSamples : [],
      corrected_narration:
        typeof report.audio?.correctedNarration === 'string'
          ? report.audio.correctedNarration
          : null,
      summary: typeof report.summary === 'string' ? report.summary : '',
      report_payload: compactReportPayload,
    };

    const { data, error } = await auth.supabase
      .from('video_audits')
      .insert(insertPayload)
      .select('*, brand_profiles(brand_name)')
      .single();

    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }

    return res.status(201).json({ videoAudit: data });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.get('/api/video-audits/:id', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid video audit ID.' });
    }

    const { data, error } = await auth.supabase
      .from('video_audits')
      .select('*, brand_profiles(brand_name)')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }
    if (!data) {
      return res.status(404).json({ error: 'Video audit record not found or access denied.' });
    }

    return res.json({ videoAudit: data });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.delete('/api/video-audits/:id', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid video audit ID.' });
    }

    const { data, error } = await auth.supabase
      .from('video_audits')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }
    if (!data) {
      return res.status(404).json({ error: 'Video audit record not found or access denied.' });
    }

    return res.json({ deleted: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.post('/api/video-audits/:id/submit-review', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid video audit ID.' });
    }

    const { data: videoAudit, error: fetchError } = await auth.supabase
      .from('video_audits')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchError) {
      return handleSupabaseError(res, fetchError, '002_videoguard_and_workflow.sql');
    }
    if (!videoAudit) {
      return res.status(404).json({ error: 'Video audit record not found or access denied.' });
    }

    const submitterName =
      (typeof auth.user.user_metadata?.full_name === 'string' &&
        auth.user.user_metadata.full_name.trim()) ||
      auth.user.email?.split('@')[0] ||
      'BrandGuard User';
    const submitterEmail = auth.user.email || '';

    const originalParts = [
      videoAudit.summary,
      videoAudit.extracted_transcript ? `Transcript:\n${videoAudit.extracted_transcript}` : '',
      videoAudit.extracted_subtitles ? `Subtitles:\n${videoAudit.extracted_subtitles}` : '',
    ].filter(Boolean);

    const correctedParts = [
      videoAudit.corrected_narration ? `Corrected Narration:\n${videoAudit.corrected_narration}` : '',
      typeof videoAudit.report_payload?.text?.correctedText === 'string' &&
      videoAudit.report_payload.text.correctedText
        ? `Corrected On-Screen/Subtitle Copy:\n${videoAudit.report_payload.text.correctedText}`
        : '',
    ].filter(Boolean);

    const customTitle =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim().slice(0, 200)
        : videoAudit.title;
    const notes =
      typeof req.body?.comments === 'string' && req.body.comments.trim()
        ? req.body.comments.trim().slice(0, 2000)
        : 'Submitted from VideoGuard AI analysis pipeline for compliance review.';

    const { data: submission, error: subError } = await auth.supabase
      .from('content_submissions')
      .insert({
        user_id: auth.user.id,
        brand_profile_id: videoAudit.brand_profile_id,
        video_audit_id: videoAudit.id,
        title: customTitle,
        content_type: 'video_audit',
        channel: 'video',
        original_content: originalParts.join('\n\n') || `Video file: ${videoAudit.file_name}`,
        corrected_content: correctedParts.join('\n\n') || null,
        audit_score: videoAudit.overall_score,
        violations: Array.isArray(videoAudit.violations) ? videoAudit.violations : [],
        video_reference: {
          fileName: videoAudit.file_name,
          fileSizeBytes: videoAudit.file_size_bytes,
          durationSeconds: Number(videoAudit.duration_seconds) || 0,
          storageBucket: videoAudit.storage_bucket,
          storagePath: videoAudit.storage_path,
          videoAuditId: videoAudit.id,
        },
        submitter_name: submitterName.slice(0, 120),
        submitter_email: submitterEmail.slice(0, 255),
        status: 'submitted',
      })
      .select('*, brand_profiles(brand_name)')
      .single();

    if (subError) {
      return handleSupabaseError(res, subError, '002_videoguard_and_workflow.sql');
    }

    const { data: reviewLog } = await auth.supabase
      .from('submission_reviews')
      .insert({
        submission_id: submission.id,
        user_id: auth.user.id,
        reviewer_name: submitterName.slice(0, 120),
        reviewer_email: submitterEmail.slice(0, 255),
        decision: 'submitted',
        comments: notes,
        previous_status: 'draft',
        review_mode: 'owner_mvp',
      })
      .select('*')
      .single();

    return res.status(201).json({
      submission: {
        ...submission,
        reviews: reviewLog ? [reviewLog] : [],
      },
    });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ============================================================================
// Content Review & Approval Workflow Endpoints (Authenticated + RLS)
// ============================================================================

const ALLOWED_SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'pending',
  'approved',
  'rejected',
  'revision_required',
] as const;

const ALLOWED_CONTENT_TYPES = ['text_audit', 'video_audit', 'compliance_report'] as const;

const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['pending', 'approved', 'rejected', 'revision_required'],
  pending: ['approved', 'rejected', 'revision_required'],
  revision_required: ['submitted', 'pending', 'approved', 'rejected'],
  approved: [],
  rejected: [],
};

app.get('/api/submissions', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const contentTypeParam =
      typeof req.query.content_type === 'string' ? req.query.content_type.trim() : '';
    const searchParam =
      typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    let query = auth.supabase
      .from('content_submissions')
      .select('*, brand_profiles(brand_name), submission_reviews(*)')
      .eq('user_id', auth.user.id)
      .order('submitted_at', { ascending: false })
      .limit(200);

    if (statusParam === 'pending_queue') {
      query = query.in('status', ['submitted', 'pending']);
    } else if (
      statusParam &&
      (ALLOWED_SUBMISSION_STATUSES as readonly string[]).includes(statusParam)
    ) {
      query = query.eq('status', statusParam);
    }

    if (
      contentTypeParam &&
      (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentTypeParam)
    ) {
      query = query.eq('content_type', contentTypeParam);
    }

    const { data, error } = await query;
    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }

    const normalized = (data || [])
      .map((row: Record<string, unknown>) => {
        const rawReviews = Array.isArray(row.submission_reviews)
          ? (row.submission_reviews as Array<Record<string, unknown>>)
          : [];
        const sortedReviews = [...rawReviews].sort((a, b) =>
          String(b.created_at || '').localeCompare(String(a.created_at || ''))
        );
        const { submission_reviews: _ignored, ...rest } = row;
        return {
          ...rest,
          reviews: sortedReviews,
        };
      })
      .filter((item: Record<string, unknown>) => {
        if (!searchParam) return true;
        const hay = `${item.title || ''} ${item.original_content || ''} ${item.channel || ''} ${item.submitter_name || ''}`.toLowerCase();
        return hay.includes(searchParam);
      });

    return res.json({ submissions: normalized });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.get('/api/submissions/:id', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid submission ID.' });
    }

    const { data, error } = await auth.supabase
      .from('content_submissions')
      .select('*, brand_profiles(brand_name), submission_reviews(*)')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }
    if (!data) {
      return res.status(404).json({ error: 'Submission not found or access denied.' });
    }

    const rawReviews = Array.isArray(data.submission_reviews) ? data.submission_reviews : [];
    const sortedReviews = [...rawReviews].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
    const { submission_reviews: _ignored, ...rest } = data as Record<string, unknown>;

    return res.json({
      submission: {
        ...rest,
        reviews: sortedReviews,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'title is required (1-200 characters).' });
    }

    const contentType = req.body?.content_type;
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      return res.status(400).json({
        error: 'content_type must be text_audit, video_audit, or compliance_report.',
      });
    }

    const initialStatus = req.body?.status === 'draft' ? 'draft' : 'submitted';

    let brandProfileId: string | null = null;
    if (req.body?.brand_profile_id && isValidUuid(req.body.brand_profile_id)) {
      const { data: bp, error: bpError } = await auth.supabase
        .from('brand_profiles')
        .select('id')
        .eq('id', req.body.brand_profile_id)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (bpError) {
        return handleSupabaseError(res, bpError, '001_initial_schema.sql');
      }
      if (!bp) {
        return res.status(403).json({ error: 'Selected brand profile does not belong to your account.' });
      }
      brandProfileId = bp.id;
    }

    let auditId: string | null = null;
    if (req.body?.audit_id && isValidUuid(req.body.audit_id)) {
      const { data: auditRow } = await auth.supabase
        .from('audits')
        .select('id')
        .eq('id', req.body.audit_id)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (auditRow) auditId = auditRow.id;
    }

    let videoAuditId: string | null = null;
    if (req.body?.video_audit_id && isValidUuid(req.body.video_audit_id)) {
      const { data: videoRow } = await auth.supabase
        .from('video_audits')
        .select('id')
        .eq('id', req.body.video_audit_id)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (videoRow) videoAuditId = videoRow.id;
    }

    const originalContent =
      typeof req.body?.original_content === 'string' ? req.body.original_content.trim() : '';
    if (!originalContent && contentType !== 'video_audit') {
      return res.status(400).json({ error: 'original_content is required.' });
    }

    const correctedContent =
      typeof req.body?.corrected_content === 'string' && req.body.corrected_content.trim()
        ? req.body.corrected_content
        : null;

    let auditScore: number | null = null;
    if (req.body?.audit_score !== null && req.body?.audit_score !== undefined) {
      const n = Number(req.body.audit_score);
      if (Number.isFinite(n)) {
        auditScore = Math.max(0, Math.min(100, Math.round(n)));
      }
    }

    const channel =
      typeof req.body?.channel === 'string' && req.body.channel.trim()
        ? req.body.channel.trim().slice(0, 50)
        : null;

    const violations = Array.isArray(req.body?.violations) ? req.body.violations : [];
    const videoReference =
      req.body?.video_reference && typeof req.body.video_reference === 'object'
        ? req.body.video_reference
        : null;

    const submitterName =
      (typeof auth.user.user_metadata?.full_name === 'string' &&
        auth.user.user_metadata.full_name.trim()) ||
      auth.user.email?.split('@')[0] ||
      'BrandGuard User';
    const submitterEmail = auth.user.email || '';

    const { data: submission, error } = await auth.supabase
      .from('content_submissions')
      .insert({
        user_id: auth.user.id,
        brand_profile_id: brandProfileId,
        audit_id: auditId,
        video_audit_id: videoAuditId,
        title,
        content_type: contentType,
        channel,
        original_content: originalContent || `Video asset submission: ${title}`,
        corrected_content: correctedContent,
        audit_score: auditScore,
        violations,
        video_reference: videoReference,
        submitter_name: submitterName.slice(0, 120),
        submitter_email: submitterEmail.slice(0, 255),
        status: initialStatus,
      })
      .select('*, brand_profiles(brand_name)')
      .single();

    if (error) {
      return handleSupabaseError(res, error, '002_videoguard_and_workflow.sql');
    }

    let initialReview = null;
    if (initialStatus === 'submitted') {
      const comments =
        typeof req.body?.comments === 'string' && req.body.comments.trim()
          ? req.body.comments.trim().slice(0, 2000)
          : 'Submitted content for brand compliance review.';

      const { data: reviewRow } = await auth.supabase
        .from('submission_reviews')
        .insert({
          submission_id: submission.id,
          user_id: auth.user.id,
          reviewer_name: submitterName.slice(0, 120),
          reviewer_email: submitterEmail.slice(0, 255),
          decision: 'submitted',
          comments,
          previous_status: 'draft',
          review_mode: 'owner_mvp',
        })
        .select('*')
        .single();
      initialReview = reviewRow;
    }

    return res.status(201).json({
      submission: {
        ...submission,
        reviews: initialReview ? [initialReview] : [],
      },
    });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

app.post('/api/submissions/:id/review', async (req, res) => {
  try {
    const auth = await authenticateSupabaseRequest(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const id = req.params.id;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid submission ID.' });
    }

    const decision = typeof req.body?.decision === 'string' ? req.body.decision.trim() : '';
    if (!['submitted', 'pending', 'approved', 'rejected', 'revision_required'].includes(decision)) {
      return res.status(400).json({
        error: 'decision must be submitted, pending, approved, rejected, or revision_required.',
      });
    }

    const comments = typeof req.body?.comments === 'string' ? req.body.comments.trim().slice(0, 2000) : '';
    if ((decision === 'rejected' || decision === 'revision_required') && !comments) {
      return res.status(400).json({
        error: 'Reviewer comments are required when rejecting or requesting revisions.',
      });
    }

    const { data: existing, error: fetchError } = await auth.supabase
      .from('content_submissions')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchError) {
      return handleSupabaseError(res, fetchError, '002_videoguard_and_workflow.sql');
    }
    if (!existing) {
      return res.status(404).json({ error: 'Submission not found or access denied.' });
    }

    const allowedNext = WORKFLOW_TRANSITIONS[existing.status] || [];
    if (!allowedNext.includes(decision)) {
      return res.status(400).json({
        error: `Cannot transition submission from "${existing.status}" to "${decision}".`,
      });
    }

    const updates: Record<string, unknown> = { status: decision };
    if (decision === 'submitted') {
      updates.submitted_at = new Date().toISOString();
      if (typeof req.body?.original_content === 'string' && req.body.original_content.trim()) {
        updates.original_content = req.body.original_content.trim();
      }
      if (typeof req.body?.corrected_content === 'string') {
        updates.corrected_content = req.body.corrected_content;
      }
    }

    const { data: updatedSubmission, error: updateError } = await auth.supabase
      .from('content_submissions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select('*, brand_profiles(brand_name)')
      .single();

    if (updateError) {
      return handleSupabaseError(res, updateError, '002_videoguard_and_workflow.sql');
    }

    const reviewerName =
      (typeof auth.user.user_metadata?.full_name === 'string' &&
        auth.user.user_metadata.full_name.trim()) ||
      auth.user.email?.split('@')[0] ||
      'BrandGuard Reviewer';
    const reviewerEmail = auth.user.email || '';

    const defaultCommentMap: Record<string, string> = {
      pending: 'Review started.',
      approved: 'Approved for brand compliance release.',
      submitted: 'Resubmitted after revision.',
    };

    const { data: reviewRow, error: reviewError } = await auth.supabase
      .from('submission_reviews')
      .insert({
        submission_id: id,
        user_id: auth.user.id,
        reviewer_name: reviewerName.slice(0, 120),
        reviewer_email: reviewerEmail.slice(0, 255),
        decision,
        comments: comments || defaultCommentMap[decision] || `Status updated to ${decision}.`,
        previous_status: existing.status,
        review_mode: 'owner_mvp',
      })
      .select('*')
      .single();

    if (reviewError) {
      return handleSupabaseError(res, reviewError, '002_videoguard_and_workflow.sql');
    }

    const { data: allReviews } = await auth.supabase
      .from('submission_reviews')
      .select('*')
      .eq('submission_id', id)
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    return res.json({
      submission: {
        ...updatedSubmission,
        reviews: allReviews || [reviewRow],
      },
      review: reviewRow,
    });
  } catch (err) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const rawAppUrl = (process.env.APP_URL || '').trim();
  const appUrl =
    rawAppUrl && rawAppUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(rawAppUrl)
      ? rawAppUrl
      : null;

  res.json({
    status: 'online',
    system: 'BrandGuard AI Engine',
    geminiConfigured: hasValidGeminiKey(),
    models: GEMINI_MODEL_CANDIDATES,
    supabase: getServerSupabaseConfigStatus(),
    appUrl,
    timestamp: new Date().toISOString(),
  });
});

// Active Supabase connectivity probe (never exposes keys)
app.get('/api/supabase/health', async (req, res) => {
  const status = await verifyServerSupabaseConnection();
  return res.status(status.configured && !status.reachable ? 503 : 200).json({
    ...status,
    timestamp: new Date().toISOString(),
  });
});

// Clean JSON errors for Multer upload validation/size failures
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'Video file exceeds the 75 MB upload limit. Please compress or trim your MP4 file.',
        });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && err.message.includes('Unsupported video format')) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
);

// In production, serve built client assets
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // In development, hook Vite into express
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[BrandGuard AI] Server running on http://0.0.0.0:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
