-- Allow Infinity I–VII plan slugs on profiles (Paddle billing).
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
