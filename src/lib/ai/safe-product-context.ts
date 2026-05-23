import { getPublicSiteUrl } from "@/lib/app-url";
import { formatDreamOSKnowledgePack } from "@/lib/ai/dreamos-knowledge-pack";
import type { ChatMode } from "@/lib/ai/chat-mode-policy";
import { getChatModePolicy } from "@/lib/ai/chat-mode-policy";

/**
 * User-safe product context injected into chat system prompts.
 * Excludes revenue, margins, provider costs, and admin diagnostics.
 */
export function getSafeProductContext(mode: ChatMode): string {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const policy = getChatModePolicy(mode);

  return [
    formatDreamOSKnowledgePack(),
    "",
    `ACTIVE MODE: ${mode.toUpperCase()}`,
    `- Build apps: ${policy.canBuildApps ? "yes (via Create pipeline)" : "no — use Create"}`,
    `- Edit files: ${policy.canEditFiles ? "yes (pending diff + accept)" : "no — use Builder"}`,
    `- Publish: ${policy.canPublishApps ? "via in-app publish flow" : "no — use app publish UI"}`,
    `- Redirect hint: ${policy.redirectHint}`,
    "",
    "LINKS:",
    `- Create: ${base}/create`,
    `- Chat: ${base}/chat`,
    `- Projects: ${base}/projects`,
    `- Templates: ${base}/templates`,
    `- Explore: ${base}/explore`,
    `- Pricing: ${base}/pricing`,
    `- Billing: ${base}/settings/billing`,
    `- Help: ${base}/help`,
  ].join("\n");
}
