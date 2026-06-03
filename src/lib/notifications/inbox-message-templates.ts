export type InboxMessageTemplate = {
  id: string;
  label: string;
  title: string;
  body: string;
  iconKey: string;
  effectKey: string;
  priority: "low" | "normal" | "high";
  category: string;
};

export const INBOX_MESSAGE_TEMPLATES: InboxMessageTemplate[] = [
  {
    id: "welcome",
    label: "Welcome to Vodex",
    title: "Welcome to Vodex!",
    body: "Your workspace is ready — start building your first app with free credits.",
    iconKey: "sparkles",
    effectKey: "stars",
    priority: "high",
    category: "welcome",
  },
  {
    id: "new_feature",
    label: "New feature available",
    title: "New Vodex feature is live",
    body: "We shipped improvements to generation, publishing, and workspace collaboration.",
    iconKey: "rocket",
    effectKey: "glow",
    priority: "normal",
    category: "system",
  },
  {
    id: "credits_added",
    label: "Credits added",
    title: "Credits added to your account",
    body: "Build and Action credits were added. Open the builder to keep creating.",
    iconKey: "gift",
    effectKey: "glow",
    priority: "high",
    category: "credits",
  },
  {
    id: "maintenance",
    label: "Maintenance notice",
    title: "Scheduled maintenance",
    body: "Vodex may be briefly unavailable while we upgrade infrastructure.",
    iconKey: "wrench",
    effectKey: "frost",
    priority: "normal",
    category: "system",
  },
  {
    id: "collab_tip",
    label: "Workspace collaboration tip",
    title: "Invite collaborators to your workspace",
    body: "Editors can help build apps — usage is always billed to the workspace owner.",
    iconKey: "users",
    effectKey: "glow",
    priority: "low",
    category: "workspace",
  },
  {
    id: "integration_reminder",
    label: "Integration setup reminder",
    title: "Connect integrations for your app",
    body: "Link Supabase or GitHub from your app dashboard for one-click setup.",
    iconKey: "plug",
    effectKey: "frost",
    priority: "normal",
    category: "system",
  },
  {
    id: "template_publish",
    label: "Template publishing reminder",
    title: "Share your app as a template",
    body: "Published templates help the community and track likes and usage on your profile.",
    iconKey: "layers",
    effectKey: "stars",
    priority: "low",
    category: "templates",
  },
  {
    id: "security",
    label: "Security / account notice",
    title: "Important account notice",
    body: "Review your account security settings and recent sign-in activity.",
    iconKey: "alert",
    effectKey: "frost",
    priority: "high",
    category: "security",
  },
];
