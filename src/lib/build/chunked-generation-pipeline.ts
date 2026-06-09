import { sliceToTokenBudget } from "@/lib/ai/prompt-compression-policy";
import type { ProviderCallInput } from "@/lib/ai/provider-call";
import { FILE_PAYLOAD_RULE } from "@/lib/build/stage-prompts";
import type { DesignBrief } from "@/lib/build/design-brief-generator";
import { callChunkWithFailover, CHUNK_MODEL_TIMEOUT_MS } from "@/lib/build/chunked-model-call";
import type { TimedProviderResult } from "@/lib/build/timed-build-operations";
import type { BuildFile } from "@/lib/build/generated-file-utils";
import type { BuildWorkerTraceSnapshot } from "@/lib/build/build-worker-trace";
import { formatChunkProgress } from "@/lib/build/live-build-activity";

export const GENERATION_CHUNK_IDS = [
  "generate_app_shell",
  "generate_design_system",
  "generate_mock_data",
  "generate_home_page",
  "generate_dashboard_page",
  "generate_route_pages_batch_1",
  "generate_route_pages_batch_2",
  "generate_components_batch_1",
  "generate_components_batch_2",
  "generate_mobile_responsive_layer",
  "generate_final_polish",
] as const;

export type GenerationChunkId = (typeof GENERATION_CHUNK_IDS)[number];

export type GenerationChunk = {
  id: GenerationChunkId;
  label: string;
  activeWork: string;
  critical?: boolean;
};

export const GENERATION_CHUNKS: GenerationChunk[] = [
  { id: "generate_app_shell", label: "App shell", activeWork: "Generating app shell and navigation layout…", critical: true },
  { id: "generate_design_system", label: "Design system", activeWork: "Creating design system tokens and theme…" },
  { id: "generate_mock_data", label: "Mock data", activeWork: "Creating domain mock data and fixtures…", critical: true },
  { id: "generate_home_page", label: "Home page", activeWork: "Writing home page with rich sections…" },
  { id: "generate_dashboard_page", label: "Dashboard", activeWork: "Generating dashboard layout and KPI cards…", critical: true },
  { id: "generate_route_pages_batch_1", label: "Route pages (1)", activeWork: "Writing primary feature route pages…" },
  { id: "generate_route_pages_batch_2", label: "Route pages (2)", activeWork: "Writing detail pages and settings routes…" },
  { id: "generate_components_batch_1", label: "Components (1)", activeWork: "Building shared UI components…" },
  { id: "generate_components_batch_2", label: "Components (2)", activeWork: "Building charts, tables, and forms…" },
  { id: "generate_mobile_responsive_layer", label: "Mobile polish", activeWork: "Adding mobile responsive layer and touch targets…" },
  { id: "generate_final_polish", label: "Final polish", activeWork: "Applying final polish and navigation coverage check…" },
];

export type ChunkedGenerationResult = {
  files: BuildFile[];
  costUsd: number;
  modelId: string;
  chunksRun: number;
  chunksCompleted: number;
  inputTokens: number;
  outputTokens: number;
};

type ChunkPromptCtx = {
  executionPrompt: string;
  planJson: string;
  designBrief: DesignBrief | null;
  appName: string;
  routes: string[];
  existingPaths: string[];
};

function routeBatches(routes: string[]): [string[], string[]] {
  const list = routes.length ? routes : ["/", "/dashboard", "/settings", "/analytics"];
  const mid = Math.ceil(list.length / 2);
  return [list.slice(0, mid), list.slice(mid)];
}

export function buildChunkPrompt(chunk: GenerationChunk, ctx: ChunkPromptCtx): string {
  const brief = sliceToTokenBudget(ctx.executionPrompt, 500);
  const [batch1, batch2] = routeBatches(ctx.routes);
  const existing = ctx.existingPaths.slice(0, 24).join(", ") || "none yet";

  const base = [
    FILE_PAYLOAD_RULE,
    `CHUNK: ${chunk.id} — return ONLY files for this chunk. Merge with existing: ${existing}`,
    `App: ${ctx.appName}. Brief: ${brief}`,
    `Plan: ${sliceToTokenBudget(ctx.planJson, 350)}`,
  ];

  switch (chunk.id) {
    case "generate_app_shell":
      return [
        ...base,
        "Generate: app/layout.tsx (AppShell/Sidebar), app/globals.css base, components/layout/AppShell.tsx",
        "Include package.json, tsconfig paths @/* if missing.",
      ].join("\n");
    case "generate_design_system":
      return [
        ...base,
        "Generate: design tokens, CSS variables, typography scale in globals.css or lib/design-tokens.ts",
      ].join("\n");
    case "generate_mock_data":
      return [
        ...base,
        "Generate: lib/mock-data.ts with realistic domain-specific exports every page will import.",
      ].join("\n");
    case "generate_home_page":
      return [...base, "Generate: app/page.tsx — rich landing or overview, 60+ lines, not welcome-only."].join("\n");
    case "generate_dashboard_page":
      return [
        ...base,
        "Generate: app/dashboard/page.tsx — KPI cards, charts/tables, filters, 80+ lines.",
      ].join("\n");
    case "generate_route_pages_batch_1":
      return [
        ...base,
        `Generate route pages for: ${batch1.join(", ")} — full UI per route under app/.`,
      ].join("\n");
    case "generate_route_pages_batch_2":
      return [
        ...base,
        `Generate route pages for: ${batch2.join(", ")} — detail sections, forms, empty states.`,
      ].join("\n");
    case "generate_components_batch_1":
      return [...base, "Generate: components/ui/* shared cards, buttons, tables used across routes."].join("\n");
    case "generate_components_batch_2":
      return [...base, "Generate: feature components — charts, filters, modals, domain-specific widgets."].join("\n");
    case "generate_mobile_responsive_layer":
      return [
        ...base,
        "Generate: mobile CSS tweaks, public/manifest.webmanifest, viewport-safe styles.",
      ].join("\n");
    case "generate_final_polish":
      return [
        ...base,
        "Polish: wire navigation links, fix imports, strengthen thin pages, add missing route stubs.",
      ].join("\n");
    default:
      return base.join("\n");
  }
}

