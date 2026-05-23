export type BenchmarkPromptResult = {
  id: string;
  prompt: string;
  category: string;
  filesGenerated: number;
  routesGenerated: number;
  placeholderRate: number;
  mobileReady: boolean;
  buildSuccess: boolean;
  previewSuccess: boolean;
  publishReady: boolean;
  qualityScore: number;
  costCredits: number;
  modelRoute: string;
  cacheHit: boolean;
  errors: string[];
  uiCompleteness?: number;
  appSpecificRelevance?: number;
  visualPolish?: number;
  mobileReadiness?: number;
  routeCompleteness?: number;
  interactionCompleteness?: number;
  qualityBeforePolish?: number;
  qualityAfterPolish?: number;
};

/** Per-prompt live benchmark result — full schema for scoreboard evidence. */
export type LiveBenchmarkPromptResult = {
  promptId: string;
  prompt: string;
  category: string;
  projectId: string | null;
  templateId: string;
  stylePresetId: string;
  buildTier: string;
  createdProject: boolean;
  blueprintGenerated: boolean;
  blueprintApproved: boolean;
  buildStarted: boolean;
  buildCompleted: boolean;
  filesGenerated: boolean;
  fileCount: number;
  routeCount: number;
  validatorPassed: boolean;
  uiQualityScore: number;
  uiValidated: boolean;
  blueprintScore: number;
  templateInfluenceScore: number;
  backendCompleteness: number;
  databaseDepthScore: number;
  previewReadiness: boolean;
  publishReadiness: boolean;
  placeholderRate: number;
  creditsReserved: number;
  creditsUsed: number;
  providerCostUsd: number;
  modelRouteSummary: string;
  cacheHitRate: number;
  status: "passed" | "failed" | "partial" | "skipped";
  failureStage: string | null;
  failureReason: string | null;
  durationMs: number;
  createdAt: string;
};

export type BenchmarkReport = {
  runAt: string;
  promptCount: number;
  buildSuccessRate: number;
  previewSuccessRate: number;
  publishReadinessRate: number;
  placeholderRate: number;
  averageQualityScore: number;
  averageCostCredits: number;
  results: BenchmarkPromptResult[];
  uiCompleteness?: number;
  appSpecificRelevance?: number;
  visualPolish?: number;
  mobileReadiness?: number;
  routeCompleteness?: number;
  interactionCompleteness?: number;
  qualityBeforePolish?: number;
  qualityAfterPolish?: number;
  validatorFailMarkedGenerated?: number;
};

export type LiveBenchmarkReport = Omit<BenchmarkReport, "results"> & {
  mode: "live_passed" | "live_partial" | "live_failed" | "structure_readiness" | "not_run";
  scale: string;
  live: boolean;
  smokePassed: boolean;
  reason: string;
  averageBlueprintScore: number;
  templateInfluenceRate: number;
  backendPlanCompleteness: number;
  databaseDepthAverage: number;
  uiValidationRate: number;
  fileGenerationRate: number;
  previewReadinessRate: number;
  averageProviderCostUsd: number;
  totalProviderCostUsd: number;
  failedPrompts: string[];
  topFailureStages: Array<{ stage: string; count: number }>;
  benchmarkRunId?: string;
  halfBenchmarkReady?: boolean;
  fullBenchmarkReady?: boolean;
  fullBenchmarkPending?: boolean;
  results: LiveBenchmarkPromptResult[];
};

