import fs from "node:fs";
import path from "node:path";
import { writeFinalRestaurantE2eFailure } from "./final-restaurant-e2e-failure";

export type WatchdogStage =
  | "dev_server"
  | "auth"
  | "credits"
  | "create_interactive"
  | "build_strategy"
  | "prompt_submit"
  | "chat_enqueue"
  | "first_build_event"
  | "project_create"
  | "builder_open"
  | "build_events"
  | "app_files"
  | "preview"
  | "publish"
  | "published_url"
  | "dashboard_unlock"
  | "payments"
  | "analytics"
  | "queue"
  | "console_error";

/** Hard cap for the full restaurant @live journey — never wait for Playwright's old 30m default. */
export const GLOBAL_RESTAURANT_E2E_MAX_MS = 600_000;

export const STAGE_BUDGET_MS: Record<WatchdogStage, number> = {
  dev_server: 180_000,
  auth: process.platform === "win32" ? 90_000 : 45_000,
  credits: 45_000,
  /** /create first compile + composer sync on Windows dev often exceeds 20s */
  create_interactive: process.platform === "win32" ? 120_000 : 90_000,
  build_strategy: 5_000,
  prompt_submit: 10_000,
  chat_enqueue: process.platform === "win32" ? 90_000 : 45_000,
  first_build_event: process.platform === "win32" ? 60_000 : 30_000,
  project_create: 45_000,
  builder_open: 60_000,
  build_events: 300_000,
  app_files: 240_000,
  preview: 180_000,
  publish: 60_000,
  published_url: 30_000,
  dashboard_unlock: 60_000,
  payments: 60_000,
  /** Next.js first compile of /analytics on Windows dev can exceed 30s */
  analytics: 120_000,
  queue: 120_000,
  console_error: 5_000,
};

export const WATCHDOG_FAILURE_PATH = path.join(
  process.cwd(),
  "tests/e2e/evidence/stage-watchdog-failure.json",
);

export class StageWatchdog {
  private readonly t0 = Date.now();
  private stageStartedAt = Date.now();
  private currentStage: WatchdogStage = "dev_server";

  constructor(private readonly testStartedAt = Date.now()) {}

  enter(stage: WatchdogStage): void {
    this.assertGlobalCap();
    this.assertBudget();
    this.currentStage = stage;
    this.stageStartedAt = Date.now();
  }

  current(): WatchdogStage {
    return this.currentStage;
  }

  elapsedMs(): number {
    return Date.now() - this.testStartedAt;
  }

  stageElapsedMs(): number {
    return Date.now() - this.stageStartedAt;
  }

  /** Call between long polls / waits — enforces per-stage and global 10m caps. */
  tick(extra?: Partial<Record<WatchdogStage, number>>): void {
    this.assertGlobalCap();
    this.assertBudget(extra);
  }

  assertGlobalCap(): void {
    const elapsed = this.elapsedMs();
    if (elapsed <= GLOBAL_RESTAURANT_E2E_MAX_MS) return;
    this.fail(`global_e2e_cap_exceeded:${elapsed}ms>${GLOBAL_RESTAURANT_E2E_MAX_MS}ms`);
  }

  assertBudget(extra?: Partial<Record<WatchdogStage, number>>): void {
    const budgets = { ...STAGE_BUDGET_MS, ...extra };
    const stageMs = Date.now() - this.stageStartedAt;
    const limit = budgets[this.currentStage];
    if (stageMs <= limit) return;
    this.fail(`stage_budget_exceeded:${this.currentStage}:${stageMs}ms>${limit}ms`);
  }

  fail(
    message: string,
    context: {
      projectId?: string;
      buildJobId?: string;
      lastApiResponse?: unknown;
      lastEvent?: string;
      serverLogTail?: string[];
      url?: string;
    } = {},
  ): never {
    const payload = {
      capturedAt: new Date().toISOString(),
      stage: this.currentStage,
      message,
      elapsedMs: this.elapsedMs(),
      stageElapsedMs: this.stageElapsedMs(),
      stageBudgetMs: STAGE_BUDGET_MS[this.currentStage],
      globalMaxMs: GLOBAL_RESTAURANT_E2E_MAX_MS,
      project_id: context.projectId ?? null,
      build_job_id: context.buildJobId ?? null,
      url: context.url ?? null,
      last_api_response: context.lastApiResponse ?? null,
      last_event: context.lastEvent ?? null,
      server_log_tail: context.serverLogTail ?? tailServerLogs(80),
    };
    fs.mkdirSync(path.dirname(WATCHDOG_FAILURE_PATH), { recursive: true });
    fs.writeFileSync(WATCHDOG_FAILURE_PATH, JSON.stringify(payload, null, 2));
    writeFinalRestaurantE2eFailure({
      stage: this.currentStage,
      message,
      elapsed_ms: payload.elapsedMs,
      stage_elapsed_ms: payload.stageElapsedMs,
      stage_budget_ms: payload.stageBudgetMs,
      global_max_ms: GLOBAL_RESTAURANT_E2E_MAX_MS,
      evidence_file: "tests/e2e/evidence/final-restaurant-e2e-failure.json",
      project_id: context.projectId ?? null,
      build_job_id: context.buildJobId ?? null,
      url: context.url ?? null,
    });
    throw new Error(`${this.currentStage}:${message}`);
  }
}

function tailServerLogs(maxLines = 80): string[] {
  const paths = [
    path.join(process.cwd(), "tests/e2e/evidence/restaurant-dev-server.log"),
    path.join(process.cwd(), ".next/dev/logs/next-development.log"),
  ];
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean);
      if (lines.length) return lines.slice(-maxLines);
    } catch {
      /* ignore */
    }
  }
  return [];
}
