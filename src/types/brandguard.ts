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
  overallScore: number;
  status: ComplianceStatus;
  wordCount: number;
  channel: MarketingChannel | string;
  tokenDrift: TokenDriftMetrics;
  summary: string;
  violations: RuleViolation[];
  remediatedText: string;
  channelSpecificTips?: string[];
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
  channel: MarketingChannel;
  author: string;
  score: number;
  status: ComplianceStatus;
  violationCount: number;
  timestamp: string;
  content: string;
  remediatedText: string;
}