export function buildSmallerChunkPrompt(chunk: GenerationChunk, ctx: ChunkPromptCtx): string {
  const mini = buildChunkPrompt(chunk, ctx);
  return `${mini}\nSCOPE REDUCTION: Return at most 4 files for this chunk only. Skip optional polish.`;
}

export type RunChunkedGenerationInput = {
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
  maxFiles: number;
  ingestChunk: (text: string, files: BuildFile[]) => Promise<BuildFile[]>;
  onChunkStart: (index: number, total: number, chunk: GenerationChunk, progressLine: string) => void;
  onChunkActiveWork: (line: string, meta: Record<string, unknown>) => void;
  onChunkComplete: (index: number, total: number, chunk: GenerationChunk, fileCount: number) => void;
  onChunkSkipped: (chunk: GenerationChunk, reason: string) => void;
};

export async function runChunkedFrontendGeneration(
  input: RunChunkedGenerationInput,
): Promise<ChunkedGenerationResult> {
  const chunks = GENERATION_CHUNKS;
  const total = chunks.length;
  let files = [...input.initialFiles];
  let costUsd = 0;
  let modelId = input.userSelectedModelId ?? "automatic";
  let inputTokens = 0;
  let outputTokens = 0;
  let chunksRun = 0;
  let chunksCompleted = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const index = i + 1;
    const progressLine = formatChunkProgress(index, total, chunk.label);
    input.onChunkStart(index, total, chunk, progressLine);

    const promptCtx: ChunkPromptCtx = {
      executionPrompt: input.executionPrompt,
      planJson: input.planJson,
      designBrief: input.designBrief,
      appName: input.appName,
      routes: input.routes,
      existingPaths: files.map((f) => f.path),
    };

    chunksRun += 1;
    const callInput: ProviderCallInput & { operationType: string } = {
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: `${input.operationId}:${chunk.id}`,
      operationType: "frontend_implementation",
      system: input.system,
      prompt: buildChunkPrompt(chunk, promptCtx),
      complexity: input.complexity,
      accumulatedCostUsd: input.accumulatedCostUsd + costUsd,
      userSelectedModelId: input.userSelectedModelId,
      timeoutMs: CHUNK_MODEL_TIMEOUT_MS,
    };

    let result: TimedProviderResult = await callChunkWithFailover(callInput, {
      trace: input.buildTrace,
      chunk,
      chunkIndex: index,
      chunkTotal: total,
      buildSmallerPrompt: () => buildSmallerChunkPrompt(chunk, promptCtx),
      onActiveWork: (line) => {
        input.onChunkActiveWork(line, {
          generation_chunk_id: chunk.id,
          generation_chunk_index: index,
          generation_chunk_total: total,
          generation_chunk_label: chunk.label,
          chunk_progress_line: formatChunkProgress(index, total, chunk.label),
          active_work: true,
        });
      },
    });

    if (!result.ok && chunk.critical) {
      result = await callChunkWithFailover(
        { ...callInput, operationId: `${input.operationId}:${chunk.id}:failover` },
        {
          trace: input.buildTrace,
          chunk,
          chunkIndex: index,
          chunkTotal: total,
          buildSmallerPrompt: () => buildSmallerChunkPrompt(chunk, promptCtx),
          onActiveWork: (line) => input.onChunkActiveWork(line, { generation_chunk_id: chunk.id, active_work: true }),
          useFallbackModel: true,
        },
      );
    }

    if (!result.ok) {
      input.onChunkSkipped(chunk, result.timedOut ? "chunk_timeout" : result.error);
      if (chunk.critical && files.length === 0) {
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
    chunksCompleted += 1;
    input.onChunkComplete(index, total, chunk, files.length - before);
  }

  return {
    files,
    costUsd,
    modelId,
    chunksRun,
    chunksCompleted,
    inputTokens,
    outputTokens,
  };
}
