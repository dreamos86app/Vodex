export type TaskScopeResult = {
  complexity: number;
  featureCount: number;
  integrationCount: number;
  pageCount: number;
  entityCount: number;
  requiresAuth: boolean;
  requiresPayments: boolean;
  requiresRealtime: boolean;
  requiresAdmin: boolean;
  tooLarge: boolean;
  coreV1Only: boolean;
  backlog: string[];
  maxWorkUnits: number;
  maxFiles: number;
};

const FEATURE_SIGNALS =
  /\b(feature|screen|page|view|tab|module|section|dashboard|panel|workflow|integration|api|auth|login|signup|payment|stripe|realtime|websocket|admin|role|notification|search|filter|export|import|chart|calendar|chat|bot|ai)\b/gi;

export function scoreTaskScope(prompt: string): TaskScopeResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const featureMatches = text.match(FEATURE_SIGNALS) ?? [];
  const featureCount = Math.min(40, new Set(featureMatches.map((m) => m.toLowerCase())).size + Math.floor(text.split(/[,;]|\band\b/i).length / 2));

  const integrationCount = (lower.match(/\b(stripe|paypal|supabase|firebase|slack|discord|twilio|sendgrid|oauth|google|apple)\b/g) ?? []).length;
  const pageCount = (lower.match(/\b(page|screen|view|tab)\b/g) ?? []).length;
  const entityCount = (lower.match(/\b(table|entity|model|schema|database|record)\b/g) ?? []).length;

  const requiresAuth = /\b(auth|login|signup|session|jwt|oauth)\b/i.test(lower);
  const requiresPayments = /\b(payment|stripe|checkout|billing|subscription)\b/i.test(lower);
  const requiresRealtime = /\b(realtime|websocket|live|stream)\b/i.test(lower);
  const requiresAdmin = /\b(admin|moderator|role|permission)\b/i.test(lower);

  let complexity = 3;
  complexity += Math.min(4, Math.floor(featureCount / 3));
  complexity += Math.min(2, integrationCount);
  complexity += Math.min(2, Math.floor(pageCount / 2));
  complexity += requiresAuth ? 1 : 0;
  complexity += requiresPayments ? 1 : 0;
  complexity += requiresRealtime ? 1 : 0;
  complexity += requiresAdmin ? 1 : 0;
  if (text.length > 1200) complexity += 1;
  complexity = Math.min(10, Math.max(1, complexity));

  const tooLarge =
    featureCount > 12 ||
    integrationCount > 4 ||
    pageCount > 10 ||
    (lower.match(/\b(and|also|plus|with)\b/gi) ?? []).length > 8;

  const backlog: string[] = [];
  if (tooLarge) {
    const parts = text.split(/[,;]|\n/).map((p) => p.trim()).filter((p) => p.length > 8);
    backlog.push(...parts.slice(6));
  }

  return {
    complexity,
    featureCount,
    integrationCount,
    pageCount,
    entityCount,
    requiresAuth,
    requiresPayments,
    requiresRealtime,
    requiresAdmin,
    tooLarge,
    coreV1Only: tooLarge,
    backlog,
    maxWorkUnits: complexity >= 8 ? 14 : complexity >= 5 ? 12 : 10,
    maxFiles: complexity >= 8 ? 82 : complexity >= 5 ? 58 : 38,
  };
}
