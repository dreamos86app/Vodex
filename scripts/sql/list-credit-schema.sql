-- Vodex: inspect credit / plan / billing related schema (run in Supabase SQL Editor).
-- Use before writing allowance migrations — production has no platform_credit_defaults table.

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%credit%'
    OR table_name ILIKE '%plan%'
    OR table_name ILIKE '%billing%'
    OR table_name ILIKE '%subscription%'
  )
ORDER BY table_name;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%credit%'
    OR column_name ILIKE '%plan%'
    OR column_name ILIKE '%billing%'
    OR column_name ILIKE '%subscription%'
  )
ORDER BY table_name, ordinal_position;

-- Canonical allowance functions (should exist after P5.4.4 migration)
SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'plan_monthly_credits',
    'plan_monthly_action_credits',
    '_plan_monthly_quota',
    'admin_reset_action_credits_monthly'
  )
ORDER BY p.proname;

-- Confirm stale table is absent
SELECT to_regclass('public.platform_credit_defaults') AS platform_credit_defaults_exists;
