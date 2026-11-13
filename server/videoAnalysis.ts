import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const execFileAsync = promisify(execFile);

export type VideoViolationSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ModuleExecutionStatus = 'completed' | 'unavailable' | 'failed';

export interface BrandContextForVideo {
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
}

export interface ExtractedFrame {
  index: number;
  timestamp: string;
  timestampSeconds: number;
  base64Jpeg: string;
  thumbnailDataUrl: string;
}

export interface VideoProbeInfo {
  durationSeconds: number;
  width: number | null;
  height: number | null;
  hasVideoStream: boolean;
  hasAudioStream: boolean;
  subtitleStreamsCount: number;
}

function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseTimestampToSeconds(ts: string, fallbackSeconds = 0): number {
  const match = (ts || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return fallbackSeconds;
  if (match[3] !== undefined) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeSeverity(sev: string | undefined): VideoViolationSeverity {
  const s = (sev || '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium' || s === 'warning') return 'medium';
  return 'low';
}

function sanitizeMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]');
}

function parseJsonSafely<T>(rawText: string): T {
  const trimmed = rawText.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(unfenced) as T;
}

function formatBrandPromptBlock(brandContext?: BrandContextForVideo): string {
  const lines = [
    `Brand Name: ${brandContext?.brandName || 'BrandGuard AI™'}`,
    `Industry: ${brandContext?.industry || 'Enterprise Technology'}`,
    `Brand Voice: ${brandContext?.brandVoice || 'Authoritative, precise, and enterprise-grade.'}`,
  ];
  if (brandContext?.approvedWords?.length) {
    lines.push(`Approved Preferred Vocabulary: ${brandContext.approvedWords.join(', ')}`);
  }
  if (brandContext?.restrictedWords?.length) {
    lines.push(
      `Strictly Restricted/Forbidden Words (flag every occurrence): ${brandContext.restrictedWords.join(', ')}`
    );
  }
  if (brandContext?.toneRules) {
    lines.push(
      `Tone Targets (0-100): Formality=${brandContext.toneRules.formality ?? 75}%, Authoritative=${brandContext.toneRules.authoritative ?? 60}%, Technical=${brandContext.toneRules.technical ?? 85}%`
    );
    if (brandContext.toneRules.customGuidelines) {
      lines.push(`Additional Guidelines: ${brandContext.toneRules.customGuidelines}`);
    }
  }
  return lines.join('\n');
}

export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 3000 });
    await execFileAsync('ffprobe', ['-version'], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function probeVideo(inputPath: string): Promise<VideoProbeInfo> {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
    { timeout: 15000 }
  );

  const parsed = JSON.parse(stdout || '{}') as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
  };

  const streams = parsed.streams || [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');
  const subtitleStreams = streams.filter((s) => s.codec_type === 'subtitle');

  const rawDuration =
    Number(parsed.format?.duration) || Number(videoStream?.duration) || 0;

  return {
    durationSeconds: Number.isFinite(rawDuration) ? Number(rawDuration.toFixed(2)) : 0,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    hasVideoStream: Boolean(videoStream),
    hasAudioStream: Boolean(audioStream),
    subtitleStreamsCount: subtitleStreams.length,
  };
}

async function extractRepresentativeFrames(
  inputPath: string,
  tempDir: string,
  durationSeconds: number,
  maxFrames = 6
): Promise<ExtractedFrame[]> {
  const effectiveDuration = Math.max(1, durationSeconds);
  const frameCount =
    effectiveDuration < 3 ? 2 : effectiveDuration < 10 ? 4 : maxFrames;

  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    // Sample evenly inside [5% .. 92%] of video duration so black intro/outro frames are avoided
    const ratio = frameCount === 1 ? 0.5 : 0.05 + (0.87 * i) / (frameCount - 1);
    const ts = Number((effectiveDuration * ratio).toFixed(2));
    timestamps.push(Math.min(Math.max(0, ts), Math.max(0, effectiveDuration - 0.1)));
  }

  const frames: ExtractedFrame[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const outPath = path.join(tempDir, `frame_${i}.jpg`);
    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-ss',
          String(ts),
          '-i',
          inputPath,
          '-frames:v',
          '1',
          '-vf',
          "scale='min(960,iw)':-2",
          '-q:v',
          '4',
          outPath,
        ],
        { timeout: 15000 }
      );

      const buf = await fs.readFile(outPath);
      const base64Jpeg = buf.toString('base64');
      frames.push({
        index: i,
        timestamp: formatTimestamp(ts),
        timestampSeconds: Math.round(ts),
        base64Jpeg,
        thumbnailDataUrl: `data:image/jpeg;base64,${base64Jpeg}`,
      });
    } catch {
      // Skip individual frame extraction errors cleanly
    }
  }

  return frames;
}

