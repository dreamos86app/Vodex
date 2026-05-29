-- DreamOS86: Infinity I–VII plan slugs (safe manual apply if `supabase db push` is blocked)
-- Paste into Supabase Dashboard → SQL Editor for project wciioegiczwqlmlroley
-- Idempotent: drops and recreates profiles_plan_id_check only.

alter table public.profiles drop constraint if exists profiles_plan_id_check;

alter table public.profiles
  add constraint profiles_plan_id_check
  check (
    plan_id in (
      'free',
      'starter',
      'pro',
      'business',
      'infinity',
      'infinity_i',
      'infinity_ii',
      'infinity_iii',
      'infinity_iv',
      'infinity_v',
      'infinity_vi',
      'infinity_vii',
      'enterprise'
    )
  );

-- Verify:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.profiles'::regclass and conname = 'profiles_plan_id_check';

NOTIFY pgrst, 'reload schema';
