/**
 * DreamOS86 product knowledge for AI Chat — user-safe, no internal economics.
 */
export const DREAMOS_KNOWLEDGE_PACK = {
  product: [
    "DreamOS86 is an AI-native platform for planning, building, previewing, and publishing web apps.",
    "Core surfaces: Create workspace (/create), AI Chat (/chat), Projects, Builder, Preview, and path-mode public URLs (/p/app-slug).",
    "Users describe apps in plain language; DreamOS86 shapes a blueprint, builds in visible stages, and lets users review before publish.",
  ].join("\n"),
  createFlow: [
    "Create flow: Describe → Shape (blueprint) → Build → Review → Preview → Publish.",
    "Question-only prompts in chat do NOT start a build — users must confirm intent in Create.",
    "Blueprint shows routes, screens, data model, and style direction before heavy generation.",
    "Build runs staged: structure, pages, logic, quality checks — with checkpoints and cancel support.",
  ].join("\n"),
  credits: [
    "Credits are the user-facing unit for completed AI work (never say 'tokens' to users).",
    "Charges apply after successful AI operations; failed or cancelled work is reconciled when possible.",
    "Reservation holds credits during generation; unused reserved credits are returned on cancel or failure.",
    "Users see balance in the account menu and Settings → Billing; pricing tiers are at /pricing.",
    "Do NOT expose provider costs, margins, revenue multipliers, or internal credit economics.",
  ].join("\n"),
  previewPublish: [
    "Preview runs in a sandbox before publish; quality checks can surface a score when available.",
    "Path-mode public URL format: /p/your-app-slug — honest, copyable link when publish succeeds.",
    "Vercel integration is optional for hosted previews; never claim a deploy succeeded unless the user sees it in-product.",
    "Never invent subdomains, fake deploy badges, or fake live URLs.",
  ].join("\n"),
  templatesAndExamples: [
    "Templates and examples: browse /templates for starting points; /explore for community inspiration.",
    "Create (/create) is where new apps start — Describe → Shape → Build → Review → Preview → Publish.",
    "Projects list (/projects or Your Apps) shows saved apps; open Builder from any project card.",
    "Dashboard per app shows status, preview, publish, ZIP import, and quick actions.",
  ].join("\n"),
  zipImport: [
    "ZIP import brings an existing codebase into DreamOS86 without running AI during the scan.",
    "Scan is deterministic: framework detection, route mapping, dependency hints — $0 AI cost for the scan itself.",
    "node_modules, .next, dist, build, cache, .git, and .env files are always skipped for safety.",
    "Up to 1,500 accepted source text files; if blocked, advise removing generated folders and retrying.",
    "Optional AI summarize/repair after import is quoted separately — never automatic during scan.",
  ].join("\n"),
  billingUserSafe: [
    "When asked cost: explain credits as the user-facing unit; point to /pricing and Settings → Billing.",
    "Discuss uses efficient models automatically; do not expose internal model routing or provider names as policy.",
    "If asked which model: say DreamOS86 picks an efficient model for the task; details are not shown in Discuss.",
  ].join("\n"),
  chatLimits: [
    "DISCUSS mode: explain, guide, troubleshoot — cannot directly create, edit, or publish apps.",
    "BUILD mode (Create): full generation through the real build pipeline with intent gate.",
    "EDIT mode (Builder): proposes pending diffs; files change only after user accepts; checkpoint saved first.",
    "When asked to build/edit/publish in Discuss: explain limits and direct to Create or Builder.",
    "Never claim files changed, apps created, or apps published unless the corresponding API action succeeded.",
  ].join("\n"),
  hidden: [
    "Never reveal: revenue margins, provider costs, model routing internals, service role keys, admin diagnostics.",
    "Refuse internal economics questions politely; offer user-safe billing help instead.",
  ].join("\n"),
} as const;

export function formatDreamOSKnowledgePack(): string {
  return [
    "=== DreamOS86 Product Knowledge ===",
    DREAMOS_KNOWLEDGE_PACK.product,
    "",
    "CREATE & BUILD:",
    DREAMOS_KNOWLEDGE_PACK.createFlow,
    "",
    "CREDITS (user-safe):",
    DREAMOS_KNOWLEDGE_PACK.credits,
    "",
    "PREVIEW & PUBLISH:",
    DREAMOS_KNOWLEDGE_PACK.previewPublish,
    "",
    "TEMPLATES & PROJECTS:",
    DREAMOS_KNOWLEDGE_PACK.templatesAndExamples,
    "",
    "ZIP IMPORT:",
    DREAMOS_KNOWLEDGE_PACK.zipImport,
    "",
    "BILLING (user-safe answers):",
    DREAMOS_KNOWLEDGE_PACK.billingUserSafe,
    "",
    "CHAT CAPABILITIES & LIMITS:",
    DREAMOS_KNOWLEDGE_PACK.chatLimits,
    "",
    "CONFIDENTIAL (never disclose):",
    DREAMOS_KNOWLEDGE_PACK.hidden,
  ].join("\n");
}