export function scorePromptResult(input: {
  id: string;
  prompt: string;
  category: string;
  files: Array<{ path: string; content: string }>;
  buildSuccess: boolean;
  previewSuccess: boolean;
  publishReady: boolean;
  costCredits?: number;
  modelRoute?: string;
  cacheHit?: boolean;
  errors?: string[];
  uiReviewScore?: number;
  appTypeScore?: number;
}): BenchmarkPromptResult {
  const placeholderRe = /(lorem ipsum|TODO:|placeholder|coming soon|your app here)/i;
  let placeholderHits = 0;
  const routes = new Set<string>();
  const uiContent = input.files.map((f) => f.content).join("\n");

  for (const f of input.files) {
    if (placeholderRe.test(f.content)) placeholderHits++;
    if (/\/page\.(tsx|jsx)/i.test(f.path) || f.path === "index.html") routes.add(f.path);
  }

  const placeholderRate = input.files.length ? placeholderHits / input.files.length : 1;
  const mobileReady = input.files.some((f) => /sm:|md:|mobile|responsive/i.test(f.content));

  const uiCompleteness =
    (uiContent.match(/nav|sidebar|header/gi)?.length ?? 0) > 0 &&
    (uiContent.match(/card|grid|section/gi)?.length ?? 0) > 0
      ? 80
      : 40;
  const appSpecificRelevance = input.appTypeScore ?? (input.category ? 60 : 50);
  const visualPolish = /rounded|shadow|font-|gap-|text-(xs|sm|lg)/i.test(uiContent) ? 75 : 35;
  const mobileReadiness = mobileReady ? 85 : 30;
  const routeCompleteness = routes.size >= 2 ? 90 : routes.size === 1 ? 60 : 20;
  const interactionCompleteness = /onClick|onSubmit|useState|form|button/i.test(uiContent) ? 80 : 35;

  let qualityBeforePolish = input.uiReviewScore ?? 0;
  if (!qualityBeforePolish) {
    qualityBeforePolish = 0;
    if (input.buildSuccess) qualityBeforePolish += 30;
    if (placeholderRate < 0.05) qualityBeforePolish += 20;
    qualityBeforePolish += Math.round((uiCompleteness + visualPolish) / 4);
  }
  const qualityAfterPolish = Math.min(100, qualityBeforePolish + (input.publishReady ? 10 : 0));

  let qualityScore = qualityAfterPolish;
  if (input.previewSuccess && qualityScore < 70) qualityScore += 10;
  if (placeholderRate < 0.05 && qualityScore < 85) qualityScore += 5;

  return {
    id: input.id,
    prompt: input.prompt,
    category: input.category,
    filesGenerated: input.files.length,
    routesGenerated: routes.size,
    placeholderRate,
    mobileReady,
    buildSuccess: input.buildSuccess,
    previewSuccess: input.previewSuccess,
    publishReady: input.publishReady,
    qualityScore: Math.min(100, qualityScore),
    costCredits: input.costCredits ?? 0,
    modelRoute: input.modelRoute ?? "unknown",
    cacheHit: input.cacheHit ?? false,
    errors: input.errors ?? [],
    uiCompleteness,
    appSpecificRelevance,
    visualPolish,
    mobileReadiness,
    routeCompleteness,
    interactionCompleteness,
    qualityBeforePolish,
    qualityAfterPolish,
  };
}

function avgNum(results: LiveBenchmarkPromptResult[], pick: (r: LiveBenchmarkPromptResult) => number): number {
  if (!results.length) return 0;
  return results.reduce((s, r) => s + pick(r), 0) / results.length;
}

export function aggregateLiveBenchmarkReport(
  results: LiveBenchmarkPromptResult[],
  meta: {
    scale: string;
    benchmarkRunId: string;
    maxCostUsd: number;
    totalProviderCostUsd: number;
  },
): LiveBenchmarkReport {
  const n = results.length || 1;
  const buildSuccessRate = results.filter((r) => r.buildCompleted && r.filesGenerated).length / n;
  const fileGenerationRate = results.filter((r) => r.filesGenerated).length / n;
  const uiValidationRate = results.filter((r) => r.uiValidated).length / n;
  const previewReadinessRate = results.filter((r) => r.previewReadiness).length / n;
  const publishReadinessRate = results.filter((r) => r.publishReadiness).length / n;
  const placeholderRate = avgNum(results, (r) => r.placeholderRate);
  const averageQualityScore = avgNum(results, (r) => r.uiQualityScore);
  const averageBlueprintScore = avgNum(results, (r) => r.blueprintScore);
  const templateInfluenceRate =
    results.filter((r) => r.templateInfluenceScore >= 100).length / n;
  const backendPlanCompleteness = avgNum(results, (r) => r.backendCompleteness) / 100;
  const databaseDepthAverage = avgNum(results, (r) => r.databaseDepthScore);

  const failed = results.filter((r) => r.status === "failed" || r.status === "skipped");
  const stageCounts = new Map<string, number>();
  for (const r of failed) {
    const s = r.failureStage ?? "unknown";
    stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
  }
  const topFailureStages = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  const targetsOk =
    buildSuccessRate >= 0.9 &&
    fileGenerationRate >= 0.9 &&
    uiValidationRate >= 0.9 &&
    averageQualityScore >= 88 &&
    averageBlueprintScore >= 85 &&
    templateInfluenceRate >= 0.9 &&
    backendPlanCompleteness >= 0.8 &&
    databaseDepthAverage >= 80 &&
    previewReadinessRate >= 0.85 &&
    publishReadinessRate >= 0.85 &&
    placeholderRate <= 0.05;

  const scaleCount = meta.scale === "full" ? 50 : meta.scale === "smoke" ? 10 : 25;

  return {
    runAt: new Date().toISOString(),
    mode: targetsOk ? "live_passed" : buildSuccessRate > 0 ? "live_partial" : "live_failed",
    scale: meta.scale,
    live: true,
    promptCount: results.length,
    buildSuccessRate,
    previewSuccessRate: previewReadinessRate,
    publishReadinessRate,
    placeholderRate,
    averageQualityScore,
    averageCostCredits: avgNum(results, (r) => r.creditsUsed),
    averageBlueprintScore,
    templateInfluenceRate,
    backendPlanCompleteness,
    databaseDepthAverage,
    uiValidationRate,
    fileGenerationRate,
    previewReadinessRate,
    averageProviderCostUsd: avgNum(results, (r) => r.providerCostUsd),
    totalProviderCostUsd: meta.totalProviderCostUsd,
    smokePassed: targetsOk,
    reason: targetsOk
      ? `Live ${meta.scale}: ${results.filter((r) => r.status === "passed").length}/${results.length} passed`
      : `Live ${meta.scale} partial — see failedPrompts`,
    failedPrompts: failed.map((r) => r.promptId),
    topFailureStages,
    benchmarkRunId: meta.benchmarkRunId,
    halfBenchmarkReady: meta.scale === "half" && results.length >= 25,
    fullBenchmarkReady: meta.scale === "full" && results.length >= 50,
    fullBenchmarkPending: meta.scale !== "full" || results.length < 50,
    validatorFailMarkedGenerated: 0,
    results,
  };
}

