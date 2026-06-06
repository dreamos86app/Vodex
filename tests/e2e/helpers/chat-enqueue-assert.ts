import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";

export const CHAT_ENQUEUE_FAILURE_PATH = path.join(
  process.cwd(),
  "tests/e2e/evidence/chat-enqueue-failure.json",
);

/** Windows dev /api/chat can block behind compile while request is in flight */
export const CHAT_ENQUEUE_WAIT_MS = process.platform === "win32" ? 90_000 : 45_000;

export type ChatEnqueueCapture = {
  status: number;
  body: Record<string, unknown>;
  requestPayload?: Record<string, unknown>;
};

export function installChatEnqueueListener(page: Page): {
  getLast: () => ChatEnqueueCapture | null;
  waitFor202: (timeoutMs: number) => Promise<ChatEnqueueCapture>;
} {
  let last: ChatEnqueueCapture | null = null;
  let resolveWait: ((v: ChatEnqueueCapture) => void) | null = null;

  page.on("request", (req) => {
    if (req.method() !== "POST" || !req.url().includes("/api/chat")) return;
    try {
      const post = req.postDataJSON() as Record<string, unknown>;
      last = { status: 0, body: {}, requestPayload: post };
    } catch {
      /* ignore */
    }
  });

  page.on("response", async (res) => {
    if (res.request().method() !== "POST" || !res.url().includes("/api/chat")) return;
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = { parse_error: true };
    }
    const cap: ChatEnqueueCapture = {
      status: res.status(),
      body,
      requestPayload: last?.requestPayload,
    };
    last = cap;
    if (res.status() === 202 && resolveWait) {
      resolveWait(cap);
      resolveWait = null;
    }
  });

  return {
    getLast: () => last,
    waitFor202: (timeoutMs) =>
      new Promise((resolve, reject) => {
        if (last?.status === 202) {
          resolve(last);
          return;
        }
        const timer = setTimeout(() => {
          resolveWait = null;
          reject(new Error("chat_enqueue_timeout"));
        }, timeoutMs);
        resolveWait = (v) => {
          clearTimeout(timer);
          resolve(v);
        };
        if (last?.status === 202) {
          resolveWait(last);
          resolveWait = null;
        }
      }),
  };
}

export function writeChatEnqueueFailure(
  page: Page,
  capture: ChatEnqueueCapture | null,
  extra: Record<string, unknown> = {},
): void {
  const payload = {
    capturedAt: new Date().toISOString(),
    stage: "chat_enqueue",
    url: page.url(),
    http_status: capture?.status ?? null,
    response_body: capture?.body ?? null,
    request_payload: capture?.requestPayload ?? null,
    ...extra,
  };
  fs.mkdirSync(path.dirname(CHAT_ENQUEUE_FAILURE_PATH), { recursive: true });
  fs.writeFileSync(CHAT_ENQUEUE_FAILURE_PATH, JSON.stringify(payload, null, 2));
}

export function assertChatBuildNowPayload(capture: ChatEnqueueCapture | null): void {
  const payload = capture?.requestPayload ?? {};
  const strategy = payload.strategy;
  const force = payload.forceBuildPipeline;
  const mode = payload.mode;
  if (mode !== "build" || strategy !== "build_now") {
    throw new Error(
      `chat_payload_invalid: mode=${String(mode)} strategy=${String(strategy)} forceBuildPipeline=${String(force)}`,
    );
  }
  if (capture?.status !== 202) {
    throw new Error(`chat_enqueue_status_${capture?.status ?? "missing"}`);
  }
  const jobId = capture.body.buildJobId ?? capture.body.build_job_id;
  if (!jobId) throw new Error("chat_enqueue_missing_buildJobId");
  const asyncBuild = capture.body.asyncBuild === true;
  if (force !== true && !asyncBuild) {
    throw new Error(
      `chat_payload_invalid: mode=${String(mode)} strategy=${String(strategy)} forceBuildPipeline=${String(force)}`,
    );
  }
}

export async function waitForFirstBuildEvent(
  request: APIRequestContext,
  projectId: string,
  buildJobId: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request
      .get(`/api/projects/${projectId}/build-jobs/${buildJobId}/events`)
      .catch(() => null);
    if (res?.ok()) {
      const body = await res.json().catch(() => ({}));
      const events = (body as { events?: Array<{ type?: string; title?: string }> }).events ?? [];
      if (events.length > 0) {
        const first = events[0];
        return String(first.type ?? first.title ?? "event");
      }
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("first_build_event_timeout");
}
