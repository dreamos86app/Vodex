-- P5.4.1: Formula-based credits ($1 = 7.5 BC + 25 AC). Monotonic Infinity ladder.

UPDATE public.platform_credit_defaults
SET
  monthly_build_credits = 20,
  monthly_action_credits = 20
WHERE plan_id = 'free';

COMMENT ON TABLE public.platform_credit_defaults IS
  'P5.4.1: Credits from monthly list price (7.5 BC + 25 AC per $1). Annual discount does not reduce monthly credits.';
