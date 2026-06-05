-- P5.3 — Free tier 20 Action Credits; sync action credit balances for free users

-- Clamp free-plan action balances that exceed new 20 AC allowance
update public.action_credit_balances acb
set balance = least(acb.balance, 20), updated_at = now()
from public.profiles p
where acb.owner_user_id = p.id
  and acb.project_id is null
  and p.plan_id = 'free'
  and acb.balance > 20;
