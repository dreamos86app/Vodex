import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  requireProjectId,
  requireUserId,
  jsonMissingId,
  jsonUnauthorized,
  USER_FACING_ID_ERRORS,
} from "@/lib/ids/required-ids";

export function requireAuthUser(user: User | null | undefined): User | NextResponse {
  const id = requireUserId(user?.id);
  if (!id) return jsonUnauthorized();
  return user!;
}

export function requireMutationProjectId(
  projectId: string | undefined | null,
): string | NextResponse {
  const id = requireProjectId(projectId);
  if (!id) return jsonMissingId("projectId", USER_FACING_ID_ERRORS.project);
  return id;
}

export function requireMutationDiffId(
  diffId: string | undefined | null,
): string | NextResponse {
  const id = requireProjectId(diffId);
  if (!id) return jsonMissingId("pendingDiffId", "Pending diff id is required.");
  return id;
}

export function requireMutationSlug(slug: string | undefined | null): string | NextResponse {
  const s = slug?.trim().toLowerCase();
  if (!s) return jsonMissingId("slug", "Publish slug is required.");
  return s;
}

export function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
