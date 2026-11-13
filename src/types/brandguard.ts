export type ComplianceStatus = 'compliant' | 'warning' | 'critical';

export type SeverityLevel = 'critical' | 'warning' | 'nominal';

export type MarketingChannel = 'social' | 'press' | 'landing_page' | 'paid_ads' | 'email' | 'partner';

export interface TokenDriftMetrics {
  formalDeviation: number; // e.g. -12 to +15
  authoritativeDeviation: number; // e.g. +8
  hyperboleFactor: number; // 0 to 100
  vocabularyPrecision: number; // 0 to 100
}

export interface RuleViolation {
  id: string;
  ruleName: string;
  severity: SeverityLevel;
  snippet: string;
  issue: string;
  remediation: string;
  replacement: string;
  category?: 'trademark' | 'tone' | 'legal' | 'embargo' | 'syntax';
}

export interface AuditResult {
  id?: string;
  timestamp?: string;
  title?: string;
  brandProfileId?: string | null;
  brandName?: string;
  overallScore: number;
  status: ComplianceStatus;
  wordCount: number;
  channel: MarketingChannel | string;
  tokenDrift: TokenDriftMetrics;
  summary: string;
  violations: RuleViolation[];
  remediatedText: string;
  channelSpecificTips?: string[];
  engine?: 'gemini' | 'heuristic-fallback';
  model?: string;
  notice?: string;
}

export interface BrandRule {
  id: string;
  name: string;
  category: 'trademark' | 'tone' | 'legal' | 'embargo' | 'forbidden_terms';
  description: string;
  patternOrTerm: string;
  recommendedFix: string;
  severity: SeverityLevel;
  isActive: boolean;
  affectedChannels: string[];
}

export interface ChannelStatus {
  channel: MarketingChannel;
  name: string;
  healthScore: number;
  activeAudits: number;
  openViolations: number;
  status: ComplianceStatus;
  lastScanned: string;
}

export interface AuditHistoryRecord {
  id: string;
  title: string;
  channel: MarketingChannel | string;
  author: string;
  score: number;
  status: ComplianceStatus;
  violationCount: number;
  violations?: RuleViolation[];
  brandProfileId?: string | null;
  brandName?: string | null;
  timestamp: string;
  content: string;
  remediatedText: string;
  isPersisted?: boolean;
}

