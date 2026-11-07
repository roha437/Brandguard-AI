import React, { useState } from 'react';
import { 
  Download, 
  Search, 
  Filter, 
  FileCheck, 
  ArrowUpRight, 
  Clock, 
  Calendar, 
  Eye, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle 
} from 'lucide-react';
import { INITIAL_AUDIT_HISTORY } from '../data/mockData';
import { AuditHistoryRecord, ComplianceStatus, MarketingChannel } from '../types/brandguard';

interface AuditHistoryViewProps {
  onInspectRecord: (record: AuditHistoryRecord) => void;
}

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({ onInspectRecord }) => {
  const [records, setRecords] = useState<AuditHistoryRecord[]>(INITIAL_AUDIT_HISTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ComplianceStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | MarketingChannel>('all');

  const filtered = records.filter((rec) => {
    const matchesSearch = 
      rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || rec.channel === channelFilter;

    return matchesSearch && matchesStatus && matchesChannel;
  });

  const handleExportCSV = () => {
    const headers = ['Audit ID', 'Title', 'Channel', 'Author', 'Score', 'Status', 'Violations', 'Timestamp'];
    const rows = filtered.map(r => [
      r.id,
      `"${r.title.replace(/"/g, '""')}"`,
      r.channel,
      `"${r.author}"`,
      r.score,
      r.status,
      r.violationCount,
      r.timestamp
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `brandguard_audit_trail_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Immutable Audit Trail
          </span>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight mt-1">
            Enterprise Compliance Records & Telemetry Logs
          </h2>
          <p className="text-sm text-slate-400">
            Cryptographically sealed and timestamped audit history for regulatory, legal, and brand review.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20 flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-violet-300" />
          <span>Export Audit Log (CSV)</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Audit ID, campaign title, author..."
            className="w-full bg-[#0b1020] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
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
              onChange={(e) => setChannelFilter(e.target.value as any)}
              className="bg-[#0b1020] border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
            >
              <option value="all">All Channels</option>
              <option value="press">Press Wire</option>
              <option value="landing_page">Landing Page</option>
              <option value="social">Social Media</option>
              <option value="paid_ads">Paid PPC</option>
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
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Violations</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => {
                  const isCompliant = rec.status === 'compliant';
                  const isWarning = rec.status === 'warning';

                  return (
                    <tr 
                      key={rec.id}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => onInspectRecord(rec)}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-violet-300">
                        {rec.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white max-w-[260px] truncate">
                        {rec.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono uppercase text-slate-400 text-[11px]">
                        {rec.channel}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {rec.author}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] border ${
                          isCompliant
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isWarning
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
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
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectRecord(rec);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-violet-300 hover:text-white bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 rounded-md transition-colors"
                        >
                          Inspect Diff
                        </button>
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
