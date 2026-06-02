import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildFallbackStatusPayload } from "@/lib/status/status-fallback";
import { isStatusSchemaMissingError, uptimePercentForStatus } from "@/lib/status/status-db";
import { aggregatePublicSurface } from "@/lib/status/status-public-surface";
import type {
  PlatformAnnouncementRow,
  StatusComponentRow,
  StatusDayRow,
  StatusIncidentRow,
  StatusLevel,
} from "@/lib/status/status-types";

export const HISTORY_DAYS = 30;

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

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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

function incidentStatusForDay(
  incidents: StatusIncidentRow[],
  componentKey: string,
  date: string,
): StatusLevel | null {
  let worst: StatusLevel | null = null;
  for (const inc of incidents) {
    if (inc.resolved_at && inc.resolved_at.slice(0, 10) < date) continue;
    if (inc.started_at.slice(0, 10) > date) continue;
    const keys = Array.isArray(inc.affected_components)
      ? inc.affected_components
      : [];
    if (keys.length > 0 && !keys.includes(componentKey)) continue;
    const level: StatusLevel =
      inc.severity === "outage" || inc.severity === "incident"
        ? "major_outage"
        : inc.severity === "maintenance"
          ? "maintenance"
          : "degraded";
    worst = worst ? worstStatus(worst, level) : level;
  }
  return worst;
}

export async function fetchPublicStatusPayload(options?: { fullView?: boolean }) {
  const fullView = options?.fullView === true;
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, error: "Service role unavailable", schemaReady: false };
  }

  const days = lastNDays();
  const since = days[0]!;
  const today = todayUtc();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: components, error: compErr } = await db
    .from("status_components")
    .select("id,key,name,group_name,description,current_status,sort_order")
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  if (compErr && isStatusSchemaMissingError(compErr)) {
    return buildFallbackStatusPayload({ fullView });
  }

  const compRows = (components ?? []) as StatusComponentRow[];
  const compIds = compRows.map((c) => c.id);
  const compByKey = new Map(compRows.map((c) => [c.key, c]));

  const { data: history, error: histErr } = await db
    .from("status_daily_history")
    .select("component_id,date,status,uptime_percent")
    .in("component_id", compIds.length ? compIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("date", since);

  if (histErr && isStatusSchemaMissingError(histErr)) {
    return buildFallbackStatusPayload({ fullView });
  }

  const historyByComp = new Map<string, Map<string, StatusDayRow>>();
  for (const h of history ?? []) {
    const row = h as {
      component_id: string;
      date: string;
      status: StatusLevel;
      uptime_percent: number;
    };
    if (!historyByComp.has(row.component_id)) historyByComp.set(row.component_id, new Map());
    historyByComp.get(row.component_id)!.set(row.date, {
      date: row.date,
      status: row.status,
      uptime_percent: Number(row.uptime_percent ?? 100),
    });
  }

  const { data: incidents, error: incErr } = await db
    .from("status_incidents")
    .select("id,title,message,status,severity,affected_components,started_at,resolved_at")
    .eq("is_public", true)
    .gte("started_at", new Date(Date.now() - 90 * 86400000).toISOString())
    .order("started_at", { ascending: false })
    .limit(40);

  if (incErr && isStatusSchemaMissingError(incErr)) {
    return buildFallbackStatusPayload({ fullView });
  }

  const incidentRows = (incidents ?? []) as StatusIncidentRow[];

  const nowIso = new Date().toISOString();
  const { data: announcements, error: annErr } = await db
    .from("platform_announcements")
    .select(
      "id,title,message,severity,link_label,link_url,priority,banner_type,gradient_from,gradient_to,text_color,icon_type",
    )
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("priority", { ascending: true })
    .limit(2);

  if (annErr && isStatusSchemaMissingError(annErr)) {
    return buildFallbackStatusPayload({ fullView });
  }

  const activeAnnouncements = ((announcements ?? []) as PlatformAnnouncementRow[]).slice(0, 2);

  const componentsWithHistory = compRows.map((c) => {
    const map = historyByComp.get(c.id) ?? new Map();
    const dayRows: StatusDayRow[] = days.map((date) => {
      const hit = map.get(date);
      let status: StatusLevel = hit?.status ?? "operational";
      const incLevel = incidentStatusForDay(incidentRows, c.key, date);
      if (incLevel) status = worstStatus(status, incLevel);
      if (date === today) {
        status = worstStatus(status, c.current_status);
      }
      const uptime =
        hit?.uptime_percent ??
        (date === today ? uptimePercentForStatus(c.current_status) : 100);
      return { date, status, uptime_percent: uptime };
    });
    const uptime =
      dayRows.reduce((s, d) => s + d.uptime_percent, 0) / Math.max(dayRows.length, 1);
    const displayStatus = dayRows[dayRows.length - 1]?.status ?? c.current_status;
    return {
      ...c,
      current_status: displayStatus,
      uptimePercent: Math.round(uptime * 100) / 100,
      history: dayRows,
    };
  });

  const activeIncidents = incidentRows.filter((i) => !i.resolved_at);
  const overallWorst = componentsWithHistory.reduce<StatusLevel>(
    (acc, c) => worstStatus(acc, c.current_status),
    activeIncidents.length > 0 ? "partial_outage" : "operational",
  );

  const publicSurface = aggregatePublicSurface(
    componentsWithHistory.map((c) => ({ key: c.key, current_status: c.current_status })),
  );

  return {
    ok: true as const,
    schemaReady: true,
    viewMode: fullView ? ("full" as const) : ("public" as const),
    overallStatus: overallWorst,
    components: fullView ? componentsWithHistory : [],
    publicComponents: fullView ? [] : publicSurface,
    incidents: fullView ? incidentRows : incidentRows.filter((i) => !i.resolved_at).slice(0, 5),
    activeAnnouncements,
    activeAnnouncement: activeAnnouncements[0] ?? null,
  };
}

export async function checkStatusSchemaReady(): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { error: cErr } = await db.from("status_components").select("id").limit(1);
  if (!cErr) return true;
  if (!isStatusSchemaMissingError(cErr)) return false;
  const { error: aErr } = await db.from("platform_announcements").select("id").limit(1);
  return !aErr || !isStatusSchemaMissingError(aErr);
}