export interface UserProfile {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface ToneRules {
  formality: number; // 0-100
  authoritative: number; // 0-100
  technical: number; // 0-100
  customGuidelines?: string;
}

export interface BrandProfile {
  id: string;
  user_id: string;
  brand_name: string;
  industry: string;
  brand_voice: string;
  approved_words: string[];
  restricted_words: string[];
  tone_rules: ToneRules;
  created_at: string;
  updated_at: string;
}

export interface BrandProfileInput {
  brand_name: string;
  industry: string;
  brand_voice: string;
  approved_words: string[];
  restricted_words: string[];
  tone_rules: ToneRules;
}

// ============================================================================
// VideoGuard AI Types
// ============================================================================

export type VideoViolationSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ModuleExecutionStatus = 'completed' | 'unavailable' | 'failed';

export interface VideoMetadataSummary {
  fileName: string;
  fileSizeBytes: number;
  durationSeconds: number;
  width: number | null;
  height: number | null;
  hasVideoStream: boolean;
  hasAudioStream: boolean;
  embeddedSubtitlesFound: boolean;
  frameCount: number;
  ffmpegAvailable: boolean;
}

export interface VideoFrameSample {
  index: number;
  timestamp: string;
  timestampSeconds: number;
  thumbnailDataUrl: string;
}

export interface VisualFinding {
  id: string;
  timestamp: string;
  timestampSeconds: number;
  finding: string;
  severity: VideoViolationSeverity;
  explanation: string;
  suggestedCorrection: string;
}

export interface VisualAnalysisModule {
  status: ModuleExecutionStatus;
  score: number | null;
  summary: string;
  logoVisibility: string;
  colorConsistency: string;
  findings: VisualFinding[];
  error?: string;
}

export interface OcrFrameSample {
  timestamp: string;
  timestampSeconds: number;
  detectedText: string;
}

export interface TextVideoViolation {
  id: string;
  timestamp: string;
  timestampSeconds: number;
  source: 'ocr' | 'subtitle' | 'caption';
  violatingText: string;
  severity: VideoViolationSeverity;
  explanation: string;
  recommendedReplacement: string;
}

export interface TextAnalysisModule {
  status: ModuleExecutionStatus;
  score: number | null;
  summary: string;
  ocrSamples: OcrFrameSample[];
  extractedSubtitles: string;
  correctedText: string;
  violations: TextVideoViolation[];
  error?: string;
}

export interface AudioTranscriptSegment {
  timestamp: string;
  timestampSeconds: number;
  text: string;
}

export interface AudioViolation {
  id: string;
  timestamp: string;
  timestampSeconds: number;
  transcriptSegment: string;
  violation: string;
  severity: VideoViolationSeverity;
  explanation: string;
  suggestedCorrectedNarration: string;
}

export interface AudioAnalysisModule {
  status: ModuleExecutionStatus;
  score: number | null;
  summary: string;
  speechDetected: boolean;
  fullTranscript: string;
  transcriptSegments: AudioTranscriptSegment[];
  correctedNarration: string;
  violations: AudioViolation[];
  reason?: string;
  error?: string;
}

export interface CombinedVideoViolation {
  id: string;
  module: 'visual' | 'text' | 'audio';
  timestamp: string;
  timestampSeconds: number;
  title: string;
  violatingContent: string;
  severity: VideoViolationSeverity;
  explanation: string;
  suggestedCorrection: string;
}

export interface VideoAuditReport {
  id?: string;
  title: string;
  brandProfileId: string | null;
  brandName: string;
  storageBucket?: string | null;
  storagePath?: string | null;
  metadata: VideoMetadataSummary;
  frames: VideoFrameSample[];
  visual: VisualAnalysisModule;
  text: TextAnalysisModule;
  audio: AudioAnalysisModule;
  overallScore: number | null;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  totalViolations: number;
  combinedViolations: CombinedVideoViolation[];
  summary: string;
  status: 'completed' | 'partial' | 'failed';
  createdAt: string;
}

export interface SavedVideoAuditRecord {
  id: string;
  user_id: string;
  brand_profile_id: string | null;
  title: string;
  file_name: string;
  file_size_bytes: number;
  duration_seconds: number;
  storage_bucket: string | null;
  storage_path: string | null;
  overall_score: number | null;
  visual_score: number | null;
  text_score: number | null;
  audio_score: number | null;
  status: 'processing' | 'completed' | 'partial' | 'failed';
  module_statuses: Record<string, ModuleExecutionStatus>;
  violations: CombinedVideoViolation[];
  extracted_transcript: string | null;
  extracted_subtitles: string | null;
  ocr_text: OcrFrameSample[];
  corrected_narration: string | null;
  summary: string;
  report_payload: Partial<VideoAuditReport>;
  created_at: string;
  brand_profiles?: { brand_name?: string } | null;
}

// ============================================================================
// Content Review & Approval Workflow Types
// ============================================================================

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision_required';

export type SubmissionContentType =
  | 'text_audit'
  | 'video_audit'
  | 'compliance_report';

export interface VideoSubmissionReference {
  fileName: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  storageBucket?: string | null;
  storagePath?: string | null;
  videoAuditId?: string | null;
}

export interface ContentSubmissionRecord {
  id: string;
  user_id: string;
  brand_profile_id: string | null;
  audit_id: string | null;
  video_audit_id: string | null;
  title: string;
  content_type: SubmissionContentType;
  channel: string | null;
  original_content: string;
  corrected_content: string | null;
  audit_score: number | null;
  violations: Array<RuleViolation | CombinedVideoViolation>;
  video_reference: VideoSubmissionReference | null;
  submitter_name: string;
  submitter_email: string;
  status: SubmissionStatus;
  submitted_at: string;
  updated_at: string;
  brand_profiles?: { brand_name?: string } | null;
  reviews?: SubmissionReviewRecord[];
}

export interface SubmissionReviewRecord {
  id: string;
  submission_id: string;
  user_id: string;
  reviewer_name: string;
  reviewer_email: string;
  decision: Exclude<SubmissionStatus, 'draft'>;
  comments: string;
  previous_status: SubmissionStatus | null;
  review_mode: 'owner_mvp' | 'demo_review';
  created_at: string;
}

