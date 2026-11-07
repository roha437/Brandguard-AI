import React, { useState } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { AuditStudioView } from './components/AuditStudioView';
import { RuleEngineView } from './components/RuleEngineView';
import { ChannelGuardView } from './components/ChannelGuardView';
import { AuditHistoryView } from './components/AuditHistoryView';
import { ViolationModal } from './components/ViolationModal';
import { RuleViolation, AuditHistoryRecord, MarketingChannel } from './types/brandguard';
import { SAMPLE_DRAFTS } from './data/mockData';
import { Shield, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeViolationModal, setActiveViolationModal] = useState<RuleViolation | null>(null);
  const [studioDraftContent, setStudioDraftContent] = useState<string>(SAMPLE_DRAFTS[0].content);
  const [studioChannel, setStudioChannel] = useState<string>(SAMPLE_DRAFTS[0].channel);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleNavigateToStudio = (draftContent?: string, channel?: string) => {
    if (draftContent !== undefined) {
      setStudioDraftContent(draftContent);
    }
    if (channel !== undefined) {
      setStudioChannel(channel);
    }
    setCurrentTab('audit_studio');
  };

  const handleTestChannel = (ch: MarketingChannel) => {
    setStudioChannel(ch);
    const matchedSample = SAMPLE_DRAFTS.find(s => s.channel === ch);
    if (matchedSample) {
      setStudioDraftContent(matchedSample.content);
    }
    setCurrentTab('audit_studio');
    showToast(`Loaded ${ch.toUpperCase()} Channel Profile into Audit Studio`);
  };

  const handleInspectRecord = (rec: AuditHistoryRecord) => {
    setStudioDraftContent(rec.content);
    setStudioChannel(rec.channel);
    setCurrentTab('audit_studio');
    showToast(`Loaded Audit Record ${rec.id} into Inspector`);
  };

  const handleApplyFixFromModal = (violation: RuleViolation) => {
    if (!violation.snippet || !violation.replacement) return;
    const regex = new RegExp(violation.snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    setStudioDraftContent(prev => prev.replace(regex, violation.replacement));
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
        onNewScan={() => {
          setStudioDraftContent('');
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
            onOpenViolationModal={(v) => setActiveViolationModal(v)}
            onAuditCompleted={(res) => {
              if (res.status === 'compliant') {
                showToast(`Audit Verified: 100% Brand Compliant (${res.overallScore}%)`);
              } else {
                showToast(`Audit Completed: ${res.violations.length} deviations detected`);
              }
            }}
          />
        )}

        {currentTab === 'rule_engine' && (
          <RuleEngineView />
        )}

        {currentTab === 'channel_guard' && (
          <ChannelGuardView onTestChannel={handleTestChannel} />
        )}

        {currentTab === 'audit_history' && (
          <AuditHistoryView onInspectRecord={handleInspectRecord} />
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
