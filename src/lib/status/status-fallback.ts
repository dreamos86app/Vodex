import type { StatusLevel } from "@/lib/status/status-types";
import { aggregatePublicSurface } from "@/lib/status/status-public-surface";

const HISTORY_DAYS = 30;

export type FallbackComponent = {
  id: string;
  key: string;
  name: string;
  group_name: string;
  description: string | null;
  current_status: StatusLevel;
  sort_order: number;
};

const CATALOG: Omit<FallbackComponent, "id">[] = [
  { key: "platform", name: "Platform", group_name: "Core Platform", description: null, current_status: "operational", sort_order: 110 },
  { key: "login", name: "Login / Authentication", group_name: "Core Platform", description: null, current_status: "operational", sort_order: 120 },
  { key: "dashboard", name: "Dashboard", group_name: "Core Platform", description: null, current_status: "operational", sort_order: 130 },
  { key: "admin_panel", name: "Admin Panel", group_name: "Core Platform", description: null, current_status: "operational", sort_order: 140 },
  { key: "ai_builder", name: "AI Builder", group_name: "Builder", description: null, current_status: "operational", sort_order: 210 },
  { key: "app_generation", name: "App Generation", group_name: "Builder", description: null, current_status: "operational", sort_order: 220 },
  { key: "build_queue", name: "Build Queue", group_name: "Builder", description: null, current_status: "operational", sort_order: 230 },
  { key: "edit_mode", name: "Edit Mode", group_name: "Builder", description: null, current_status: "operational", sort_order: 240 },
  { key: "preview_rendering", name: "Preview Rendering", group_name: "Builder", description: null, current_status: "operational", sort_order: 250 },
  { key: "code_export", name: "Code Export", group_name: "Builder", description: null, current_status: "operational", sort_order: 260 },
  { key: "supabase", name: "Database / Supabase", group_name: "Infrastructure", description: null, current_status: "operational", sort_order: 310 },
  { key: "file_storage", name: "File Storage", group_name: "Infrastructure", description: null, current_status: "operational", sort_order: 320 },
  { key: "images_serving", name: "Images Serving", group_name: "Infrastructure", description: null, current_status: "operational", sort_order: 330 },
  { key: "vercel_hosting", name: "Hosting / Vercel", group_name: "Infrastructure", description: null, current_status: "operational", sort_order: 340 },
  { key: "published_apps", name: "Published Applications", group_name: "Infrastructure", description: null, current_status: "operational", sort_order: 350 },
  { key: "paddle_checkout", name: "Paddle Checkout", group_name: "Billing", description: null, current_status: "operational", sort_order: 410 },
  { key: "subscription_sync", name: "Subscription Sync", group_name: "Billing", description: null, current_status: "operational", sort_order: 420 },
  { key: "credits_usage", name: "Credits / Usage", group_name: "Billing", description: null, current_status: "operational", sort_order: 430 },
  { key: "upgrade_flow", name: "Upgrade Flow", group_name: "Billing", description: null, current_status: "operational", sort_order: 440 },
  { key: "email_resend", name: "Email / Resend", group_name: "Communications", description: null, current_status: "operational", sort_order: 510 },
  { key: "notifications", name: "Notifications", group_name: "Communications", description: null, current_status: "operational", sort_order: 520 },
  { key: "discord_community", name: "Discord Community", group_name: "Communications", description: null, current_status: "operational", sort_order: 530 },
  { key: "openai", name: "OpenAI", group_name: "AI Services", description: null, current_status: "operational", sort_order: 610 },
  { key: "anthropic", name: "Anthropic", group_name: "AI Services", description: null, current_status: "operational", sort_order: 620 },
  { key: "google_gemini", name: "Google Gemini", group_name: "AI Services", description: null, current_status: "operational", sort_order: 630 },
  { key: "image_generation", name: "Image Generation", group_name: "AI Services", description: null, current_status: "operational", sort_order: 640 },
];

function lastNDays(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export function buildFallbackStatusPayload(options?: { fullView?: boolean }) {
  const fullView = options?.fullView === true;
  const days = lastNDays();
  const components = CATALOG.map((c, i) => ({
    ...c,
    id: `fallback-${c.key}`,
    uptimePercent: 100,
    history: days.map((date) => ({
      date,
      status: "operational" as StatusLevel,
      uptime_percent: 100,
    })),
  }));
  const publicComponents = aggregatePublicSurface(
    components.map((c) => ({ key: c.key, current_status: c.current_status })),
  );

  return {
    ok: true as const,
    schemaReady: false,
    placeholder: true as const,
    viewMode: fullView ? ("full" as const) : ("public" as const),
    overallStatus: "operational" as StatusLevel,
    components: fullView ? components : [],
    publicComponents: fullView ? [] : publicComponents,
    incidents: [] as [],
    activeAnnouncements: [],
    activeAnnouncement: null,
  };
}
