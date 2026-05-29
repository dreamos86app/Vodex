import { test, expect } from "./helpers/live-gate";
import fs from "node:fs";
import path from "node:path";
import {
  assertCreateSubmitReady,
  clickComposerSubmit,
  ensureBuildNowStrategy,
  visibleComposerTextarea,
  visibleSubmitButton,
  waitForComposerReady,
} from "./helpers/create-submit-assert";
import {
  assertChatBuildNowPayload,
  installChatEnqueueListener,
} from "./helpers/chat-enqueue-assert";
import { waitForBuildJobStarted } from "./helpers/wait-for-build-job";
import { waitForProjectIdAfterSubmit } from "./helpers/journey-api";
import { RESTAURANT_PROMPT } from "./helpers/restaurant-prompt";

const EVIDENCE_DIR = path.join(process.cwd(), "test-results", "workflow-qa");

test.describe("Agent workflow stream @workflow-qa", () => {
  test.describe.configure({ mode: "serial", timeout: 360_000 });

  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test("desktop — stream visible with assistant + file events", async ({ page, request, liveGate }) => {
    test.setTimeout(360_000);
    if (!liveGate) {
      test.skip(true, "Set E2E_RUN_LIVE=1 and ensure .playwright-auth.json exists");
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/create?mode=build&strategy=build_now", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForComposerReady(page, 90_000);

    const textarea = visibleComposerTextarea(page);
    const submit = visibleSubmitButton(page);
    await assertCreateSubmitReady(page, textarea, submit, RESTAURANT_PROMPT);
    await ensureBuildNowStrategy(page);

    const projectsBefore = await request.get("/api/projects").then((r) => (r.ok() ? r.json() : []));
    const beforeCount = Array.isArray(projectsBefore)
      ? projectsBefore.length
      : Array.isArray((projectsBefore as { projects?: unknown[] }).projects)
        ? (projectsBefore as { projects: unknown[] }).projects.length
        : 0;

    const chatListener = installChatEnqueueListener(page);
    await clickComposerSubmit(page, submit);

    const chatCapture = await chatListener.waitFor202(90_000);
    assertChatBuildNowPayload(chatCapture);

    const projectId = await waitForProjectIdAfterSubmit(page, request, beforeCount, 120_000);
    const buildJobId = String(chatCapture.body.buildJobId ?? chatCapture.body.build_job_id ?? "");

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "desktop-after-submit.png"),
      fullPage: true,
    });

    const stream = page.locator("[data-testid='agent-workflow-stream']");
    const summary = page.locator("[data-testid='build-run-summary']");

    let streamCaptured = false;
    let streamSnippet = "";
    const deadline = Date.now() + 180_000;

    while (Date.now() < deadline) {
      if (await stream.isVisible().catch(() => false)) {
        streamSnippet = (await stream.innerText({ timeout: 5_000 }).catch(() => "")).toLowerCase();
        if (!streamCaptured) {
          streamCaptured = true;
          await page.screenshot({
            path: path.join(EVIDENCE_DIR, "desktop-mid-stream.png"),
            fullPage: true,
          });
          const fileCards = page.locator("[data-testid='workflow-file-card']");
          if ((await fileCards.count()) > 0) {
            await fileCards.first().screenshot({
              path: path.join(EVIDENCE_DIR, "desktop-file-card.png"),
            });
          }
        }
      }
      if (await summary.isVisible().catch(() => false)) break;
      await page.waitForTimeout(2_000);
    }

    await expect(streamCaptured, "agent workflow stream should appear during build").toBe(true);
    expect(streamSnippet).not.toMatch(/creating the app plan[\s\S]*creating the app plan/);
    expect(
      streamSnippet.includes("i'll") ||
        streamSnippet.includes("understanding") ||
        streamSnippet.includes("writing") ||
        streamSnippet.includes("created") ||
        streamSnippet.includes("data model"),
    ).toBeTruthy();

    await expect(summary).toBeVisible({ timeout: 60_000 });
    const summaryText = (await summary.innerText()).toLowerCase();
    expect(summaryText).not.toContain("another repair pass");

    let eventsBody: Record<string, unknown> = {};
    if (projectId && buildJobId) {
      const eventsRes = await request.get(
        `/api/projects/${projectId}/build-jobs/${buildJobId}/events`,
      );
      if (eventsRes.ok()) eventsBody = (await eventsRes.json()) as Record<string, unknown>;
      await waitForBuildJobStarted(request, projectId, 120_000);
    }

    const events = (eventsBody.events ?? []) as Array<{
      type?: string;
      title?: string;
      metadata?: Record<string, unknown>;
    }>;
    const withLineMeta = events.filter(
      (e) =>
        typeof e.metadata?.added_lines === "number" ||
        typeof e.metadata?.new_line_count === "number",
    );
    const assistantEvents = events.filter(
      (e) => e.metadata?.stream_category === "assistant_message",
    );

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "desktop-qa-report.json"),
      JSON.stringify(
        {
          projectId,
          buildJobId,
          streamSnippet: streamSnippet.slice(0, 1500),
          summaryText: summaryText.slice(0, 500),
          fileCardCount: await page.locator("[data-testid='workflow-file-card']").count(),
          eventCount: events.length,
          assistantEventCount: assistantEvents.length,
          lineMetaEventCount: withLineMeta.length,
          sampleLineMeta: withLineMeta.slice(0, 5).map((e) => e.metadata),
          sampleAssistant: assistantEvents.slice(0, 4).map((e) => e.title),
        },
        null,
        2,
      ),
    );

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "desktop-final.png"),
      fullPage: true,
    });

    expect(assistantEvents.length).toBeGreaterThanOrEqual(1);
    expect(summaryText.includes("preview") || summaryText.includes("done")).toBeTruthy();
  });

  test("mobile — stream visible on builder", async ({ page, request, liveGate }) => {
    test.setTimeout(180_000);
    if (!liveGate) {
      test.skip(true, "Set E2E_RUN_LIVE=1");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/create?mode=build&strategy=build_now", {
      waitUntil: "domcontentloaded",
    });
    await waitForComposerReady(page, 90_000);

    const projectsBefore = await request.get("/api/projects").then((r) => (r.ok() ? r.json() : []));
    const beforeCount = Array.isArray(projectsBefore)
      ? projectsBefore.length
      : Array.isArray((projectsBefore as { projects?: unknown[] }).projects)
        ? (projectsBefore as { projects: unknown[] }).projects.length
        : 0;

    const textarea = visibleComposerTextarea(page);
    const submit = visibleSubmitButton(page);
    await assertCreateSubmitReady(page, textarea, submit, "Build a simple habit tracker with streaks", {
      skipComposerReadyWait: true,
    });
    await clickComposerSubmit(page, submit);

    const projectId = await waitForProjectIdAfterSubmit(page, request, beforeCount, 90_000);
    expect(projectId).toBeTruthy();

    const stream = page.locator("[data-testid='agent-workflow-stream']");
    const deadline = Date.now() + 120_000;
    let streamVisible = false;
    while (Date.now() < deadline) {
      if (await stream.isVisible().catch(() => false)) {
        streamVisible = true;
        break;
      }
      await page.waitForTimeout(2_000);
    }
    expect(streamVisible).toBe(true);

    const text = (await stream.innerText({ timeout: 10_000 })).toLowerCase();
    expect(text).not.toContain("another repair pass");

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "mobile-builder-stream.png"),
      fullPage: true,
    });

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "mobile-qa-report.json"),
      JSON.stringify({ projectId, streamSnippet: text.slice(0, 1000) }, null, 2),
    );
  });
});
