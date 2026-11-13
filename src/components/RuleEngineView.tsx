import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Building2,
  Pencil,
  CheckCircle2,
  LogIn,
  Loader2,
  Database,
  X,
} from 'lucide-react';
import { BrandProfile, BrandProfileInput, BrandRule, SeverityLevel } from '../types/brandguard';
import { useSupabase } from '../contexts/SupabaseContext';
import type { AuthModalMode } from './AuthModal';

interface RuleEngineViewProps {
  rules: BrandRule[];
  onRulesChange: React.Dispatch<React.SetStateAction<BrandRule[]>>;
  toneSettings: {
    formality: number;
    authoritative: number;
    technical: number;
  };
  onToneSettingsChange: (next: {
    formality: number;
    authoritative: number;
    technical: number;
  }) => void;
  onOpenAuthModal: (mode: AuthModalMode) => void;
  onToast?: (msg: string) => void;
}

function parseTokenList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export const RuleEngineView: React.FC<RuleEngineViewProps> = ({
  rules,
  onRulesChange,
  toneSettings,
  onToneSettingsChange,
  onOpenAuthModal,
  onToast,
}) => {
  const {
    user,
    brandProfiles,
    brandProfilesLoading,
    activeBrandProfileId,
    activeBrandProfile,
    setActiveBrandProfileId,
    createBrandProfile,
    updateBrandProfile,
    deleteBrandProfile,
    schemaError,
  } = useSupabase();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [newRuleModal, setNewRuleModal] = useState<boolean>(false);
  const [savedNotification, setSavedNotification] = useState<boolean>(false);
  const [savingToneToCloud, setSavingToneToCloud] = useState<boolean>(false);

  // New rule state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<BrandRule['category']>('forbidden_terms');
  const [newPattern, setNewPattern] = useState('');
  const [newFix, setNewFix] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<SeverityLevel>('warning');

  // Brand Profile Modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [bpName, setBpName] = useState('');
  const [bpIndustry, setBpIndustry] = useState('Enterprise Technology');
  const [bpVoice, setBpVoice] = useState('Authoritative, precise, and enterprise-grade.');
  const [bpApprovedRaw, setBpApprovedRaw] = useState('');
  const [bpRestrictedRaw, setBpRestrictedRaw] = useState('');
  const [bpGuidelines, setBpGuidelines] = useState('');
  const [bpFormality, setBpFormality] = useState(75);
  const [bpAuthoritative, setBpAuthoritative] = useState(60);
  const [bpTechnical, setBpTechnical] = useState(85);
  const [bpSaving, setBpSaving] = useState(false);
  const [bpError, setBpError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sync tone sliders when switching active brand profile
  useEffect(() => {
    if (activeBrandProfile?.tone_rules) {
      onToneSettingsChange({
        formality: activeBrandProfile.tone_rules.formality ?? 75,
        authoritative: activeBrandProfile.tone_rules.authoritative ?? 60,
        technical: activeBrandProfile.tone_rules.technical ?? 85,
      });
    }
  }, [activeBrandProfile?.id]);

  const openCreateProfile = () => {
    setEditingProfileId(null);
    setBpName('');
    setBpIndustry('Enterprise Technology');
    setBpVoice('Authoritative, precise, and enterprise-grade.');
    setBpApprovedRaw('enterprise-grade, verified, deterministic');
    setBpRestrictedRaw('cheap, magic, 100% guaranteed');
    setBpGuidelines('');
    setBpFormality(toneSettings.formality);
    setBpAuthoritative(toneSettings.authoritative);
    setBpTechnical(toneSettings.technical);
    setBpError(null);
    setProfileModalOpen(true);
  };

  const openEditProfile = (bp: BrandProfile) => {
    setEditingProfileId(bp.id);
    setBpName(bp.brand_name);
    setBpIndustry(bp.industry);
    setBpVoice(bp.brand_voice);
    setBpApprovedRaw((bp.approved_words || []).join(', '));
    setBpRestrictedRaw((bp.restricted_words || []).join(', '));
    setBpGuidelines(bp.tone_rules?.customGuidelines || '');
    setBpFormality(bp.tone_rules?.formality ?? 75);
    setBpAuthoritative(bp.tone_rules?.authoritative ?? 60);
    setBpTechnical(bp.tone_rules?.technical ?? 85);
    setBpError(null);
    setProfileModalOpen(true);
  };

  const handleSaveBrandProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBpError(null);

    if (!bpName.trim()) {
      setBpError('Brand name is required.');
      return;
    }

    const input: BrandProfileInput = {
      brand_name: bpName.trim(),
      industry: bpIndustry.trim() || 'Enterprise Technology',
      brand_voice: bpVoice.trim() || 'Authoritative, precise, and enterprise-grade.',
      approved_words: parseTokenList(bpApprovedRaw),
      restricted_words: parseTokenList(bpRestrictedRaw),
      tone_rules: {
        formality: bpFormality,
        authoritative: bpAuthoritative,
        technical: bpTechnical,
        ...(bpGuidelines.trim() ? { customGuidelines: bpGuidelines.trim() } : {}),
      },
    };

    setBpSaving(true);
    const result = editingProfileId
      ? await updateBrandProfile(editingProfileId, input)
      : await createBrandProfile(input);
    setBpSaving(false);

    if (result.error) {
      setBpError(result.error);
      return;
    }

    if (result.profile?.tone_rules) {
      onToneSettingsChange({
        formality: result.profile.tone_rules.formality,
        authoritative: result.profile.tone_rules.authoritative,
        technical: result.profile.tone_rules.technical,
      });
    }

    setProfileModalOpen(false);
    onToast?.(
      editingProfileId
        ? `Updated Brand Profile "${input.brand_name}"`
        : `Created Brand Profile "${input.brand_name}"`
    );
  };

  const handleDeleteProfile = async (id: string) => {
    const res = await deleteBrandProfile(id);
    setConfirmDeleteId(null);
    if (res.error) {
      onToast?.(res.error);
    } else {
      onToast?.('Brand profile deleted');
    }
  };

  const toggleRuleActive = (id: string) => {
    onRulesChange((prev) =>
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

    onRulesChange((prev) => [created, ...prev]);
    setNewName('');
    setNewPattern('');
    setNewFix('');
    setNewDesc('');
    setNewRuleModal(false);
    onToast?.(`Added active rule "${created.name}"`);
  };

  const handleSaveTone = async () => {
    if (user && activeBrandProfile) {
      setSavingToneToCloud(true);
      const res = await updateBrandProfile(activeBrandProfile.id, {
        tone_rules: {
          ...activeBrandProfile.tone_rules,
          ...toneSettings,
        },
      });
      setSavingToneToCloud(false);
      if (res.error) {
        onToast?.(res.error);
        return;
      }
      onToast?.(`Saved tone baseline to "${activeBrandProfile.brand_name}"`);
    }
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  const filteredRules =
    activeCategory === 'all' ? rules : rules.filter((r) => r.category === activeCategory);

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
            Brand Governance &amp; Invariant Rules Engine
          </h2>
          <p className="text-sm text-slate-400">
            Manage custom Brand Profiles, lexical boundaries, tone curves, and trademark rules applied to every audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {user && !schemaError && (
            <button
              type="button"
              onClick={openCreateProfile}
              className="px-4 py-2 text-xs font-semibold text-violet-200 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-violet-500/30 flex items-center gap-2"
            >
              <Building2 className="w-4 h-4 text-violet-300" />
              <span>New Brand Profile</span>
            </button>
          )}
          <button
            onClick={() => setNewRuleModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Define New Brand Rule</span>
          </button>
        </div>
      </div>

      {/* Custom Brand Profiles Workspace (Supabase) */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-violet-400" />
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Saved Brand Profiles
              </h3>
              <p className="text-xs text-slate-400">
                Select an active Brand Profile to inject approved/restricted vocabulary and brand voice into AI audits.
              </p>
            </div>
          </div>

          {user && !schemaError && (
            <button
              type="button"
              onClick={openCreateProfile}
              className="text-xs font-medium text-violet-300 hover:text-white px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/30 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Profile</span>
            </button>
          )}
        </div>

        {!user ? (
          <div className="bg-[#0b1020] rounded-xl p-5 border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Sign in to create and persist custom Brand Profiles
              </p>
              <p className="text-xs text-slate-400">
                Using default BrandGuard AI™ enterprise rules in preview mode. Authenticate to save multi-brand guidelines per account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuthModal('signin')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg border border-white/20 flex items-center gap-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Sync Profiles</span>
            </button>
          </div>
        ) : schemaError ? (
          <div className="bg-amber-950/30 rounded-xl p-4 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
            <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Supabase Database Schema Setup Required</p>
              <p className="text-amber-200/80">{schemaError}</p>
            </div>
          </div>
        ) : brandProfilesLoading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            <span>Loading Brand Profiles from Supabase...</span>
          </div>
        ) : brandProfiles.length === 0 ? (
          <div className="bg-[#0b1020] rounded-xl p-6 border border-dashed border-white/15 text-center space-y-3">
            <p className="text-sm font-medium text-slate-200">No saved Brand Profiles yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Create your first Brand Profile with industry context, brand voice, approved terminology, and restricted words.
            </p>
            <button
              type="button"
              onClick={openCreateProfile}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg border border-white/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Brand Profile</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brandProfiles.map((bp) => {
              const isActive = bp.id === activeBrandProfileId;
              const isConfirming = confirmDeleteId === bp.id;

              return (
                <div
                  key={bp.id}
                  onClick={() => setActiveBrandProfileId(isActive ? null : bp.id)}
                  className={`rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'bg-violet-950/35 border-violet-500/60 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                      : 'bg-[#0b1020] border-white/10 hover:border-violet-500/35'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {bp.brand_name}
                        </h4>
                        <span className="text-[11px] font-mono text-violet-300">
                          {bp.industry}
                        </span>
                      </div>

                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {bp.brand_voice}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] font-mono pt-1">
                      <span className="text-emerald-400">
                        {(bp.approved_words || []).length} approved
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-red-400">
                        {(bp.restricted_words || []).length} restricted
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveBrandProfileId(isActive ? null : bp.id)}
                      className={`font-medium ${
                        isActive ? 'text-violet-300' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isActive ? 'Active in Studio' : 'Set Active'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditProfile(bp)}
                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/5"
                        title="Edit Brand Profile"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(bp.id)}
                            className="px-2 py-0.5 rounded bg-red-600 text-white font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(bp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10"
                          title="Delete Brand Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tone & Voice Precision Calibration */}
      <div className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-violet-400" />
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Brand Voice &amp; Lexical Tone Target Calibration
              </h3>
              {activeBrandProfile && (
                <p className="text-[11px] font-mono text-violet-300">
                  Linked to active profile: {activeBrandProfile.brand_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSaveTone}
            disabled={savingToneToCloud}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md transition-all disabled:opacity-50"
          >
            {savingToneToCloud ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedNotification ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {savingToneToCloud
                ? 'Saving...'
                : savedNotification
                ? 'Calibrations Saved'
                : activeBrandProfile
                ? 'Save to Active Profile'
                : 'Commit Baseline'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Formality Slider */}
          <div className="bg-[#0b1020] p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Formality Index</span>
              <span className="font-mono text-violet-400 font-bold">
                {toneSettings.formality}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={toneSettings.formality}
              onChange={(e) =>
                onToneSettingsChange({ ...toneSettings, formality: Number(e.target.value) })
              }
              className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Conversational</span>
              <span>Rigorous Enterprise</span>
            </div>
          </div>

          {/* Authoritative Slider */}
          <div className="bg-[#0b1020] p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Authoritative Weight</span>
              <span className="font-mono text-blue-400 font-bold">
                {toneSettings.authoritative}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={toneSettings.authoritative}
              onChange={(e) =>
                onToneSettingsChange({ ...toneSettings, authoritative: Number(e.target.value) })
              }
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Humble &amp; Soft</span>
              <span>Dominant Market Leader</span>
            </div>
          </div>

          {/* Technicality Slider */}
          <div className="bg-[#0b1020] p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Technical Depth</span>
              <span className="font-mono text-emerald-400 font-bold">
                {toneSettings.technical}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={toneSettings.technical}
              onChange={(e) =>
                onToneSettingsChange({ ...toneSettings, technical: Number(e.target.value) })
              }
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
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0b1020] rounded-xl border border-white/10 text-xs">
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
              Tone &amp; Vocabulary
            </button>
            <button
              onClick={() => setActiveCategory('legal')}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                activeCategory === 'legal'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Legal &amp; Disclaimers
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
            {rules.filter((r) => r.isActive).length} of {rules.length} Policies Active
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
                      <h4 className="text-sm font-semibold text-white">{rule.name}</h4>
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

                <p className="text-xs text-slate-300 leading-relaxed mb-3">{rule.description}</p>

                <div className="bg-[#0b1020] rounded-lg p-2.5 border border-white/5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-400 gap-2">
                    <span className="shrink-0">Forbidden Term / Pattern:</span>
                    <span className="text-red-400 font-semibold truncate">
                      &quot;{rule.patternOrTerm}&quot;
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-white/5 gap-2">
                    <span className="shrink-0">Approved Corporate Equivalent:</span>
                    <span className="text-emerald-400 font-semibold truncate">
                      &quot;{rule.recommendedFix}&quot;
                    </span>
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

      {/* Create / Edit Brand Profile Modal */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setProfileModalOpen(false)}
        >
          <div
            className="w-full max-w-xl glass-panel-elevated rounded-2xl p-6 border border-violet-500/40 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  {editingProfileId ? 'Edit Brand Profile' : 'Create Brand Profile'}
                </h3>
                <p className="text-xs text-slate-400">
                  Stored privately in Supabase with Row-Level Security for your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bpError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs">
                {bpError}
              </div>
            )}

            <form onSubmit={handleSaveBrandProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Brand Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={bpName}
                    onChange={(e) => setBpName(e.target.value)}
                    placeholder="e.g. Acme Cloud Security"
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Industry</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={bpIndustry}
                    onChange={(e) => setBpIndustry(e.target.value)}
                    placeholder="e.g. Cybersecurity SaaS"
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Brand Voice</label>
                <textarea
                  rows={2}
                  maxLength={1500}
                  value={bpVoice}
                  onChange={(e) => setBpVoice(e.target.value)}
                  placeholder="Describe voice attributes, cadence, and executive positioning..."
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Approved Preferred Words (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    value={bpApprovedRaw}
                    onChange={(e) => setBpApprovedRaw(e.target.value)}
                    placeholder="deterministic, verified, enterprise-grade"
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-emerald-200 font-mono focus:border-violet-500 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Restricted / Forbidden Words (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    value={bpRestrictedRaw}
                    onChange={(e) => setBpRestrictedRaw(e.target.value)}
                    placeholder="cheap, magic, 100% guaranteed"
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-red-200 font-mono focus:border-violet-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-[#0b1020] p-3 rounded-xl border border-white/10">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Formality</span>
                    <span className="font-mono text-violet-300">{bpFormality}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bpFormality}
                    onChange={(e) => setBpFormality(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Authority</span>
                    <span className="font-mono text-blue-300">{bpAuthoritative}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bpAuthoritative}
                    onChange={(e) => setBpAuthoritative(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Technical</span>
                    <span className="font-mono text-emerald-300">{bpTechnical}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bpTechnical}
                    onChange={(e) => setBpTechnical(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Additional Tone / Legal Directives (Optional)
                </label>
                <input
                  type="text"
                  maxLength={1000}
                  value={bpGuidelines}
                  onChange={(e) => setBpGuidelines(e.target.value)}
                  placeholder="e.g. Always cite SOC2 Type II compliance when referencing security."
                  className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bpSaving}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {bpSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProfileId ? 'Update Brand Profile' : 'Save Brand Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Define Rule Modal */}
      {newRuleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setNewRuleModal(false)}
        >
          <div
            className="w-full max-w-lg glass-panel-elevated rounded-2xl p-6 border border-violet-500/40 relative"
            onClick={(e) => e.stopPropagation()}
          >
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
                    onChange={(e) => setNewCategory(e.target.value as BrandRule['category'])}
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                  >
                    <option value="forbidden_terms">Forbidden Terms</option>
                    <option value="trademark">Trademark Syntax</option>
                    <option value="tone">Tone &amp; Cadence</option>
                    <option value="legal">Legal &amp; Disclaimers</option>
                    <option value="embargo">Embargo Shield</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as SeverityLevel)}
                    className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 outline-none"
                  >
                    <option value="warning">Warning / Drift</option>
                    <option value="critical">Critical / Zero-Tolerance</option>
                    <option value="nominal">Nominal Advisory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Forbidden Snippet or Term
                </label>
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
                <label className="block text-slate-300 mb-1 font-medium">
                  Approved Corporate Replacement
                </label>
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
