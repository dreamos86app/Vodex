import fs from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { syncComposerTextarea } from "./sync-composer-textarea";

const EVIDENCE_DIR = path.join(process.cwd(), "tests/e2e/evidence");
const CREATE_READY_MAX_MS = 90_000;

/**
 * Prefer the server fallback shell while it is shown; otherwise the hydrated workspace composer.
 */
const SERVER_COMPOSER = '[data-create-server-shell="true"]:visible';
const WORKSPACE_COMPOSER =
  '[data-testid="create-workspace-layer"]:not(.hidden) [data-testid="workspace-composer-textarea"]';
const BUILDER_COMPOSER =
  '[data-testid="builder-shell"]:visible [data-testid="workspace-composer-textarea"], [data-testid="builder-shell"]:visible [data-testid="create-prompt-textarea"]';

export function visibleBuilderShell(page: Page) {
  return page
    .locator(
      '[data-testid="builder-shell"]:not([data-create-server-shell="true"]):visible, [data-testid="create-workspace-layer"]:not(.hidden), [data-testid="create-page-root"]',
    )
    .first();
}

export function visibleComposerTextarea(page: Page) {
  return page
    .locator(
      `${BUILDER_COMPOSER}, ${SERVER_COMPOSER} [data-testid="create-prompt-textarea"], ${WORKSPACE_COMPOSER}`,
    )
    .first();
}

export function visibleSubmitButton(page: Page) {
  return page
    .locator(
      `${BUILDER_COMPOSER.replace(/workspace-composer-textarea|create-prompt-textarea/g, "workspace-composer-submit")}, ${BUILDER_COMPOSER.replace(/workspace-composer-textarea|create-prompt-textarea/g, "create-submit-button")}, ${SERVER_COMPOSER} [data-testid="create-submit-button"], [data-testid="create-workspace-layer"]:not(.hidden) [data-testid="workspace-composer-submit"], [data-testid="create-workspace-layer"]:not(.hidden) [data-testid="create-submit-button"]`,
    )
    .first();
}

export type ComposerWaitResult = {
  usedFallback: boolean;
  readyReason: string | null;
  elapsedMs: number;
};

async function probeComposerFallback(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const shell =
      document.querySelector('[data-testid="builder-shell"]:not([data-create-server-shell="true"])') ??
      document.querySelector('[data-testid="create-page-root"]');
    const ta =
      (document.querySelector('[data-testid="workspace-composer-textarea"]') as HTMLTextAreaElement | null) ??
      (document.getElementById("dreamos-composer-prompt") as HTMLTextAreaElement | null);
    const btn =
      (document.querySelector('[data-testid="workspace-composer-submit"]') as HTMLButtonElement | null) ??
      (document.querySelector('[data-testid="create-submit-button"]') as HTMLButtonElement | null);
    if (!shell || !ta || !btn) return false;
    const rect = ta.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || ta.disabled) return false;
    return (
      btn.hasAttribute("data-disabled-reason") &&
      btn.hasAttribute("data-dom-len") &&
      btn.hasAttribute("data-state-len") &&
      btn.hasAttribute("data-live-len")
    );
  });
}

