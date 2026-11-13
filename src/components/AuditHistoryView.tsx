import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Search,
  Filter,
  Clock,
  Trash2,
  RefreshCw,
  LogIn,
  Database,
  AlertCircle,
  Loader2,
  Building2,
  Send,
} from 'lucide-react';
import { INITIAL_AUDIT_HISTORY } from '../data/mockData';
import {
  AuditHistoryRecord,
  ComplianceStatus,
  MarketingChannel,
  RuleViolation,
} from '../types/brandguard';
import { useSupabase } from '../contexts/SupabaseContext';
import type { AuthModalMode } from './AuthModal';

interface AuditHistoryViewProps {
  onInspectRecord: (record: AuditHistoryRecord) => void;
  onOpenAuthModal: (mode: AuthModalMode) => void;
  onNavigateToReviewWorkflow?: () => void;
  onToast?: (msg: string) => void;
}

interface RawDbAuditRow {
  id: string;
  user_id: string;
  brand_profile_id: string | null;
  title: string;
  original_content: string;
  corrected_content: string | null;
  overall_score: number;
  status: ComplianceStatus;
  violations: RuleViolation[] | null;
  channel: string | null;
  created_at: string;
  brand_profiles?: { brand_name?: string } | null;
}

function formatDisplayTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return iso;
  }
}

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({
  onInspectRecord,
  onOpenAuthModal,
  onNavigateToReviewWorkflow,
  onToast,
}) => {
  const { user, accessToken, profile, brandProfiles, schemaError } = useSupabase();

  const [records, setRecords] = useState<AuditHistoryRecord[]>(INITIAL_AUDIT_HISTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ComplianceStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | MarketingChannel>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localSchemaError, setLocalSchemaError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const authorLabel =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email ||
    'Authenticated User';

  const fetchPersistedAudits = useCallback(async () => {
    if (!user || !accessToken) {
      setRecords(INITIAL_AUDIT_HISTORY);
      setLoadError(null);
      setLocalSchemaError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/audits', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (payload?.code === 'SCHEMA_NOT_INITIALIZED') {
        setLocalSchemaError(payload.error);
        setRecords([]);
        return;
      }

      if (!res.ok) {
        setLoadError(payload.error || 'Failed to load persisted audit history.');
        return;
      }

      setLocalSchemaError(null);
      const rows = (payload.audits || []) as RawDbAuditRow[];
      const mapped: AuditHistoryRecord[] = rows.map((row) => {
        const violationsList = Array.isArray(row.violations) ? row.violations : [];
        return {
          id: row.id,
          title: row.title || 'Brand Compliance Audit',
          channel: row.channel || 'marketing',
          author: authorLabel,
          score: row.overall_score,
          status: row.status,
          violationCount: violationsList.length,
          violations: violationsList,
          brandProfileId: row.brand_profile_id,
          brandName: row.brand_profiles?.brand_name || null,
          timestamp: formatDisplayTimestamp(row.created_at),
          content: row.original_content,
          remediatedText: row.corrected_content || row.original_content,
          isPersisted: true,
        };
      });

      setRecords(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to fetch audit history.');
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken, authorLabel]);

  useEffect(() => {
    fetchPersistedAudits();
  }, [fetchPersistedAudits]);

  const handleDeleteAudit = async (id: string) => {
    if (!accessToken) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/audits/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast?.(payload.error || 'Failed to delete audit record.');
        return;
      }

      setRecords((prev) => prev.filter((r) => r.id !== id));
      onToast?.('Audit record deleted from history');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleSubmitHistoryToWorkflow = async (rec: AuditHistoryRecord) => {
    if (!accessToken) {
      onOpenAuthModal('signin');
      return;
    }
    setSubmittingId(rec.id);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: rec.title,
          content_type: 'text_audit',
          audit_id: rec.isPersisted ? rec.id : null,
          brand_profile_id: rec.brandProfileId ?? null,
          channel: rec.channel,
          original_content: rec.content,
          corrected_content: rec.remediatedText,
          audit_score: Math.round(rec.score),
          violations: rec.violations || [],
          comments: `Submitted from Audit History (${rec.violationCount} violation(s)).`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast?.(json.error || 'Could not submit audit to Review Workflow.');
        return;
      }
      onToast?.('Submitted to Content Review Workflow');
      onNavigateToReviewWorkflow?.();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmittingId(null);
    }
  };

  const filtered = records.filter((rec) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      rec.title.toLowerCase().includes(q) ||
      rec.author.toLowerCase().includes(q) ||
      rec.id.toLowerCase().includes(q) ||
      rec.content.toLowerCase().includes(q) ||
      (rec.brandName || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || rec.channel === channelFilter;
    const matchesBrand =
      brandFilter === 'all' ||
      (brandFilter === 'none' ? !rec.brandProfileId : rec.brandProfileId === brandFilter);

    return matchesSearch && matchesStatus && matchesChannel && matchesBrand;
  });

  const handleExportCSV = () => {
    const headers = [
      'Audit ID',
      'Title',
      'Brand Profile',
      'Channel',
      'Author',
      'Score',
      'Status',
      'Violations',
      'Timestamp',
    ];
    const rows = filtered.map((r) => [
      r.id,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${(r.brandName || 'BrandGuard AI').replace(/"/g, '""')}"`,
      r.channel,
      `"${r.author.replace(/"/g, '""')}"`,
      r.score,
      r.status,
      r.violationCount,
      r.timestamp,
    ]);
    const csvString = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `brandguard_audit_trail_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const effectiveSchemaError = localSchemaError || (user ? schemaError : null);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {user ? 'Persistent Supabase Audit Trail' : 'Immutable Audit Trail (Preview Mode)'}
          </span>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight mt-1">
            Enterprise Compliance Records &amp; Telemetry Logs
          </h2>
          <p className="text-sm text-slate-400">
            Cryptographically sealed and timestamped audit history for regulatory, legal, and brand review.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {user && (
            <button
              type="button"
              onClick={fetchPersistedAudits}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-violet-300 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-violet-300" />
            <span>Export Audit Log (CSV)</span>
          </button>
        </div>
      </div>

      {/* Auth / Schema Notices */}
      {!user && (
        <div className="glass-panel rounded-xl p-4 border border-violet-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-300">
            <span className="font-semibold text-white">Preview Mode:</span> Showing sample demo audit
            logs. Sign in to load and persist your private workspace audits in Supabase.
          </div>
          <button
            type="button"
            onClick={() => onOpenAuthModal('signin')}
            className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        </div>
      )}

      {user && effectiveSchemaError && (
        <div className="bg-amber-950/30 rounded-xl p-4 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
          <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Database Tables Not Initialized</p>
            <p className="text-amber-200/85">{effectiveSchemaError}</p>
          </div>
        </div>
      )}

      {user && loadError && (
        <div className="bg-red-950/40 rounded-xl p-4 border border-red-500/40 flex items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={fetchPersistedAudits}
            className="px-3 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-white font-medium shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, campaign title, content, or brand profile..."
            className="w-full bg-[#0b1020] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user && brandProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-violet-400" />
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="bg-[#0b1020] border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs max-w-[150px]"
              >
                <option value="all">All Brands</option>
                <option value="none">Default Brand</option>
                {brandProfiles.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.brand_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ComplianceStatus)}
              className="bg-[#0b1020] border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
            >
              <option value="all">All States</option>
              <option value="compliant">Compliant</option>
              <option value="warning">Tone Drift</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Channel:</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as 'all' | MarketingChannel)}
              className="bg-[#0b1020] border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
            >
              <option value="all">All Channels</option>
              <option value="press">Press Wire</option>
              <option value="landing_page">Landing Page</option>
              <option value="social">Social Media</option>
              <option value="paid_ads">Paid PPC</option>
              <option value="email">Lifecycle Email</option>
              <option value="partner">Partner Portal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0e1323] border-b border-white/10 font-mono text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Audit ID</th>
                <th className="py-3 px-4">Campaign Document</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Brand / Author</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Violations</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span>Querying encrypted audit records...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    {user && !effectiveSchemaError
                      ? 'No saved audits match your current filters. Run an audit in Audit Studio to record it here.'
                      : 'No matching audit records found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => {
                  const isCompliant = rec.status === 'compliant';
                  const isWarning = rec.status === 'warning';
                  const shortId = rec.id.length > 12 ? `AUD-${rec.id.slice(0, 8).toUpperCase()}` : rec.id;
                  const isConfirmingDelete = confirmDeleteId === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => onInspectRecord(rec)}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-violet-300" title={rec.id}>
                        {shortId}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white max-w-[260px] truncate">
                        {rec.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono uppercase text-slate-400 text-[11px]">
                        {rec.channel}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-[180px] truncate">
                        {rec.brandName ? (
                          <span className="text-violet-200">{rec.brandName}</span>
                        ) : (
                          rec.author
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] border ${
                            isCompliant
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isWarning
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {rec.score}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-300">
                        {rec.violationCount > 0 ? (
                          <span className={rec.status === 'critical' ? 'text-red-400' : 'text-amber-400'}>
                            {rec.violationCount} flagged
                          </span>
                        ) : (
                          <span className="text-emerald-400">0 (Clean)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] tabular-nums">
                        {rec.timestamp}
                      </td>
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onInspectRecord(rec)}
                            className="px-2.5 py-1 text-[11px] font-medium text-violet-300 hover:text-white bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 rounded-md transition-colors"
                          >
                            Inspect Diff
                          </button>

                          {rec.isPersisted && (
                            <button
                              type="button"
                              disabled={submittingId === rec.id}
                              onClick={() => handleSubmitHistoryToWorkflow(rec)}
                              className="px-2.5 py-1 text-[11px] font-medium text-blue-200 hover:text-white bg-blue-600/25 hover:bg-blue-600/45 border border-blue-500/30 rounded-md transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                              title="Submit for Review"
                            >
                              <Send className="w-3 h-3" />
                              <span>{submittingId === rec.id ? '...' : 'Review'}</span>
                            </button>
                          )}

                          {rec.isPersisted && (
                            isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={deletingId === rec.id}
                                  onClick={() => handleDeleteAudit(rec.id)}
                                  className="px-2 py-1 text-[11px] font-medium bg-red-600 hover:bg-red-500 text-white rounded-md disabled:opacity-50"
                                >
                                  {deletingId === rec.id ? '...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(rec.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors"
                                title="Delete audit record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
