import { NextResponse } from "next/server";

export function requireUserId(userId: string | undefined | null): string | null {
  if (!userId?.trim()) return null;
  return userId;
}

export function requireProjectId(projectId: string | undefined | null): string | null {
  if (!projectId?.trim() || projectId === "undefined" || projectId === "null") return null;
  return projectId;
}

export const USER_FACING_ID_ERRORS = {
  project: "Project was not created correctly. Please retry from Create.",
  user: "Sign in required.",
  ownership: "This app does not exist or you do not have access.",
  build: "This app is missing a build record. Open the builder and retry.",
  publish: "Cannot publish until generation is complete.",
  edit: "Cannot edit because no app is selected.",
} as const;

export function jsonMissingId(field: string, message: string) {
  return NextResponse.json({ error: message, code: `missing_${field}`, field }, { status: 400 });
}

export function jsonUnauthorized(message = USER_FACING_ID_ERRORS.user) {
  return NextResponse.json({ error: message, code: "unauthorized" }, { status: 401 });
}

export function jsonNotFound(message = USER_FACING_ID_ERRORS.ownership) {
  return NextResponse.json({ error: message, code: "not_found" }, { status: 404 });
}
