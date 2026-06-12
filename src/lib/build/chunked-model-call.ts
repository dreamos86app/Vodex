import type { ProviderCallInput } from "@/lib/ai/provider-call";
import type { BuildWorkerTraceSnapshot } from "@/lib/build/build-worker-trace";
import {
  activeWorkDuringChunk,
  domainActiveWorkLines,
} from "@/lib/build/live-build-activity";
import type { GenerationChunk } from "@/lib/build/chunked-generation-pipeline";
import { pickUiImplementationModelId } from "@/lib/ai/ui-implementation-model";
import { CHUNK_MODEL_TIMEOUT_MS } from "@/lib/ai/provider-timeouts";
import { callProviderWithBuildTimeout, type TimedProviderResult } from "@/lib/build/timed-build-operations";

export { CHUNK_MODEL_TIMEOUT_MS };

const ACTIVE_TICK_MS = 3_500;

export async function callChunkWithFailover(
  input: ProviderCallInput & { operationType: string },
  options: {
    trace?: BuildWorkerTraceSnapshot | null;
    chunk: GenerationChunk;
    chunkIndex: number;
    chunkTotal: number;
    buildSmallerPrompt?: () => string;
    onActiveWork: (line: string) => void;
    useFallbackModel?: boolean;
    timeoutMs?: number;
  },
): Promise<TimedProviderResult> {
  const maxAttempts = options.useFallbackModel ? 1 : 2;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const prompt =
      attempt === 0 ? input.prompt : (options.buildSmallerPrompt?.() ?? input.prompt);
    const timeoutMs = options.timeoutMs ?? input.timeoutMs ?? CHUNK_MODEL_TIMEOUT_MS;
    const started = Date.now();
    let tick = 0;

    options.onActiveWork(options.chunk.activeWork);

    const timer = setInterval(() => {
      tick += 1;
      const domainLines = domainActiveWorkLines(input.prompt);
      const line = activeWorkDuringChunk(options.chunk, tick, domainLines);
      options.onActiveWork(line);
    }, ACTIVE_TICK_MS);

    const callInput: ProviderCallInput & { operationType: string } = {
      ...input,
      prompt,
      timeoutMs,
      userSelectedModelId:
        options.useFallbackModel
          ? pickUiImplementationModelId(input.complexity ?? 7, input.userEmail)
          : input.userSelectedModelId,
    };

    try {
      const result = await callProviderWithBuildTimeout(callInput, options.trace);
      if (result.ok) return result;
      if (result.timedOut && attempt + 1 < maxAttempts) {
        options.onActiveWork("Some screens are still incomplete, so I'm continuing generation with a smaller scope.");
        attempt += 1;
        continue;
      }
      return result;
    } finally {
      clearInterval(timer);
    }
  }

  return { ok: false, timedOut: true, error: "chunk_failover_exhausted" };
}