function avg(results: BenchmarkPromptResult[], key: keyof BenchmarkPromptResult): number {
  if (!results.length) return 0;
  const sum = results.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  return sum / results.length;
}

export function aggregateBenchmarkReport(results: BenchmarkPromptResult[]): BenchmarkReport {
  const n = results.length || 1;
  return {
    runAt: new Date().toISOString(),
    promptCount: results.length,
    buildSuccessRate: results.filter((r) => r.buildSuccess).length / n,
    previewSuccessRate: results.filter((r) => r.previewSuccess).length / n,
    publishReadinessRate: results.filter((r) => r.publishReady).length / n,
    placeholderRate: results.reduce((s, r) => s + r.placeholderRate, 0) / n,
    averageQualityScore: results.reduce((s, r) => s + r.qualityScore, 0) / n,
    averageCostCredits: results.reduce((s, r) => s + r.costCredits, 0) / n,
    results,
    uiCompleteness: avg(results, "uiCompleteness"),
    appSpecificRelevance: avg(results, "appSpecificRelevance"),
    visualPolish: avg(results, "visualPolish"),
    mobileReadiness: avg(results, "mobileReadiness"),
    routeCompleteness: avg(results, "routeCompleteness"),
    interactionCompleteness: avg(results, "interactionCompleteness"),
    qualityBeforePolish: avg(results, "qualityBeforePolish"),
    qualityAfterPolish: avg(results, "qualityAfterPolish"),
    validatorFailMarkedGenerated: 0,
  };
}

export function benchmarkPassesGates(report: BenchmarkReport): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (report.placeholderRate > 0.1) reasons.push("placeholder rate >10%");
  if (report.buildSuccessRate < 0.8) reasons.push("build success <80%");
  if (report.previewSuccessRate < 0.9 && report.promptCount >= 50) reasons.push("preview success <90%");
  if (report.publishReadinessRate < 0.85 && report.promptCount >= 50) reasons.push("publish readiness <85%");
  if ((report.averageQualityScore ?? 0) < 80 && report.promptCount >= 10) reasons.push("average UI quality <80");
  return { ok: reasons.length === 0, reasons };
}

export function liveBenchmarkPassesHalfTargets(report: LiveBenchmarkReport): boolean {
  return (
    report.live === true &&
    report.smokePassed === true &&
    report.halfBenchmarkReady === true &&
    report.buildSuccessRate >= 0.9 &&
    report.uiValidationRate >= 0.9 &&
    report.averageQualityScore >= 88 &&
    report.averageBlueprintScore >= 85 &&
    report.templateInfluenceRate >= 0.9 &&
    report.backendPlanCompleteness >= 0.8 &&
    report.placeholderRate <= 0.05
  );
}

export function liveBenchmarkPassesFullTargets(report: LiveBenchmarkReport): boolean {
  return (
    liveBenchmarkPassesHalfTargets(report) &&
    report.fullBenchmarkReady === true &&
    report.promptCount >= 50
  );
}
