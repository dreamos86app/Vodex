import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(["read", "write", "deploy", "admin"])).default(["read"]),
  expiresAt: z.string().datetime().optional(),
});

const revokeSchema = z.object({
  id: z.string().uuid(),
});

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at, expires_at, revoked_at, request_count")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { name, scopes, expiresAt } = parsed.data;

  // Check key limit (max 10 active keys)
  const { count } = await supabase
    .from("api_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Maximum 10 API keys allowed" }, { status: 400 });
  }

  // Generate key — show once, never again
  const rawKey = `sk-dream-${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 14) + "...";

  const { data: key, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      expires_at: expiresAt ?? null,
    })
    .select("id, name, key_prefix, scopes, created_at, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return full key ONCE — never stored in plaintext
  return NextResponse.json({ key: { ...key, full_key: rawKey } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: key } = await supabase
    .from("api_keys")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();

  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id);

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id, name } = parsed.data;

  const { error } = await supabase
    .from("api_keys")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
