import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  FileCheck2,
  Search,
  MessageSquare,
  Send,
  RefreshCw,
  LogIn,
  Database,
  AlertCircle,
  Film,
  FileText,
  ShieldAlert,
  PlayCircle,
  Plus,
  History,
} from 'lucide-react';
import { useSupabase } from '../contexts/SupabaseContext';
import type { AuthModalMode } from './AuthModal';
import type {
  ContentSubmissionRecord,
  SubmissionContentType,
  SubmissionStatus,
} from '../types/brandguard';

interface ReviewWorkflowViewProps {
  onOpenAuthModal: (mode: AuthModalMode) => void;
  onToast?: (msg: string) => void;
}

type FilterBucket = 'all' | 'pending_queue' | 'approved' | 'revision_required' | 'rejected' | 'draft';

function getStatusBadge(status: SubmissionStatus): { label: string; className: string } {
  switch (status) {
    case 'draft':
      return {
        label: 'DRAFT',
        className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      };
    case 'submitted':
      return {
        label: 'SUBMITTED',
        className: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
      };
    case 'pending':
      return {
        label: 'PENDING REVIEW',
        className: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
      };
    case 'approved':
      return {
        label: 'APPROVED',
        className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      };
    case 'revision_required':
      return {
        label: 'REVISION REQUIRED',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      };
    case 'rejected':
      return {
        label: 'REJECTED',
        className: 'bg-red-500/15 text-red-300 border-red-500/35',
      };
  }
}

function getContentTypeLabel(t: SubmissionContentType): string {
  switch (t) {
    case 'video_audit':
      return 'VIDEO AUDIT';
    case 'compliance_report':
      return 'COMPLIANCE REPORT';
    default:
      return 'TEXT AUDIT';
  }
}

