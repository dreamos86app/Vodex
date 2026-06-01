import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { assertActionCreditsAffordable } from "@/lib/action-credits/assert-action-credits-affordable";
import { getActionCreditAvailability } from "@/lib/action-credits/get-action-credit-availability";
import { chargeActionCredit } from "@/lib/action-credits/charge-action-credit";
import { quoteLogoRegenerationCredits } from "@/lib/action-credits/logo-generation-pricing";
import {
  isDreamOSMediaProviderDisabled,
  routeDreamOSMedia,
} from "@/lib/media/dreamos-media-router";
import { generateAppName } from "@/lib/projects/app-name-generator";
import {
  buildFallbackIconSvg,
  generateAppLogoWithOpenAi,
  generateBrandIconFromSvg,
  isAiLogoGenerationAvailable,
  type LogoAssetUrls,
} from "@/lib/projects/app-logo-generation";
import { refundActionCredit } from "@/lib/action-credits/refund-action-credit";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { isProvisionalAppName } from "@/lib/projects/provisional-app-name";

type Writer = SupabaseClient<Database>;

export type IconGenerationMode =
  | "ai_openai_mini"
  | "deterministic_fallback"
  | "user_uploaded"
  | "skipped_no_action_credits"
  | "skipped_no_openai_key"
  | "skipped_provider_disabled"
  | "reused_existing";

export type AppIdentityResult = {
  appName: string;
  slug: string;
  shortDescription: string;
  category: string;
  namingConfidence: number;
  namingSource: "build_intent" | "fallback";
  iconSvg: string;
  iconUrl: string | null;
  logoAssets: Partial<LogoAssetUrls>;
  logoGenerationStatus: "generated" | "fallback" | "skipped" | "insufficient_credits" | "failed";
  logoGenerationError: string | null;
  logoGenerationActionCreditCost: number;
  logoGenerationOperationId: string;
  reused: boolean;
  userNotice?: string;
  iconGenerationMode?: IconGenerationMode;
  iconStoragePath?: string | null;
  iconProviderCostUsd?: number;
  iconErrorCode?: string | null;
};

export type CreateAppIdentityInput = {
  writer: Writer;
  userId: string;
  userEmail?: string | null;
  projectId: string;
  buildOperationId: string;
  buildIntent: string;
  planSummary?: string;
  categoryHint?: string;
  userSelectedModelId?: string | null;
  onProgress?: (step: string) => void;
  /** Skip AI logo (e.g. idempotent reuse). */
  skipLogo?: boolean;
};

function isUserUploadedProjectIcon(
  iconUrl: string | null | undefined,
  prevIdentity: Record<string, unknown> | null,
): boolean {
  if (prevIdentity?.user_icon_uploaded === true) return true;
  if (prevIdentity?.logo_generation_mode === "user_uploaded") return true;
  if (prevIdentity?.logo_generation_status === "user_uploaded") return true;
  const url = iconUrl?.trim() ?? "";
  if (!url) return false;
  if (url.includes("/storage/v1/object/public/project-icons/")) return false;
  if (url.includes("/api/projects/") && url.endsWith("/icon")) return false;
  return true;
}

function metaRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function readStoredIdentity(meta: Record<string, unknown>, buildOperationId: string): AppIdentityResult | null {
  const identity = meta.app_identity;
  if (!identity || typeof identity !== "object") return null;
  const row = identity as Record<string, unknown>;
  if (row.build_operation_id !== buildOperationId) return null;
  if (typeof row.app_name !== "string") return null;

  return {
    appName: row.app_name,
    slug: typeof row.slug === "string" ? row.slug : row.app_name.toLowerCase(),
    shortDescription: typeof row.short_description === "string" ? row.short_description : "",
    category: typeof row.category === "string" ? row.category : "productivity",
    namingConfidence: typeof row.naming_confidence === "number" ? row.naming_confidence : 0.8,
    namingSource: row.naming_source === "fallback" ? "fallback" : "build_intent",
    iconSvg: typeof row.icon_svg === "string" ? row.icon_svg : buildFallbackIconSvg(row.app_name),
    iconUrl: typeof row.icon_url === "string" ? row.icon_url : null,
    logoAssets: {
      iconOriginalUrl: typeof row.icon_original_url === "string" ? row.icon_original_url : undefined,
      icon512Url: typeof row.icon_512_url === "string" ? row.icon_512_url : undefined,
      icon192Url: typeof row.icon_192_url === "string" ? row.icon_192_url : undefined,
      faviconUrl: typeof row.favicon_url === "string" ? row.favicon_url : undefined,
    },
    logoGenerationStatus:
      row.logo_generation_status === "generated" ||
      row.logo_generation_status === "fallback" ||
      row.logo_generation_status === "skipped" ||
      row.logo_generation_status === "insufficient_credits" ||
      row.logo_generation_status === "failed"
        ? row.logo_generation_status
        : "fallback",
    logoGenerationError: typeof row.logo_generation_error === "string" ? row.logo_generation_error : null,
    logoGenerationActionCreditCost:
      typeof row.logo_generation_action_credit_cost === "number" ? row.logo_generation_action_credit_cost : 0,
    logoGenerationOperationId:
      typeof row.logo_generation_operation_id === "string"
        ? row.logo_generation_operation_id
        : `${buildOperationId}:logo`,
    reused: true,
  };
}

