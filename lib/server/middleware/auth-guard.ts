// lib/server/middleware/auth-guard.ts
// Request Authentication & Capability Guard Interceptors

import { createClient } from "../../supabase";
import { roleAllows, type Capability } from "../permissions";
import type { Role, Session } from "../types";

export class AccessError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

export async function getAuthenticatedSession(): Promise<Session> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new AccessError("Authentication required.", 401);
  }

  // Resolve user role and tenant scoping
  const { data: dbUser, error } = await supabase
    .from("users")
    .select("id, tenant_id, property_id, email, name, role, is_active")
    .eq("email", user.email)
    .single();

  if (error || !dbUser || !dbUser.is_active) {
    throw new AccessError("Account is inactive or not found.", 403);
  }

  return {
    userId: dbUser.id,
    tenantId: dbUser.tenant_id ?? "platform",
    propertyId: dbUser.property_id ?? "platform",
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as Role,
  };
}

export function enforceCapability(session: Session, capability: Capability) {
  if (!roleAllows(session.role, capability)) {
    throw new AccessError(
      session.role === "MANAGER"
        ? "This action is restricted. Only an admin can perform this operation."
        : "You do not have permission to perform this action.",
      403
    );
  }
}

export function enforceRole(session: Session, allowedRoles: Role[]) {
  if (!allowedRoles.includes(session.role)) {
    throw new AccessError(
      session.role === "MANAGER"
        ? "This action is restricted. Only an admin can perform this operation."
        : "You do not have permission to perform this action.",
      403
    );
  }
}