export async function captureCreateComposerFailure(page: Page, label: string): Promise<string> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const stamp = Date.now();
  const screenshot = path.join(EVIDENCE_DIR, `create-composer-fail-${stamp}.png`);
  const jsonPath = path.join(EVIDENCE_DIR, `create-composer-fail-${stamp}.json`);

  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);

  const snippet = await page
    .evaluate(() => {
      const root =
        document.querySelector('[data-testid="create-composer-form"]') ??
        document.querySelector('[data-testid="builder-shell"]');
      return root?.outerHTML?.slice(0, 4000) ?? "";
    })
    .catch(() => "");

  const diag = await page
    .evaluate(() => {
      const ready = document.querySelector('[data-testid="create-composer-ready"]');
      const ta = document.getElementById("dreamos-composer-prompt") as HTMLTextAreaElement | null;
      const btn = document.querySelector('[data-testid="create-submit-button"]');
      return {
        url: location.href,
        composerReady: ready?.getAttribute("data-ready") ?? null,
        composerReason: ready?.getAttribute("data-reason") ?? null,
        textareaVisible: Boolean(ta && ta.getBoundingClientRect().width > 0),
        textareaDisabled: ta?.disabled ?? null,
        textareaValueLen: ta?.value?.length ?? 0,
        submitAttrs: btn
          ? {
              dataDisabledReason: btn.getAttribute("data-disabled-reason"),
              dataDomLen: btn.getAttribute("data-dom-len"),
              dataStateLen: btn.getAttribute("data-state-len"),
              dataLiveLen: btn.getAttribute("data-live-len"),
            }
          : null,
      };
    })
    .catch(() => ({ url: page.url() }));

  const payload = { label, ...diag, htmlSnippet: snippet };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  console.error("[e2e] create composer failure", payload, `screenshot=${screenshot}`);
  return jsonPath;
}

/** Wait for interactive create composer — marker or DOM fallback, max ~90s. */
async function ensureOnCreatePage(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        location.pathname.includes("/onboarding") ||
        Boolean(document.querySelector('[data-testid="builder-shell"]')),
      { timeout: 60_000 },
    )
    .catch(() => undefined);

  if (!page.url().includes("/onboarding")) return;

  const res = await page.request.post("/api/onboarding", {
    data: { hear_about: "e2e", build_first: "apps", replay: true },
  });
  if (!res.ok()) {
    throw new Error(`onboarding_complete_failed_${res.status()}`);
  }
  await page.evaluate(() => {
    const key = "dreamos-auth";
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { state?: { profile?: { onboarding_completed?: boolean } } };
      if (parsed?.state?.profile) {
        parsed.state.profile.onboarding_completed = true;
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } catch {
      /* ignore */
    }
  });
  await page.goto("/create?mode=build", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .waitForFunction(
      () =>
        !location.pathname.includes("/onboarding") &&
        Boolean(
          document.querySelector(
            '[data-testid="builder-shell"]:not([data-create-server-shell="true"])',
          ) ||
            document.querySelector('[data-testid="create-workspace-layer"]:not(.hidden)') ||
            document.querySelector('[data-testid="workspace-composer-textarea"]'),
        ),
      { timeout: 60_000 },
    )
    .catch(() => undefined);
  if (page.url().includes("/onboarding")) {
    throw new Error("stuck_on_onboarding");
  }
}

export async function waitForComposerReady(
  page: Page,
  timeoutMs = CREATE_READY_MAX_MS,
): Promise<ComposerWaitResult> {
  await ensureOnCreatePage(page).catch(async (err) => {
    await captureCreateComposerFailure(page, "onboarding_redirect");
    throw err;
  });

  const shellStart = Date.now();
  const composerSurface = visibleComposerTextarea(page);
  while (Date.now() - shellStart < 25_000) {
    if (await composerSurface.isVisible().catch(() => false)) break;
    if (await probeComposerFallback(page)) break;
    await page.waitForTimeout(150);
  }
  if (
    !(await composerSurface.isVisible().catch(() => false)) &&
    !(await probeComposerFallback(page))
  ) {
    await captureCreateComposerFailure(page, "composer_surface_25s");
    throw new Error("CREATE_COMPOSER_NOT_VISIBLE");
  }

  const start = Date.now();
  const shell = visibleBuilderShell(page);
  const textarea = visibleComposerTextarea(page);
  const submit = visibleSubmitButton(page);
  const ready = page.locator('[data-testid="create-composer-ready"]').first();

  await expect(shell).toBeVisible({ timeout: Math.min(timeoutMs, 60_000) });
  await expect(textarea).toBeVisible({ timeout: Math.min(timeoutMs, 60_000) });
  await expect(submit).toBeVisible({ timeout: Math.min(timeoutMs, 60_000) });
  await page.waitForSelector("#dreamos-composer-prompt", {
    timeout: Math.min(timeoutMs, 60_000),
  });

  let usedFallback = false;
  let readyReason: string | null = null;

  while (Date.now() - start < timeoutMs) {
    const attr = await ready.getAttribute("data-ready").catch(() => null);
    readyReason = await ready.getAttribute("data-reason").catch(() => null);
    if (attr === "true") {
      return { usedFallback, readyReason, elapsedMs: Date.now() - start };
    }

    if (await probeComposerFallback(page)) {
      usedFallback = true;
      console.warn(
        "[e2e] create-composer-ready marker false but DOM fallback passed",
        { reason: readyReason },
      );
      return { usedFallback, readyReason, elapsedMs: Date.now() - start };
    }

    await page.waitForTimeout(250);
  }

  await captureCreateComposerFailure(page, "waitForComposerReady_timeout");
  await expect(ready).toHaveAttribute("data-ready", "true", { timeout: 2_000 });
  return { usedFallback, readyReason, elapsedMs: Date.now() - start };
}