async function extractEmbeddedSubtitles(
  inputPath: string,
  tempDir: string,
  subtitleStreamsCount: number
): Promise<string> {
  if (subtitleStreamsCount <= 0) return '';
  const srtPath = path.join(tempDir, 'subtitles.srt');
  try {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', inputPath, '-map', '0:s:0', '-f', 'srt', srtPath],
      { timeout: 15000 }
    );
    const raw = await fs.readFile(srtPath, 'utf-8');
    return raw.trim().slice(0, 12000);
  } catch {
    return '';
  }
}

async function extractAudioMp3Base64(
  inputPath: string,
  tempDir: string,
  hasAudioStream: boolean
): Promise<string | null> {
  if (!hasAudioStream) return null;
  const audioPath = path.join(tempDir, 'audio.mp3');
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '48k',
        '-t',
        '180',
        audioPath,
      ],
      { timeout: 25000 }
    );
    const audioBuf = await fs.readFile(audioPath);
    if (audioBuf.length < 256) return null;
    return audioBuf.toString('base64');
  } catch {
    return null;
  }
}

async function generateMultimodalJson<T>(
  ai: GoogleGenAI,
  parts: Array<Record<string, unknown>>,
  schema: Record<string, unknown>,
  timeoutMs = 25000
): Promise<T> {
  const candidates = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
  const errors: string[] = [];

  for (const model of candidates) {
    try {
      const config: Record<string, unknown> = {
        responseMimeType: 'application/json',
        responseSchema: schema,
      };
      if (model === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: { parts },
          config,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms on ${model}`)), timeoutMs)
        ),
      ]);

      const text = response.text;
      if (!text || !text.trim()) {
        throw new Error(`Empty JSON response from ${model}`);
      }
      return parseJsonSafely<T>(text);
    } catch (err) {
      errors.push(`${model}: ${sanitizeMessage(err)}`);
    }
  }

  throw new Error(errors.join(' | '));
}

// ============================================================================
// Module A: Visual AI (Logos, Colours, Visual Identity)
// ============================================================================
async function runVisualAI(
  ai: GoogleGenAI,
  frames: ExtractedFrame[],
  brandContext?: BrandContextForVideo
) {
  if (frames.length === 0) {
    return {
      status: 'unavailable' as const,
      score: null,
      summary: 'No representative video frames could be extracted for visual analysis.',
      logoVisibility: 'Unavailable — no frames sampled.',
      colorConsistency: 'Unavailable — no frames sampled.',
      findings: [],
      error: 'No frames available for Visual AI.',
    };
  }

  const parts: Array<Record<string, unknown>> = [
    {
      text: `You are Visual AI in the BrandGuard AI Video Compliance Pipeline.
Inspect the sampled video frames below against these brand guidelines.
Note: Each frame is labeled with its actual timestamp in the video. Do NOT invent timestamps outside the provided frames unless clearly anchored to a frame timestamp. Do NOT claim pixel-perfect trademark matching against external vector files—evaluate visual brand compliance, logo presence/visibility/distortion, color palette consistency, visual identity professionalism, and inappropriate/prohibited visual elements.

Brand Context:
${formatBrandPromptBlock(brandContext)}

Sampled Frames:`,
    },
  ];

  for (const frame of frames) {
    parts.push({ text: `[Frame #${frame.index + 1} at timestamp ${frame.timestamp} (${frame.timestampSeconds}s)]` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame.base64Jpeg,
      },
    });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER, description: 'Visual compliance score from 0 to 100.' },
      summary: { type: Type.STRING },
      logoVisibility: { type: Type.STRING },
      colorConsistency: { type: Type.STRING },
      findings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING, description: 'MM:SS timestamp from the inspected frames.' },
            finding: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
            explanation: { type: Type.STRING },
            suggestedCorrection: { type: Type.STRING },
          },
          required: ['timestamp', 'finding', 'severity', 'explanation', 'suggestedCorrection'],
        },
      },
    },
    required: ['score', 'summary', 'logoVisibility', 'colorConsistency', 'findings'],
  };

  try {
    const raw = await generateMultimodalJson<{
      score: number;
      summary: string;
      logoVisibility: string;
      colorConsistency: string;
      findings: Array<{
        timestamp: string;
        finding: string;
        severity: string;
        explanation: string;
        suggestedCorrection: string;
      }>;
    }>(ai, parts, schema, 28000);

    return {
      status: 'completed' as const,
      score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
      summary: raw.summary,
      logoVisibility: raw.logoVisibility,
      colorConsistency: raw.colorConsistency,
      findings: (raw.findings || []).map((f, idx) => ({
        id: `vis-${idx + 1}`,
        timestamp: f.timestamp || frames[0].timestamp,
        timestampSeconds: parseTimestampToSeconds(f.timestamp, frames[0].timestampSeconds),
        finding: f.finding,
        severity: normalizeSeverity(f.severity),
        explanation: f.explanation,
        suggestedCorrection: f.suggestedCorrection,
      })),
    };
  } catch (err) {
    return {
      status: 'failed' as const,
      score: null,
      summary: 'Visual AI analysis failed during Gemini multimodal inference.',
      logoVisibility: 'Analysis failed',
      colorConsistency: 'Analysis failed',
      findings: [],
      error: sanitizeMessage(err),
    };
  }
}

