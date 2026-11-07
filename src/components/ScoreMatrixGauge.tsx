import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ComplianceStatus } from '../types/brandguard';

interface ScoreMatrixGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subMetrics?: {
    toneAlignment: number;
    trademarkIntegrity: number;
    claimSubstantiation: number;
    channelReadiness: number;
  };
}

export const ScoreMatrixGauge: React.FC<ScoreMatrixGaugeProps> = ({
  score,
  size = 200,
  strokeWidth = 14,
  label = 'Brand Compliance Index',
  subMetrics = {
    toneAlignment: 94,
    trademarkIntegrity: 98,
    claimSubstantiation: 91,
    channelReadiness: 96,
  },
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // Use 270 degree arc for gauge look
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getStatus = (val: number): ComplianceStatus => {
    if (val >= 90) return 'compliant';
    if (val >= 70) return 'warning';
    return 'critical';
  };

  const status = getStatus(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Ambient radial glow under the gauge */}
        <div 
          className="absolute inset-0 rounded-full blur-2xl opacity-25 pointer-events-none transition-all duration-500"
          style={{
            background: status === 'compliant'
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(59, 130, 246, 0.1) 70%, transparent 100%)'
              : status === 'warning'
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, rgba(139, 92, 246, 0.1) 70%, transparent 100%)'
              : 'radial-gradient(circle, rgba(239, 68, 68, 0.45) 0%, rgba(139, 92, 246, 0.15) 70%, transparent 100%)',
          }}
        />

        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            {/* Gradient from Cyber Blue #3B82F6 to Electric Violet #8B5CF6 */}
            <linearGradient id="scoreGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="60%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>

            {/* Warning gradient */}
            <linearGradient id="scoreGaugeWarning" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Value Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={status === 'critical' ? 'url(#scoreGaugeWarning)' : 'url(#scoreGaugeGradient)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <div className="flex items-baseline gap-0.5">
            <span className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-white tabular-nums drop-shadow-md">
              {Math.round(score)}
            </span>
            <span className="text-sm font-semibold text-[#8B5CF6]">%</span>
          </div>
          
          <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase"
            style={{
              backgroundColor: status === 'compliant' ? 'rgba(16, 185, 129, 0.12)' : status === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.15)',
              color: status === 'compliant' ? '#10B981' : status === 'warning' ? '#F59E0B' : '#EF4444',
              border: `1px solid ${status === 'compliant' ? 'rgba(16, 185, 129, 0.3)' : status === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <span 
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: status === 'compliant' ? '#10B981' : status === 'warning' ? '#F59E0B' : '#EF4444',
                boxShadow: `0 0 6px ${status === 'compliant' ? '#10B981' : status === 'warning' ? '#F59E0B' : '#EF4444'}`,
              }}
            />
            {status === 'compliant' ? 'Audit Verified' : status === 'warning' ? 'Tone Drift' : 'Action Required'}
          </div>

          <span className="text-[11px] text-slate-400 mt-1 max-w-[120px] leading-tight font-medium">
            {label}
          </span>
        </div>
      </div>

      {/* Sub-Metric Bars */}
      {subMetrics && (
        <div className="w-full mt-6 grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
          <div className="bg-[#111827]/70 border border-white/5 rounded-lg p-2.5">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-400">Tone Alignment</span>
              <span className="font-mono font-medium text-slate-200 tabular-nums">{subMetrics.toneAlignment}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" 
                style={{ width: `${subMetrics.toneAlignment}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111827]/70 border border-white/5 rounded-lg p-2.5">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-400">Trademark Mark</span>
              <span className="font-mono font-medium text-slate-200 tabular-nums">{subMetrics.trademarkIntegrity}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" 
                style={{ width: `${subMetrics.trademarkIntegrity}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111827]/70 border border-white/5 rounded-lg p-2.5">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-400">Substantiation</span>
              <span className="font-mono font-medium text-slate-200 tabular-nums">{subMetrics.claimSubstantiation}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" 
                style={{ width: `${subMetrics.claimSubstantiation}%` }}
              />
            </div>
          </div>

          <div className="bg-[#111827]/70 border border-white/5 rounded-lg p-2.5">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-400">Channel Guard</span>
              <span className="font-mono font-medium text-slate-200 tabular-nums">{subMetrics.channelReadiness}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-violet-500 rounded-full transition-all duration-500" 
                style={{ width: `${subMetrics.channelReadiness}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
