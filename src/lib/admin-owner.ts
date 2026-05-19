/**
 * DreamOS86 platform owner — safe for client and server imports.
 */
export const DREAMOS_OWNER_EMAIL = "dreamos86app@gmail.com";

export function isDreamosOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DREAMOS_OWNER_EMAIL;
}
