import React, { useEffect, useState } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { AuditStudioView } from './components/AuditStudioView';
import { RuleEngineView } from './components/RuleEngineView';
import { ChannelGuardView } from './components/ChannelGuardView';
import { AuditHistoryView } from './components/AuditHistoryView';
import { VideoGuardView } from './components/VideoGuardView';
import { ReviewWorkflowView } from './components/ReviewWorkflowView';
import { ViolationModal } from './components/ViolationModal';
import { AuthModal, AuthModalMode } from './components/AuthModal';
import {
  RuleViolation,
  AuditHistoryRecord,
  MarketingChannel,
  AuditResult,
  BrandRule,
} from './types/brandguard';
import { INITIAL_BRAND_RULES, SAMPLE_DRAFTS } from './data/mockData';
import { useSupabase } from './contexts/SupabaseContext';
import { Shield, CheckCircle2 } from 'lucide-react';

export default function App() {
  const { isRecoveryMode, authNotice, clearAuthNotice } = useSupabase();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeViolationModal, setActiveViolationModal] = useState<RuleViolation | null>(null);
  const [studioDraftContent, setStudioDraftContent] = useState<string>(SAMPLE_DRAFTS[0].content);
  const [studioChannel, setStudioChannel] = useState<string>(SAMPLE_DRAFTS[0].channel);
  const [studioTitle, setStudioTitle] = useState<string>(SAMPLE_DRAFTS[0].title);
  const [studioInitialAudit, setStudioInitialAudit] = useState<AuditResult | null>(null);
  const [studioLoadKey, setStudioLoadKey] = useState<number>(0);

  const [rules, setRules] = useState<BrandRule[]>(INITIAL_BRAND_RULES);
  const [toneSettings, setToneSettings] = useState({
    formality: 75,
    authoritative: 60,
    technical: 85,
  });

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('signin');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isRecoveryMode) {
      setAuthModalMode('update_password');
      setAuthModalOpen(true);
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    if (authNotice) {
      showToast(authNotice);
      clearAuthNotice();
    }
  }, [authNotice, clearAuthNotice]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const openAuthModal = (mode: AuthModalMode) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleNavigateToStudio = (draftContent?: string, channel?: string) => {
    if (draftContent !== undefined) {
      setStudioDraftContent(draftContent);
    }
    if (channel !== undefined) {
      setStudioChannel(channel);
    }
    setStudioTitle('Custom Campaign Compliance Audit');
    setStudioInitialAudit(null);
    setStudioLoadKey((k) => k + 1);
    setCurrentTab('audit_studio');
  };

  const handleTestChannel = (ch: MarketingChannel) => {
    setStudioChannel(ch);
    const matchedSample = SAMPLE_DRAFTS.find((s) => s.channel === ch);
    if (matchedSample) {
      setStudioDraftContent(matchedSample.content);
      setStudioTitle(matchedSample.title);
    }
    setStudioInitialAudit(null);
    setStudioLoadKey((k) => k + 1);
    setCurrentTab('audit_studio');
    showToast(`Loaded ${ch.toUpperCase()} Channel Profile into Audit Studio`);
  };

  const handleInspectRecord = (rec: AuditHistoryRecord) => {
    setStudioDraftContent(rec.content);
    setStudioChannel(rec.channel);
    setStudioTitle(rec.title);
    if (rec.violations) {
      setStudioInitialAudit({
        id: rec.id,
        title: rec.title,
        timestamp: rec.timestamp,
        brandProfileId: rec.brandProfileId ?? null,
        brandName: rec.brandName ?? undefined,
        overallScore: rec.score,
        status: rec.status,
        wordCount: rec.content.trim().split(/\s+/).filter(Boolean).length,
        channel: rec.channel,
        tokenDrift: {
          formalDeviation: 0,
          authoritativeDeviation: 0,
          hyperboleFactor: rec.status === 'critical' ? 28 : rec.status === 'warning' ? 12 : 2,
          vocabularyPrecision: rec.score,
        },
        summary: `Loaded historical audit snapshot (${rec.violationCount} deviation(s) recorded).`,
        violations: rec.violations,
        remediatedText: rec.remediatedText,
      });
    } else {
      setStudioInitialAudit(null);
    }
    setStudioLoadKey((k) => k + 1);
    setCurrentTab('audit_studio');
    const shortId = rec.id.length > 12 ? `AUD-${rec.id.slice(0, 8).toUpperCase()}` : rec.id;
    showToast(`Loaded Audit Record ${shortId} into Inspector`);
  };

  const handleApplyFixFromModal = (violation: RuleViolation) => {
    if (!violation.snippet || !violation.replacement) return;
    const regex = new RegExp(violation.snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    setStudioDraftContent((prev) => prev.replace(regex, violation.replacement));
    setStudioInitialAudit(null);
    setStudioLoadKey((k) => k + 1);
    showToast(`Remediated: "${violation.replacement}"`);
  };

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#DEE1F9] flex flex-col font-sans selection:bg-[#7C3AED]/30 selection:text-white relative">
      {/* Background atmospheric ambient gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/[0.07] rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-blue-600/[0.05] rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-emerald-600/[0.04] rounded-full blur-[140px]" />
      </div>

      {/* Top Bar Navigation (Strict 3-zone contract) */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenAuthModal={openAuthModal}
        onNewScan={() => {
          setStudioDraftContent('');
          setStudioTitle('New Brand Compliance Scan');
          setStudioInitialAudit(null);
          setStudioLoadKey((k) => k + 1);
          setCurrentTab('audit_studio');
        }}
      />

      {/* Main Viewport Container */}
      <main className="relative z-10 flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateToStudio={handleNavigateToStudio}
            onOpenAuditHistory={() => setCurrentTab('audit_history')}
          />
        )}

        {currentTab === 'audit_studio' && (
          <AuditStudioView
            initialContent={studioDraftContent}
            initialChannel={studioChannel}
            initialTitle={studioTitle}
            initialAuditResult={studioInitialAudit}
            loadKey={studioLoadKey}
            activeRules={rules}
            toneSettings={toneSettings}
            onOpenViolationModal={(v) => setActiveViolationModal(v)}
            onOpenAuthModal={openAuthModal}
            onNavigateToReviewWorkflow={() => setCurrentTab('review_workflow')}
            onToast={showToast}
            onAuditCompleted={(res) => {
              if (res.status === 'compliant') {
                showToast(`Audit Verified: Brand Compliant (${res.overallScore}%)`);
              } else {
                showToast(`Audit Completed: ${res.violations.length} deviations detected`);
              }
            }}
          />
        )}

        {currentTab === 'videoguard' && (
          <VideoGuardView
            onOpenAuthModal={openAuthModal}
            onNavigateToReviewWorkflow={() => setCurrentTab('review_workflow')}
            onToast={showToast}
          />
        )}

        {currentTab === 'review_workflow' && (
          <ReviewWorkflowView
            onOpenAuthModal={openAuthModal}
            onToast={showToast}
          />
        )}

        {currentTab === 'rule_engine' && (
          <RuleEngineView
            rules={rules}
            onRulesChange={setRules}
            toneSettings={toneSettings}
            onToneSettingsChange={setToneSettings}
            onOpenAuthModal={openAuthModal}
            onToast={showToast}
          />
        )}

        {currentTab === 'channel_guard' && (
          <ChannelGuardView onTestChannel={handleTestChannel} />
        )}

        {currentTab === 'audit_history' && (
          <AuditHistoryView
            onInspectRecord={handleInspectRecord}
            onOpenAuthModal={openAuthModal}
            onNavigateToReviewWorkflow={() => setCurrentTab('review_workflow')}
            onToast={showToast}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
          <div className="glass-panel-elevated rounded-xl px-4 py-2.5 flex items-center gap-2.5 border border-violet-500/40 text-xs font-mono text-white shadow-[0_0_24px_rgba(139,92,246,0.4)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Auth / Profile Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccessToast={showToast}
      />

      {/* Specular Violation Drilldown Modal */}
      {activeViolationModal && (
        <ViolationModal
          violation={activeViolationModal}
          onClose={() => setActiveViolationModal(null)}
          onApplyFix={handleApplyFixFromModal}
        />
      )}

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-white/10 bg-[#080d1d]/80 backdrop-blur-md px-6 py-6 text-xs text-slate-400">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-violet-600/30 flex items-center justify-center border border-violet-500/30">
              <Shield className="w-3 h-3 text-violet-300" />
            </div>
            <span className="font-display font-semibold text-slate-300">BrandGuard AI™</span>
            <span>·</span>
            <span className="font-mono text-slate-400">Enterprise Brand Governance System</span>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-slate-400">
            <span>SOC2 Type II Certified</span>
            <span aria-hidden="true">·</span>
            <span>GDPR Ready</span>
            <span aria-hidden="true">·</span>
            <span>Continuous Gemini 3.8 Flash Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
