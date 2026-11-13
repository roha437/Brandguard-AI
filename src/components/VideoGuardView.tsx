import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  UploadCloud,
  Film,
  Eye,
  FileText,
  Mic,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Download,
  CloudUpload,
  CloudCheck,
  Send,
  Trash2,
  Clock,
  Building2,
  Loader2,
  LogIn,
  Database,
  Sparkles,
  ArrowRight,
  Captions,
} from 'lucide-react';
import { useSupabase } from '../contexts/SupabaseContext';
import type { AuthModalMode } from './AuthModal';
import type {
  CombinedVideoViolation,
  ModuleExecutionStatus,
  SavedVideoAuditRecord,
  VideoAuditReport,
  VideoViolationSeverity,
} from '../types/brandguard';

interface VideoGuardViewProps {
  onOpenAuthModal: (mode: AuthModalMode) => void;
  onNavigateToReviewWorkflow: () => void;
  onToast?: (msg: string) => void;
}

interface CapabilitiesResponse {
  ffmpegAvailable: boolean;
  geminiConfigured: boolean;
  maxFileSizeBytes: number;
  supportedFormats: string[];
  storageBucket: string;
}

type PipelineStageState = 'idle' | 'running' | 'completed' | 'partial' | 'unavailable' | 'failed';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSeverityBadgeClass(severity: VideoViolationSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/35';
    case 'high':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/35';
    case 'medium':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
    default:
      return 'bg-blue-500/15 text-blue-300 border-blue-500/35';
  }
}

function getModuleBadgeClass(status: ModuleExecutionStatus | PipelineStageState): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'running':
      return 'bg-violet-500/20 text-violet-200 border-violet-500/40 animate-pulse';
    case 'partial':
    case 'unavailable':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'failed':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-white/5 text-slate-400 border-white/10';
  }
}

