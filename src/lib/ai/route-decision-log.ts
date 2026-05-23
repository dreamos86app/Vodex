/**
 * Admin-only route decision evidence (never shown to normal users).
 */
export type RouteDecisionRecord = {
  stage: string;
  selectedModel: string;
  reason: string;
  maxTokens?: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  fallback?: boolean;
  cacheHit?: boolean;
  escalationReason?: string;
  timestamp: string;
};

const recent: RouteDecisionRecord[] = [];
const MAX = 200;

export function logRouteDecision(record: Omit<RouteDecisionRecord, "timestamp">): void {
  recent.unshift({ ...record, timestamp: new Date().toISOString() });
  if (recent.length > MAX) recent.length = MAX;
  if (process.env.NODE_ENV !== "production") {
    console.info("[route-decision]", record.stage, record.reason);
  }
}

export function getRecentRouteDecisions(limit = 50): RouteDecisionRecord[] {
  return recent.slice(0, limit);
}
