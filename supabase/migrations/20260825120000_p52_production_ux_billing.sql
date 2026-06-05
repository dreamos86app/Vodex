-- P5.2 — Free plan allowance, chat/workspace canonical ids, app version history

-- Free tier: 20 Build Credits / month (Action Credits remain 25 in app constants)
UPDATE public.profiles
SET credits_remaining = LEAST(credits_remaining, 20)
WHERE plan_id = 'free'
  AND credits_remaining > 20;

-- Canonical workspace on standalone AI conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

UPDATE public.conversations c
SET workspace_id = w.id
FROM public.workspaces w
WHERE c.workspace_id IS NULL
  AND w.owner_id = c.user_id;

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON public.conversations(workspace_id);

-- Builder / edit version history
CREATE TABLE IF NOT EXISTS public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  version_number integer NOT NULL,
  summary text,
  mode text,
  credit_cost numeric(10, 2) DEFAULT 0,
  changed_paths text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.app_version_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.app_versions(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  UNIQUE (version_id, path)
);

CREATE INDEX IF NOT EXISTS idx_app_versions_project ON public.app_versions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_version_files_version ON public.app_version_files(version_id);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_version_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_versions_owner ON public.app_versions
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY app_version_files_via_version ON public.app_version_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.app_versions v
      WHERE v.id = app_version_files.version_id AND v.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_versions v
      WHERE v.id = app_version_files.version_id AND v.owner_id = auth.uid()
    )
  );
