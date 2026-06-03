export type BannerTemplateId =
  | "global_technical"
  | "builder_affected"
  | "preview_issue"
  | "scheduled_maintenance"
  | "service_restored"
  | "big_sale"
  | "new_feature"
  | "billing_notice"
  | "integration_outage"
  | "platform_update";

export type BannerTemplate = {
  id: BannerTemplateId;
  label: string;
  title: string;
  message: string;
  linkLabel: string;
  linkUrl: string;
  bannerType: "incident" | "sale" | "maintenance" | "info" | "success" | "warning";
  severity: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
  iconType: string;
  priority: number;
};

export const BANNER_TEMPLATES: BannerTemplate[] = [
  {
    id: "global_technical",
    label: "Global technical issue",
    title: "Technical issue affecting Vodex",
    message:
      "We're aware of a technical issue affecting some Vodex services. Our team is working to resolve it as quickly as possible.",
    linkLabel: "Status Page",
    linkUrl: "https://status.vodex.dev",
    bannerType: "incident",
    severity: "incident",
    gradientFrom: "#DC2626",
    gradientTo: "#EF4444",
    textColor: "#ffffff",
    iconType: "alert",
    priority: 10,
  },
  {
    id: "builder_affected",
    label: "Builder affected",
    title: "Builder is currently affected",
    message:
      "Some builds may fail, take longer than usual, or need repair. Your saved projects and files are safe.",
    linkLabel: "View status",
    linkUrl: "https://status.vodex.dev",
    bannerType: "incident",
    severity: "incident",
    gradientFrom: "#B91C1C",
    gradientTo: "#F97316",
    textColor: "#ffffff",
    iconType: "alert",
    priority: 20,
  },
  {
    id: "preview_issue",
    label: "Preview issue",
    title: "Preview rendering issue",
    message:
      "Some generated app previews may not load correctly. Builds are saved and can be repaired once the issue is resolved.",
    linkLabel: "View updates",
    linkUrl: "https://status.vodex.dev",
    bannerType: "warning",
    severity: "warning",
    gradientFrom: "#DC2626",
    gradientTo: "#FB7185",
    textColor: "#ffffff",
    iconType: "alert",
    priority: 30,
  },
  {
    id: "scheduled_maintenance",
    label: "Scheduled maintenance",
    title: "Scheduled maintenance",
    message:
      "Vodex is undergoing scheduled maintenance. Some features may be temporarily unavailable.",
    linkLabel: "Status Page",
    linkUrl: "https://status.vodex.dev",
    bannerType: "maintenance",
    severity: "maintenance",
    gradientFrom: "#D97706",
    gradientTo: "#F59E0B",
    textColor: "#ffffff",
    iconType: "wrench",
    priority: 40,
  },
  {
    id: "big_sale",
    label: "Limited-time upgrade offer",
    title: "Limited-time upgrade offer",
    message:
      "Upgrade today and get more build credits, action credits, and access to premium generation features.",
    linkLabel: "View plans",
    linkUrl: "/pricing",
    bannerType: "sale",
    severity: "sale",
    gradientFrom: "#2563EB",
    gradientTo: "#7C3AED",
    textColor: "#ffffff",
    iconType: "sparkles",
    priority: 50,
  },
  {
    id: "new_feature",
    label: "New features live",
    title: "New Vodex features are live",
    message:
      "We've shipped new improvements to app generation, publishing, and workspace collaboration.",
    linkLabel: "See changelog",
    linkUrl: "/changelog",
    bannerType: "success",
    severity: "success",
    gradientFrom: "#2563EB",
    gradientTo: "#06B6D4",
    textColor: "#ffffff",
    iconType: "sparkles",
    priority: 60,
  },
  {
    id: "service_restored",
    label: "Service restored",
    title: "All systems operational",
    message: "The incident has been resolved. Thank you for your patience.",
    linkLabel: "Status page",
    linkUrl: "https://status.vodex.dev",
    bannerType: "success",
    severity: "success",
    gradientFrom: "#059669",
    gradientTo: "#10B981",
    textColor: "#ffffff",
    iconType: "sparkles",
    priority: 15,
  },
  {
    id: "billing_notice",
    label: "Billing / payment notice",
    title: "Billing update",
    message: "There is an update regarding your subscription or payment method.",
    linkLabel: "Billing settings",
    linkUrl: "/settings/billing",
    bannerType: "warning",
    severity: "warning",
    gradientFrom: "#B45309",
    gradientTo: "#F59E0B",
    textColor: "#ffffff",
    iconType: "alert",
    priority: 45,
  },
  {
    id: "integration_outage",
    label: "Integration outage",
    title: "Third-party integration issue",
    message: "A connected provider may be temporarily unavailable. Your apps and data are safe.",
    linkLabel: "View status",
    linkUrl: "https://status.vodex.dev",
    bannerType: "warning",
    severity: "warning",
    gradientFrom: "#7C3AED",
    gradientTo: "#EC4899",
    textColor: "#ffffff",
    iconType: "alert",
    priority: 35,
  },
  {
    id: "platform_update",
    label: "Platform update",
    title: "Platform update rolling out",
    message: "We're deploying improvements across Vodex. You may notice brief UI refreshes.",
    linkLabel: "Changelog",
    linkUrl: "/changelog",
    bannerType: "info",
    severity: "info",
    gradientFrom: "#0EA5E9",
    gradientTo: "#6366F1",
    textColor: "#ffffff",
    iconType: "sparkles",
    priority: 70,
  },
];

export function getBannerTemplate(id: string): BannerTemplate | undefined {
  return BANNER_TEMPLATES.find((t) => t.id === id);
}
