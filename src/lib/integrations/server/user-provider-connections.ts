import { sealIntegrationSecret, unsealSecret } from "@/lib/secrets/seal";
import { getIntegrationAdmin } from "@/lib/integrations/server/verify-project";

export type UserProvider = "github" | "supabase";

export type UserProviderConnection = {
  provider: UserProvider;
  status: string;
  displayName: string | null;
  metadata: Record<string, unknown>;
  connected: boolean;
};

export async function getUserProviderConnection(
  userId: string,
  provider: UserProvider,
): Promise<UserProviderConnection | null> {
  const admin = getIntegrationAdmin();
  const { data, error } = await admin
    .from("user_provider_connections")
    .select("provider, status, display_name, metadata, encrypted_access_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return null;

  return {
    provider,
    status: data.status,
    displayName: data.display_name,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    connected: data.status === "connected" && Boolean(data.encrypted_access_token),
  };
}

export async function getUserProviderAccessToken(
  userId: string,
  provider: UserProvider,
): Promise<string | null> {
  const admin = getIntegrationAdmin();
  const { data } = await admin
    .from("user_provider_connections")
    .select("encrypted_access_token, status")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data?.encrypted_access_token || data.status !== "connected") return null;
  try {
    return unsealSecret(data.encrypted_access_token);
  } catch {
    return null;
  }
}

export async function saveUserProviderConnection(opts: {
  userId: string;
  provider: UserProvider;
  accessToken: string;
  displayName?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = getIntegrationAdmin();
  const sealed = sealIntegrationSecret(opts.accessToken);
  const { error } = await admin.from("user_provider_connections").upsert(
    {
      user_id: opts.userId,
      provider: opts.provider,
      status: "connected",
      display_name: opts.displayName ?? null,
      metadata: opts.metadata ?? {},
      encrypted_access_token: sealed,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function listUserProviderConnections(userId: string): Promise<UserProviderConnection[]> {
  const admin = getIntegrationAdmin();
  const { data } = await admin
    .from("user_provider_connections")
    .select("provider, status, display_name, metadata, encrypted_access_token")
    .eq("user_id", userId);

  return (data ?? []).map((row) => ({
    provider: row.provider as UserProvider,
    status: row.status,
    displayName: row.display_name,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    connected: row.status === "connected" && Boolean(row.encrypted_access_token),
  }));
}