// ============================================================================
// Module B: Text AI (Frame OCR + Embedded/Sidecar Subtitles)
// ============================================================================
async function runTextAI(
  ai: GoogleGenAI,
  frames: ExtractedFrame[],
  extractedSubtitles: string,
  sidecarCaptions: string,
  brandContext?: BrandContextForVideo
) {
  const combinedSubtitles = [extractedSubtitles, sidecarCaptions].filter(Boolean).join('\n\n').trim();

  if (frames.length === 0 && !combinedSubtitles) {
    return {
      status: 'unavailable' as const,
      score: null,
      summary: 'Neither video frames nor subtitle tracks were available for Text AI inspection.',
      ocrSamples: [],
      extractedSubtitles: '',
      correctedText: '',
      violations: [],
      error: 'No frames or subtitles available.',
    };
  }

  const parts: Array<Record<string, unknown>> = [
    {
      text: `You are Text AI in the BrandGuard AI Video Compliance Pipeline.
Perform two tasks:
1. Extract visible on-screen OCR text (titles, slogans, banners, captions, promotional overlays) from each sampled frame below.
2. Evaluate all OCR text AND any provided subtitles/captions against the Brand Context (restricted words, approved vocabulary, misleading claims, trademark formatting, grammar/clarity, and brand tone).

If no on-screen text is visible in a frame, record detectedText as "" for that frame. Do NOT invent text that is not visible or in the subtitles.

Brand Context:
${formatBrandPromptBlock(brandContext)}

Extracted / Attached Subtitles:
${combinedSubtitles ? combinedSubtitles : '(None detected in video container or uploaded captions)'}

Sampled Video Frames:`,
    },
  ];

  for (const frame of frames) {
    parts.push({ text: `[Frame #${frame.index + 1} at timestamp ${frame.timestamp}]` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame.base64Jpeg,
      },
    });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER, description: 'Text & subtitle compliance score 0 to 100.' },
      summary: { type: Type.STRING },
      ocrSamples: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING },
            detectedText: { type: Type.STRING },
          },
          required: ['timestamp', 'detectedText'],
        },
      },
      correctedText: { type: Type.STRING, description: 'Brand-compliant corrected copy for detected text/subtitles.' },
      violations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING },
            source: { type: Type.STRING, enum: ['ocr', 'subtitle', 'caption'] },
            violatingText: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
            explanation: { type: Type.STRING },
            recommendedReplacement: { type: Type.STRING },
          },
          required: ['timestamp', 'source', 'violatingText', 'severity', 'explanation', 'recommendedReplacement'],
        },
      },
    },
    required: ['score', 'summary', 'ocrSamples', 'correctedText', 'violations'],
  };

  try {
    const raw = await generateMultimodalJson<{
      score: number;
      summary: string;
      ocrSamples: Array<{ timestamp: string; detectedText: string }>;
      correctedText: string;
      violations: Array<{
        timestamp: string;
        source: 'ocr' | 'subtitle' | 'caption';
        violatingText: string;
        severity: string;
        explanation: string;
        recommendedReplacement: string;
      }>;
    }>(ai, parts, schema, 28000);

    return {
      status: 'completed' as const,
      score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
      summary: raw.summary,
      ocrSamples: (raw.ocrSamples || []).map((s) => ({
        timestamp: s.timestamp || '00:00',
        timestampSeconds: parseTimestampToSeconds(s.timestamp, 0),
        detectedText: s.detectedText || '',
      })),
      extractedSubtitles: combinedSubtitles,
      correctedText: raw.correctedText || '',
      violations: (raw.violations || []).map((v, idx) => ({
        id: `txt-${idx + 1}`,
        timestamp: v.timestamp || '00:00',
        timestampSeconds: parseTimestampToSeconds(v.timestamp, 0),
        source: v.source || 'ocr',
        violatingText: v.violatingText,
        severity: normalizeSeverity(v.severity),
        explanation: v.explanation,
        recommendedReplacement: v.recommendedReplacement,
      })),
    };
  } catch (err) {
    return {
      status: 'failed' as const,
      score: null,
      summary: 'Text AI analysis failed during Gemini OCR/subtitle inference.',
      ocrSamples: [],
      extractedSubtitles: combinedSubtitles,
      correctedText: '',
      violations: [],
      error: sanitizeMessage(err),
    };
  }
}

