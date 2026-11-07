import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  ArrowUpRight, 
  Sparkles, 
  Layers, 
  Send, 
  CheckCircle2, 
  Eye, 
  ChevronRight,
  Zap,
  Globe,
  Radio
} from 'lucide-react';
import { ScoreMatrixGauge } from './ScoreMatrixGauge';
import { CHANNELS_DATA, SAMPLE_DRAFTS } from '../data/mockData';
import { AuditResult, ChannelStatus } from '../types/brandguard';

interface DashboardViewProps {
  onNavigateToStudio: (draftContent?: string, channel?: string) => void;
  onOpenAuditHistory: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToStudio,
  onOpenAuditHistory,
}) => {
  const [quickDraft, setQuickDraft] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('press');

  const handleQuickScan = () => {
    if (quickDraft.trim()) {
      onNavigateToStudio(quickDraft, selectedChannel);
    } else {
      // Pick the first sample draft
      onNavigateToStudio(SAMPLE_DRAFTS[0].content, SAMPLE_DRAFTS[0].channel);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_DRAFTS[0]) => {
    setQuickDraft(sample.content);
    setSelectedChannel(sample.channel);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Executive Suite Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left: Main Score Matrix Gauge & System Health */}
        <div className="lg:col-span-5 glass-panel-elevated rounded-2xl p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-violet-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Brand Governance Telemetry
              </span>
              <span className="text-xs text-slate-400 font-mono">SOC2 Type II Active</span>
            </div>

            <h2 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Enterprise Brand Health Index
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Real-time multi-channel adherence across 142 corporate brand invariants and trademark rules.
            </p>
          </div>

          <div className="py-6 flex justify-center">
            <ScoreMatrixGauge 
              score={94.2} 
              size={220}
              strokeWidth={14}
              label="Global Brand Integrity"
              subMetrics={{
                toneAlignment: 96,
                trademarkIntegrity: 98,
                claimSubstantiation: 91,
                channelReadiness: 97,
              }}
            />
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Last automated cluster sweep: 3 mins ago</span>
            <button 
              onClick={onOpenAuditHistory}
              className="text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
            >
              <span>View telemetry logs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Quick Pre-Flight Audit Terminal & Active Highlights */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Executive Quick Launch Studio */}
          <div className="glass-panel rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                <h3 className="font-display text-base font-semibold text-white">
                  Instant Pre-Flight Brand Audit
                </h3>
              </div>
              <span className="text-xs text-slate-400">Powered by Gemini 3.8 Flash</span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Paste marketing draft, press release, or executive statement to detect token drift and trademark breaches.
            </p>

            <textarea
              value={quickDraft}
              onChange={(e) => setQuickDraft(e.target.value)}
              placeholder="e.g. Brandguard revolutionary launch is 100% guaranteed to eliminate all errors and is disrupting martech..."
              rows={4}
              className="w-full bg-[#080D1D]/90 text-slate-200 text-sm font-mono p-3.5 rounded-xl border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all placeholder:text-slate-600 resize-none"
            />

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400">Sample Drafts:</span>
                {SAMPLE_DRAFTS.slice(0, 3).map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                  >
                    {sample.title.split(' ')[0]} Launch
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="bg-[#0b1020] border border-white/10 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500 font-mono"
                >
                  <option value="press">Wire / Press</option>
                  <option value="landing_page">Web Landing</option>
                  <option value="social">Social Media</option>
                  <option value="paid_ads">Paid PPC</option>
                </select>

                <button
                  onClick={handleQuickScan}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.5)] border border-white/20 flex items-center gap-2 active:scale-95 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>Execute Audit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel rounded-xl p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Invariants Guarded
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-white tabular-nums">142</span>
                <span className="text-[11px] text-emerald-400 font-mono">100% Active</span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Scans Today
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-white tabular-nums">1,842</span>
                <span className="text-[11px] text-violet-400 font-mono">+18%</span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Breaches Blocked
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-emerald-400 tabular-nums">34</span>
                <span className="text-[11px] text-slate-400 font-mono">Zero Slip</span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Average Latency
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-white tabular-nums">140ms</span>
                <span className="text-[11px] text-blue-400 font-mono">Streaming</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Multi-Channel Governance Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-white tracking-tight">
              Multi-Channel Integrity Telemetry
            </h3>
            <p className="text-xs text-slate-400">
              Live status across verified enterprise marketing surfaces.
            </p>
          </div>
          <span className="text-xs font-mono text-violet-400">
            6 Channel Monitors Connected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CHANNELS_DATA.map((ch) => {
            const isCompliant = ch.status === 'compliant';
            const isWarning = ch.status === 'warning';

            return (
              <div
                key={ch.channel}
                className="glass-panel glass-interactive rounded-xl p-5 cursor-pointer group"
                onClick={() => onNavigateToStudio(undefined, ch.channel)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-violet-300 group-hover:border-violet-500/30 transition-colors">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                        {ch.name}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Scanned {ch.lastScanned}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium border ${
                    isCompliant
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : isWarning
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {ch.healthScore}% Index
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden my-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompliant
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : isWarning
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-red-500 to-rose-400'
                    }`}
                    style={{ width: `${ch.healthScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                  <span className="font-mono">{ch.activeAudits} Active Audits</span>
                  <span className={`font-mono ${ch.openViolations > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {ch.openViolations > 0 ? `${ch.openViolations} Open Flaws` : 'Zero Breaches'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Strategic Drift Alerts Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-base font-semibold text-white">
              Recent Brand Drift Detections & Automated Neutralizations
            </h3>
          </div>
          <button
            onClick={onOpenAuditHistory}
            className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
          >
            <span>Complete audit trail</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-1.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    PR Newswire Wire Distribution Draft
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                    CRITICAL
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Breach: Prohibited superlative &quot;100% guaranteed&quot; + improper trademark casing &quot;Brandguard&quot;.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToStudio(SAMPLE_DRAFTS[0].content, 'press')}
              className="text-xs text-violet-300 hover:text-white px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 rounded-lg transition-colors whitespace-nowrap self-start md:self-auto"
            >
              Inspect in Studio
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    Paid Search PMax Campaign Snippet
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                    WARNING
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Breach: Unauthorized discount positioning &quot;cheap&quot; violates brand value policy §2.4.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToStudio(SAMPLE_DRAFTS[3].content, 'paid_ads')}
              className="text-xs text-violet-300 hover:text-white px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 rounded-lg transition-colors whitespace-nowrap self-start md:self-auto"
            >
              Inspect in Studio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
