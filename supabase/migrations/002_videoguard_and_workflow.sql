-- ============================================================================
-- BrandGuard AI — VideoGuard AI & Content Review Workflow Migration (Phase 4)
-- Target: Supabase (PostgreSQL 15+)
-- Prerequisites: Run 001_initial_schema.sql first (requires public.set_updated_at,
--   public.brand_profiles, and public.audits).
-- Execute this file manually in your Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. Table: public.video_audits
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.video_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_profile_id UUID NULL REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Video Compliance Audit' CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  file_name TEXT NOT NULL CHECK (char_length(trim(file_name)) BETWEEN 1 AND 255),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  duration_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  storage_bucket TEXT NULL CHECK (storage_bucket IS NULL OR char_length(storage_bucket) <= 100),
  storage_path TEXT NULL CHECK (storage_path IS NULL OR char_length(storage_path) <= 500),
  overall_score INTEGER NULL CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  visual_score INTEGER NULL CHECK (visual_score IS NULL OR (visual_score >= 0 AND visual_score <= 100)),
  text_score INTEGER NULL CHECK (text_score IS NULL OR (text_score >= 0 AND text_score <= 100)),
  audio_score INTEGER NULL CHECK (audio_score IS NULL OR (audio_score >= 0 AND audio_score <= 100)),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'partial', 'failed')),
  module_statuses JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(module_statuses) = 'object'),
  violations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(violations) = 'array'),
  extracted_transcript TEXT NULL,
  extracted_subtitles TEXT NULL,
  ocr_text JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ocr_text) = 'array'),
  corrected_narration TEXT NULL,
  summary TEXT NOT NULL DEFAULT '',
  report_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(report_payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_audits_user_created_at
  ON public.video_audits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_audits_brand_profile_id
  ON public.video_audits (brand_profile_id);

CREATE INDEX IF NOT EXISTS idx_video_audits_user_status
  ON public.video_audits (user_id, status);

DROP TRIGGER IF EXISTS trg_video_audits_updated_at ON public.video_audits;
CREATE TRIGGER trg_video_audits_updated_at
  BEFORE UPDATE ON public.video_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.video_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_audits_select_own" ON public.video_audits;
CREATE POLICY "video_audits_select_own"
  ON public.video_audits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "video_audits_insert_own" ON public.video_audits;
CREATE POLICY "video_audits_insert_own"
  ON public.video_audits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      brand_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.brand_profiles bp
        WHERE bp.id = brand_profile_id
          AND bp.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "video_audits_update_own" ON public.video_audits;
CREATE POLICY "video_audits_update_own"
  ON public.video_audits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      brand_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.brand_profiles bp
        WHERE bp.id = brand_profile_id
          AND bp.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "video_audits_delete_own" ON public.video_audits;
CREATE POLICY "video_audits_delete_own"
  ON public.video_audits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Table: public.content_submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_profile_id UUID NULL REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  audit_id UUID NULL REFERENCES public.audits(id) ON DELETE SET NULL,
  video_audit_id UUID NULL REFERENCES public.video_audits(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  content_type TEXT NOT NULL CHECK (content_type IN ('text_audit', 'video_audit', 'compliance_report')),
  channel TEXT NULL CHECK (channel IS NULL OR char_length(channel) <= 50),
  original_content TEXT NOT NULL DEFAULT '',
  corrected_content TEXT NULL,
  audit_score INTEGER NULL CHECK (audit_score IS NULL OR (audit_score >= 0 AND audit_score <= 100)),
  violations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(violations) = 'array'),
  video_reference JSONB NULL CHECK (video_reference IS NULL OR jsonb_typeof(video_reference) = 'object'),
  submitter_name TEXT NOT NULL DEFAULT '' CHECK (char_length(submitter_name) <= 120),
  submitter_email TEXT NOT NULL DEFAULT '' CHECK (char_length(submitter_email) <= 255),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('draft', 'submitted', 'pending', 'approved', 'rejected', 'revision_required')
  ),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_submissions_user_submitted_at
  ON public.content_submissions (user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_submissions_user_status
  ON public.content_submissions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_content_submissions_video_audit_id
  ON public.content_submissions (video_audit_id);

DROP TRIGGER IF EXISTS trg_content_submissions_updated_at ON public.content_submissions;
CREATE TRIGGER trg_content_submissions_updated_at
  BEFORE UPDATE ON public.content_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_submissions_select_own" ON public.content_submissions;
CREATE POLICY "content_submissions_select_own"
  ON public.content_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "content_submissions_insert_own" ON public.content_submissions;
CREATE POLICY "content_submissions_insert_own"
  ON public.content_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      brand_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.brand_profiles bp
        WHERE bp.id = brand_profile_id
          AND bp.user_id = auth.uid()
      )
    )
    AND (
      audit_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.audits a
        WHERE a.id = audit_id
          AND a.user_id = auth.uid()
      )
    )
    AND (
      video_audit_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.video_audits va
        WHERE va.id = video_audit_id
          AND va.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "content_submissions_update_own" ON public.content_submissions;
CREATE POLICY "content_submissions_update_own"
  ON public.content_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "content_submissions_delete_own" ON public.content_submissions;
CREATE POLICY "content_submissions_delete_own"
  ON public.content_submissions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Table: public.submission_reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.submission_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.content_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL DEFAULT '' CHECK (char_length(reviewer_name) <= 120),
  reviewer_email TEXT NOT NULL DEFAULT '' CHECK (char_length(reviewer_email) <= 255),
  decision TEXT NOT NULL CHECK (
    decision IN ('submitted', 'pending', 'approved', 'rejected', 'revision_required')
  ),
  comments TEXT NOT NULL DEFAULT '' CHECK (char_length(comments) <= 2000),
  previous_status TEXT NULL CHECK (
    previous_status IS NULL
    OR previous_status IN ('draft', 'submitted', 'pending', 'approved', 'rejected', 'revision_required')
  ),
  review_mode TEXT NOT NULL DEFAULT 'owner_mvp' CHECK (review_mode IN ('owner_mvp', 'demo_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission_created_at
  ON public.submission_reviews (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_reviews_user_id
  ON public.submission_reviews (user_id);

ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submission_reviews_select_own" ON public.submission_reviews;
CREATE POLICY "submission_reviews_select_own"
  ON public.submission_reviews
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.content_submissions cs
      WHERE cs.id = submission_id
        AND cs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "submission_reviews_insert_own" ON public.submission_reviews;
CREATE POLICY "submission_reviews_insert_own"
  ON public.submission_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.content_submissions cs
      WHERE cs.id = submission_id
        AND cs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. Supabase Storage Bucket & Policies for VideoGuard AI (`videoguard-videos`)
-- ============================================================================
-- Creates a private bucket (if storage schema permissions allow) and restricts
-- object access so authenticated users can only manage files under `<user_id>/`.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videoguard-videos',
  'videoguard-videos',
  false,
  78643200,
  ARRAY['video/mp4']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "videoguard_videos_select_own" ON storage.objects;
CREATE POLICY "videoguard_videos_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'videoguard-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "videoguard_videos_insert_own" ON storage.objects;
CREATE POLICY "videoguard_videos_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'videoguard-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "videoguard_videos_delete_own" ON storage.objects;
CREATE POLICY "videoguard_videos_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'videoguard-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
