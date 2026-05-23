import type { APIRequestContext } from "@playwright/test";

export async function countProjects(request: APIRequestContext, timeoutMs = 60_000): Promise<number> {
  try {
    const res = await request.get("/api/projects", { timeout: timeoutMs });
    if (res.status() === 401) return -1;
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects.length : Array.isArray(data) ? data.length : 0;
  } catch {
    return -1;
  }
}

export async function classifyIntent(request: APIRequestContext, prompt: string) {
  const res = await request.post("/api/projects/classify-intent", {
    data: { prompt },
  });
  const ct = res.headers()["content-type"] ?? "";
  if (!ct.includes("json")) {
    return { status: res.status(), body: { shouldCreateProject: false, _nonJson: true } };
  }
  return { status: res.status(), body: await res.json() };
}

export async function getCredits(request: APIRequestContext) {
  const res = await request.get("/api/credits");
  return { status: res.status(), body: await res.json() };
}

export async function getProjectSummary(request: APIRequestContext, projectId: string) {
  const res = await request.get(`/api/projects/${projectId}/summary`);
  return { status: res.status(), body: await res.json() };
}

export async function checkOverflow(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
}