export async function ensureIdempotentIdentity(
  writer: Writer,
  projectId: string,
  buildOperationId: string,
): Promise<AppIdentityResult | null> {
  const { data } = await writer.from("projects").select("metadata").eq("id", projectId).maybeSingle();
  return readStoredIdentity(metaRecord(data?.metadata), buildOperationId);
}

export async function persistAppIdentity(
  writer: Writer,
  projectId: string,
  userId: string,
  identity: AppIdentityResult,
  buildOperationId: string,
): Promise<void> {
  const { data: cur } = await writer
    .from("projects")
    .select("metadata, name")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const prevMeta = metaRecord(cur?.metadata);
  const curName = cur?.name?.trim() ?? "";
  const shouldRename = !curName || isProvisionalAppName(curName);

  const identityMeta = {
    build_operation_id: buildOperationId,
    app_name: identity.appName,
    slug: identity.slug,
    short_description: identity.shortDescription,
    category: identity.category,
    naming_confidence: identity.namingConfidence,
    naming_source: identity.namingSource,
    icon_svg: identity.iconSvg,
    icon_url: identity.iconUrl,
    icon_original_url: identity.logoAssets.iconOriginalUrl ?? null,
    icon_512_url: identity.logoAssets.icon512Url ?? null,
    icon_192_url: identity.logoAssets.icon192Url ?? null,
    favicon_url: identity.logoAssets.faviconUrl ?? null,
    logo_generation_status: identity.logoGenerationStatus,
    logo_generation_error: identity.logoGenerationError,
    logo_generated_at: identity.logoGenerationStatus === "generated" ? new Date().toISOString() : null,
    logo_generation_action_credit_cost: identity.logoGenerationActionCreditCost,
    logo_generation_operation_id: identity.logoGenerationOperationId,
    icon_generation_mode: identity.iconGenerationMode ?? null,
    icon_storage_path: identity.iconStoragePath ?? null,
    icon_provider_cost_usd: identity.iconProviderCostUsd ?? null,
    icon_error_code: identity.iconErrorCode ?? null,
    icon_credit_charged: identity.logoGenerationActionCreditCost > 0,
  };

  const patch: Record<string, unknown> = {
    app_name: identity.appName,
    short_description: identity.shortDescription.slice(0, 240),
    category: identity.category.slice(0, 64),
    icon_svg: identity.iconSvg,
    metadata: {
      ...prevMeta,
      app_identity: identityMeta,
      app_name: identity.appName,
    } as Json,
  };

  if (shouldRename) {
    patch.name = identity.appName.slice(0, 80);
    patch.slug = identity.slug.slice(0, 48);
  }
  if (identity.iconUrl) {
    patch.icon_url = identity.iconUrl;
  }

  await writer.from("projects").update(patch as never).eq("id", projectId).eq("owner_id", userId);
}

