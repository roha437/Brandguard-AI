import React, { useState } from 'react';
import { 
  Check, 
  Copy, 
  Terminal as TerminalIcon, 
  AlertCircle, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw,
  Wand2,
  ChevronRight,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { AuditResult, RuleViolation } from '../types/brandguard';

interface RuleInspectorTerminalProps {
  auditResult: AuditResult | null;
  rawContent: string;
  onContentChange: (newText: string) => void;
  onRunAudit: () => void;
  isLoading: boolean;
  onSelectViolation?: (violation: RuleViolation) => void;
}

export const RuleInspectorTerminal: React.FC<RuleInspectorTerminalProps> = ({
  auditResult,
  rawContent,
  onContentChange,
  onRunAudit,
  isLoading,
  onSelectViolation,
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'remediation' | 'raw'>('diff');
  const [copied, setCopied] = useState(false);
  const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplySingleFix = (violation: RuleViolation) => {
    if (!violation.snippet || !violation.replacement) return;
    const regex = new RegExp(violation.snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const updated = rawContent.replace(regex, violation.replacement);
    onContentChange(updated);
  };

  const handleApplyAllRemediations = () => {
    if (auditResult?.remediatedText) {
      onContentChange(auditResult.remediatedText);
    }
  };

  const violations = auditResult?.violations || [];
  const tokenDrift = auditResult?.tokenDrift;

  // Split text into tokens/snippets for syntax diff
  const renderHighlightedContent = () => {
    if (!auditResult || violations.length === 0) {
      return (
        <div className="text-slate-300 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
          {rawContent}
        </div>
      );
    }

    // Build parts highlighting violations
    let parts: Array<{ text: string; violation?: RuleViolation }> = [{ text: rawContent }];

    violations.forEach((violation) => {
      const newParts: Array<{ text: string; violation?: RuleViolation }> = [];
      parts.forEach((part) => {
        if (part.violation) {
          newParts.push(part);
          return;
        }

        const index = part.text.toLowerCase().indexOf(violation.snippet.toLowerCase());
        if (index === -1) {
          newParts.push(part);
        } else {
          if (index > 0) {
            newParts.push({ text: part.text.substring(0, index) });
          }
          newParts.push({
            text: part.text.substring(index, index + violation.snippet.length),
            violation,
          });
          const remainder = part.text.substring(index + violation.snippet.length);
          if (remainder.length > 0) {
            newParts.push({ text: remainder });
          }
        }
      });
      parts = newParts;
    });

    return (
      <div className="font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (!part.violation) {
            return <span key={i} className="text-slate-300">{part.text}</span>;
          }

          const v = part.violation;
          const isCritical = v.severity === 'critical';
          const isSelected = selectedViolationId === v.id;

          return (
            <span
              key={i}
              onClick={() => {
                setSelectedViolationId(v.id);
                if (onSelectViolation) onSelectViolation(v);
              }}
              title={`${v.ruleName}: ${v.issue}`}
              className={`inline-block cursor-pointer px-1.5 py-0.5 rounded transition-all duration-150 mx-0.5 ${
                isCritical
                  ? 'bg-red-950/80 text-red-300 border border-red-500/40 hover:bg-red-900/90'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40 hover:bg-amber-900/90'
              } ${isSelected ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-slate-900' : ''}`}
            >
              <span className="line-through opacity-75">{part.text}</span>
              <span className="mx-1 text-slate-500">→</span>
              <span className="font-bold underline text-emerald-400">{v.replacement}</span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="glass-panel-elevated rounded-xl overflow-hidden border border-violet-500/25 flex flex-col h-full">
      {/* Terminal Bar Top Chrome */}
      <div className="bg-[#0e1323] px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/70 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/70 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/70 inline-block" />
          </div>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-violet-300 font-semibold tracking-wide">RULE_INSPECTOR_TERMINAL</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {auditResult ? `${auditResult.wordCount} words` : `${rawContent.trim().split(/\s+/).filter(Boolean).length} words`}
            </span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-[#0B1020] rounded-lg border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1 font-medium rounded-md transition-colors ${
              activeTab === 'diff' 
                ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Syntax Diff
          </button>
          <button
            onClick={() => setActiveTab('remediation')}
            className={`px-3 py-1 font-medium rounded-md transition-colors ${
              activeTab === 'remediation' 
                ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            AI Remediated View
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1 font-medium rounded-md transition-colors ${
              activeTab === 'raw' 
                ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Raw Source
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {violations.length > 0 && (
            <button
              onClick={handleApplyAllRemediations}
              className="px-2.5 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Apply All Fixes ({violations.length})</span>
            </button>
          )}

          <button
            onClick={() => handleCopy(activeTab === 'remediation' && auditResult?.remediatedText ? auditResult.remediatedText : rawContent)}
            className="p-1.5 text-xs text-slate-400 hover:text-white rounded-md bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
            title="Copy text to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onRunAudit}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium bg-[#7C3AED] hover:bg-[#8B5CF6] text-white rounded-md transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(139,92,246,0.35)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Auditing...' : 'Re-Scan'}</span>
          </button>
        </div>
      </div>

      {/* Token Drift Telemetry Ribbon */}
      {tokenDrift && (
        <div className="bg-[#0b1020]/90 border-b border-white/5 px-4 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="flex items-center justify-between px-2 py-1 bg-white/5 rounded">
            <span className="text-slate-400">Formal Drift:</span>
            <span className={`font-semibold tabular-nums ${tokenDrift.formalDeviation > 5 ? 'text-indigo-400' : tokenDrift.formalDeviation < -5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {tokenDrift.formalDeviation > 0 ? `+${tokenDrift.formalDeviation}%` : `${tokenDrift.formalDeviation}%`}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-white/5 rounded">
            <span className="text-slate-400">Hyperbole Factor:</span>
            <span className={`font-semibold tabular-nums ${tokenDrift.hyperboleFactor > 20 ? 'text-red-400' : 'text-emerald-400'}`}>
              {tokenDrift.hyperboleFactor}%
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-white/5 rounded">
            <span className="text-slate-400">Vocab Precision:</span>
            <span className="font-semibold text-blue-400 tabular-nums">
              {tokenDrift.vocabularyPrecision}%
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-white/5 rounded">
            <span className="text-slate-400">Authoritative:</span>
            <span className="font-semibold text-violet-300 tabular-nums">
              {tokenDrift.authoritativeDeviation > 0 ? `+${tokenDrift.authoritativeDeviation}%` : `${tokenDrift.authoritativeDeviation}%`}
            </span>
          </div>
        </div>
      )}

      {/* Main Terminal Viewport */}
      <div className="flex-1 p-4 bg-[#090D1A]/95 overflow-y-auto min-h-[260px] max-h-[380px]">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center py-12 text-center">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mb-3" />
            <p className="text-sm font-mono text-slate-300">Parsing lexical tokens against corporate brand constitution...</p>
            <span className="text-xs text-slate-500 mt-1">Checking trademark syntax, hyperbole vectors, and legal indemnification clauses</span>
          </div>
        ) : activeTab === 'diff' ? (
          <div>
            <div className="mb-2 text-[11px] font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Lexical Diff & Token Inspection</span>
              <span className="text-violet-400">Click highlighted tokens to inspect rules</span>
            </div>
            {renderHighlightedContent()}
          </div>
        ) : activeTab === 'remediation' ? (
          <div>
            <div className="mb-2 text-[11px] font-mono uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Full 100% Brand-Compliant Reconstructed Text</span>
            </div>
            <div className="text-emerald-100/90 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/20">
              {auditResult?.remediatedText || rawContent}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Editable Source Buffer
            </div>
            <textarea
              value={rawContent}
              onChange={(e) => onContentChange(e.target.value)}
              rows={8}
              className="w-full bg-transparent text-slate-200 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none"
              placeholder="Paste or enter enterprise brand marketing copy..."
            />
          </div>
        )}
      </div>

      {/* Inline Active Violations Strip */}
      {violations.length > 0 && (
        <div className="bg-[#0e1323] border-t border-white/10 p-3">
          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-violet-400" />
              <span>Detected Deviations ({violations.length})</span>
            </span>
            <span className="text-[11px] text-slate-400">Click &apos;Apply&apos; for one-click in-place fix</span>
          </div>

          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {violations.map((violation) => {
              const isCrit = violation.severity === 'critical';
              const isSelected = selectedViolationId === violation.id;

              return (
                <div
                  key={violation.id}
                  onClick={() => {
                    setSelectedViolationId(violation.id);
                    if (onSelectViolation) onSelectViolation(violation);
                  }}
                  className={`p-2 rounded-lg border transition-all text-xs flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-violet-950/40 border-violet-500'
                      : isCrit
                      ? 'bg-red-950/30 border-red-500/30 hover:border-red-500/60'
                      : 'bg-amber-950/30 border-amber-500/30 hover:border-amber-500/60'
                  }`}
                >
                  <div className="flex items-start gap-2 overflow-hidden">
                    {isCrit ? (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 truncate">
                          {violation.ruleName}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          isCrit ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {violation.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] truncate mt-0.5">
                        {violation.issue}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplySingleFix(violation);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/40 rounded transition-all flex items-center gap-1"
                    >
                      <span>Fix: &quot;{violation.replacement}&quot;</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
