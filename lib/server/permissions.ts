// lib/server/permissions.ts
// Granular capability-based access control engine

import type { Role } from "./types";

export type Capability =
  | "VIEW_OPERATIONS"
  | "CREATE_CHECKIN"
  | "UPLOAD_ID_PROOF"
  | "VIEW_PRIVATE_DOCUMENT"
  | "EDIT_LOCKED_RECORD"
  | "MANAGE_BILLING"
  | "MANAGE_ROOMS"
  | "MANAGE_TEAM"
  | "VIEW_AUDIT"
  | "CONFIGURE_HOTEL"
  | "MANAGE_PLATFORM";

export const roleCapabilities: Record<Role, ReadonlySet<Capability>> = {
  SUPER_ADMIN: new Set([
    "MANAGE_PLATFORM",
    "VIEW_OPERATIONS",
    "VIEW_AUDIT",
  ]),
  ADMIN: new Set([
    "VIEW_OPERATIONS",
    "CREATE_CHECKIN",
    "UPLOAD_ID_PROOF",
    "VIEW_PRIVATE_DOCUMENT",
    "EDIT_LOCKED_RECORD",
    "MANAGE_BILLING",
    "MANAGE_ROOMS",
    "MANAGE_TEAM",
    "VIEW_AUDIT",
    "CONFIGURE_HOTEL",
  ]),
  MANAGER: new Set([
    "VIEW_OPERATIONS",
    "CREATE_CHECKIN",
    "UPLOAD_ID_PROOF",
  ]),
};

export function roleAllows(role: Role, capability: Capability): boolean {
  const capabilities = roleCapabilities[role];
  return capabilities ? capabilities.has(capability) : false;
}
