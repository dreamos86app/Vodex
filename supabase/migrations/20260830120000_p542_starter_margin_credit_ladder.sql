-- P5.4.2: 20 AC/$ formula, Starter 150 BC / 400 AC, clean Infinity ladder.

UPDATE public.platform_credit_defaults
SET
  monthly_build_credits = 20,
  monthly_action_credits = 20
WHERE plan_id = 'free';

COMMENT ON TABLE public.platform_credit_defaults IS
  'P5.4.2: 7.5 BC + 20 AC per $1 monthly list price. Annual discount does not reduce credits.';
