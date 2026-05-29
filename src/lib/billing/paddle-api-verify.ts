import {
  BILLABLE_PLAN_DEFINITIONS,
  billablePlanDefinition,
  monthlyPriceUsd,
  annualPriceUsd,
  readEnvPrice,
} from "@/lib/billing/billable-plans";
import {
  planFromPaddlePriceId,
  resolveCatalogTier,
  type BillablePlanId,
  type CatalogBillingInterval,
} from "@/lib/billing/plan-billing-catalog";
import { paddleEnvironment } from "@/lib/billing/paddle-billing";
import { validatePaddleEnvironmentConsistency } from "@/lib/billing/paddle-env-consistency";

function paddleApiBase(): string {
  return paddleEnvironment() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export type PaddlePriceVerifyRow = {
  plan: BillablePlanId;
  interval: CatalogBillingInterval;
  priceId: string | null;
  priceIdMasked: string;
  expectedAmountUsd: number;
  paddleAmountUsd: number | null;
  paddleInterval: string | null;
  productId: string | null;
  ok: boolean;
  error: string | null;
};

export type PaddleCatalogVerifyResult = {
  ok: boolean;
  connectionOk: boolean;
  errors: string[];
  warnings: string[];
  rows: PaddlePriceVerifyRow[];
  missingPriceIds: string[];
};

function maskId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `…${id.slice(-4)}`;
}

async function fetchPaddlePrice(
  priceId: string,
  apiKey: string,
): Promise<
  | { ok: true; unitPriceUsd: number; interval: string; productId: string | null }
  | { ok: false; error: string }
> {
  const res = await fetch(`${paddleApiBase()}/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = (await res.json()) as {
    data?: {
      unit_price?: { amount?: string; currency_code?: string };
      billing_cycle?: { interval?: string; frequency?: number };
      product_id?: string;
    };
    error?: { detail?: string };
  };
  if (!res.ok) {
    return { ok: false, error: json.error?.detail ?? `Paddle API ${res.status}` };
  }
  const amountCents = Number(json.data?.unit_price?.amount ?? 0);
  const unitPriceUsd = Math.round((amountCents / 100) * 100) / 100;
  const interval = json.data?.billing_cycle?.interval ?? null;
  return {
    ok: true,
    unitPriceUsd,
    interval: interval ?? "unknown",
    productId: json.data?.product_id ?? null,
  };
}

export async function verifyPaddleCatalogViaApi(): Promise<PaddleCatalogVerifyResult> {
  const envCheck = validatePaddleEnvironmentConsistency();
  const errors = [...envCheck.errors];
  const warnings = [...envCheck.warnings];
  const rows: PaddlePriceVerifyRow[] = [];
  const missingPriceIds: string[] = [];

  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      connectionOk: false,
      errors: [...errors, "PADDLE_API_KEY missing"],
      warnings,
      rows: [],
      missingPriceIds: [],
    };
  }

  let connectionOk = false;
  try {
    const ping = await fetch(`${paddleApiBase()}/event-types`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    connectionOk = ping.ok;
    if (!ping.ok) {
      errors.push(`Paddle API connection failed (${ping.status}).`);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Paddle API connection failed");
  }

  for (const def of BILLABLE_PLAN_DEFINITIONS) {
    for (const interval of ["monthly", "annual"] as const) {
      const tier = resolveCatalogTier(def.id, interval);
      const priceId = tier.priceId;
      const expected = interval === "monthly" ? monthlyPriceUsd(def) : annualPriceUsd(def);

      if (!priceId) {
        missingPriceIds.push(def.env[interval === "monthly" ? "monthlyPriceKey" : "annualPriceKey"]);
        rows.push({
          plan: def.id,
          interval,
          priceId: null,
          priceIdMasked: "—",
          expectedAmountUsd: expected,
          paddleAmountUsd: null,
          paddleInterval: null,
          productId: readEnvPrice(def.env.productKey),
          ok: false,
          error: "Price ID not configured",
        });
        continue;
      }

      if (!priceId.startsWith("pri_")) {
        errors.push(`${def.id} ${interval}: ID must be pri_* (got ${maskId(priceId)})`);
      }

      const fetched = await fetchPaddlePrice(priceId, apiKey);
      if (!fetched.ok) {
        rows.push({
          plan: def.id,
          interval,
          priceId,
          priceIdMasked: maskId(priceId),
          expectedAmountUsd: expected,
          paddleAmountUsd: null,
          paddleInterval: null,
          productId: readEnvPrice(def.env.productKey),
          ok: false,
          error: fetched.error,
        });
        errors.push(`${def.label} ${interval}: ${fetched.error}`);
        continue;
      }

      const mapped = planFromPaddlePriceId(priceId);
      if (!mapped || mapped.plan !== def.id || mapped.interval !== interval) {
        warnings.push(`${def.label} ${interval}: price ID maps to unexpected plan in catalog`);
      }

      const amountMatch = Math.abs(fetched.unitPriceUsd - expected) < 0.02;
      const intervalOk =
        (interval === "monthly" && fetched.interval === "month") ||
        (interval === "annual" && fetched.interval === "year");

      const productEnv = readEnvPrice(def.env.productKey);
      if (productEnv && fetched.productId && productEnv !== fetched.productId) {
        warnings.push(`${def.label} ${interval}: product ID env does not match Paddle price product`);
      }

      if (!amountMatch) {
        errors.push(
          `${def.label} ${interval}: Paddle amount $${fetched.unitPriceUsd} != expected $${expected}`,
        );
      }
      if (!intervalOk) {
        warnings.push(`${def.label} ${interval}: Paddle interval is ${fetched.interval}`);
      }

      rows.push({
        plan: def.id,
        interval,
        priceId,
        priceIdMasked: maskId(priceId),
        expectedAmountUsd: expected,
        paddleAmountUsd: fetched.unitPriceUsd,
        paddleInterval: fetched.interval,
        productId: fetched.productId,
        ok: amountMatch && intervalOk,
        error: amountMatch && intervalOk ? null : "Amount or interval mismatch",
      });
    }
  }

  const ok =
    envCheck.ok &&
    connectionOk &&
    missingPriceIds.length === 0 &&
    rows.every((r) => r.ok) &&
    errors.length === 0;

  return { ok, connectionOk, errors, warnings, rows, missingPriceIds };
}
