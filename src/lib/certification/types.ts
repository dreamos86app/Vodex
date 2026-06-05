export type CertificationLevel =
  | "NOT_READY"
  | "BASIC"
  | "BETA_READY"
  | "PRODUCTION_READY"
  | "ENTERPRISE_READY";

export type CheckStatus = "passed" | "warning" | "blocker";

export type CertificationSectionId =
  | "security"
  | "auth"
  | "integrations"
  | "payments"
  | "publish"
  | "mobile"
  | "performance"
  | "data"
  | "dashboard"
  | "app_audit"
  | "platform";

export type CertificationCheck = {
  id: string;
  section: CertificationSectionId;
  title: string;
  status: CheckStatus;
  detail: string;
  weight: number;
  fix?: string;
};

export type CertificationSectionReport = {
  id: CertificationSectionId;
  label: string;
  score: number;
  checks: CertificationCheck[];
  passed: number;
  warnings: number;
  blockers: number;
};

export type LaunchChecklistItem = {
  id: string;
  label: string;
  status: "done" | "pending" | "blocked";
  detail?: string;
};

export type AutoFixSuggestion = {
  id: string;
  title: string;
  description: string;
  kind: "migration" | "env" | "route" | "integration" | "dashboard" | "manual";
  safe: boolean;
};

export type ProductionCertificationResult = {
  overall_score: number;
  certification_level: CertificationLevel;
  passed_checks: number;
  warnings: number;
  blockers: number;
  recommendations: string[];
  sections: CertificationSectionReport[];
  launch_checklist: LaunchChecklistItem[];
  auto_fix_suggestions: AutoFixSuggestion[];
  report: {
    generated_at: string;
    project_id: string;
    app_name: string | null;
    published: boolean;
    source_kind: string;
    duration_ms: number;
  };
};

export type CertificationContext = {
  projectId: string;
  ownerId: string;
  projectName: string | null;
  metadata: Record<string, unknown>;
  files: Array<{ path: string; content: string }>;
  published: boolean;
  publishedSlug: string | null;
  publishedUrl: string | null;
};