export const VideoGuardView: React.FC<VideoGuardViewProps> = ({
  onOpenAuthModal,
  onNavigateToReviewWorkflow,
  onToast,
}) => {
  const {
    supabase,
    user,
    accessToken,
    brandProfiles,
    activeBrandProfileId,
    activeBrandProfile,
    setActiveBrandProfileId,
  } = useSupabase();

  const [capabilities, setCapabilities] = useState<CapabilitiesResponse>({
    ffmpegAvailable: true,
    geminiConfigured: true,
    maxFileSizeBytes: 75 * 1024 * 1024,
    supportedFormats: ['video/mp4'],
    storageBucket: 'videoguard-videos',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [sidecarCaptions, setSidecarCaptions] = useState<string>('');
  const [archiveToStorage, setArchiveToStorage] = useState<boolean>(false);
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [phase, setPhase] = useState<'idle' | 'uploading_storage' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [report, setReport] = useState<VideoAuditReport | null>(null);
  const [savedVideoAuditId, setSavedVideoAuditId] = useState<string | null>(null);
  const [isSavingAudit, setIsSavingAudit] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [submittedToWorkflow, setSubmittedToWorkflow] = useState<boolean>(false);

  const [activeModuleTab, setActiveModuleTab] = useState<'visual' | 'text' | 'audio'>('visual');
  const [violationModuleFilter, setViolationModuleFilter] = useState<'all' | 'visual' | 'text' | 'audio'>('all');
  const [activeTimestampSec, setActiveTimestampSec] = useState<number | null>(null);

  const [savedAudits, setSavedAudits] = useState<SavedVideoAuditRecord[]>([]);
  const [savedAuditsLoading, setSavedAuditsLoading] = useState<boolean>(false);
  const [savedSchemaError, setSavedSchemaError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    fetch('/api/video-audit/capabilities')
      .then((r) => r.json())
      .then((data: CapabilitiesResponse) => {
        if (data && typeof data.maxFileSizeBytes === 'number') {
          setCapabilities(data);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const fetchSavedVideoAudits = useCallback(async () => {
    if (!user || !accessToken) {
      setSavedAudits([]);
      setSavedSchemaError(null);
      return;
    }

    setSavedAuditsLoading(true);
    try {
      const res = await fetch('/api/video-audits', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (json?.code === 'SCHEMA_NOT_INITIALIZED') {
        setSavedSchemaError(json.error);
        setSavedAudits([]);
        return;
      }
      if (res.ok && Array.isArray(json.videoAudits)) {
        setSavedSchemaError(null);
        setSavedAudits(json.videoAudits as SavedVideoAuditRecord[]);
      }
    } catch {
      // keep silent in background list refresh
    } finally {
      setSavedAuditsLoading(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    fetchSavedVideoAudits();
  }, [fetchSavedVideoAudits]);

  const handleFileSelection = (file: File | null) => {
    if (!file) return;
    setErrorMessage(null);
    setStorageNote(null);

    const isMp4 =
      file.type === 'video/mp4' ||
      file.type === 'application/mp4' ||
      file.name.toLowerCase().endsWith('.mp4');

    if (!isMp4) {
      setErrorMessage('Unsupported file type. VideoGuard AI accepts MP4 (.mp4 / video/mp4) files.');
      return;
    }

    if (file.size > capabilities.maxFileSizeBytes) {
      setErrorMessage(
        `File size (${formatBytes(file.size)}) exceeds the ${formatBytes(capabilities.maxFileSizeBytes)} limit.`
      );
      return;
    }

    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setVideoPreviewUrl(objectUrl);
    setTitle((prev) => prev.trim() || file.name.replace(/\.mp4$/i, ''));
    setReport(null);
    setSavedVideoAuditId(null);
    setSubmittedToWorkflow(false);
    setPhase('idle');
    setUploadProgress(0);
  };

  const handleCancelAnalysis = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setPhase('idle');
    setUploadProgress(0);
    setErrorMessage('Video upload/analysis cancelled.');
  };

  const runVideoAudit = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an MP4 video file first.');
      return;
    }

    setErrorMessage(null);
    setStorageNote(null);
    setReport(null);
    setSavedVideoAuditId(null);
    setSubmittedToWorkflow(false);

    let storageBucket: string | null = null;
    let storagePath: string | null = null;

    // Optional Supabase Storage archiving when signed in and enabled
    if (archiveToStorage && user && supabase) {
      setPhase('uploading_storage');
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = `${user.id}/${Date.now()}-${safeName}`;
      try {
        const { error: uploadErr } = await supabase.storage
          .from(capabilities.storageBucket)
          .upload(targetPath, selectedFile, {
            contentType: 'video/mp4',
            upsert: false,
          });
        if (uploadErr) {
          setStorageNote(
            `Supabase Storage upload skipped (${uploadErr.message}). Running direct analysis pipeline instead.`
          );
        } else {
          storageBucket = capabilities.storageBucket;
          storagePath = targetPath;
          setStorageNote(`Archived MP4 to Supabase Storage (${storageBucket}/${storagePath}).`);
        }
      } catch (err) {
        setStorageNote(
          `Supabase Storage upload unavailable (${err instanceof Error ? err.message : 'unknown error'}). Continuing analysis.`
        );
      }
    }

    setPhase('uploading');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title.trim() || selectedFile.name.replace(/\.mp4$/i, ''));
    if (activeBrandProfileId) {
      formData.append('brandProfileId', activeBrandProfileId);
    }
    if (sidecarCaptions.trim()) {
      formData.append('sidecarCaptions', sidecarCaptions.trim());
    }
    if (storageBucket && storagePath) {
      formData.append('storageBucket', storageBucket);
      formData.append('storagePath', storagePath);
    }
    if (activeBrandProfile) {
      formData.append(
        'brandContext',
        JSON.stringify({
          brandName: activeBrandProfile.brand_name,
          industry: activeBrandProfile.industry,
          brandVoice: activeBrandProfile.brand_voice,
          approvedWords: activeBrandProfile.approved_words || [],
          restrictedWords: activeBrandProfile.restricted_words || [],
          toneRules: activeBrandProfile.tone_rules,
        })
      );
    }

    try {
      const parsedReport = await new Promise<VideoAuditReport>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', '/api/video-audit', true);
        if (accessToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        }

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(pct);
            if (pct >= 100) {
              setPhase('processing');
            }
          }
        };

        xhr.upload.onload = () => {
          setUploadProgress(100);
          setPhase('processing');
        };

        xhr.onload = () => {
          xhrRef.current = null;
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(xhr.responseText || '{}');
          } catch {
            // ignore
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(payload as unknown as VideoAuditReport);
          } else {
            reject(new Error((payload.error as string) || `Video audit failed (HTTP ${xhr.status}).`));
          }
        };

        xhr.onerror = () => {
          xhrRef.current = null;
          reject(new Error('Network error while uploading video to BrandGuard server.'));
        };

        xhr.onabort = () => {
          xhrRef.current = null;
          reject(new Error('ABORTED'));
        };

        xhr.send(formData);
      });

      setReport(parsedReport);
      setPhase('done');
      onToast?.(
        parsedReport.overallScore !== null
          ? `VideoGuard AI completed (${parsedReport.overallScore}% overall score)`
          : 'VideoGuard AI pipeline finished with module notices'
      );

      // Automatically persist if signed in
      if (user && accessToken) {
        await saveReportToSupabase(parsedReport, true);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'ABORTED') return;
      setPhase('error');
      setErrorMessage(err instanceof Error ? err.message : 'Video compliance audit failed.');
    }
  };

  const saveReportToSupabase = async (
    targetReport: VideoAuditReport,
    silent = false
  ): Promise<string | null> => {
    if (!user || !accessToken) {
      if (!silent) onOpenAuthModal('signin');
      return null;
    }

    setIsSavingAudit(true);
    try {
      const res = await fetch('/api/video-audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ report: targetReport }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.code === 'SCHEMA_NOT_INITIALIZED') {
        setSavedSchemaError(json.error);
        if (!silent) onToast?.('Run 002_videoguard_and_workflow.sql to save video audits.');
        return null;
      }
      if (!res.ok) {
        if (!silent) onToast?.(json.error || 'Could not save video audit.');
        return null;
      }

      const id = json.videoAudit?.id as string | undefined;
      if (id) {
        setSavedVideoAuditId(id);
        fetchSavedVideoAudits();
        if (!silent) onToast?.('Video audit saved to Supabase');
        return id;
      }
      return null;
    } catch (err) {
      if (!silent) onToast?.(err instanceof Error ? err.message : 'Save failed.');
      return null;
    } finally {
      setIsSavingAudit(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!report) return;
    if (!user || !accessToken) {
      onOpenAuthModal('signin');
      return;
    }

    setIsSubmittingReview(true);
    try {
      let videoAuditId = savedVideoAuditId;
      if (!videoAuditId) {
        videoAuditId = await saveReportToSupabase(report, true);
      }

      if (videoAuditId) {
        const res = await fetch(`/api/video-audits/${videoAuditId}/submit-review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: report.title,
            comments: `Submitted VideoGuard AI report (${report.totalViolations} timestamped findings).`,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          onToast?.(json.error || 'Could not submit video audit for review.');
          return;
        }
      } else {
        // Fallback direct submission if video_audits schema missing check fails cleanly
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: report.title,
            content_type: 'video_audit',
            brand_profile_id: report.brandProfileId,
            channel: 'video',
            original_content:
              [
                report.summary,
                report.audio.fullTranscript ? `Transcript:\n${report.audio.fullTranscript}` : '',
                report.text.extractedSubtitles ? `Subtitles:\n${report.text.extractedSubtitles}` : '',
              ]
                .filter(Boolean)
                .join('\n\n') || report.metadata.fileName,
            corrected_content:
              [report.audio.correctedNarration, report.text.correctedText]
                .filter(Boolean)
                .join('\n\n') || null,
            audit_score: report.overallScore,
            violations: report.combinedViolations,
            video_reference: {
              fileName: report.metadata.fileName,
              fileSizeBytes: report.metadata.fileSizeBytes,
              durationSeconds: report.metadata.durationSeconds,
              storageBucket: report.storageBucket,
              storagePath: report.storagePath,
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          onToast?.(json.error || 'Failed to submit for review.');
          return;
        }
      }

      setSubmittedToWorkflow(true);
      onToast?.('Video audit submitted to Review Workflow');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleExportReport = () => {
    if (!report) return;
    const exportPayload = {
      ...report,
      frames: report.frames.map(({ thumbnailDataUrl: _omit, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `videoguard-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast?.('Exported VideoGuard AI JSON report');
  };

  const handleLoadSavedAudit = async (item: SavedVideoAuditRecord) => {
    const payload = item.report_payload || {};
    const hydrated: VideoAuditReport = {
      id: item.id,
      title: item.title,
      brandProfileId: item.brand_profile_id,
      brandName: item.brand_profiles?.brand_name || payload.brandName || 'BrandGuard AI™',
      storageBucket: item.storage_bucket,
      storagePath: item.storage_path,
      metadata: payload.metadata || {
        fileName: item.file_name,
        fileSizeBytes: item.file_size_bytes,
        durationSeconds: Number(item.duration_seconds) || 0,
        width: null,
        height: null,
        hasVideoStream: true,
        hasAudioStream: item.audio_score !== null,
        embeddedSubtitlesFound: Boolean(item.extracted_subtitles),
        frameCount: 0,
        ffmpegAvailable: capabilities.ffmpegAvailable,
      },
      frames: [],
      visual: payload.visual || {
        status: item.module_statuses?.visual || 'completed',
        score: item.visual_score,
        summary: 'Loaded from saved Supabase video audit record.',
        logoVisibility: 'Saved snapshot',
        colorConsistency: 'Saved snapshot',
        findings: [],
      },
      text: payload.text || {
        status: item.module_statuses?.text || 'completed',
        score: item.text_score,
        summary: 'Loaded from saved Supabase video audit record.',
        ocrSamples: item.ocr_text || [],
        extractedSubtitles: item.extracted_subtitles || '',
        correctedText: '',
        violations: [],
      },
      audio: payload.audio || {
        status: item.module_statuses?.audio || 'unavailable',
        score: item.audio_score,
        summary: 'Loaded from saved Supabase video audit record.',
        speechDetected: Boolean(item.extracted_transcript),
        fullTranscript: item.extracted_transcript || '',
        transcriptSegments: [],
        correctedNarration: item.corrected_narration || '',
        violations: [],
      },
      overallScore: item.overall_score,
      severityCounts: payload.severityCounts || {
        critical: item.violations.filter((v) => v.severity === 'critical').length,
        high: item.violations.filter((v) => v.severity === 'high').length,
        medium: item.violations.filter((v) => v.severity === 'medium').length,
        low: item.violations.filter((v) => v.severity === 'low').length,
      },
      totalViolations: item.violations.length,
      combinedViolations: item.violations || [],
      summary: item.summary,
      status: item.status === 'processing' ? 'partial' : item.status,
      createdAt: item.created_at,
    };

    setReport(hydrated);
    setSavedVideoAuditId(item.id);
    setSubmittedToWorkflow(false);
    setPhase('done');

    // Attempt to create signed playback URL if archived in Supabase Storage
    if (supabase && item.storage_bucket && item.storage_path) {
      const { data } = await supabase.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 3600);
      if (data?.signedUrl) {
        setVideoPreviewUrl(data.signedUrl);
      } else {
        setVideoPreviewUrl(null);
      }
    } else {
      setVideoPreviewUrl(null);
    }

    onToast?.(`Loaded saved video audit: ${item.title}`);
  };

  const handleDeleteSavedAudit = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/video-audits/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setSavedAudits((prev) => prev.filter((a) => a.id !== id));
        if (savedVideoAuditId === id) {
          setSavedVideoAuditId(null);
        }
        onToast?.('Deleted saved video audit');
      }
    } catch {
      onToast?.('Failed to delete saved video audit.');
    }
  };

  const seekVideoTo = (seconds: number) => {
    setActiveTimestampSec(seconds);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, seconds);
      videoRef.current.play().catch(() => undefined);
    }
  };

  // Compute live pipeline node states for visual diagram
  const isRunningPipeline = phase === 'uploading' || phase === 'processing' || phase === 'uploading_storage';
  const uploadNodeState: PipelineStageState =
    phase === 'uploading' || phase === 'uploading_storage'
      ? 'running'
      : phase === 'processing' || phase === 'done'
      ? 'completed'
      : phase === 'error'
      ? 'failed'
      : selectedFile
      ? 'completed'
      : 'idle';

  const processingNodeState: PipelineStageState =
    phase === 'processing'
      ? 'running'
      : report
      ? 'completed'
      : phase === 'error'
      ? 'failed'
      : 'idle';

  const visualNodeState: PipelineStageState =
    phase === 'processing' ? 'running' : report ? report.visual.status : 'idle';
  const textNodeState: PipelineStageState =
    phase === 'processing' ? 'running' : report ? report.text.status : 'idle';
  const audioNodeState: PipelineStageState =
    phase === 'processing' ? 'running' : report ? report.audio.status : 'idle';
  const reportNodeState: PipelineStageState =
    phase === 'processing' ? 'running' : report ? report.status : phase === 'error' ? 'failed' : 'idle';

  const filteredCombinedViolations: CombinedVideoViolation[] = (report?.combinedViolations || []).filter(
    (v) => violationModuleFilter === 'all' || v.module === violationModuleFilter
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400 flex items-center gap-2">
            <Film className="w-4 h-4" />
            VideoGuard AI · Multimodal Compliance Engine
          </span>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight mt-1">
            Parallel Visual, Text &amp; Audio Video Governance
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Upload an MP4 campaign asset to extract frames, subtitles, and speech audio, then audit all three streams in parallel against your brand guidelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-[#080d1d] border border-white/10 font-mono text-slate-300 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                capabilities.ffmpegAvailable && capabilities.geminiConfigured
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <span>
              FFmpeg {capabilities.ffmpegAvailable ? 'Ready' : 'Missing'} · Gemini{' '}
              {capabilities.geminiConfigured ? 'Connected' : 'Unconfigured'}
            </span>
          </div>

          {user && brandProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#080d1d] border border-violet-500/30 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-violet-400" />
              <select
                value={activeBrandProfileId || ''}
                onChange={(e) => setActiveBrandProfileId(e.target.value || null)}
                className="bg-transparent text-violet-200 text-xs focus:outline-none font-mono max-w-[170px]"
              >
                <option value="" className="bg-[#0b1020]">
                  Default BrandGuard AI™
                </option>
                {brandProfiles.map((bp) => (
                  <option key={bp.id} value={bp.id} className="bg-[#0b1020]">
                    {bp.brand_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* VideoGuard AI Architecture Pipeline Visualizer */}
      <div className="glass-panel rounded-2xl p-5 border border-violet-500/20">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            VideoGuard AI Execution Pipeline
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Brand Target: {activeBrandProfile?.brand_name || 'BrandGuard AI™'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Stage 1: Upload */}
          <div className="lg:col-span-2 rounded-xl bg-[#080d1d]/90 border border-white/10 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 1</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getModuleBadgeClass(uploadNodeState)}`}>
                {uploadNodeState}
              </span>
            </div>
            <div className="mt-2">
              <UploadCloud className="w-4 h-4 text-blue-400 mb-1" />
              <p className="text-xs font-semibold text-white">User Uploads Video</p>
              <p className="text-[11px] text-slate-400 mt-0.5">MP4 container (&le; 75 MB)</p>
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 items-center justify-center text-slate-500">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 2: Processing */}
          <div className="lg:col-span-2 rounded-xl bg-[#080d1d]/90 border border-white/10 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 2</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getModuleBadgeClass(processingNodeState)}`}>
                {processingNodeState}
              </span>
            </div>
            <div className="mt-2">
              <Film className="w-4 h-4 text-violet-400 mb-1" />
              <p className="text-xs font-semibold text-white">Video Processing</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Extract frames, audio, subtitles &amp; timestamps
              </p>
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 items-center justify-center text-slate-500">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 3: 3 Parallel AI Modules */}
          <div className="lg:col-span-3 rounded-xl bg-[#080d1d]/90 border border-violet-500/25 p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase text-violet-300 flex items-center justify-between">
              <span>Step 3 · Parallel AI Modules</span>
              <span>3x Concurrent</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
                <span className="flex items-center gap-2 text-slate-200 font-medium">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Visual AI <span className="text-[10px] text-slate-400 font-normal">(logos, colours)</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getModuleBadgeClass(visualNodeState)}`}>
                  {report?.visual.score !== null && report?.visual.score !== undefined
                    ? `${report.visual.score}%`
                    : visualNodeState}
                </span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
                <span className="flex items-center gap-2 text-slate-200 font-medium">
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                  Text AI <span className="text-[10px] text-slate-400 font-normal">(OCR, subtitles)</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getModuleBadgeClass(textNodeState)}`}>
                  {report?.text.score !== null && report?.text.score !== undefined
                    ? `${report.text.score}%`
                    : textNodeState}
                </span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
                <span className="flex items-center gap-2 text-slate-200 font-medium">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  Audio AI <span className="text-[10px] text-slate-400 font-normal">(speech, tone)</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getModuleBadgeClass(audioNodeState)}`}>
                  {report?.audio.score !== null && report?.audio.score !== undefined
                    ? `${report.audio.score}%`
                    : audioNodeState}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 items-center justify-center text-slate-500">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 4: Combined Report */}
          <div className="lg:col-span-2 rounded-xl bg-[#080d1d]/90 border border-white/10 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-slate-400">Step 4</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getModuleBadgeClass(reportNodeState)}`}>
                {report?.overallScore !== null && report?.overallScore !== undefined
                  ? `${report.overallScore}%`
                  : reportNodeState}
              </span>
            </div>
            <div className="mt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
              <p className="text-xs font-semibold text-white">Combined Compliance Report</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Score, violations, timestamps &amp; corrections
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Upload & Player on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload Controls + Video Player */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Video className="w-4 h-4 text-violet-400" />
                MP4 Video Ingestion
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Max {formatBytes(capabilities.maxFileSizeBytes)}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                Campaign / Video Audit Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q4 Enterprise Launch Spot (30s)"
                className="w-full bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Drag-and-drop Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0] || null;
                handleFileSelection(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-violet-400 bg-violet-500/10'
                  : 'border-white/15 bg-[#080d1d]/70 hover:border-violet-500/50 hover:bg-white/[0.02]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,.mp4"
                className="hidden"
                onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
              />
              <UploadCloud className="w-8 h-8 text-violet-400 mx-auto mb-2" />
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white truncate">{selectedFile.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {formatBytes(selectedFile.size)} · Click or drop another MP4 to replace
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-200">
                    Drag &amp; drop an MP4 file here, or click to browse
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports `.mp4` / `video/mp4` up to {formatBytes(capabilities.maxFileSizeBytes)}
                  </p>
                </div>
              )}
            </div>

            {/* Optional sidecar captions */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                  <Captions className="w-3.5 h-3.5 text-blue-400" />
                  Optional Sidecar Subtitles / Captions (.srt / .vtt / text)
                </label>
              </div>
              <textarea
                value={sidecarCaptions}
                onChange={(e) => setSidecarCaptions(e.target.value)}
                rows={3}
                placeholder="Paste SRT/VTT captions if your MP4 does not include an embedded subtitle track (optional)..."
                className="w-full bg-[#080d1d] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-y"
              />
            </div>

            {user && (
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={archiveToStorage}
                  onChange={(e) => setArchiveToStorage(e.target.checked)}
                  className="rounded border-white/20 bg-[#080d1d] text-violet-500 focus:ring-violet-500"
                />
                <span>Archive MP4 copy to Supabase Storage (`{capabilities.storageBucket}`)</span>
              </label>
            )}

            {storageNote && (
              <div className="text-[11px] font-mono px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-200">
                {storageNote}
              </div>
            )}

            {errorMessage && (
              <div className="text-xs px-3 py-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            {/* Progress Indicator */}
            {isRunningPipeline && (
              <div className="space-y-2 p-3 rounded-xl bg-violet-950/30 border border-violet-500/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-violet-200 font-medium flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    {phase === 'uploading_storage'
                      ? 'Archiving MP4 to Supabase Storage...'
                      : phase === 'uploading'
                      ? `Uploading MP4 (${uploadProgress}%)...`
                      : 'Extracting frames & audio, running Visual + Text + Audio AI...'}
                  </span>
                  <span className="font-mono text-violet-300">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300 ${
                      phase === 'processing' ? 'animate-pulse' : ''
                    }`}
                    style={{ width: `${phase === 'processing' ? 100 : uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {isRunningPipeline ? (
                <button
                  type="button"
                  onClick={handleCancelAnalysis}
                  className="px-3.5 py-2 text-xs font-medium text-red-200 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <>
                  {phase === 'error' && selectedFile && (
                    <button
                      type="button"
                      onClick={runVideoAudit}
                      className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!selectedFile || !capabilities.ffmpegAvailable || !capabilities.geminiConfigured}
                    onClick={runVideoAudit}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg transition-all shadow-[0_0_16px_rgba(139,92,246,0.4)] border border-white/20 flex items-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run VideoGuard AI Audit</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Interactive Video Player & Sampled Frame Timeline */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Video Playback &amp; Timestamp Seeker
              </span>
              {activeTimestampSec !== null && (
                <span className="text-[11px] font-mono text-violet-300">
                  Jumped to {formatDuration(activeTimestampSec)}
                </span>
              )}
            </div>

            {videoPreviewUrl ? (
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                controls
                playsInline
                className="w-full rounded-xl bg-black border border-white/10 aspect-video"
              />
            ) : (
              <div className="w-full rounded-xl bg-[#080d1d] border border-white/10 aspect-video flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Film className="w-8 h-8 opacity-40" />
                <span>Select an MP4 video to preview &amp; scrub violation timestamps</span>
              </div>
            )}

            {report && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-[#080d1d] border border-white/5">
                  <span className="text-slate-500 block">Duration</span>
                  <span className="text-white font-semibold">
                    {formatDuration(report.metadata.durationSeconds)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-[#080d1d] border border-white/5">
                  <span className="text-slate-500 block">Resolution</span>
                  <span className="text-white font-semibold">
                    {report.metadata.width && report.metadata.height
                      ? `${report.metadata.width}x${report.metadata.height}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-[#080d1d] border border-white/5">
                  <span className="text-slate-500 block">Audio Track</span>
                  <span className={report.metadata.hasAudioStream ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                    {report.metadata.hasAudioStream ? 'Detected' : 'Absent'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-[#080d1d] border border-white/5">
                  <span className="text-slate-500 block">Subtitles</span>
                  <span className={report.metadata.embeddedSubtitlesFound ? 'text-emerald-400 font-semibold' : 'text-slate-400 font-semibold'}>
                    {report.metadata.embeddedSubtitlesFound ? 'Embedded' : 'OCR/Sidecar'}
                  </span>
                </div>
              </div>
            )}

            {/* Sampled Frames Strip */}
            {report && report.frames.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 block">
                  Sampled Frames ({report.frames.length}) — Click to Seek
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {report.frames.map((frame) => (
                    <button
                      key={frame.index}
                      type="button"
                      onClick={() => seekVideoTo(frame.timestampSeconds)}
                      className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-violet-400 transition-all text-left"
                    >
                      <img
                        src={frame.thumbnailDataUrl}
                        alt={`Frame at ${frame.timestamp}`}
                        className="w-full h-16 object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white group-hover:bg-violet-600">
                        {frame.timestamp}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Combined Brand Compliance Report */}
        <div className="lg:col-span-7 space-y-5">
          {!report ? (
            <div className="glass-panel rounded-2xl p-10 text-center space-y-3 border border-white/10">
              <ShieldCheck className="w-10 h-10 text-violet-400/70 mx-auto" />
              <h3 className="font-display text-lg font-semibold text-white">
                Combined Brand Compliance Report Will Appear Here
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                Upload an MP4 video and launch VideoGuard AI. FFmpeg extracts frames, audio, and embedded subtitles, then Visual AI, Text AI, and Audio AI evaluate your asset concurrently and return timestamped findings.
              </p>
            </div>
          ) : (
            <>
              {/* Score & Action Summary Card */}
              <div className="glass-panel rounded-2xl p-5 space-y-4 border border-violet-500/25">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${getModuleBadgeClass(
                          report.status
                        )}`}
                      >
                        {report.status}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {report.brandName} · {report.metadata.fileName}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-white mt-1">
                      {report.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportReport}
                      className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-violet-300" />
                      <span>Export JSON</span>
                    </button>

                    {user ? (
                      <button
                        type="button"
                        disabled={isSavingAudit || Boolean(savedVideoAuditId)}
                        onClick={() => saveReportToSupabase(report, false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {savedVideoAuditId ? (
                          <>
                            <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Saved</span>
                          </>
                        ) : isSavingAudit ? (
                          <>
                            <CloudUpload className="w-3.5 h-3.5 animate-pulse text-violet-300" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <CloudUpload className="w-3.5 h-3.5 text-violet-300" />
                            <span>Save Audit</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenAuthModal('signin')}
                        className="px-3 py-1.5 text-xs font-medium text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg flex items-center gap-1.5"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In to Save</span>
                      </button>
                    )}

                    {submittedToWorkflow ? (
                      <button
                        type="button"
                        onClick={onNavigateToReviewWorkflow}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Open in Review Workflow</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmittingReview}
                        onClick={handleSubmitForReview}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#8B5CF6] border border-white/20 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSubmittingReview ? 'Submitting...' : 'Submit for Review'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Module Score Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#080d1d] border border-violet-500/30">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Overall Score</span>
                    <div className="text-2xl font-display font-bold text-white mt-1 tabular-nums">
                      {report.overallScore !== null ? `${report.overallScore}%` : 'N/A'}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {report.totalViolations} total violation(s)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#080d1d] border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-cyan-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Visual AI
                    </span>
                    <div className="text-2xl font-display font-bold text-white mt-1 tabular-nums">
                      {report.visual.score !== null ? `${report.visual.score}%` : report.visual.status.toUpperCase()}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {report.visual.findings.length} finding(s)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#080d1d] border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-violet-300 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Text AI
                    </span>
                    <div className="text-2xl font-display font-bold text-white mt-1 tabular-nums">
                      {report.text.score !== null ? `${report.text.score}%` : report.text.status.toUpperCase()}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {report.text.violations.length} violation(s)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#080d1d] border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-emerald-300 flex items-center gap-1">
                      <Mic className="w-3 h-3" /> Audio AI
                    </span>
                    <div className="text-2xl font-display font-bold text-white mt-1 tabular-nums">
                      {report.audio.score !== null ? `${report.audio.score}%` : report.audio.status.toUpperCase()}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {report.audio.status === 'unavailable'
                        ? 'No audio track'
                        : `${report.audio.violations.length} violation(s)`}
                    </span>
                  </div>
                </div>

                {/* Severity Breakdown + Summary */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/25">
                    Critical: {report.severityCounts.critical}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-300 border border-orange-500/25">
                    High: {report.severityCounts.high}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25">
                    Medium: {report.severityCounts.medium}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25">
                    Low: {report.severityCounts.low}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                  {report.summary}
                </p>
              </div>

              {/* Timestamp-Based Combined Violations */}
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Timestamp-Based Violation Report ({filteredCombinedViolations.length})
                  </span>

                  <div className="flex items-center gap-1.5 text-xs">
                    {(['all', 'visual', 'text', 'audio'] as const).map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setViolationModuleFilter(mod)}
                        className={`px-2.5 py-1 rounded-md font-mono capitalize transition-colors border ${
                          violationModuleFilter === mod
                            ? 'bg-violet-600 text-white border-violet-400'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {mod}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredCombinedViolations.length === 0 ? (
                  <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center text-xs text-emerald-300">
                    No violations flagged in the selected module view.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {filteredCombinedViolations.map((v) => (
                      <div
                        key={`${v.module}-${v.id}`}
                        onClick={() => seekVideoTo(v.timestampSeconds)}
                        className="p-3.5 rounded-xl bg-[#080d1d]/90 border border-white/10 hover:border-violet-500/50 cursor-pointer transition-all space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-violet-500/20 border border-violet-500/35 text-violet-200 font-mono text-[11px] flex items-center gap-1">
                              <Play className="w-2.5 h-2.5" />
                              {v.timestamp}
                            </span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                              {v.module} AI
                            </span>
                            <span className="text-xs font-semibold text-white">{v.title}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${getSeverityBadgeClass(
                              v.severity
                            )}`}
                          >
                            {v.severity}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">{v.explanation}</p>
                        {v.violatingContent && (
                          <p className="text-[11px] font-mono text-red-300 bg-red-950/30 px-2.5 py-1.5 rounded border border-red-500/20">
                            Flagged: {v.violatingContent}
                          </p>
                        )}
                        {v.suggestedCorrection && (
                          <p className="text-[11px] font-mono text-emerald-300 bg-emerald-950/30 px-2.5 py-1.5 rounded border border-emerald-500/20">
                            Correction: {v.suggestedCorrection}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detailed Module Breakdown Tabs (Visual / Text OCR / Audio Transcript) */}
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
                  <button
                    type="button"
                    onClick={() => setActiveModuleTab('visual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      activeModuleTab === 'visual'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visual AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModuleTab('text')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      activeModuleTab === 'text'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Text AI (OCR &amp; Subtitles)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModuleTab('audio')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      activeModuleTab === 'audio'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Audio AI (Transcript &amp; Tone)</span>
                  </button>
                </div>

                {activeModuleTab === 'visual' && (
                  <div className="space-y-3 text-xs">
                    {report.visual.error && (
                      <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-200">
                        {report.visual.error}
                      </div>
                    )}
                    <p className="text-slate-300 leading-relaxed">{report.visual.summary}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-[#080d1d] border border-white/10">
                        <span className="text-[11px] font-mono text-cyan-300 uppercase block mb-1">
                          Logo &amp; Brand Presence
                        </span>
                        <p className="text-slate-300">{report.visual.logoVisibility}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080d1d] border border-white/10">
                        <span className="text-[11px] font-mono text-cyan-300 uppercase block mb-1">
                          Color Palette &amp; Visual Identity
                        </span>
                        <p className="text-slate-300">{report.visual.colorConsistency}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeModuleTab === 'text' && (
                  <div className="space-y-3 text-xs">
                    {report.text.error && (
                      <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-200">
                        {report.text.error}
                      </div>
                    )}
                    <p className="text-slate-300 leading-relaxed">{report.text.summary}</p>

                    <div className="space-y-2">
                      <span className="text-[11px] font-mono uppercase text-violet-300 block">
                        Extracted Frame OCR Text
                      </span>
                      {report.text.ocrSamples.length === 0 ? (
                        <p className="text-slate-500 font-mono">No OCR samples recorded.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {report.text.ocrSamples.map((s, idx) => (
                            <div
                              key={idx}
                              onClick={() => seekVideoTo(s.timestampSeconds)}
                              className="p-2.5 rounded-lg bg-[#080d1d] border border-white/10 flex items-start gap-2.5 cursor-pointer hover:border-violet-500/40"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 font-mono text-[10px] shrink-0">
                                {s.timestamp}
                              </span>
                              <span className="font-mono text-slate-300">
                                {s.detectedText || '(No visible on-screen text)'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {report.text.extractedSubtitles && (
                      <div>
                        <span className="text-[11px] font-mono uppercase text-violet-300 block mb-1">
                          Extracted / Attached Subtitles
                        </span>
                        <pre className="p-3 rounded-xl bg-[#080d1d] border border-white/10 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {report.text.extractedSubtitles}
                        </pre>
                      </div>
                    )}

                    {report.text.correctedText && (
                      <div>
                        <span className="text-[11px] font-mono uppercase text-emerald-300 block mb-1">
                          Brand-Compliant Copy Correction
                        </span>
                        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 font-mono text-[11px] text-emerald-200 whitespace-pre-wrap">
                          {report.text.correctedText}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeModuleTab === 'audio' && (
                  <div className="space-y-3 text-xs">
                    {report.audio.status === 'unavailable' && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200">
                        <p className="font-semibold">Audio AI Unavailable (No Score Fabricated)</p>
                        <p className="mt-0.5 text-amber-200/80">
                          {report.audio.reason || report.audio.summary}
                        </p>
                      </div>
                    )}
                    {report.audio.error && (
                      <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-200">
                        {report.audio.error}
                      </div>
                    )}
                    <p className="text-slate-300 leading-relaxed">{report.audio.summary}</p>

                    {report.audio.fullTranscript && (
                      <div>
                        <span className="text-[11px] font-mono uppercase text-emerald-300 block mb-1">
                          Verbatim Speech Transcript (gemini-3.5-transcribe)
                        </span>
                        <div className="p-3 rounded-xl bg-[#080d1d] border border-white/10 font-mono text-[11px] text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {report.audio.fullTranscript}
                        </div>
                      </div>
                    )}

                    {report.audio.correctedNarration && (
                      <div>
                        <span className="text-[11px] font-mono uppercase text-emerald-300 block mb-1">
                          Suggested Corrected Narration
                        </span>
                        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 font-mono text-[11px] text-emerald-200 whitespace-pre-wrap">
                          {report.audio.correctedNarration}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Saved Video Audits Archive (Supabase RLS) */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            Saved VideoGuard AI Audits
          </span>
          {user && (
            <button
              type="button"
              onClick={fetchSavedVideoAudits}
              className="text-xs text-violet-300 hover:text-white font-mono"
            >
              Refresh
            </button>
          )}
        </div>

        {!user ? (
          <div className="p-4 rounded-xl bg-[#080d1d] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              Sign in to save VideoGuard AI reports to Supabase (`video_audits`) and submit them to the approval workflow.
            </span>
            <button
              type="button"
              onClick={() => onOpenAuthModal('signin')}
              className="px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white font-semibold flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        ) : savedSchemaError ? (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
            <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{savedSchemaError}</span>
          </div>
        ) : savedAuditsLoading ? (
          <div className="py-6 text-center text-xs text-slate-400 font-mono">
            Loading saved video audits...
          </div>
        ) : savedAudits.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-mono">
            No saved video audits yet. Run an analysis above to persist it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedAudits.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#080d1d]/90 border border-white/10 hover:border-violet-500/40 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      {item.file_name} · {formatDuration(Number(item.duration_seconds) || 0)}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-violet-500/15 text-violet-200 border border-violet-500/30 shrink-0">
                    {item.overall_score !== null ? `${item.overall_score}%` : item.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{item.violations.length} finding(s)</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleLoadSavedAudit(item)}
                    className="text-xs text-violet-300 hover:text-white font-medium"
                  >
                    Open Report
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedAudit(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete saved video audit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
