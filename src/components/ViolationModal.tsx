import React from 'react';
import { X, ShieldAlert, CheckCircle, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { RuleViolation } from '../types/brandguard';

interface ViolationModalProps {
  violation: RuleViolation | null;
  onClose: () => void;
  onApplyFix?: (violation: RuleViolation) => void;
}

export const ViolationModal: React.FC<ViolationModalProps> = ({
  violation,
  onClose,
  onApplyFix,
}) => {
  if (!violation) return null;

  const isCritical = violation.severity === 'critical';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-lg glass-panel-elevated rounded-2xl border border-violet-500/40 p-6 shadow-[0_0_50px_rgba(124,58,237,0.25)] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top ambient highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isCritical 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Rule Policy Drilldown
              </span>
              <h3 className="font-display text-lg font-bold text-white">
                {violation.ruleName}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Details */}
        <div className="space-y-4 text-sm">
          {/* Severity & Status */}
          <div className="flex items-center gap-3 text-xs">
            <span className={`px-2.5 py-1 rounded-full font-mono uppercase text-[11px] font-semibold border ${
              isCritical
                ? 'bg-red-500/15 text-red-300 border-red-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              {violation.severity} Breach
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-violet-400" />
              Brand Constitution §4.1
            </span>
          </div>

          {/* Diff Box */}
          <div className="bg-[#0b1020] border border-white/10 rounded-xl p-3.5 space-y-2">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Detected Token:</span>
              <span className="text-red-400 font-mono line-through font-medium">
                &quot;{violation.snippet}&quot;
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/5">
              <span>Mandated Replacement:</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                &quot;{violation.replacement}&quot;
              </span>
            </div>
          </div>

          {/* Rationale */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Policy Deviation Rationale
            </h4>
            <p className="text-slate-300 leading-relaxed text-xs sm:text-sm bg-white/5 p-3 rounded-lg border border-white/5">
              {violation.issue}
            </p>
          </div>

          {/* Remediation Advice */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Recommended Remediation
            </h4>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              {violation.remediation}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            Dismiss
          </button>
          {onApplyFix && (
            <button
              onClick={() => {
                onApplyFix(violation);
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.5)] border border-white/20 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Fix: &quot;{violation.replacement}&quot;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
