-- ============================================================================
-- BrandGuard AI — Phase 3 Initial Database Schema & RLS Migration
-- Target: Supabase (PostgreSQL 15+)
-- Execute this file manually in your Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Shared Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Table: public.profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Automatic profile creation when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived_name TEXT;
BEGIN
  derived_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
    'BrandGuard User'
  );

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, LEFT(derived_name, 120))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. Table: public.brand_profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL CHECK (char_length(trim(brand_name)) BETWEEN 1 AND 120),
  industry TEXT NOT NULL DEFAULT 'Enterprise Technology' CHECK (char_length(industry) <= 100),
  brand_voice TEXT NOT NULL DEFAULT 'Authoritative, precise, and enterprise-grade.' CHECK (char_length(brand_voice) <= 1500),
  approved_words JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(approved_words) = 'array'),
  restricted_words JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(restricted_words) = 'array'),
  tone_rules JSONB NOT NULL DEFAULT '{"formality":75,"authoritative":60,"technical":85}'::jsonb CHECK (jsonb_typeof(tone_rules) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id
  ON public.brand_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_updated_at
  ON public.brand_profiles (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_brand_profiles_updated_at ON public.brand_profiles;
CREATE TRIGGER trg_brand_profiles_updated_at
  BEFORE UPDATE ON public.brand_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_profiles_select_own" ON public.brand_profiles;
CREATE POLICY "brand_profiles_select_own"
  ON public.brand_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_profiles_insert_own" ON public.brand_profiles;
CREATE POLICY "brand_profiles_insert_own"
  ON public.brand_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_profiles_update_own" ON public.brand_profiles;
CREATE POLICY "brand_profiles_update_own"
  ON public.brand_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_profiles_delete_own" ON public.brand_profiles;
CREATE POLICY "brand_profiles_delete_own"
  ON public.brand_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Table: public.audits
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_profile_id UUID NULL REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Brand Compliance Audit' CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  original_content TEXT NOT NULL CHECK (char_length(trim(original_content)) > 0),
  corrected_content TEXT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  status TEXT NOT NULL CHECK (status IN ('compliant', 'warning', 'critical')),
  violations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(violations) = 'array'),
  channel TEXT NULL CHECK (channel IS NULL OR char_length(channel) <= 50),
  content_hash TEXT NULL CHECK (content_hash IS NULL OR char_length(content_hash) <= 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_user_id_created_at
  ON public.audits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audits_brand_profile_id
  ON public.audits (brand_profile_id);

CREATE INDEX IF NOT EXISTS idx_audits_user_status
  ON public.audits (user_id, status);

CREATE INDEX IF NOT EXISTS idx_audits_user_channel
  ON public.audits (user_id, channel);

CREATE INDEX IF NOT EXISTS idx_audits_user_content_hash
  ON public.audits (user_id, content_hash);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audits_select_own" ON public.audits;
CREATE POLICY "audits_select_own"
  ON public.audits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audits_insert_own" ON public.audits;
CREATE POLICY "audits_insert_own"
  ON public.audits
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

DROP POLICY IF EXISTS "audits_update_own" ON public.audits;
CREATE POLICY "audits_update_own"
  ON public.audits
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

DROP POLICY IF EXISTS "audits_delete_own" ON public.audits;
CREATE POLICY "audits_delete_own"
  ON public.audits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
