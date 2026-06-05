-- P5.4.3: Full-gross max-burn margin ladder (credit + Paddle + infra gates).
-- Starter 57 BC / 152 AC; 2.85 BC/$ + 7.6 AC/$ scaled with clean rounding.

UPDATE public.platform_credit_defaults
SET
  monthly_build_credits = 20,
  monthly_action_credits = 20
WHERE plan_id = 'free';

COMMENT ON TABLE public.platform_credit_defaults IS
  'P5.4.3: 2.85 BC + 7.6 AC per $1 monthly list. Full-gross margin audited. Annual discount does not reduce credits.';
