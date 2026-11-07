import React, { useState } from 'react';
import { 
  Globe, 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  FileText, 
  Hash, 
  Clock, 
  Sparkles,
  Sliders
} from 'lucide-react';
import { CHANNELS_DATA } from '../data/mockData';
import { MarketingChannel } from '../types/brandguard';

interface ChannelGuardViewProps {
  onTestChannel: (channel: MarketingChannel) => void;
}

export const ChannelGuardView: React.FC<ChannelGuardViewProps> = ({ onTestChannel }) => {
  const [selectedChannel, setSelectedChannel] = useState<MarketingChannel>('press');

  const channelRulesInfo: Record<MarketingChannel, {
    description: string;
    strictness: 'Zero-Tolerance (Strict)' | 'High' | 'Adaptive';
    mandatoryChecks: string[];
    embargoShield: boolean;
    characterLimit?: string;
  }> = {
    press: {
      description: 'Global wire distributions, investor letters, and news releases. Audited for SEC compliance, claims substantiation, and corporate trademark notation.',
      strictness: 'Zero-Tolerance (Strict)',
      mandatoryChecks: [
        'BrandGuard AI™ full trademark on headline and first body occurrence',
        'Official boilerplate text included in footer',
        'C-Suite attribution verified for quote statements',
        'Zero absolute superlatives ("100% guaranteed", "unbeatable")',
      ],
      embargoShield: true,
      characterLimit: 'Unlimited (standard 400-800 words)',
    },
    landing_page: {
      description: 'Public marketing website, product feature tours, and customer portal sign-up pages.',
      strictness: 'High',
      mandatoryChecks: [
        'SOC2 Type II and ISO 27001 badge references verified',
        'No colloquial jargon or depreciated acronyms',
        'Accurate SLA guarantee terms linked to legal portal',
        'Clear pricing transparency without discount slang',
      ],
      embargoShield: true,
      characterLimit: 'Headline 65 chars / Sections 300 words',
    },
    social: {
      description: 'Corporate X/Twitter, LinkedIn Executive, and YouTube community feeds.',
      strictness: 'Adaptive',
      mandatoryChecks: [
        'No informal hyperbole ("crushes", "insane")',
        'Verified corporate hashtag guidelines applied (#BrandGovernance)',
        'Trademark capitalization preserved even in short-form posts',
        'No unapproved competitor comparisons',
      ],
      embargoShield: true,
      characterLimit: 'X: 280 chars / LinkedIn: 3000 chars',
    },
    paid_ads: {
      description: 'Google Performance Max, LinkedIn Sponsored Content, and Meta Display ads.',
      strictness: 'Zero-Tolerance (Strict)',
      mandatoryChecks: [
        'Prohibition on word "cheap" or unapproved discounts',
        'Superlatives like "Best in class" must cite Gartner or Forrester',
        'Destination URL match verification',
        'No clickbait formatting or unauthorized punctuation',
      ],
      embargoShield: false,
      characterLimit: 'Headlines: 30 chars / Descriptions: 90 chars',
    },
    email: {
      description: 'Customer lifecycle campaigns, monthly product updates, and executive briefings.',
      strictness: 'High',
      mandatoryChecks: [
        'CAN-SPAM and GDPR unsubscribe footer syntax',
        'Accurate sender brand signature',
        'Tone alignment with executive enterprise baseline',
        'Safe-list verification on external links',
      ],
      embargoShield: false,
      characterLimit: 'Subject: 50 chars / Body: 400 words',
    },
    partner: {
      description: 'Reseller enablement portal, distributor whitepapers, and partner co-branding.',
      strictness: 'High',
      mandatoryChecks: [
        'Co-branding lockup rules followed (BrandGuard logo dominance)',
        'Tier status (Platinum/Gold) accurately classified',
        'Resale SLA boundaries explicitly cited',
        'Trademark usage guidelines linked',
      ],
      embargoShield: true,
      characterLimit: 'Document specific',
    },
  };

  const currentInfo = channelRulesInfo[selectedChannel];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-blue-400 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Cross-Surface Governance
          </span>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight mt-1">
            Multi-Channel Brand Guard Matrix
          </h2>
          <p className="text-sm text-slate-400">
            Enforce channel-specific policy constraints, character bounds, and pre-flight launch checklists.
          </p>
        </div>

        <button
          onClick={() => onTestChannel(selectedChannel)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Launch {selectedChannel.toUpperCase()} Studio Audit</span>
        </button>
      </div>

      {/* Channel Switcher Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CHANNELS_DATA.map((ch) => {
          const isSelected = selectedChannel === ch.channel;
          const isCompliant = ch.status === 'compliant';
          const isWarning = ch.status === 'warning';

          return (
            <button
              key={ch.channel}
              onClick={() => setSelectedChannel(ch.channel)}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-violet-950/40 border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                  : 'glass-panel hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-slate-400">
                  {ch.channel}
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  isCompliant ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-red-400'
                }`} />
              </div>
              <div className="text-sm font-semibold text-white truncate">
                {ch.name.split(' ')[0]}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                Score: <span className="text-slate-200 font-bold">{ch.healthScore}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Channel Detailed Policy & Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Policy Spec & Rules */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-violet-400">
                Channel Architecture Profile
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
                {currentInfo.strictness}
              </span>
            </div>
            <h3 className="font-display text-xl font-bold text-white capitalize">
              {selectedChannel.replace('_', ' ')} Directives
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {currentInfo.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[#0b1020] p-4 rounded-xl border border-white/5">
            <div>
              <span className="text-slate-400 block mb-1">Character Bounds:</span>
              <span className="text-slate-200 font-medium">{currentInfo.characterLimit}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Embargo Policy:</span>
              <span className={currentInfo.embargoShield ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                {currentInfo.embargoShield ? 'Shield Active (Hard Block)' : 'Standard Monitoring'}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Pre-Flight Automated Validation Checklist
            </h4>
            <div className="space-y-2">
              {currentInfo.mandatoryChecks.map((check, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-start gap-3 text-xs"
                >
                  <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-[11px] font-mono">
                    ✓
                  </span>
                  <span className="text-slate-300 leading-relaxed">{check}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Channel Sandbox Simulator */}
        <div className="lg:col-span-5 glass-panel-elevated rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-violet-400" />
              <h3 className="font-display text-base font-semibold text-white">
                Live Channel Pre-Flight Simulator
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Run test copy against {selectedChannel.toUpperCase()} rule set.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-[#080d1d] border border-white/10 font-mono text-xs text-slate-300 space-y-3">
              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>SIMULATED PAYLOAD:</span>
                <span className="text-emerald-400">STATUS: READY</span>
              </div>
              <p className="italic text-slate-400">
                &quot;BrandGuard AI™ empowers global enterprises with deterministic brand compliance across digital touchpoints.&quot;
              </p>
              <div className="pt-2 border-t border-white/5 flex justify-between text-[11px]">
                <span className="text-slate-400">Expected Score:</span>
                <span className="text-emerald-400 font-bold">98% (Pass)</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <button
              onClick={() => onTestChannel(selectedChannel)}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-xl transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Dedicated {selectedChannel.toUpperCase()} Audit</span>
            </button>
            <p className="text-[11px] text-center text-slate-500">
              Directly routes into the Rule Inspector Terminal with this channel active.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
