import { sliceToTokenBudget } from "@/lib/ai/prompt-compression-policy";
import type { ProviderCallInput } from "@/lib/ai/provider-call";
import { CHUNK_MODEL_TIMEOUT_MS } from "@/lib/ai/provider-timeouts";
import { FILE_PAYLOAD_RULE } from "@/lib/build/stage-prompts";
import type { DesignBrief } from "@/lib/build/design-brief-generator";
import { callChunkWithFailover } from "@/lib/build/chunked-model-call";
import type { GenerationChunk, ChunkedGenerationResult } from "@/lib/build/chunked-generation-pipeline";
import { formatChunkProgress } from "@/lib/build/live-build-activity";
import {
  createTimeoutStrategyState,
  recordModelTimeout,
  shouldPauseAfterTimeout,
  userMessageForTimeoutStrategy,
  type TimeoutStrategyState,
} from "@/lib/build/model-timeout-strategy";
import type { BuildFile } from "@/lib/build/generated-file-utils";
import type { BuildWorkerTraceSnapshot } from "@/lib/build/build-worker-trace";
import type { TimedProviderResult } from "@/lib/build/timed-build-operations";

export function buildRouteByRouteChunks(routes: string[]): GenerationChunk[] {
  const routeList = routes.length
    ? routes.filter((r) => r !== "/" && r !== "/dashboard")
    : ["/settings", "/analytics", "/devices", "/profile"];

  const chunks: GenerationChunk[] = [
    {
      id: "generate_app_shell",
      label: "App shell",
      activeWork: "Generating app shell, layout, and config files…",
      critical: true,
    },
    {
      id: "generate_home_page",
      label: "Home page",
      activeWork: "Writing home page…",
    },
    {
      id: "generate_dashboard_page",
      label: "Dashboard",
      activeWork: "Generating dashboard layout…",
      critical: true,
    },
  ];

  for (const route of routeList.slice(0, 12)) {
    const slug = route.replace(/^\//, "").replace(/\//g, "-") || "page";
    chunks.push({
      id: `generate_route_pages_batch_1`,
      label: route,
      activeWork: `Writing ${route} page…`,
    });
    void slug;
  }

  chunks.push(
    {
      id: "generate_components_batch_1",
      label: "Components",
      activeWork: "Building shared UI components…",
    },
    {
      id: "generate_mock_data",
      label: "Mock data",
      activeWork: "Creating domain mock data layer…",
    },
    {
      id: "generate_final_polish",
      label: "Polish",
      activeWork: "Applying final polish and navigation links…",
    },
  );

  return chunks;
}

function routeChunkPrompt(
  chunk: GenerationChunk,
  ctx: {
    executionPrompt: string;
    planJson: string;
    appName: string;
    route?: string;
    existingPaths: string[];
  },
): string {
  const base = [
    FILE_PAYLOAD_RULE,
    `ROUTE-BY-ROUTE CHUNK: ${chunk.label}`,
    `App: ${ctx.appName}`,
    `Brief: ${sliceToTokenBudget(ctx.executionPrompt, 400)}`,
    `Existing: ${ctx.existingPaths.slice(0, 20).join(", ") || "none"}`,
    "Return at most 3 files for this chunk only.",
  ];

  if (chunk.id === "generate_app_shell") {
    return [...base, "Files: app/layout.tsx, app/globals.css, package.json, tsconfig.json"].join("\n");
  }
  if (chunk.id === "generate_home_page") {
    return [...base, "File: app/page.tsx — rich overview, not welcome-only."].join("\n");
  }
  if (chunk.id === "generate_dashboard_page") {
    return [...base, "File: app/dashboard/page.tsx — KPI cards and charts."].join("\n");
  }
  if (chunk.label.startsWith("/")) {
    return [...base, `File: app${chunk.label}/page.tsx — full domain UI for ${chunk.label}.`].join("\n");
  }
  if (chunk.id === "generate_mock_data") {
    return [...base, "File: lib/mock-data.ts with exports used by pages."].join("\n");
  }
  if (chunk.id === "generate_components_batch_1") {
    return [...base, "Files: components/ui/* shared widgets."].join("\n");
  }
  return [...base, "Polish navigation links and fix imports."].join("\n");
}

export type RunRouteByRouteInput = {
  writer: ProviderCallInput["writer"];
  userId: string;
  userEmail: string | null;
  operationId: string;
  system: string;
  complexity: number;
  accumulatedCostUsd: number;
  userSelectedModelId?: string | null;
  buildTrace?: BuildWorkerTraceSnapshot | null;
  executionPrompt: string;
  planJson: string;
  designBrief: DesignBrief | null;
  appName: string;
  routes: string[];
  initialFiles: BuildFile[];
  startIndex?: number;
  ingestChunk: (text: string, files: BuildFile[]) => Promise<BuildFile[]>;
  onChunkStart: (index: number, total: number, chunk: GenerationChunk, progressLine: string) => void;
  onChunkActiveWork: (line: string, meta: Record<string, unknown>) => void;
  onChunkComplete: (index: number, total: number, chunk: GenerationChunk, fileCount: number) => void;
  onStrategyChange: (message: string, state: TimeoutStrategyState) => void;
  onPaused: (message: string, state: TimeoutStrategyState) => void;
};

export async function runRouteByRouteGeneration(
  input: RunRouteByRouteInput,
): Promise<ChunkedGenerationResult & { timeoutState: TimeoutStrategyState; paused: boolean }> {
  const chunks = buildRouteByRouteChunks(input.routes);
  const total = chunks.length;
  const start = Math.max(0, input.startIndex ?? 0);
  let files = [...input.initialFiles];
  let costUsd = 0;
  let modelId = input.userSelectedModelId ?? "automatic";
  let inputTokens = 0;
  let outputTokens = 0;
  let chunksRun = 0;
  let chunksCompleted = 0;
  let timeoutState = createTimeoutStrategyState();
  timeoutState.strategy = "route_by_route";

  for (let i = start; i < chunks.length; i++) {
    if (shouldPauseAfterTimeout(timeoutState)) {
      input.onPaused(
        userMessageForTimeoutStrategy("paused"),
        timeoutState,
      );
      break;
    }

    const chunk = chunks[i]!;
    const index = i + 1;
    const progressLine = formatChunkProgress(index, total, chunk.label);
    input.onChunkStart(index, total, chunk, progressLine);

    const promptCtx = {
      executionPrompt: input.executionPrompt,
      planJson: input.planJson,
      appName: input.appName,
      route: chunk.label.startsWith("/") ? chunk.label : undefined,
      existingPaths: files.map((f) => f.path),
    };

    chunksRun += 1;
    const callInput: ProviderCallInput & { operationType: string } = {
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: `${input.operationId}:rbr:${chunk.label.replace(/\//g, "_")}`,
      operationType: "frontend_implementation",
      system: input.system,
      prompt: routeChunkPrompt(chunk, promptCtx),
      complexity: input.complexity,
      accumulatedCostUsd: input.accumulatedCostUsd + costUsd,
      userSelectedModelId: input.userSelectedModelId,
      timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
    };

    const result: TimedProviderResult = await callChunkWithFailover(callInput, {
      trace: input.buildTrace,
      chunk,
      chunkIndex: index,
      chunkTotal: total,
      buildSmallerPrompt: () =>
        `${routeChunkPrompt(chunk, promptCtx)}\nReturn exactly 1 file.`,
      onActiveWork: (line) => {
        input.onChunkActiveWork(line, {
          generation_chunk_id: chunk.id,
          generation_chunk_index: index,
          route_by_route: true,
          active_work: true,
        });
      },
    });

    if (!result.ok) {
      timeoutState = recordModelTimeout(timeoutState, chunk.id);
      input.onStrategyChange(userMessageForTimeoutStrategy(timeoutState.strategy), timeoutState);
      if (shouldPauseAfterTimeout(timeoutState)) {
        input.onPaused(userMessageForTimeoutStrategy("paused"), timeoutState);
        break;
      }
      continue;
    }

    costUsd += result.result.providerCostUsd;
    inputTokens += result.result.inputTokens ?? 0;
    outputTokens += result.result.outputTokens ?? 0;
    modelId = result.result.spec.modelId;

    const before = files.length;
    files = await input.ingestChunk(result.result.text, files);
    if (files.length > before) {
      chunksCompleted += 1;
      input.onChunkComplete(index, total, chunk, files.length - before);
    }
  }

  return {
    files,
    costUsd,
    modelId,
    chunksRun,
    chunksCompleted,
    inputTokens,
    outputTokens,
    timeoutState,
    paused: timeoutState.paused,
  };
}
