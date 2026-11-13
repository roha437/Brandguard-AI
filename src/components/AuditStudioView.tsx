import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  FileText,
  Wand2,
  CheckCircle,
  Lightbulb,
  CloudCheck,
  CloudUpload,
  LogIn,
  Building2,
  AlertCircle,
  Send,
} from 'lucide-react';
import { RuleInspectorTerminal } from './RuleInspectorTerminal';
import { SAMPLE_DRAFTS } from '../data/mockData';
import { AuditResult, BrandRule, RuleViolation } from '../types/brandguard';
import { useSupabase } from '../contexts/SupabaseContext';
import type { AuthModalMode } from './AuthModal';

interface AuditStudioViewProps {
  initialContent?: string;
  initialChannel?: string;
  initialTitle?: string;
  initialAuditResult?: AuditResult | null;
  loadKey?: number;
  activeRules?: BrandRule[];
  toneSettings?: {
    formality: number;
    authoritative: number;
    technical: number;
  };
  onAuditCompleted?: (result: AuditResult) => void;
  onOpenViolationModal: (violation: RuleViolation) => void;
  onOpenAuthModal: (mode: AuthModalMode) => void;
  onNavigateToReviewWorkflow?: () => void;
  onToast?: (msg: string) => void;
}

export const AuditStudioView: React.FC<AuditStudioViewProps> = ({
  initialContent = SAMPLE_DRAFTS[0].content,
  initialChannel = 'press',
  initialTitle = 'Q4 Global Product Release Communications',
  initialAuditResult = null,
  loadKey = 0,
  activeRules = [],
  toneSettings,
  onAuditCompleted,
  onOpenViolationModal,
  onOpenAuthModal,
  onNavigateToReviewWorkflow,
  onToast,
}) => {
  const {
    user,
    accessToken,
    brandProfiles,
    activeBrandProfileId,
    activeBrandProfile,
    setActiveBrandProfileId,
    schemaError,
  } = useSupabase();

  const [content, setContent] = useState<string>(initialContent);
  const [channel, setChannel] = useState<string>(initialChannel);
  const [title, setTitle] = useState<string>(initialTitle);
  const [targetTone] = useState<string>('executive');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(initialAuditResult);
  const [variations, setVariations] = useState<
    Array<{ title: string; text: string; toneDelta: string }>
  >([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>(SAMPLE_DRAFTS[0].id);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [submittedForReview, setSubmittedForReview] = useState<boolean>(false);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  const buildBrandContextPayload = () => {
    const enabledCustomRules = activeRules
      .filter((r) => r.isActive)
      .map((r) => ({
        name: r.name,
        patternOrTerm: r.patternOrTerm,
        recommendedFix: r.recommendedFix,
        severity: r.severity,
      }));

    if (activeBrandProfile) {
      return {
        brandName: activeBrandProfile.brand_name,
        industry: activeBrandProfile.industry,
        brandVoice: activeBrandProfile.brand_voice,
        approvedWords: activeBrandProfile.approved_words || [],
        restrictedWords: activeBrandProfile.restricted_words || [],
        toneRules: activeBrandProfile.tone_rules || toneSettings,
        customRules: enabledCustomRules,
      };
    }

    return {
      brandName: 'BrandGuard AI™',
      industry: 'Enterprise Governance SaaS',
      brandVoice: 'Authoritative, precise, and enterprise-grade.',
      toneRules: toneSettings,
      customRules: enabledCustomRules,
    };
  };

  const persistAuditRecord = async (
    result: AuditResult,
    auditedText: string,
    auditedChannel: string,
    auditedTitle: string,
    brandId: string | null
  ) => {
    if (!user || !accessToken || schemaError) return;

    const fingerprint = JSON.stringify({
      u: user.id,
      b: brandId,
      c: auditedChannel,
      t: auditedText.trim(),
      s: Math.round(result.overallScore),
    });

    if (lastSavedFingerprintRef.current === fingerprint) {
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: auditedTitle.trim() || 'Brand Compliance Audit',
          brand_profile_id: brandId,
          original_content: auditedText,
          corrected_content: result.remediatedText || null,
          overall_score: Math.round(result.overallScore),
          status: result.status,
          violations: result.violations || [],
          channel: auditedChannel,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveState('error');
        setSaveError(payload.error || 'Could not save audit record.');
        return;
      }

      lastSavedFingerprintRef.current = fingerprint;
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to save audit.');
    }
  };

  const handleSubmitForReview = async () => {
    if (!auditResult || !content.trim()) return;
    if (!user || !accessToken) {
      onOpenAuthModal('signin');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: title.trim() || 'Brand Compliance Audit',
          content_type: 'text_audit',
          brand_profile_id: auditResult.brandProfileId ?? activeBrandProfileId ?? null,
          channel,
          original_content: content,
          corrected_content: auditResult.remediatedText || null,
          audit_score: Math.round(auditResult.overallScore),
          violations: auditResult.violations || [],
          comments: `Submitted from Audit Studio (${auditResult.violations.length} violation(s) flagged).`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast?.(json.error || 'Could not submit audit for review.');
        return;
      }

      setSubmittedForReview(true);
      onToast?.('Submitted to Content Review Workflow');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Trigger server-side AI audit
  const runAudit = async (
    overrideContent?: string,
    options?: {
      persist?: boolean;
      overrideChannel?: string;
      overrideTitle?: string;
    }
  ) => {
    const textToScan = overrideContent !== undefined ? overrideContent : content;
    const scanChannel = options?.overrideChannel ?? channel;
    const scanTitle = options?.overrideTitle ?? title;
    const shouldPersist = options?.persist ?? true;

    if (!textToScan.trim()) return;

    setIsLoading(true);
    setSaveError(null);
    if (shouldPersist && user) {
      setSaveState('idle');
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/audit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: textToScan,
          channel: scanChannel,
          brandProfileId: activeBrandProfileId,
          brandContext: buildBrandContextPayload(),
        }),
      });

      if (!response.ok) {
        throw new Error('Audit API request failed');
      }

      const data: AuditResult = await response.json();
      setAuditResult(data);
      setSubmittedForReview(false);
      onAuditCompleted?.(data);

      if (shouldPersist && user && accessToken) {
        await persistAuditRecord(
          data,
          textToScan,
          scanChannel,
          scanTitle,
          data.brandProfileId ?? activeBrandProfileId ?? null
        );
      }
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate alternative variations
  const generateVariations = async () => {
    if (!content.trim()) return;
    setIsGeneratingVariations(true);
    try {
      const res = await fetch('/api/generate-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          tone: targetTone,
          brandContext: buildBrandContextPayload(),
        }),
      });
      const data = await res.json();
      if (data.variations) {
        setVariations(data.variations);
      }
    } catch (e) {
      console.error('Failed to generate variations:', e);
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const handleSelectPreset = (preset: (typeof SAMPLE_DRAFTS)[0]) => {
    setActivePresetId(preset.id);
    setTitle(preset.title);
    setContent(preset.content);
    setChannel(preset.channel);
    runAudit(preset.content, {
      persist: true,
      overrideChannel: preset.channel,
      overrideTitle: preset.title,
    });
  };

  // Sync incoming navigation props (New Live Scan, History inspect, ViolationModal fix, Dashboard launch)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (initialAuditResult) {
        setAuditResult(initialAuditResult);
      } else if (initialContent) {
        runAudit(initialContent, { persist: false });
      }
      return;
    }

    setContent(initialContent);
    setChannel(initialChannel);
    if (initialTitle) setTitle(initialTitle);
    setVariations([]);
    setSaveError(null);

    if (initialAuditResult) {
      setAuditResult(initialAuditResult);
      setSaveState('saved');
    } else if (!initialContent.trim()) {
      setAuditResult(null);
      setSaveState('idle');
    } else {
      setSaveState('idle');
      runAudit(initialContent, {
        persist: true,
        overrideChannel: initialChannel,
        overrideTitle: initialTitle || title,
      });
    }
  }, [loadKey, initialContent, initialChannel, initialTitle]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Studio Top Control Strip */}
      <div className="glass-panel rounded-2xl p-4 lg:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-[280px] flex-1">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent font-display text-base lg:text-lg font-bold text-white focus:outline-none focus:border-b focus:border-violet-400 pb-0.5"
              placeholder="Campaign or Document Title"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
              <span>Channel: {channel.toUpperCase()}</span>
              <span>·</span>
              <span>Brand: {activeBrandProfile?.brand_name || 'BrandGuard AI™'}</span>
              {auditResult && (
                <>
                  <span>·</span>
                  <span
                    className={
                      auditResult.status === 'compliant'
                        ? 'text-emerald-400'
                        : auditResult.status === 'warning'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }
                  >
                    Score: {auditResult.overallScore}%
                  </span>
                </>
              )}
              {user ? (
                <>
                  <span>·</span>
                  {saveState === 'saving' && (
                    <span className="text-violet-300 inline-flex items-center gap-1">
                      <CloudUpload className="w-3 h-3 animate-pulse" /> Saving...
                    </span>
                  )}
                  {saveState === 'saved' && (
                    <span className="text-emerald-400 inline-flex items-center gap-1">
                      <CloudCheck className="w-3 h-3" /> Saved to History
                    </span>
                  )}
                  {saveState === 'idle' && auditResult && !schemaError && (
                    <button
                      type="button"
                      onClick={() =>
                        persistAuditRecord(
                          auditResult,
                          content,
                          channel,
                          title,
                          activeBrandProfileId
                        )
                      }
                      className="text-violet-300 hover:text-white underline inline-flex items-center gap-1"
                    >
                      Save Snapshot
                    </button>
                  )}
                  {saveState === 'error' && (
                    <span className="text-amber-400 inline-flex items-center gap-1" title={saveError || ''}>
                      <AlertCircle className="w-3 h-3" /> Not Saved
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('signin')}
                    className="text-violet-300 hover:text-white inline-flex items-center gap-1"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Sign in to save history</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Preset Selectors + Workflow Submission */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Load Preset:</span>
          {SAMPLE_DRAFTS.map((draft) => (
            <button
              key={draft.id}
              onClick={() => handleSelectPreset(draft)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all border ${
                activePresetId === draft.id
                  ? 'bg-violet-600 text-white border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.5)] font-medium'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {draft.title.split(' ')[0]}
            </button>
          ))}

          {auditResult && (
            submittedForReview ? (
              <button
                type="button"
                onClick={() => onNavigateToReviewWorkflow?.()}
                className="ml-1 px-3 py-1 text-xs font-semibold text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Open Review Queue</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleSubmitForReview}
                className="ml-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600/80 hover:bg-blue-500 border border-blue-400/40 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingReview ? 'Submitting...' : 'Submit for Review'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Split Workbench: Editor on Left, Rule Inspector Terminal on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Draft Editor & Context Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Input Marketing Buffer
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {user && brandProfiles.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-violet-400" />
                    <select
                      value={activeBrandProfileId || ''}
                      onChange={(e) => setActiveBrandProfileId(e.target.value || null)}
                      className="bg-[#0b1020] border border-violet-500/30 text-violet-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-violet-500 font-mono max-w-[160px]"
                      title="Active Brand Profile"
                    >
                      <option value="">Default BrandGuard AI™</option>
                      {brandProfiles.map((bp) => (
                        <option key={bp.id} value={bp.id}>
                          {bp.brand_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="bg-[#0b1020] border border-white/10 text-slate-300 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-violet-500 font-mono"
                >
                  <option value="press">Wire / Press Release</option>
                  <option value="landing_page">Landing Page</option>
                  <option value="social">Social Media (X / LinkedIn)</option>
                  <option value="paid_ads">Paid PPC Search</option>
                  <option value="email">Lifecycle Email</option>
                  <option value="partner">Partner Reseller</option>
                </select>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={11}
              className="w-full bg-[#080d1d]/90 text-slate-200 font-mono text-sm leading-relaxed p-4 rounded-xl border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all resize-y placeholder:text-slate-600"
              placeholder="Paste or type copy here to audit against brand guidelines..."
            />

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-3 font-mono">
                <span>{content.trim().split(/\s+/).filter(Boolean).length} Words</span>
                <span>·</span>
                <span>{content.length} Chars</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setContent('');
                    setAuditResult(null);
                    setSaveState('idle');
                  }}
                  className="px-2.5 py-1 text-slate-400 hover:text-white text-xs hover:bg-white/5 rounded-md transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => runAudit(undefined, { persist: true })}
                  disabled={isLoading || !content.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>{isLoading ? 'Scanning...' : 'Run Brand Audit'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Variations Generator Box */}
          <div className="glass-panel rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-violet-400" />
                <h4 className="font-display text-sm font-semibold text-white">
                  Autonomous Brand Tone Optimizer
                </h4>
              </div>
              <button
                onClick={generateVariations}
                disabled={isGeneratingVariations || !content.trim()}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <span>{isGeneratingVariations ? 'Synthesizing...' : 'Generate 3 Variations'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Generates compliant alternative copy variations tailored to{' '}
              {activeBrandProfile?.brand_name || 'BrandGuard AI™'}.
            </p>

            {variations.length > 0 && (
              <div className="space-y-2.5 pt-2">
                {variations.map((v, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 transition-all text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{v.title}</span>
                      <span className="text-[10px] text-violet-300 font-mono">{v.toneDelta}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed font-mono bg-[#080d1d] p-2 rounded border border-white/5">
                      {v.text}
                    </p>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setContent(v.text);
                          runAudit(v.text, { persist: true });
                        }}
                        className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Use This Draft</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Rule Inspector Terminal & Compliance Metrics */}
        <div className="lg:col-span-7 space-y-5">
          <RuleInspectorTerminal
            auditResult={auditResult}
            rawContent={content}
            onContentChange={(newText) => {
              setContent(newText);
              runAudit(newText, { persist: true });
            }}
            onRunAudit={() => runAudit(undefined, { persist: true })}
            isLoading={isLoading}
            onSelectViolation={onOpenViolationModal}
          />

          {/* Audit Summary & Channel Pointers */}
          {auditResult && (
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Executive Audit Summary
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {auditResult.violations.length} Deviation(s) Analyzed
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                {auditResult.summary}
              </p>

              {auditResult.channelSpecificTips && auditResult.channelSpecificTips.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                    Channel Verification Directives
                  </span>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {auditResult.channelSpecificTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-violet-400 font-mono">→</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
