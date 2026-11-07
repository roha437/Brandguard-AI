import React, { useState } from 'react';
import { 
  Sliders, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  ShieldAlert, 
  BookOpen, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Filter,
  Calendar,
  Lock
} from 'lucide-react';
import { INITIAL_BRAND_RULES } from '../data/mockData';
import { BrandRule, SeverityLevel } from '../types/brandguard';

export const RuleEngineView: React.FC = () => {
  const [rules, setRules] = useState<BrandRule[]>(INITIAL_BRAND_RULES);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [newRuleModal, setNewRuleModal] = useState<boolean>(false);
  const [toneFormality, setToneFormality] = useState<number>(75); // 0 (casual) to 100 (formal)
  const [toneBoldness, setToneBoldness] = useState<number>(60);
  const [toneTechnical, setToneTechnical] = useState<number>(85);
  const [savedNotification, setSavedNotification] = useState<boolean>(false);

  // New rule state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<BrandRule['category']>('forbidden_terms');
  const [newPattern, setNewPattern] = useState('');
  const [newFix, setNewFix] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<SeverityLevel>('warning');

  const toggleRuleActive = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPattern) return;

    const created: BrandRule = {
      id: `rule-custom-${Date.now()}`,
      name: newName,
      category: newCategory,
      description: newDesc || `Enforce policy for ${newPattern}`,
      patternOrTerm: newPattern,
      recommendedFix: newFix || 'brand-approved equivalent',
      severity: newSeverity,
      isActive: true,
      affectedChannels: ['press', 'landing_page', 'social', 'paid_ads', 'email', 'partner'],
    };

    setRules([created, ...rules]);
    setNewName('');
    setNewPattern('');
    setNewFix('');
    setNewDesc('');
    setNewRuleModal(false);
  };

  const handleSaveTone = () => {
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  const filteredRules = activeCategory === 'all'
    ? rules
    : rules.filter((r) => r.category === activeCategory);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Corporate Brand Constitution
          </span>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight mt-1">
            Brand Governance & Invariant Rules Engine
          </h2>
          <p className="text-sm text-slate-400">
            Define mathematical lexical boundaries, tone curves, trademark covenants, and legal restrictions.
          </p>
        </div>

        <button
          onClick={() => setNewRuleModal(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Define New Brand Rule</span>
        </button>
      </div>

      {/* Tone & Voice Precision Calibration */}
      <div className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-violet-400" />
            <h3 className="font-display text-base font-semibold text-white">
              Brand Voice & Lexical Tone Target Calibration
            </h3>
          </div>
          <button
            onClick={handleSaveTone}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md transition-all"
          >
            {savedNotification ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{savedNotification ? 'Calibrations Saved' : 'Commit Baseline'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Formality Slider */}
          <div className="bg-[#0b1020] p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Formality Index</span>
              <span className="font-mono text-violet-400 font-bold">{toneFormality}% (Executive)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={toneFormality}
              onChange={(e) => setToneFormality(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Conversational</span>
              <span>Rigorous Enterprise</span>
            </div>
          </div>

          {/* Boldness Slider */}
          <div className="bg-[#0b1020] p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Authoritative Weight</span>
              <span className="font-mono text-blue-400 font-bold">{toneBoldness}% (Authoritative)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={toneBoldness}
              onChange={(e) => setToneBoldness(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Humble & Soft</span>
              <span>Dominant Market Leader</span>
            </div>
          </div>

          {/* Technicality Slider */}
          <div className="bg-[#0b1020] p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Technical Depth</span>
              <span className="font-mono text-emerald-400 font-bold">{toneTechnical}% (Engineering)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={toneTechnical}
              onChange={(e) => setToneTechnical(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Simplified Consumer</span>
              <span>Architectural / Monolinear</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Registry Table & Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#0b1020] rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                activeCategory === 'all'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveCategory('trademark')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                activeCategory === 'trademark'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Trademark Nomenclature
            </button>
            <button
              onClick={() => setActiveCategory('tone')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                activeCategory === 'tone'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tone & Vocabulary
            </button>
            <button
              onClick={() => setActiveCategory('legal')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                activeCategory === 'legal'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Legal & Disclaimers
            </button>
            <button
              onClick={() => setActiveCategory('embargo')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                activeCategory === 'embargo'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Embargo Shields
            </button>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            {rules.filter(r => r.isActive).length} of {rules.length} Policies Active
          </span>
        </div>

        {/* Rule Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule) => {
            const isCrit = rule.severity === 'critical';

            return (
              <div
                key={rule.id}
                className={`glass-panel rounded-xl p-5 border transition-all ${
                  rule.isActive ? 'border-white/10' : 'opacity-60 border-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5">
                    {isCrit ? (
                      <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {rule.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                        <span className="uppercase text-violet-300">{rule.category}</span>
                        <span>·</span>
                        <span className={isCrit ? 'text-red-400 font-semibold' : 'text-amber-400'}>
                          {rule.severity.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleRuleActive(rule.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}
                  >
                    {rule.isActive ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {rule.description}
                </p>

                <div className="bg-[#0b1020] rounded-lg p-2.5 border border-white/5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Forbidden Term / Pattern:</span>
                    <span className="text-red-400 font-semibold">&quot;{rule.patternOrTerm}&quot;</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-white/5">
                    <span>Approved Corporate Equivalent:</span>
                    <span className="text-emerald-400 font-semibold">&quot;{rule.recommendedFix}&quot;</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Enforced across {rule.affectedChannels.length} channels</span>
                  <span className={rule.isActive ? 'text-emerald-400' : 'text-slate-600'}>
                    {rule.isActive ? 'POLICY ENFORCED' : 'MUTED'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Define Rule Modal */}
      {newRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg glass-panel-elevated rounded-2xl p-6 border border-violet-500/40 relative">
            <h3 className="font-display text-lg font-bold text-white mb-2">
              Define New Brand Invariant Rule
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Specify deterministic pattern matching and semantic replacement criteria.
            </p>

            <form onSubmit={handleAddRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Rule Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Mandatory Security SLA Disclosure"
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                  >
                    <option value="forbidden_terms">Forbidden Terms</option>
                    <option value="trademark">Trademark Syntax</option>
                    <option value="tone">Tone & Cadence</option>
                    <option value="legal">Legal & Disclaimers</option>
                    <option value="embargo">Embargo Shield</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                  >
                    <option value="warning">Warning / Drift</option>
                    <option value="critical">Critical / Zero-Tolerance</option>
                    <option value="nominal">Nominal Advisory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Forbidden Snippet or Term</label>
                <input
                  type="text"
                  required
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="e.g. unbeatable price"
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 font-mono focus:border-violet-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Approved Corporate Replacement</label>
                <input
                  type="text"
                  required
                  value={newFix}
                  onChange={(e) => setNewFix(e.target.value)}
                  placeholder="e.g. highly competitive enterprise pricing"
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 font-mono focus:border-violet-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Policy Rationale</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Why this rule exists in the brand book..."
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setNewRuleModal(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-medium rounded-lg transition-all"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
