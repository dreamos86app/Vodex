import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  defaultNotificationPrefs,
  normalizeNotificationPrefs,
} from "@/lib/notifications/notification-preferences";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("notification_preferences")
    .select("prefs,sound_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const admin = createServiceRoleClient();
  let marketingOptIn = false;
  if (admin) {
    const { data: profile } = await admin
      .from("profiles")
      .select("marketing_emails_opt_in")
      .eq("id", user.id)
      .maybeSingle();
    marketingOptIn = Boolean(profile?.marketing_emails_opt_in);
  }

  if (!data) {
    return NextResponse.json({ prefs: defaultNotificationPrefs(), marketingOptIn });
  }

  const row = data as { prefs: unknown; sound_enabled: boolean };
  const prefs = normalizeNotificationPrefs(row.prefs);
  prefs.soundEnabled = row.sound_enabled ?? prefs.soundEnabled;
  return NextResponse.json({ prefs, marketingOptIn });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { prefs?: unknown; marketingOptIn?: boolean };
  const prefs = normalizeNotificationPrefs(body.prefs);

  if (typeof body.marketingOptIn === "boolean") {
    const admin = createServiceRoleClient();
    if (admin) {
      await admin
        .from("profiles")
        .update({ marketing_emails_opt_in: body.marketingOptIn } as never)
        .eq("id", user.id);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("notification_preferences").upsert({
    user_id: user.id,
    prefs: prefs.categories,
    sound_enabled: prefs.soundEnabled,
    updated_at: new Date().toISOString(),
  } as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prefs });
}
