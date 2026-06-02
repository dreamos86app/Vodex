import { createServiceRoleClient } from "@/lib/supabase/admin";
import type {
  PlatformAnnouncementRow,
  StatusComponentRow,
  StatusDayRow,
  StatusIncidentRow,
  StatusLevel,
} from "@/lib/status/status-types";

const HISTORY_DAYS = 30;

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

function worstStatus(a: StatusLevel, b: StatusLevel): StatusLevel {
  const rank: Record<StatusLevel, number> = {
    operational: 0,
    maintenance: 1,
    degraded: 2,
    partial_outage: 3,
    major_outage: 4,
  };
  return rank[a] >= rank[b] ? a : b;
}

export async function fetchPublicStatusPayload() {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, error: "Service role unavailable" };
  }

  const days = lastNDays();
  const since = days[0]!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: components } = await db
    .from("status_components")
    .select("id,key,name,group_name,description,current_status,sort_order")
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  const compRows = (components ?? []) as StatusComponentRow[];
  const compIds = compRows.map((c) => c.id);

  const { data: history } = await db
    .from("status_daily_history")
    .select("component_id,date,status,uptime_percent")
    .in("component_id", compIds.length ? compIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("date", since);

  const historyByComp = new Map<string, Map<string, StatusDayRow>>();
  for (const h of history ?? []) {
    const row = h as { component_id: string; date: string; status: StatusLevel; uptime_percent: number };
    if (!historyByComp.has(row.component_id)) historyByComp.set(row.component_id, new Map());
    historyByComp.get(row.component_id)!.set(row.date, {
      date: row.date,
      status: row.status,
      uptime_percent: Number(row.uptime_percent ?? 100),
    });
  }

  const { data: incidents } = await db
    .from("status_incidents")
    .select("id,title,message,status,severity,affected_components,started_at,resolved_at")
    .eq("is_public", true)
    .gte("started_at", new Date(Date.now() - 90 * 86400000).toISOString())
    .order("started_at", { ascending: false })
    .limit(40);

  const nowIso = new Date().toISOString();
  const { data: announcements } = await db
    .from("platform_announcements")
    .select("id,title,message,severity,link_label,link_url")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .limit(1);

  const componentsWithHistory = compRows.map((c) => {
    const map = historyByComp.get(c.id) ?? new Map();
    const dayRows: StatusDayRow[] = days.map((date) => {
      const hit = map.get(date);
      return hit ?? { date, status: "operational" as StatusLevel, uptime_percent: 100 };
    });
    const uptime =
      dayRows.reduce((s, d) => s + d.uptime_percent, 0) / Math.max(dayRows.length, 1);
    let rollup: StatusLevel = c.current_status;
    for (const d of dayRows) rollup = worstStatus(rollup, d.status);
    return { ...c, current_status: rollup, uptimePercent: Math.round(uptime * 100) / 100, history: dayRows };
  });

  const activeIncidents = ((incidents ?? []) as StatusIncidentRow[]).filter((i) => !i.resolved_at);
  const overallWorst = componentsWithHistory.reduce<StatusLevel>(
    (acc, c) => worstStatus(acc, c.current_status),
    activeIncidents.length > 0 ? "partial_outage" : "operational",
  );

  return {
    ok: true as const,
    overallStatus: overallWorst,
    components: componentsWithHistory,
    incidents: (incidents ?? []) as StatusIncidentRow[],
    activeAnnouncement: ((announcements ?? [])[0] as PlatformAnnouncementRow | undefined) ?? null,
  };
}
