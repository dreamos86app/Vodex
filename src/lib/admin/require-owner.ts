import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";

/** Server route guard — returns 401/403 response or null when allowed. */
export async function requireDreamosOwner(): Promise<
  | { user: { id: string; email: string }; error: null }
  | { user: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!isDreamosOwnerEmail(user.email)) {
    return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: { id: user.id, email: user.email! }, error: null };
}