// ============================================================================
// Module C: Audio AI (gemini-3.5-transcribe + Brand Speech Compliance)
// ============================================================================
async function runAudioAI(
  ai: GoogleGenAI,
  audioBase64: string | null,
  hasAudioStream: boolean,
  brandContext?: BrandContextForVideo
) {
  if (!hasAudioStream) {
    return {
      status: 'unavailable' as const,
      score: null,
      summary: 'Audio AI unavailable: uploaded video does not contain an audio stream.',
      speechDetected: false,
      fullTranscript: '',
      transcriptSegments: [],
      correctedNarration: '',
      violations: [],
      reason: 'No audio track detected in the uploaded MP4 container.',
    };
  }

  if (!audioBase64) {
    return {
      status: 'unavailable' as const,
      score: null,
      summary: 'Audio AI unavailable: audio track could not be extracted for transcription.',
      speechDetected: false,
      fullTranscript: '',
      transcriptSegments: [],
      correctedNarration: '',
      violations: [],
      reason: 'FFmpeg audio extraction returned empty audio buffer.',
    };
  }

  // Step 1: Real speech transcription using gemini-3.5-transcribe (fallback to gemini-4-hydrogen)
  let transcriptText = '';
  try {
    const audioPart = {
      inlineData: {
        mimeType: 'audio/mp3',
        data: audioBase64,
      },
    };

    try {
      const transcribeResp = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              audioPart,
              {
                text: 'Transcribe all spoken narration and dialogue accurately with approximate [MM:SS] timestamps if multiple sentences occur. If there is no speech (only silence or instrumental music), reply with NO_SPEECH_DETECTED.',
              },
            ],
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Audio transcription timed out after 25000ms')), 25000)
        ),
      ]);
      transcriptText = (transcribeResp.text || '').trim();
    } catch {
      const fallbackResp = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              audioPart,
              {
                text: 'Transcribe all spoken narration and dialogue accurately with [MM:SS] timestamps. If there is no speech (silence or music only), reply strictly with NO_SPEECH_DETECTED.',
              },
            ],
          },
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fallback audio transcription timed out')), 25000)
        ),
      ]);
      transcriptText = (fallbackResp.text || '').trim();
    }
  } catch (err) {
    return {
      status: 'failed' as const,
      score: null,
      summary: 'Audio transcription could not complete.',
      speechDetected: false,
      fullTranscript: '',
      transcriptSegments: [],
      correctedNarration: '',
      violations: [],
      error: sanitizeMessage(err),
    };
  }

  if (!transcriptText || transcriptText.includes('NO_SPEECH_DETECTED')) {
    return {
      status: 'completed' as const,
      score: 100,
      summary: 'Audio track analyzed: no spoken narration or dialogue detected (instrumental or silent track).',
      speechDetected: false,
      fullTranscript: '',
      transcriptSegments: [],
      correctedNarration: '',
      violations: [],
    };
  }

  // Step 2: Evaluate spoken transcript + audio tone directly against brand guidelines
  const analysisParts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: 'audio/mp3',
        data: audioBase64,
      },
    },
    {
      text: `You are Audio AI in the BrandGuard AI Video Compliance Pipeline.
Listen to the audio AND review the verbatim transcript below against the Brand Context.
Evaluate: spoken tone of voice, restricted/prohibited words, misleading claims, unverified guarantees, and brand voice alignment.

Brand Context:
${formatBrandPromptBlock(brandContext)}

Verbatim Transcript:
"""
${transcriptText}
"""`,
    },
  ];

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER, description: 'Audio & spoken narration compliance score 0 to 100.' },
      summary: { type: Type.STRING },
      transcriptSegments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING },
            text: { type: Type.STRING },
          },
          required: ['timestamp', 'text'],
        },
      },
      correctedNarration: { type: Type.STRING },
      violations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING },
            transcriptSegment: { type: Type.STRING },
            violation: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
            explanation: { type: Type.STRING },
            suggestedCorrectedNarration: { type: Type.STRING },
          },
          required: [
            'timestamp',
            'transcriptSegment',
            'violation',
            'severity',
            'explanation',
            'suggestedCorrectedNarration',
          ],
        },
      },
    },
    required: ['score', 'summary', 'transcriptSegments', 'correctedNarration', 'violations'],
  };

  try {
    const raw = await generateMultimodalJson<{
      score: number;
      summary: string;
      transcriptSegments: Array<{ timestamp: string; text: string }>;
      correctedNarration: string;
      violations: Array<{
        timestamp: string;
        transcriptSegment: string;
        violation: string;
        severity: string;
        explanation: string;
        suggestedCorrectedNarration: string;
      }>;
    }>(ai, analysisParts, schema, 28000);

    return {
      status: 'completed' as const,
      score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
      summary: raw.summary,
      speechDetected: true,
      fullTranscript: transcriptText,
      transcriptSegments: (raw.transcriptSegments || []).map((s) => ({
        timestamp: s.timestamp || '00:00',
        timestampSeconds: parseTimestampToSeconds(s.timestamp, 0),
        text: s.text,
      })),
      correctedNarration: raw.correctedNarration || transcriptText,
      violations: (raw.violations || []).map((v, idx) => ({
        id: `aud-${idx + 1}`,
        timestamp: v.timestamp || '00:00',
        timestampSeconds: parseTimestampToSeconds(v.timestamp, 0),
        transcriptSegment: v.transcriptSegment,
        violation: v.violation,
        severity: normalizeSeverity(v.severity),
        explanation: v.explanation,
        suggestedCorrectedNarration: v.suggestedCorrectedNarration,
      })),
    };
  } catch (err) {
    return {
      status: 'failed' as const,
      score: null,
      summary: 'Audio speech was transcribed, but compliance evaluation failed.',
      speechDetected: true,
      fullTranscript: transcriptText,
      transcriptSegments: [{ timestamp: '00:00', timestampSeconds: 0, text: transcriptText }],
      correctedNarration: '',
      violations: [],
      error: sanitizeMessage(err),
    };
  }
}

