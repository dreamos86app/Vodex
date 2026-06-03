import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { listUserProviderConnections } from "@/lib/integrations/server/user-provider-connections";

export const dynamic = "force-dynamic";

/** GET — linked account status (no tokens). */
export async function GET() {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await listUserProviderConnections(user.id);
  return NextResponse.json({
    connections: connections.map((c) => ({
      provider: c.provider,
      status: c.status,
      displayName: c.displayName,
      connected: c.connected,
      metadata: c.metadata,
    })),
  });
}
