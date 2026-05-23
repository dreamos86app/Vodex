import type { Page, TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const MOBILE_WIDTHS = [375, 390, 430, 768] as const;

export type MobileRouteSpec = {
  path: string;
  label: string;
  requiresAuth?: boolean;
};

export async function checkHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth + 2;
  });
}

export async function assertNoOverflow(
  page: Page,
  spec: { path: string; label: string; width: number },
  testInfo?: TestInfo,
): Promise<void> {
  const overflow = await checkHorizontalOverflow(page);
  if (overflow) {
    const dir = path.join(process.cwd(), ".dreamos-evidence", "mobile-screenshots");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${spec.label.replace(/\s+/g, "-")}-${spec.width}.png`;
    const shot = path.join(dir, name);
    await page.screenshot({ path: shot, fullPage: true });
    throw new Error(
      `Horizontal overflow on ${spec.label} (${spec.path}) at ${spec.width}px — screenshot: ${shot}`,
    );
  }
  if (testInfo && process.env.E2E_SAVE_MOBILE_SHOTS === "1") {
    const dir = path.join(process.cwd(), ".dreamos-evidence", "mobile-screenshots");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${spec.label.replace(/\s+/g, "-")}-${spec.width}-ok.png`;
    await page.screenshot({
      path: path.join(dir, name),
      fullPage: false,
    });
  }
}
