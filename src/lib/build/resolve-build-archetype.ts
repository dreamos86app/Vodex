/**
 * P1.3.18 — Blueprint is source of truth for archetype/routes on approved builds.
 */
import {
  classifyAppArchetype,
  type AppArchetype,
  type AppArchetypeId,
} from "@/lib/build/app-archetype-classifier";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { ARCHETYPE_DEFS } from "@/lib/build/app-archetype-classifier";

const BLUEPRINT_TYPE_TO_ARCHETYPE: Array<{ re: RegExp; id: AppArchetypeId }> = [
  { re: /food\s*delivery|wolt|uber\s*eats|doordash|restaurant\s*menu|courier|delivery\s*tracking/i, id: "food_delivery_marketplace" },
  { re: /finance|budget|expense|ledger|savings|spending|bank/i, id: "finance_tracker" },
  { re: /bootcamp|cohort|assignment|mentor|graduation|education\s*portal/i, id: "education" },
  { re: /marketplace|auction|bidding|seller|buyer/i, id: "marketplace" },
  { re: /booking|salon|studio|appointment/i, id: "booking" },
  { re: /restaurant|kitchen|inventory|pantry|barcode|expiry alert|shopping list/i, id: "restaurant_inventory" },
  { re: /crm|sales\s*pipeline/i, id: "crm" },
  { re: /e-?commerce|storefront|cart/i, id: "ecommerce" },
];

function archetypeIdFromFields(fields: {
  appType: string;
  category?: string;
  oneSentencePitch: string;
  primaryUserJobs: string[];
}): AppArchetypeId | null {
  const blob = `${fields.appType} ${fields.category ?? ""} ${fields.oneSentencePitch} ${fields.primaryUserJobs.join(" ")}`;
  for (const row of BLUEPRINT_TYPE_TO_ARCHETYPE) {
    if (row.re.test(blob)) return row.id;
  }
  return null;
}

function archetypeIdFromBlueprint(blueprint: AppBlueprint): AppArchetypeId | null {
  return archetypeIdFromFields(blueprint);
}

export function archetypeFromBlueprint(blueprint: AppBlueprint): AppArchetype {
  const id = archetypeIdFromBlueprint(blueprint) ?? "generic_app";
  const def = ARCHETYPE_DEFS[id as AppArchetypeId] ?? ARCHETYPE_DEFS.generic_app;
  const routes =
    blueprint.routeMap?.map((r) => (typeof r === "string" ? r : r.route)).filter(Boolean) ??
    blueprint.pages?.map((p) => p.route) ??
    def.coreRoutes;
  return {
    id: id as AppArchetypeId,
    ...def,
    coreRoutes: routes.length ? routes : def.coreRoutes,
    confidence: 0.95,
  };
}

export function resolveBuildArchetype(input: {
  buildIntent: string;
  blueprint?: AppBlueprint | null;
  blueprintBlock?: string | null;
}): AppArchetype {
  if (input.blueprint) {
    return archetypeFromBlueprint(input.blueprint);
  }
  if (input.blueprintBlock?.includes("APPROVED APP BLUEPRINT")) {
    try {
      const jsonStart = input.blueprintBlock.indexOf("{");
      const jsonEnd = input.blueprintBlock.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(input.blueprintBlock.slice(jsonStart, jsonEnd + 1)) as {
          appType?: string;
          routeMap?: Array<{ route: string; purpose?: string }>;
          pages?: Array<{ route: string; purpose?: string }>;
          primaryUserJobs?: string[];
          oneSentencePitch?: string;
        };
        const routes = (parsed.routeMap ?? parsed.pages ?? [{ route: "/" }])
          .map((r) => r.route)
          .filter(Boolean);
        const id =
          archetypeIdFromFields({
            appType: parsed.appType ?? "App",
            oneSentencePitch: parsed.oneSentencePitch ?? "",
            primaryUserJobs: parsed.primaryUserJobs ?? [],
          }) ?? "generic_app";
        const def = ARCHETYPE_DEFS[id] ?? ARCHETYPE_DEFS.generic_app;
        return {
          id,
          ...def,
          coreRoutes: routes.length ? routes : def.coreRoutes,
          confidence: 0.95,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return classifyAppArchetype(input.buildIntent);
}