export const ReviewWorkflowView: React.FC<ReviewWorkflowViewProps> = ({
  onOpenAuthModal,
  onToast,
}) => {
  const { user, accessToken, brandProfiles, activeBrandProfileId } = useSupabase();

  const [submissions, setSubmissions] = useState<ContentSubmissionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterBucket, setFilterBucket] = useState<FilterBucket>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | SubmissionContentType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reviewComments, setReviewComments] = useState<string>('');
  const [isActing, setIsActing] = useState<boolean>(false);
  const [contentViewTab, setContentViewTab] = useState<'original' | 'corrected'>('original');
  const [resubmitDraftText, setResubmitDraftText] = useState<string>('');

  // Quick manual submission modal state
  const [newSubOpen, setNewSubOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<SubmissionContentType>('compliance_report');
  const [newChannel, setNewChannel] = useState<string>('marketing');
  const [newContent, setNewContent] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [isCreatingSub, setIsCreatingSub] = useState<boolean>(false);

  const fetchSubmissions = useCallback(async () => {
    if (!user || !accessToken) {
      setSubmissions([]);
      setSelectedId(null);
      setSchemaError(null);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/submissions', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (json?.code === 'SCHEMA_NOT_INITIALIZED') {
        setSchemaError(json.error);
        setSubmissions([]);
        return;
      }
      if (!res.ok) {
        setLoadError(json.error || 'Could not fetch review workflow submissions.');
        return;
      }

      setSchemaError(null);
      const list = (json.submissions || []) as ContentSubmissionRecord[];
      setSubmissions(list);
      setSelectedId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id || null));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load workflow queue.');
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      pending_queue: submissions.filter((s) => s.status === 'submitted' || s.status === 'pending').length,
      approved: submissions.filter((s) => s.status === 'approved').length,
      revision_required: submissions.filter((s) => s.status === 'revision_required').length,
      rejected: submissions.filter((s) => s.status === 'rejected').length,
      draft: submissions.filter((s) => s.status === 'draft').length,
    };
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((s) => {
      const matchesBucket =
        filterBucket === 'all'
          ? true
          : filterBucket === 'pending_queue'
          ? s.status === 'submitted' || s.status === 'pending'
          : s.status === filterBucket;

      const matchesType = contentTypeFilter === 'all' || s.content_type === contentTypeFilter;
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.original_content.toLowerCase().includes(q) ||
        (s.channel || '').toLowerCase().includes(q) ||
        s.submitter_name.toLowerCase().includes(q);

      return matchesBucket && matchesType && matchesSearch;
    });
  }, [submissions, filterBucket, contentTypeFilter, searchQuery]);

  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.id === selectedId) || null,
    [submissions, selectedId]
  );

  useEffect(() => {
    if (selectedSubmission) {
      setResubmitDraftText(selectedSubmission.corrected_content || selectedSubmission.original_content || '');
      setReviewComments('');
      setContentViewTab(selectedSubmission.corrected_content ? 'corrected' : 'original');
    }
  }, [selectedSubmission?.id]);

  const handleReviewDecision = async (
    decision: 'submitted' | 'pending' | 'approved' | 'rejected' | 'revision_required'
  ) => {
    if (!selectedSubmission || !accessToken) return;
    if ((decision === 'rejected' || decision === 'revision_required') && !reviewComments.trim()) {
      onToast?.('Please enter reviewer comments before rejecting or requesting revision.');
      return;
    }

    setIsActing(true);
    try {
      const res = await fetch(`/api/submissions/${selectedSubmission.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          decision,
          comments: reviewComments.trim(),
          ...(decision === 'submitted' && resubmitDraftText.trim()
            ? { original_content: resubmitDraftText.trim() }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast?.(json.error || 'Could not update workflow status.');
        return;
      }

      const updated = json.submission as ContentSubmissionRecord;
      setSubmissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setReviewComments('');
      onToast?.(`Submission marked as ${decision.replace('_', ' ').toUpperCase()}`);
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Review update failed.');
    } finally {
      setIsActing(false);
    }
  };

  const handleCreateManualSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newTitle.trim() || !newContent.trim()) return;
    setIsCreatingSub(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          content_type: newType,
          brand_profile_id: activeBrandProfileId,
          channel: newChannel,
          original_content: newContent.trim(),
          comments: newNotes.trim() || 'Submitted directly via Review Workflow.',
          status: 'submitted',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast?.(json.error || 'Failed to create submission.');
        return;
      }

      const created = json.submission as ContentSubmissionRecord;
      setSubmissions((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setNewSubOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewNotes('');
      onToast?.('Compliance submission added to review queue');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Could not create submission.');
    } finally {
      setIsCreatingSub(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" />
            Content Review &amp; Approval Workflow · Owner MVP Review Mode (Supabase RLS)
          </span>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight mt-1">
            Compliance Approval Queue &amp; Revision Audit Trail
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Track submitted text audits, VideoGuard AI reports, and compliance drafts through review, revision requests, and final sign-off.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user && (
            <>
              <button
                type="button"
                onClick={fetchSubmissions}
                disabled={isLoading}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-violet-300 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => setNewSubOpen((o) => !o)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg border border-white/20 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Submission</span>
              </button>
            </>
          )}
        </div>
      </div>

      {!user ? (
        <div className="glass-panel rounded-2xl p-8 text-center space-y-4 border border-violet-500/25">
          <LogIn className="w-9 h-9 text-violet-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold text-white">
              Sign In to Access Content Review Workflow
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Submissions and approval decisions are protected by Supabase Row Level Security (`content_submissions` &amp; `submission_reviews`). Sign in to submit audits and manage approvals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuthModal('signin')}
            className="px-5 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Create Account</span>
          </button>
        </div>
      ) : (
        <>
          {schemaError && (
            <div className="bg-amber-950/30 rounded-xl p-4 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
              <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Workflow Tables Not Initialized</p>
                <p className="text-amber-200/85">{schemaError}</p>
              </div>
            </div>
          )}

          {loadError && (
            <div className="bg-red-950/40 rounded-xl p-4 border border-red-500/40 flex items-center justify-between gap-3 text-xs text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={fetchSubmissions}
                className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-white"
              >
                Retry
              </button>
            </div>
          )}

          {/* Optional New Submission Drawer */}
          {newSubOpen && (
            <form
              onSubmit={handleCreateManualSubmission}
              className="glass-panel rounded-2xl p-5 space-y-4 border border-violet-500/35"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-white">
                  Submit Compliance Report or Draft for Review
                </h3>
                <button
                  type="button"
                  onClick={() => setNewSubOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Submission Title"
                  className="bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as SubmissionContentType)}
                  className="bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                >
                  <option value="compliance_report">Compliance Report</option>
                  <option value="text_audit">Text Audit</option>
                  <option value="video_audit">Video Audit</option>
                </select>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  className="bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                >
                  <option value="marketing">Marketing</option>
                  <option value="press">Press Wire</option>
                  <option value="social">Social Media</option>
                  <option value="landing_page">Landing Page</option>
                  <option value="video">Video Campaign</option>
                </select>
              </div>

              <textarea
                required
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Paste content, compliance summary, or asset details..."
                className="w-full bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional submission note..."
                  className="flex-1 min-w-[220px] bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingSub}
                  className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isCreatingSub ? 'Submitting...' : 'Submit to Queue'}</span>
                </button>
              </div>
            </form>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel rounded-xl p-4 border border-violet-500/20">
              <span className="text-[11px] font-mono uppercase text-slate-400">Pending Reviews</span>
              <div className="text-2xl font-display font-bold text-violet-300 mt-1 tabular-nums">
                {counts.pending_queue}
              </div>
            </div>
            <div className="glass-panel rounded-xl p-4 border border-emerald-500/20">
              <span className="text-[11px] font-mono uppercase text-slate-400">Approved Content</span>
              <div className="text-2xl font-display font-bold text-emerald-400 mt-1 tabular-nums">
                {counts.approved}
              </div>
            </div>
            <div className="glass-panel rounded-xl p-4 border border-amber-500/20">
              <span className="text-[11px] font-mono uppercase text-slate-400">Revision Required</span>
              <div className="text-2xl font-display font-bold text-amber-400 mt-1 tabular-nums">
                {counts.revision_required}
              </div>
            </div>
            <div className="glass-panel rounded-xl p-4 border border-red-500/20">
              <span className="text-[11px] font-mono uppercase text-slate-400">Rejected Content</span>
              <div className="text-2xl font-display font-bold text-red-400 mt-1 tabular-nums">
                {counts.rejected}
              </div>
            </div>
          </div>

          {/* Filter Tabs + Search */}
          <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: `All (${counts.all})` },
                  { id: 'pending_queue', label: `Pending Reviews (${counts.pending_queue})` },
                  { id: 'approved', label: `Approved (${counts.approved})` },
                  { id: 'revision_required', label: `Revision Required (${counts.revision_required})` },
                  { id: 'rejected', label: `Rejected (${counts.rejected})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterBucket(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                    filterBucket === tab.id
                      ? 'bg-violet-600 text-white border-violet-400'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={contentTypeFilter}
                onChange={(e) => setContentTypeFilter(e.target.value as 'all' | SubmissionContentType)}
                className="bg-[#080d1d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="text_audit">Text Audits</option>
                <option value="video_audit">Video Audits</option>
                <option value="compliance_report">Compliance Reports</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search queue..."
                  className="bg-[#080d1d] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Main Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Queue List */}
            <div className="lg:col-span-5 space-y-3">
              {filteredSubmissions.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-xs text-slate-400 font-mono">
                  No submissions match this filter. Submit an audit from Audit Studio or VideoGuard AI to start reviewing.
                </div>
              ) : (
                filteredSubmissions.map((sub) => {
                  const badge = getStatusBadge(sub.status);
                  const isSelected = sub.id === selectedSubmission?.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedId(sub.id)}
                      className={`w-full text-left glass-panel rounded-xl p-4 transition-all border space-y-2 ${
                        isSelected
                          ? 'border-violet-500 bg-violet-600/10 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {sub.content_type === 'video_audit' ? (
                            <Film className="w-4 h-4 text-cyan-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-white truncate">
                            {sub.title}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 font-mono">
                        {sub.original_content}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1">
                        <span>
                          {getContentTypeLabel(sub.content_type)}
                          {sub.audit_score !== null ? ` · ${sub.audit_score}%` : ''}
                        </span>
                        <span>{new Date(sub.submitted_at).toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected Submission Detail & Decision Controls */}
            <div className="lg:col-span-7">
              {!selectedSubmission ? (
                <div className="glass-panel rounded-2xl p-10 text-center text-xs text-slate-400 font-mono">
                  Select a submission from the queue to inspect content, violations, and review history.
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-6 space-y-5 border border-white/10">
                  {/* Top Title & Stage Progress */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/10">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                        <span className="text-violet-300">
                          {getContentTypeLabel(selectedSubmission.content_type)}
                        </span>
                        {selectedSubmission.brand_profiles?.brand_name && (
                          <>
                            <span>·</span>
                            <span>{selectedSubmission.brand_profiles.brand_name}</span>
                          </>
                        )}
                        {selectedSubmission.channel && (
                          <>
                            <span>·</span>
                            <span>{selectedSubmission.channel.toUpperCase()}</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-xl font-bold text-white mt-1">
                        {selectedSubmission.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        Submitted by {selectedSubmission.submitter_name || selectedSubmission.submitter_email} ·{' '}
                        {new Date(selectedSubmission.submitted_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedSubmission.audit_score !== null && (
                        <span className="px-2.5 py-1 rounded-lg bg-[#080d1d] border border-white/10 font-mono text-xs text-white">
                          Score: {selectedSubmission.audit_score}%
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                          getStatusBadge(selectedSubmission.status).className
                        }`}
                      >
                        {getStatusBadge(selectedSubmission.status).label}
                      </span>
                    </div>
                  </div>

                  {/* Stage Progress Indicator */}
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-mono text-center">
                    {[
                      { key: 'draft', label: '1. Draft', active: true },
                      {
                        key: 'submitted',
                        label: '2. Submitted',
                        active: selectedSubmission.status !== 'draft',
                      },
                      {
                        key: 'pending',
                        label: '3. In Review',
                        active: ['pending', 'approved', 'rejected', 'revision_required'].includes(
                          selectedSubmission.status
                        ),
                      },
                      {
                        key: 'decision',
                        label:
                          selectedSubmission.status === 'approved'
                            ? '4. Approved'
                            : selectedSubmission.status === 'rejected'
                            ? '4. Rejected'
                            : selectedSubmission.status === 'revision_required'
                            ? '4. Revision Req.'
                            : '4. Decision',
                        active: ['approved', 'rejected', 'revision_required'].includes(
                          selectedSubmission.status
                        ),
                      },
                    ].map((step) => (
                      <div
                        key={step.key}
                        className={`py-1.5 px-2 rounded-lg border ${
                          step.active
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                            : 'bg-[#080d1d] border-white/10 text-slate-500'
                        }`}
                      >
                        {step.label}
                      </div>
                    ))}
                  </div>

                  {/* Video Reference Card if applicable */}
                  {selectedSubmission.video_reference && (
                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <Film className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-white">
                            {selectedSubmission.video_reference.fileName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {selectedSubmission.video_reference.durationSeconds
                              ? `${selectedSubmission.video_reference.durationSeconds}s`
                              : 'MP4 Video'}
                            {selectedSubmission.video_reference.storagePath
                              ? ` · Storage: ${selectedSubmission.video_reference.storageBucket}/${selectedSubmission.video_reference.storagePath}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Original vs Corrected Content */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setContentViewTab('original')}
                        className={`px-3 py-1 rounded-md text-xs font-medium ${
                          contentViewTab === 'original'
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        Original Submission
                      </button>
                      {selectedSubmission.corrected_content && (
                        <button
                          type="button"
                          onClick={() => setContentViewTab('corrected')}
                          className={`px-3 py-1 rounded-md text-xs font-medium ${
                            contentViewTab === 'corrected'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          AI Corrected Version
                        </button>
                      )}
                    </div>

                    {selectedSubmission.status === 'revision_required' ? (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono text-amber-300 block">
                          Edit Revised Content Before Resubmitting:
                        </span>
                        <textarea
                          rows={6}
                          value={resubmitDraftText}
                          onChange={(e) => setResubmitDraftText(e.target.value)}
                          className="w-full bg-[#080d1d] border border-amber-500/35 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    ) : (
                      <pre className="p-3.5 rounded-xl bg-[#080d1d] border border-white/10 text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto">
                        {contentViewTab === 'corrected' && selectedSubmission.corrected_content
                          ? selectedSubmission.corrected_content
                          : selectedSubmission.original_content}
                      </pre>
                    )}
                  </div>

                  {/* Violations Snapshot */}
                  {Array.isArray(selectedSubmission.violations) &&
                    selectedSubmission.violations.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          Attached Compliance Violations ({selectedSubmission.violations.length})
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {selectedSubmission.violations.map((v, idx) => {
                            const rec = v as unknown as Record<string, unknown>;
                            const label = String(rec.title || rec.ruleName || 'Violation');
                            const detail = String(
                              rec.explanation || rec.issue || rec.violatingContent || rec.snippet || ''
                            );
                            const ts = rec.timestamp ? `[${String(rec.timestamp)}] ` : '';
                            return (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-[#080d1d] border border-white/10 text-xs"
                              >
                                <span className="font-semibold text-amber-300">
                                  {ts}
                                  {label}:{' '}
                                </span>
                                <span className="text-slate-300">{detail}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Review Actions */}
                  {selectedSubmission.status !== 'approved' &&
                    selectedSubmission.status !== 'rejected' && (
                      <div className="p-4 rounded-xl bg-[#080d1d]/90 border border-violet-500/25 space-y-3">
                        <label className="text-xs font-mono uppercase text-slate-300 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                          Reviewer Comments (Required for Reject or Revision Required)
                        </label>
                        <textarea
                          rows={2}
                          value={reviewComments}
                          onChange={(e) => setReviewComments(e.target.value)}
                          placeholder="Add review feedback, legal notes, or revision instructions..."
                          className="w-full bg-[#0b1020] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          {selectedSubmission.status === 'draft' && (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleReviewDecision('submitted')}
                              className="px-3.5 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit for Review</span>
                            </button>
                          )}

                          {selectedSubmission.status === 'submitted' && (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleReviewDecision('pending')}
                              className="px-3.5 py-2 rounded-lg bg-violet-600/25 hover:bg-violet-600/40 text-violet-200 border border-violet-500/35 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Start Review (Pending)</span>
                            </button>
                          )}

                          {selectedSubmission.status === 'revision_required' && (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleReviewDecision('submitted')}
                              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Resubmit Revised Draft</span>
                            </button>
                          )}

                          {(selectedSubmission.status === 'submitted' ||
                            selectedSubmission.status === 'pending' ||
                            selectedSubmission.status === 'revision_required') && (
                            <>
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleReviewDecision('approved')}
                                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleReviewDecision('revision_required')}
                                className="px-3.5 py-2 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 text-amber-200 border border-amber-500/35 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Request Revision</span>
                              </button>

                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleReviewDecision('rejected')}
                                className="px-3.5 py-2 rounded-lg bg-red-600/25 hover:bg-red-600/40 text-red-200 border border-red-500/35 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Review History Timeline */}
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-violet-400" />
                      Review &amp; Revision History ({selectedSubmission.reviews?.length || 0})
                    </span>

                    {!selectedSubmission.reviews || selectedSubmission.reviews.length === 0 ? (
                      <p className="text-xs text-slate-500 font-mono">No review actions recorded yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {selectedSubmission.reviews.map((rev) => {
                          const b = getStatusBadge(rev.decision);
                          return (
                            <div
                              key={rev.id}
                              className="p-3 rounded-xl bg-[#080d1d] border border-white/10 text-xs space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${b.className}`}>
                                    {b.label}
                                  </span>
                                  <span className="font-semibold text-slate-200">
                                    {rev.reviewer_name || rev.reviewer_email}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(rev.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-300">{rev.comments}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