// ============================================================================
// Orchestrator: Video Processing -> 3 Parallel Modules -> Combined Report
// ============================================================================
export async function analyzeVideoPipeline(params: {
  ai: GoogleGenAI | null;
  videoFilePath: string;
  fileName: string;
  fileSizeBytes: number;
  title: string;
  sidecarCaptions?: string;
  brandProfileId: string | null;
  brandContext?: BrandContextForVideo;
  storageBucket?: string | null;
  storagePath?: string | null;
}) {
  const tempDir = path.join(os.tmpdir(), `videoguard-${crypto.randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error(
        'FFmpeg/FFprobe is unavailable on the server, so video frame and audio extraction cannot run.'
      );
    }

    const probe = await probeVideo(params.videoFilePath);
    if (!probe.hasVideoStream && !probe.hasAudioStream) {
      throw new Error('Uploaded file does not contain valid video or audio streams.');
    }

    // Extract frames, audio, and embedded subtitles in parallel
    const [frames, extractedSubtitles, audioBase64] = await Promise.all([
      probe.hasVideoStream
        ? extractRepresentativeFrames(params.videoFilePath, tempDir, probe.durationSeconds, 6)
        : Promise.resolve([]),
      extractEmbeddedSubtitles(params.videoFilePath, tempDir, probe.subtitleStreamsCount),
      extractAudioMp3Base64(params.videoFilePath, tempDir, probe.hasAudioStream),
    ]);

    if (!params.ai) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    // Run Visual AI, Text AI, and Audio AI in parallel
    const [visual, text, audio] = await Promise.all([
      runVisualAI(params.ai, frames, params.brandContext),
      runTextAI(
        params.ai,
        frames,
        extractedSubtitles,
        params.sidecarCaptions || '',
        params.brandContext
      ),
      runAudioAI(params.ai, audioBase64, probe.hasAudioStream, params.brandContext),
    ]);

    // Combine violations & scores strictly from completed modules (never fabricate failed/unavailable scores)
    const combinedViolations = [
      ...visual.findings.map((f) => ({
        id: f.id,
        module: 'visual' as const,
        timestamp: f.timestamp,
        timestampSeconds: f.timestampSeconds,
        title: f.finding,
        violatingContent: f.finding,
        severity: f.severity,
        explanation: f.explanation,
        suggestedCorrection: f.suggestedCorrection,
      })),
      ...text.violations.map((v) => ({
        id: v.id,
        module: 'text' as const,
        timestamp: v.timestamp,
        timestampSeconds: v.timestampSeconds,
        title: `${v.source.toUpperCase()} Text Violation`,
        violatingContent: v.violatingText,
        severity: v.severity,
        explanation: v.explanation,
        suggestedCorrection: v.recommendedReplacement,
      })),
      ...audio.violations.map((a) => ({
        id: a.id,
        module: 'audio' as const,
        timestamp: a.timestamp,
        timestampSeconds: a.timestampSeconds,
        title: a.violation,
        violatingContent: a.transcriptSegment,
        severity: a.severity,
        explanation: a.explanation,
        suggestedCorrection: a.suggestedCorrectedNarration,
      })),
    ].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

    const severityCounts = {
      critical: combinedViolations.filter((v) => v.severity === 'critical').length,
      high: combinedViolations.filter((v) => v.severity === 'high').length,
      medium: combinedViolations.filter((v) => v.severity === 'medium').length,
      low: combinedViolations.filter((v) => v.severity === 'low').length,
    };

    const completedScores = [visual.score, text.score, audio.score].filter(
      (s): s is number => typeof s === 'number'
    );
    const overallScore =
      completedScores.length > 0
        ? Math.round(completedScores.reduce((acc, s) => acc + s, 0) / completedScores.length)
        : null;

    const allCompleted =
      visual.status === 'completed' &&
      text.status === 'completed' &&
      (audio.status === 'completed' || audio.status === 'unavailable');
    const anyCompleted = completedScores.length > 0;
    const status: 'completed' | 'partial' | 'failed' = !anyCompleted
      ? 'failed'
      : allCompleted && visual.status === 'completed' && text.status === 'completed' && audio.status === 'completed'
      ? 'completed'
      : 'partial';

    const brandName = params.brandContext?.brandName || 'BrandGuard AI™';
    const summaryParts = [
      `Processed ${params.fileName} (${probe.durationSeconds}s, ${frames.length} sampled frames).`,
      `Completed ${completedScores.length}/3 AI compliance modules against ${brandName}.`,
      combinedViolations.length === 0
        ? 'No brand violations detected in completed modules.'
        : `Identified ${combinedViolations.length} timestamped finding(s) (${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low).`,
    ];

    return {
      title: params.title,
      brandProfileId: params.brandProfileId,
      brandName,
      storageBucket: params.storageBucket ?? null,
      storagePath: params.storagePath ?? null,
      metadata: {
        fileName: params.fileName,
        fileSizeBytes: params.fileSizeBytes,
        durationSeconds: probe.durationSeconds,
        width: probe.width,
        height: probe.height,
        hasVideoStream: probe.hasVideoStream,
        hasAudioStream: probe.hasAudioStream,
        embeddedSubtitlesFound: Boolean(extractedSubtitles),
        frameCount: frames.length,
        ffmpegAvailable,
      },
      frames: frames.map((f) => ({
        index: f.index,
        timestamp: f.timestamp,
        timestampSeconds: f.timestampSeconds,
        thumbnailDataUrl: f.thumbnailDataUrl,
      })),
      visual,
      text,
      audio,
      overallScore,
      severityCounts,
      totalViolations: combinedViolations.length,
      combinedViolations,
      summary: summaryParts.join(' '),
      status,
      createdAt: new Date().toISOString(),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