export async function createAppIdentityForBuild(input: CreateAppIdentityInput): Promise<AppIdentityResult> {
  const existing = await ensureIdempotentIdentity(input.writer, input.projectId, input.buildOperationId);
  if (existing) return existing;

  const { data: projRow } = await input.writer
    .from("projects")
    .select("icon_url, metadata, name")
    .eq("id", input.projectId)
    .maybeSingle();
  const prevMeta = metaRecord(projRow?.metadata);
  const prevIdentity =
    prevMeta.app_identity && typeof prevMeta.app_identity === "object"
      ? (prevMeta.app_identity as Record<string, unknown>)
      : null;

  if (
    !input.skipLogo &&
    projRow?.icon_url &&
    prevIdentity &&
    isUserUploadedProjectIcon(projRow.icon_url, prevIdentity)
  ) {
    const reused: AppIdentityResult = {
      appName: typeof prevIdentity.app_name === "string" ? prevIdentity.app_name : projRow.name ?? "Dream App",
      slug: typeof prevIdentity.slug === "string" ? prevIdentity.slug : "dream-app",
      shortDescription: typeof prevIdentity.short_description === "string" ? prevIdentity.short_description : "",
      category: typeof prevIdentity.category === "string" ? prevIdentity.category : "productivity",
      namingConfidence: 0.95,
      namingSource: "build_intent",
      iconSvg: typeof prevIdentity.icon_svg === "string" ? prevIdentity.icon_svg : buildFallbackIconSvg(projRow.name ?? "Dream App"),
      iconUrl: projRow.icon_url,
      logoAssets: {},
      logoGenerationStatus: "generated",
      logoGenerationError: null,
      logoGenerationActionCreditCost: 0,
      logoGenerationOperationId: `${input.buildOperationId}:logo`,
      reused: true,
      iconGenerationMode: "user_uploaded",
    };
    await persistAppIdentity(input.writer, input.projectId, input.userId, reused, input.buildOperationId);
    return reused;
  }

  if (
    !input.skipLogo &&
    projRow?.icon_url &&
    prevIdentity &&
    prevIdentity.logo_generation_status === "generated" &&
    (prevIdentity.icon_generation_mode === "ai_openai_mini" ||
      String(projRow.icon_url).includes("project-icons"))
  ) {
    const row = prevIdentity as Record<string, unknown>;
    const reused: AppIdentityResult = {
      appName: typeof row.app_name === "string" ? row.app_name : projRow.name ?? "Dream App",
      slug: typeof row.slug === "string" ? row.slug : "dream-app",
      shortDescription: typeof row.short_description === "string" ? row.short_description : "",
      category: typeof row.category === "string" ? row.category : "productivity",
      namingConfidence: 0.9,
      namingSource: "build_intent",
      iconSvg: typeof row.icon_svg === "string" ? row.icon_svg : buildFallbackIconSvg(projRow.name ?? "Dream App"),
      iconUrl: projRow.icon_url,
      logoAssets: {
        iconOriginalUrl: typeof row.icon_original_url === "string" ? row.icon_original_url : undefined,
        icon512Url: typeof row.icon_512_url === "string" ? row.icon_512_url : undefined,
        icon192Url: typeof row.icon_192_url === "string" ? row.icon_192_url : undefined,
        faviconUrl: typeof row.favicon_url === "string" ? row.favicon_url : undefined,
      },
      logoGenerationStatus: "generated",
      logoGenerationError: null,
      logoGenerationActionCreditCost: 0,
      logoGenerationOperationId: `${input.buildOperationId}:logo`,
      reused: true,
      iconGenerationMode: "reused_existing",
    };
    await persistAppIdentity(input.writer, input.projectId, input.userId, reused, input.buildOperationId);
    return reused;
  }

  input.onProgress?.("Naming your app");
  const named = await generateAppName({
    buildIntent: input.buildIntent,
    planSummary: input.planSummary,
    writer: input.writer,
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: input.buildOperationId,
    projectId: input.projectId,
    userSelectedModelId: input.userSelectedModelId,
  });

  const category = input.categoryHint?.trim() || "productivity";
  const logoOperationId = `${input.buildOperationId}:logo`;
  let iconSvg = buildFallbackIconSvg(named.appName, category);
  let iconUrl: string | null = null;
  let logoAssets: Partial<LogoAssetUrls> = {};
  let logoGenerationStatus: AppIdentityResult["logoGenerationStatus"] = "skipped";
  let logoGenerationError: string | null = null;
  let logoGenerationActionCreditCost = 0;
  let userNotice: string | undefined;
  let iconGenerationMode: IconGenerationMode | undefined;
  let iconStoragePath: string | null = null;
  let iconProviderCostUsd = 0;
  let iconErrorCode: string | null = null;

  if (!input.skipLogo) {
    input.onProgress?.("Designing app icon");
    const mediaRoute = routeDreamOSMedia("logo");
    const providerDisabled = isDreamOSMediaProviderDisabled("logo");
    const aiAvailable = isAiLogoGenerationAvailable();

    const applyDeterministicFallback = async (notice?: string) => {
      const brand = await generateBrandIconFromSvg({
        projectId: input.projectId,
        operationId: logoOperationId,
        appName: named.appName,
        category,
      });
      if (brand.ok) {
        iconUrl = brand.urls.iconUrl;
        logoAssets = brand.urls;
        logoGenerationStatus = "fallback";
        iconGenerationMode = "deterministic_fallback";
        iconStoragePath = `${input.projectId}/${logoOperationId}`;
        userNotice = notice;
        logoGenerationError = null;
      } else {
        logoGenerationError = brand.error;
        iconErrorCode = brand.error;
        iconSvg = buildFallbackIconSvg(named.appName, category);
        logoGenerationStatus = "fallback";
        iconGenerationMode = "deterministic_fallback";
      }
    };

    if (providerDisabled) {
      iconGenerationMode = "skipped_provider_disabled";
      await applyDeterministicFallback();
    } else if (!aiAvailable) {
      iconGenerationMode = "skipped_no_openai_key";
      await applyDeterministicFallback();
    } else {
      const creditAvail = await getActionCreditAvailability(input.userId, {
        projectId: input.projectId,
        actionType: "app_icon_ai_generation",
        providerCostUsd: mediaRoute.estimatedProviderCostUsd,
      });

      const afford = await assertActionCreditsAffordable({
        ownerUserId: input.userId,
        projectId: input.projectId,
        actionType: "app_icon_ai_generation",
        providerCostUsd: mediaRoute.estimatedProviderCostUsd,
      });

      if (!afford.ok || !creditAvail.available) {
        iconGenerationMode = "skipped_no_action_credits";
        logoGenerationStatus = "insufficient_credits";
        await applyDeterministicFallback(
          !creditAvail.available
            ? "Generated a fallback icon because Action Credits were unavailable."
            : undefined,
        );
        await logServerOperation({
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail ?? null,
          stage: "build",
          event: "app_icon_credit_check",
          status: "skipped",
          mode: "build",
          projectId: input.projectId,
          operationId: logoOperationId,
          metadata: {
            icon_generation_mode: "skipped_no_action_credits",
            credit_avail: creditAvail,
            afford_ok: afford.ok,
          },
        });
      } else {
        const charge = await chargeActionCredit({
          ownerUserId: input.userId,
          projectId: input.projectId,
          actionType: "app_icon_ai_generation",
          operationId: logoOperationId,
          provider: mediaRoute.internal.provider,
          providerCostUsd: mediaRoute.estimatedProviderCostUsd,
          metadata: {
            dreamos_label: mediaRoute.userLabel,
            model_id: mediaRoute.internal.modelId,
            project_id: input.projectId,
            build_operation_id: input.buildOperationId,
            charge_from_user_pool: true,
          },
        });

        if (!charge.ok) {
          iconGenerationMode = "skipped_no_action_credits";
          logoGenerationStatus = "insufficient_credits";
          await applyDeterministicFallback();
          await logServerOperation({
            writer: input.writer,
            userId: input.userId,
            userEmail: input.userEmail ?? null,
            stage: "build",
            event: "app_icon_charge_failed",
            status: "error",
            mode: "build",
            projectId: input.projectId,
            operationId: logoOperationId,
            errorMessage: charge.error,
            metadata: { credit_avail: creditAvail },
          });
        } else {
          const logo = await generateAppLogoWithOpenAi({
            projectId: input.projectId,
            operationId: logoOperationId,
            appName: named.appName,
            shortDescription: named.shortDescription,
            category,
          });

          if (logo.ok) {
            input.onProgress?.("Saving brand assets");
            logoGenerationActionCreditCost = charge.charged;
            iconProviderCostUsd = logo.providerCostUsd;
            iconUrl = logo.urls.iconUrl;
            logoAssets = logo.urls;
            logoGenerationStatus = "generated";
            iconGenerationMode = "ai_openai_mini";
            iconStoragePath = `${input.projectId}/${logoOperationId}`;
            await logServerOperation({
              writer: input.writer,
              userId: input.userId,
              userEmail: input.userEmail ?? null,
              stage: "build",
              event: "app_icon_generated",
              status: "ok",
              mode: "build",
              modelId: logo.modelId,
              projectId: input.projectId,
              operationId: logoOperationId,
              metadata: {
                icon_generation_mode: "ai_openai_mini",
                icon_url: logo.urls.iconUrl,
                action_credits_charged: charge.charged,
                provider_cost_usd: logo.providerCostUsd,
              },
            });
          } else {
            logoGenerationError = logo.error;
            iconErrorCode = logo.error;
            await refundActionCredit({
              ownerUserId: input.userId,
              projectId: input.projectId,
              operationId: logoOperationId,
              reason: "openai_image_failed",
            });
            logoGenerationActionCreditCost = 0;
            await applyDeterministicFallback();
          }
        }
      }
    }
  }

  const result: AppIdentityResult = {
    appName: named.appName,
    slug: named.slug,
    shortDescription: named.shortDescription,
    category,
    namingConfidence: named.namingConfidence,
    namingSource: named.source,
    iconSvg,
    iconUrl,
    logoAssets,
    logoGenerationStatus,
    logoGenerationError,
    logoGenerationActionCreditCost,
    logoGenerationOperationId: logoOperationId,
    reused: false,
    userNotice,
    iconGenerationMode,
    iconStoragePath,
    iconProviderCostUsd,
    iconErrorCode,
  };

  await persistAppIdentity(input.writer, input.projectId, input.userId, result, input.buildOperationId);
  return result;
}

