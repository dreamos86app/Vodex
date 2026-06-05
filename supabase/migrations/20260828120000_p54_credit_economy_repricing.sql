-- P5.4: Cost-backed credit repricing — 25 AC/$, reduced BC allowances, Free 20/20.

UPDATE public.platform_credit_defaults
SET
  monthly_build_credits = 20,
  monthly_action_credits = 20
WHERE plan_id = 'free';

COMMENT ON TABLE public.platform_credit_defaults IS
  'P5.4: Build Credits for AI builder; Action Credits for runtime (25 AC per $1 on paid plans).';
