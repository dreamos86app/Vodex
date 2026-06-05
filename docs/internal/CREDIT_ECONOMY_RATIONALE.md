# Vodex Credit Economy Rationale (Internal)

## P5.4.4 — Margin optimization (frozen ladder)

Plan allowances are **frozen** at the approved P5.4.2 ladder. Profitability improvements come from:

1. **Provider cost reductions** (cheaper models for classify/plan stages, worker runtime trims, builder cache)
2. **Modest consumption increases** (5–15%, max 20% on expensive actions)
3. **No pricing or allowance cuts**

### Frozen allowances

| Plan | BC | AC |
|------|-----|-----|
| Starter | 150 | 400 |
| Pro | 375 | 1,000 |
| Infinity I–VII | 750–9,300 | 2,000–25,000 |

Full-gross max-burn on Starter (~64% monthly) is **informational** under frozen ladder — blended margin is the operational gate.

### Audits

```bash
npm run verify:p544-margin-optimization
npm run audit:p544-margin-optimization
npm run audit:action-costs
npm run audit:profit-forecast
npm run audit:unit-economics
```
