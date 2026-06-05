-- P5.4.4: Frozen credit ladder + margin optimization via action/provider tuning (not allowance cuts).

UPDATE public.platform_credit_defaults
SET
  monthly_build_credits = 20,
  monthly_action_credits = 20
WHERE plan_id = 'free';

COMMENT ON TABLE public.platform_credit_defaults IS
  'P5.4.4: Frozen 7.5 BC + 20 AC per $1. Margin via provider routing + action consumption tuning.';
