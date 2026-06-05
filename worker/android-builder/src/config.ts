function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  builderId: process.env.ANDROID_BUILDER_ID?.trim() ?? "android-builder-1",
  port: Number(process.env.ANDROID_BUILDER_PORT ?? 8788),
  supabaseUrl:
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  builderSecret: process.env.ANDROID_BUILDER_SECRET?.trim() ?? "",
  callbackUrl:
    process.env.ANDROID_BUILDER_CALLBACK_URL?.trim() ??
    process.env.VODEX_CALLBACK_URL?.trim() ??
    "",
  mediaBucket: process.env.MEDIA_BUCKET?.trim() ?? "media",
  pollIntervalMs: Number(process.env.ANDROID_BUILDER_POLL_MS ?? 5000),
  androidHome: process.env.ANDROID_HOME?.trim() ?? process.env.ANDROID_SDK_ROOT?.trim() ?? "",
  javaHome: process.env.JAVA_HOME?.trim() ?? "",
  version: process.env.BUILDER_VERSION?.trim() ?? "0.1.0",
};
