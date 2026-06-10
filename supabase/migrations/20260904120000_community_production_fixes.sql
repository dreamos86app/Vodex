-- Member count sync, discussion attachments, sanctions, mentions

-- Sync groups.member_count from group_members
CREATE OR REPLACE FUNCTION public.sync_group_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = (
      SELECT count(*)::int FROM public.group_members WHERE group_id = NEW.group_id
    ), updated_at = now() WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = (
      SELECT count(*)::int FROM public.group_members WHERE group_id = OLD.group_id
    ), updated_at = now() WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_members_count ON public.group_members;
CREATE TRIGGER trg_group_members_count
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_group_member_count();

-- Backfill member counts
UPDATE public.groups g
SET member_count = sub.cnt
FROM (
  SELECT group_id, count(*)::int AS cnt FROM public.group_members GROUP BY group_id
) sub
WHERE g.id = sub.group_id;

UPDATE public.groups g
SET member_count = 0
WHERE NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id);

-- Discussion reply edit timestamp
ALTER TABLE public.discussion_replies
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Discussion attachments
CREATE TABLE IF NOT EXISTS public.discussion_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reply_id uuid NOT NULL REFERENCES public.discussion_replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  mime_type text,
  width int,
  height int
);

CREATE INDEX IF NOT EXISTS idx_discussion_attachments_reply ON public.discussion_attachments(reply_id);

ALTER TABLE public.discussion_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussion_attachments: read public"
  ON public.discussion_attachments FOR SELECT
  USING (true);

CREATE POLICY "discussion_attachments: insert own"
  ON public.discussion_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "discussion_attachments: delete own"
  ON public.discussion_attachments FOR DELETE
  USING (auth.uid() = user_id);

-- Group member sanctions (ban / timeout)
CREATE TABLE IF NOT EXISTS public.group_member_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sanction_type text NOT NULL CHECK (sanction_type IN ('ban', 'timeout')),
  reason text,
  until timestamptz,
  UNIQUE (group_id, user_id, sanction_type)
);

CREATE INDEX IF NOT EXISTS idx_group_sanctions_group ON public.group_member_sanctions(group_id);

ALTER TABLE public.group_member_sanctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_sanctions: read members"
  ON public.group_member_sanctions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_member_sanctions.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "group_sanctions: manage admin"
  ON public.group_member_sanctions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_member_sanctions.group_id
        AND (g.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid() AND gm.role IN ('admin', 'owner')
        ))
    )
  );

-- Group message mentions
CREATE TABLE IF NOT EXISTS public.group_message_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_mentions_user ON public.group_message_mentions(mentioned_user_id);

ALTER TABLE public.group_message_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_mentions: read members"
  ON public.group_message_mentions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_messages m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id = group_message_mentions.message_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "group_mentions: insert sender"
  ON public.group_message_mentions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_messages m
      WHERE m.id = message_id AND m.user_id = auth.uid()
    )
  );

-- Groups rules column
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS rules jsonb DEFAULT '[]'::jsonb;