export async function waitForWorkspaceComposer(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForFunction(
    () => {
      const layer = document.querySelector('[data-testid="create-workspace-layer"]');
      const ta = layer?.querySelector(
        '[data-testid="workspace-composer-textarea"], [data-testid="create-prompt-textarea"]',
      );
      return Boolean(layer && !layer.classList.contains("hidden") && ta);
    },
    { timeout: timeoutMs },
  );
}

export function workspaceComposerLocators(page: Page) {
  const layer = page.locator('[data-testid="create-workspace-layer"]:not(.hidden)');
  return {
    textarea: layer
      .getByTestId("workspace-composer-textarea")
      .or(layer.getByTestId("create-prompt-textarea"))
      .first(),
    submit: layer
      .getByTestId("workspace-composer-submit")
      .or(layer.getByTestId("create-submit-button"))
      .first(),
  };
}

export async function gotoWorkspaceComposer(
  page: Page,
  timeoutMs = CREATE_READY_MAX_MS,
): Promise<{ textarea: Locator; submit: Locator }> {
  await waitForComposerReady(page, timeoutMs);
  await waitForWorkspaceComposer(page, Math.min(timeoutMs, 60_000));
  return workspaceComposerLocators(page);
}

/** Restaurant prompts match plan-first heuristics — force immediate build for live E2E. */
/** Next.js dev overlay portal blocks Playwright clicks on narrow viewports. */
export async function dismissNextJsDevOverlay(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      for (const portal of document.querySelectorAll("nextjs-portal")) {
        const el = portal as HTMLElement;
        el.style.pointerEvents = "none";
        el.style.display = "none";
      }
    })
    .catch(() => undefined);
}

export async function clickComposerSubmit(page: Page, submit: Locator): Promise<void> {
  await dismissNextJsDevOverlay(page);
  await submit.click({ force: true });
}

export async function ensureBuildNowStrategy(page: Page): Promise<void> {
  const root = page
    .locator('[data-testid="builder-shell"]:visible')
    .filter({ has: page.getByTestId("workspace-composer-textarea") })
    .or(page.locator('[data-testid="create-workspace-layer"]:not(.hidden)'))
    .first();
  const toggle = root.getByTestId("plan-first-toggle").getByRole("switch");
  if (!(await toggle.isVisible().catch(() => false))) return;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await toggle.getAttribute("aria-checked")) !== "true") break;
    await toggle.click({ force: true });
    await page.waitForTimeout(150);
  }
  await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 5_000 });
}