export async function regenerateAppLogo(input: {
  writer: Writer;
  userId: string;
  projectId: string;
  operationId: string;
  appName: string;
  shortDescription: string;
  category?: string;
}): Promise<
  | { ok: true; identity: AppIdentityResult; charged: number }
  | { ok: false; error: string; code: "insufficient" | "generation" | "storage" }
> {
  const mediaRoute = routeDreamOSMedia("logo");
  const quote = quoteLogoRegenerationCredits(mediaRoute.estimatedProviderCostUsd);

  const afford = await assertActionCreditsAffordable({
    ownerUserId: input.userId,
    projectId: input.projectId,
    actionType: "app_logo_regeneration",
    providerCostUsd: mediaRoute.estimatedProviderCostUsd,
    dynamicFloor: quote.finalActionCredits,
  });
  if (!afford.ok) {
    return { ok: false, error: "Action Credits depleted.", code: "insufficient" };
  }

  const charge = await chargeActionCredit({
    ownerUserId: input.userId,
    projectId: input.projectId,
    actionType: "app_logo_regeneration",
    operationId: input.operationId,
    provider: mediaRoute.internal.provider,
    providerCostUsd: mediaRoute.estimatedProviderCostUsd,
    metadata: {
      dreamos_label: mediaRoute.userLabel,
      regenerate: true,
      project_id: input.projectId,
      charge_from_user_pool: true,
    },
  });

  if (!charge.ok) {
    return {
      ok: false,
      error: charge.error,
      code: charge.code === "insufficient" ? "insufficient" : "generation",
    };
  }

  const logo = await generateAppLogoWithOpenAi({
    projectId: input.projectId,
    operationId: input.operationId,
    appName: input.appName,
    shortDescription: input.shortDescription,
    category: input.category,
  });

  if (!logo.ok) {
    await refundActionCredit({
      ownerUserId: input.userId,
      projectId: input.projectId,
      operationId: input.operationId,
      reason: "openai_image_failed",
    });
    return { ok: false, error: logo.error, code: "generation" };
  }

  const identity: AppIdentityResult = {
    appName: input.appName,
    slug: input.appName.toLowerCase().replace(/\s+/g, "-"),
    shortDescription: input.shortDescription,
    category: input.category ?? "productivity",
    namingConfidence: 1,
    namingSource: "build_intent",
    iconSvg: buildFallbackIconSvg(input.appName, input.category),
    iconUrl: logo.urls.iconUrl,
    logoAssets: logo.urls,
    logoGenerationStatus: "generated",
    logoGenerationError: null,
    logoGenerationActionCreditCost: charge.charged,
    logoGenerationOperationId: input.operationId,
    reused: false,
  };

  await persistAppIdentity(input.writer, input.projectId, input.userId, identity, input.operationId);
  return { ok: true, identity, charged: charge.charged };
}
