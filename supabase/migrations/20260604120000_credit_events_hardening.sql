-- Credit events + charge_tokens hardening — never null credits_consumed; canonical RPC for PostgREST.

alter table public.credit_events
  alter column credits_consumed set default 0;

alter table public.credit_events
  add column if not exists provider_cost_usd numeric(12, 6) default 0;

alter table public.credit_events
  add column if not exists status text default 'finalized';

update public.credit_events
set credits_consumed = coalesce(credits_consumed, amount, 0),
    provider_cost_usd = coalesce(provider_cost_usd, 0),
    status = coalesce(status, metadata->>'status', case when coalesce(credits_consumed, amount, 0) > 0 then 'finalized' else 'failed' end)
where credits_consumed is null
   or provider_cost_usd is null
   or status is null;

drop function if exists public.charge_tokens(uuid, integer, text, text, jsonb) cascade;
drop function if exists public.charge_tokens(uuid, integer, text, text, jsonb, uuid, uuid) cascade;
drop function if exists public.charge_tokens(integer, uuid, text, jsonb, uuid, text, uuid) cascade;

create or replace function public.charge_tokens(
  p_user_id uuid,
  p_amount integer,
  p_reason text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_project_id uuid default null,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
  v_op text;
  v_balance_after integer;
  v_provider_usd numeric;
  v_model text;
begin
  v_op := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_provider_usd := coalesce((p_metadata->>'provider_cost_usd')::numeric, 0);
  v_model := coalesce(nullif(trim(p_metadata->>'model_id'), ''), 'unknown');

  perform public.ensure_user_profile(p_user_id, null);

  if v_op is not null and exists (
    select 1 from public.credit_events where operation_id = v_op
  ) then
    select credits_remaining into v_remaining from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'charged', false,
      'balance_after', coalesce(v_remaining, 0),
      'remaining', coalesce(v_remaining, 0),
      'operation_id', v_op,
      'idempotent', true
    );
  end if;

  if p_amount < 1 then
    select credits_remaining into v_remaining from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', false,
      'success', false,
      'error', 'invalid_amount',
      'balance_after', coalesce(v_remaining, 0),
      'remaining', coalesce(v_remaining, 0)
    );
  end if;

  select credits_remaining into v_remaining
    from public.profiles
    where id = p_user_id
    for update;

  if v_remaining is null then
    return jsonb_build_object('ok', false, 'success', false, 'error', 'profile_missing', 'remaining', 0);
  end if;

  if v_remaining < p_amount then
    return jsonb_build_object(
      'ok', false,
      'success', false,
      'error', 'insufficient_credits',
      'remaining', v_remaining,
      'balance_after', v_remaining
    );
  end if;

  v_balance_after := v_remaining - p_amount;

  update public.profiles
    set credits_remaining = v_balance_after,
        credits_used = coalesce(credits_used, 0) + p_amount,
        updated_at = now()
    where id = p_user_id;

  insert into public.credit_events (
    user_id, operation_id, amount, balance_after, reason, project_id, conversation_id, metadata,
    model_id, credits_consumed, event_type, provider_cost_usd, status
  )
  values (
    p_user_id,
    v_op,
    p_amount,
    v_balance_after,
    coalesce(p_reason, 'AI usage'),
    p_project_id,
    p_conversation_id,
    coalesce(p_metadata, '{}'::jsonb),
    v_model,
    p_amount,
    'generation',
    v_provider_usd,
    'finalized'
  );

  insert into public.token_ledger (
    user_id, amount, reason, source, metadata, idempotency_key
  )
  values (
    p_user_id,
    p_amount,
    coalesce(p_reason, 'Token charge'),
    'ai_usage',
    coalesce(p_metadata, '{}'::jsonb),
    v_op
  )
  on conflict do nothing;

  return jsonb_build_object(
    'ok', true,
    'success', true,
    'charged', true,
    'balance_after', v_balance_after,
    'remaining', v_balance_after,
    'operation_id', v_op
  );
exception
  when unique_violation then
    select credits_remaining into v_remaining from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'charged', false,
      'balance_after', coalesce(v_remaining, 0),
      'remaining', coalesce(v_remaining, 0),
      'idempotent', true
    );
end;
$$;

revoke execute on function public.charge_tokens(uuid, integer, text, text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.charge_tokens(uuid, integer, text, text, jsonb, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