export async function assertCreateSubmitReady(
  page: Page,
  textarea: Locator,
  submit: Locator,
  expectedValue: string,
  opts?: { skipComposerReadyWait?: boolean },
) {
  const wait = opts?.skipComposerReadyWait
    ? null
    : await waitForComposerReady(page, CREATE_READY_MAX_MS);

  await syncComposerTextarea(textarea, expectedValue);
  await ensureBuildNowStrategy(page);
  const layerVisible = await page
    .locator('[data-testid="create-workspace-layer"]:not(.hidden)')
    .isVisible()
    .catch(() => false);
  if (!layerVisible) {
    await waitForWorkspaceComposer(page, Math.min(CREATE_READY_MAX_MS, 25_000)).catch(() => undefined);
  }

  const workspace = workspaceComposerLocators(page);
  if (await workspace.textarea.isVisible().catch(() => false)) {
    await syncComposerTextarea(workspace.textarea, expectedValue);
    textarea = workspace.textarea;
    submit = workspace.submit;
  }
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dreamos:composer-sync"));
  });

  await expect(textarea).toHaveValue(expectedValue, { timeout: 5_000 });

  const canType = await textarea
    .evaluate((el) => {
      const ta = el as HTMLTextAreaElement;
      const prev = ta.value;
      ta.focus();
      ta.value = "x";
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      const ok = ta.value.length > 0;
      ta.value = prev;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      return ok && !ta.disabled;
    })
    .catch(() => false);

  if (!canType) {
    await captureCreateComposerFailure(page, "textarea_not_accepting_text");
    throw new Error("Composer textarea cannot accept text");
  }

  const diag = await readSubmitDiagnostics(page, textarea, submit);
  const enabled = await submit.isEnabled().catch(() => false);

  if (
    !enabled ||
    diag.dataHasText !== "true" ||
    diag.dataDisabledReason !== "none" ||
    Number(diag.domLen) <= 0
  ) {
    await captureCreateComposerFailure(page, "submit_not_enabled_after_fill");
    await expect(submit).toBeEnabled({ timeout: 3_000 });
    await expect(submit).toHaveAttribute("data-has-text", "true");
    await expect(submit).toHaveAttribute("data-disabled-reason", "none");
    await expect
      .poll(async () => Number((await submit.getAttribute("data-dom-len")) ?? "0"))
      .toBeGreaterThan(0);
  }

  void wait;
}

export async function readSubmitDiagnostics(
  page: Page,
  textarea: Locator,
  submit: Locator,
) {
  const inputValue = await textarea.inputValue();
  const dom = await page.evaluate(() => {
    const ta =
      (document.querySelector('[data-testid="workspace-composer-textarea"]') as HTMLTextAreaElement | null) ??
      (document.getElementById("dreamos-composer-prompt") as HTMLTextAreaElement | null);
    const btn =
      (document.querySelector('[data-testid="workspace-composer-submit"]') as HTMLButtonElement | null) ??
      (document.querySelector('[data-testid="create-submit-button"]') as HTMLButtonElement | null);
    const marker = document.querySelector('[data-testid="create-composer-ready"]');
    return {
      domLen: ta?.value.length ?? 0,
      dataHasText: btn?.getAttribute("data-has-text") ?? null,
      dataDisabledReason: btn?.getAttribute("data-disabled-reason") ?? null,
      dataStateLen: btn?.getAttribute("data-state-len") ?? null,
      dataLiveLen: btn?.getAttribute("data-live-len") ?? null,
      dataDomLen: btn?.getAttribute("data-dom-len") ?? null,
      composerReady: marker?.getAttribute("data-ready") ?? null,
      composerReason: marker?.getAttribute("data-reason") ?? null,
    };
  });

  return {
    inputValueLength: inputValue.length,
    inputValuePreview: inputValue.slice(0, 80),
    dataHasText: dom.dataHasText,
    dataDisabledReason: dom.dataDisabledReason,
    dataStateLen: dom.dataStateLen,
    dataLiveLen: dom.dataLiveLen,
    domLen: dom.dataDomLen ?? String(dom.domLen),
    composerReady: dom.composerReady,
    composerReason: dom.composerReason,
  };
}
