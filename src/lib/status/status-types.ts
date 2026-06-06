export type StatusLevel =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export type AnnouncementSeverity =
  | "info"
  | "warning"
  | "incident"
  | "maintenance"
  | "outage"
  | "sale"
  | "success";

export type BannerType = "incident" | "sale" | "maintenance" | "info" | "success" | "warning";

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
  priority?: number;
  banner_type?: BannerType;
  gradient_from?: string | null;
  gradient_to?: string | null;
  text_color?: string | null;
  icon_type?: string | null;
  background_preset?: string | null;
  effect_preset?: string | null;
  effect_key?: string | null;
  icon_preset?: string | null;
  animated_icon_enabled?: boolean | null;
  accent_color?: string | null;
  outline_color?: string | null;
  button_color?: string | null;
  is_active?: boolean;
};
