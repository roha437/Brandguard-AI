import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Terminal, 
  Layers, 
  FileText, 
  Wand2, 
  CheckCircle, 
  Copy, 
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { RuleInspectorTerminal } from './RuleInspectorTerminal';
import { SAMPLE_DRAFTS } from '../data/mockData';
import { AuditResult, RuleViolation, MarketingChannel } from '../types/brandguard';

interface AuditStudioViewProps {
  initialContent?: string;
  initialChannel?: string;
  onAuditCompleted?: (result: AuditResult) => void;
  onOpenViolationModal: (violation: RuleViolation) => void;
}

export const AuditStudioView: React.FC<AuditStudioViewProps> = ({
  initialContent = SAMPLE_DRAFTS[0].content,
  initialChannel = 'press',
  onAuditCompleted,
  onOpenViolationModal,
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [channel, setChannel] = useState<string>(initialChannel);
  const [title, setTitle] = useState<string>('Q4 Global Product Release Communications');
  const [targetTone, setTargetTone] = useState<string>('executive');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [variations, setVariations] = useState<Array<{ title: string; text: string; toneDelta: string }>>([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>(SAMPLE_DRAFTS[0].id);

  // Trigger real-time or server-side AI audit
  const runAudit = async (overrideContent?: string) => {
    const textToScan = overrideContent !== undefined ? overrideContent : content;
    if (!textToScan.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textToScan,
          channel,
        }),
      });

      if (!response.ok) {
        throw new Error('Audit API request failed');
      }

      const data: AuditResult = await response.json();
      setAuditResult(data);
      if (onAuditCompleted) {
        onAuditCompleted(data);
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

  const handleSelectPreset = (preset: typeof SAMPLE_DRAFTS[0]) => {
    setActivePresetId(preset.id);
    setTitle(preset.title);
    setContent(preset.content);
    setChannel(preset.channel);
    runAudit(preset.content);
  };

  // Automatically run audit on mount if not yet run
  React.useEffect(() => {
    if (!auditResult && content) {
      runAudit(content);
    }
  }, []);

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
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
              <span>Channel: {channel.toUpperCase()}</span>
              <span>·</span>
              <span>Model: Gemini 3.8 Flash</span>
              {auditResult && (
                <>
                  <span>·</span>
                  <span className={auditResult.status === 'compliant' ? 'text-emerald-400' : auditResult.status === 'warning' ? 'text-amber-400' : 'text-red-400'}>
                    Score: {auditResult.overallScore}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Preset Selectors */}
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
        </div>
      </div>

      {/* Main Split Workbench: Editor on Left, Rule Inspector Terminal on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Draft Editor & Context Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Input Marketing Buffer
              </span>

              <div className="flex items-center gap-2">
                <select
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value);
                  }}
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
              placeholder="Paste or type copy here to audit against BrandGuard brand guidelines..."
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
                  }}
                  className="px-2.5 py-1 text-slate-400 hover:text-white text-xs hover:bg-white/5 rounded-md transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => runAudit()}
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
              Generates fully compliant alternative copy variations using Gemini 3.8 Flash.
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
                          runAudit(v.text);
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
              // Re-run audit with new content
              runAudit(newText);
            }}
            onRunAudit={() => runAudit()}
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
