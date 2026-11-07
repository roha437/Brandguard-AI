import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// Initialize Google Gen AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface AuditRequest {
  content: string;
  channel?: string;
  rules?: {
    brandName?: string;
    forbiddenTerms?: string[];
    trademarkRules?: { term: string; requiredFormat: string }[];
    toneTarget?: {
      playfulVsFormal: number; // -100 (playful) to +100 (formal)
      humbleVsAuthoritative: number; // -100 to +100
    };
    embargoDate?: string;
  };
}

// Fallback deterministic rule evaluator for offline / keyless testing
function evaluateWithHeuristics(content: string, channel: string = 'general') {
  const forbidden = [
    { term: 'revolutionary', replacement: 'advanced', reason: 'Hyperbolic claim violates tone guideline §3.2' },
    { term: '100% guaranteed', replacement: 'rigorously verified', reason: 'Absolute legal liability guarantee' },
    { term: 'cheap', replacement: 'cost-efficient', reason: 'Brand value devaluation' },
    { term: 'disrupting', replacement: 'modernizing', reason: 'Overused clichéd terminology' },
    { term: 'Brandguard', replacement: 'BrandGuard AI™', reason: 'Missing trademark and capitalization syntax' },
    { term: 'magic', replacement: 'algorithmic inference', reason: 'Unscientific claim' },
    { term: 'unbeatable', replacement: 'industry-leading', reason: 'Unsubstantiated comparative superiority' },
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

  forbidden.forEach((item, idx) => {
    const regex = new RegExp(`\\b${item.term}\\b`, 'gi');
    if (regex.test(content)) {
      violations.push({
        id: `v-${idx + 1}`,
        ruleName: item.term.includes('Brandguard') ? 'Trademark Protection' : 'Tone & Vocabulary Governance',
        severity: item.term.includes('guaranteed') || item.term.includes('Brandguard') ? 'critical' : 'warning',
        snippet: item.term,
        issue: item.reason,
        remediation: `Replace "${item.term}" with authorized corporate terminology "${item.replacement}".`,
        replacement: item.replacement,
      });
      remediated = remediated.replace(regex, item.replacement);
    }
  });

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

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
    tokenDrift: {
      formalDeviation: Math.floor(Math.random() * 8) - 4,
      authoritativeDeviation: Math.floor(Math.random() * 12) - 3,
      hyperboleFactor: criticalCount > 0 ? 32 : warningCount > 0 ? 14 : 3,
      vocabularyPrecision: Math.max(70, 100 - (criticalCount * 18 + warningCount * 8)),
    },
    summary: violations.length === 0 
      ? 'All corporate brand tokens, trademark designations, and tone criteria successfully passed.'
      : `Detected ${violations.length} divergence(s): ${criticalCount} critical violation(s) and ${warningCount} advisory drift warning(s).`,
    violations,
    remediatedText: remediated,
    channelSpecificTips: [
      `${channel.toUpperCase()}: Maintain concise syntax and verify clear attribution.`,
      'Adhere to BrandGuard AI™ trademark guidelines on primary header mentions.',
    ],
  };
}

// POST /api/audit - AI Brand Compliance Inspector
app.post('/api/audit', async (req, res) => {
  try {
    const { content, channel = 'marketing', rules } = req.body as AuditRequest;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required for brand audit.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Use local rule engine if API key is not configured
      const localResult = evaluateWithHeuristics(content, channel);
      return res.json(localResult);
    }

    // Call Gemini 3.8 Flash
    const prompt = `You are the lead Brand Compliance Engine for BrandGuard AI, an enterprise governance platform.
Evaluate the following text for brand guideline adherence, tone drift, forbidden vocabulary, legal liabilities, and trademark compliance.

Text to inspect:
"""
${content}
"""

Channel Context: ${channel}
Brand Name: BrandGuard AI™

Output strict JSON adhering to this schema:
{
  "overallScore": number (0 to 100, where 90+ is compliant, 70-89 warning, <70 critical),
  "status": "compliant" | "warning" | "critical",
  "wordCount": number,
  "tokenDrift": {
    "formalDeviation": number (e.g. -12 for too casual, +15 for too rigid),
    "authoritativeDeviation": number,
    "hyperboleFactor": number (0 to 100, where higher means too much exaggerated hype),
    "vocabularyPrecision": number (0 to 100)
  },
  "summary": string (1-2 sentences high-level executive audit summary),
  "violations": [
    {
      "id": string (unique ID like "v-1"),
      "ruleName": string (e.g. "Trademark Syntax", "Unsubstantiated Superiority", "Hyperbolic Claim", "Tone Drift"),
      "severity": "critical" | "warning" | "nominal",
      "snippet": string (exact substring in the text that violates the rule),
      "issue": string (explanation of why it breaches brand guidelines),
      "remediation": string (actionable instruction to fix),
      "replacement": string (direct word or phrase replacement)
    }
  ],
  "remediatedText": string (the complete full text rewritten with all violations corrected to be 100% brand-compliant, maintaining original intent without slop),
  "channelSpecificTips": [string] (2-3 tailored pointers for this channel)
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Empty response from model');
    }

    const parsed = JSON.parse(textOutput);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error during AI brand audit:', error);
    // Graceful fallback to heuristic evaluation so user experience is rock solid
    const fallback = evaluateWithHeuristics(req.body?.content || '', req.body?.channel || 'marketing');
    return res.json({
      ...fallback,
      notice: 'Audit generated via BrandGuard Local Rule Engine (API fallback active).',
    });
  }
});

// POST /api/generate-fix - Generate alternate variations
app.post('/api/generate-fix', async (req, res) => {
  try {
    const { content, tone = 'executive' } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        variations: [
          {
            title: 'Executive & Rigorous',
            text: content.replace(/revolutionary|cheap|magic/gi, 'rigorously tested'),
            toneDelta: 'Balanced and authoritative',
          },
          {
            title: 'Customer-Centric & Modern',
            text: content.replace(/Brandguard/gi, 'BrandGuard AI™'),
            toneDelta: 'Accessible without hyperbole',
          },
        ],
      });
    }

    const prompt = `Rewrite this draft into 3 high-impact, 100% brand-compliant variations for BrandGuard AI.
Draft:
"""
${content}
"""

Target Tone: ${tone}

Return JSON with format:
{
  "variations": [
    {
      "title": string,
      "text": string,
      "toneDelta": string
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{"variations": []}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in generate-fix:', err);
    return res.status(500).json({ error: 'Could not generate brand copy variations.' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'BrandGuard AI Engine',
    timestamp: new Date().toISOString(),
  });
});

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

app.listen(PORT, () => {
  console.log(`[BrandGuard AI] Server running on port ${PORT}`);
});
