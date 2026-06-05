export type MobilePlatform = "android" | "ios";
export type MobileWrapperType = "capacitor" | "twa";
export type MobileBuildStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "requires_builder_config";

export type MobileArtifactType = "apk" | "aab" | "ipa" | "xcarchive" | "zip" | "wrapper_zip";

export type MobilePermissionKey =
  | "camera"
  | "photos"
  | "location"
  | "push_notifications"
  | "file_upload"
  | "microphone"
  | "contacts"
  | "background";

export type MobileAppConfig = {
  id?: string;
  project_id: string;
  owner_id?: string;
  platforms: MobilePlatform[];
  wrapper_type: MobileWrapperType;
  app_name: string | null;
  short_name: string | null;
  app_description: string | null;
  package_id: string | null;
  bundle_id: string | null;
  theme_color: string | null;
  version_name: string;
  android_version_code: number;
  ios_build_number: number;
  permissions: Partial<Record<MobilePermissionKey, boolean>>;
  features: {
    push?: boolean;
    deep_links?: boolean;
    universal_links?: boolean;
    offline_shell?: boolean;
    external_browser?: boolean;
  };
  store_draft: Record<string, unknown>;
  icon_url: string | null;
  splash_url: string | null;
  /** Splash display time in ms (Capacitor / TWA). */
  splash_duration_ms?: number | null;
  readiness_android: number | null;
  readiness_ios: number | null;
  readiness_store: number | null;
  meta?: Record<string, unknown>;
};

export type ReadinessItem = {
  id: string;
  label: string;
  status: "pass" | "missing" | "warning";
  detail: string;
  platform?: "general" | "android" | "ios" | "store";
};

export type ReadinessResult = {
  score: number;
  items: ReadinessItem[];
  platform: "general" | "android" | "ios" | "store";
};
