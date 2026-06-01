import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}

export function requireServiceAdmin() {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Server configuration error" }, { status: 503 }) };
  }
  return { admin };
}
