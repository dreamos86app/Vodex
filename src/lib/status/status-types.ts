export type StatusLevel =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export type AnnouncementSeverity = "info" | "warning" | "incident" | "maintenance" | "outage";

export type StatusComponentRow = {
  id: string;
  key: string;
  name: string;
  group_name: string;
  description: string | null;
  current_status: StatusLevel;
  sort_order: number;
};

export type StatusDayRow = {
  date: string;
  status: StatusLevel;
  uptime_percent: number;
};

export type StatusIncidentRow = {
  id: string;
  title: string;
  message: string;
  status: IncidentStatus;
  severity: AnnouncementSeverity;
  affected_components: string[];
  started_at: string;
  resolved_at: string | null;
};

export type PlatformAnnouncementRow = {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  link_label: string | null;
  link_url: string | null;
};
