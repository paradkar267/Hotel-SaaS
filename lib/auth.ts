import { createClient } from "./supabase";
import { roleAllows, type Capability } from "./permissions";
import type { Identity, Role, Session } from "./types";

export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch the user's role and tenant from the users table
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, tenant_id, property_id, email, name, role, is_active")
    .eq("email", user.email)
    .single();

  if (!dbUser || !dbUser.is_active) return null;

  return {
    userId: dbUser.id,
    tenantId: dbUser.tenant_id ?? "platform",
    propertyId: dbUser.property_id ?? "platform",
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as Role,
  };
}

export async function getIdentity(): Promise<Identity | null> {
  const session = await getSession();
  if (session) {
    return {
      email: session.email.toLowerCase(),
      displayName: session.name,
    };
  }

  return null;
}

export function requireRole(session: Session, allowed: Role[]) {
  if (!allowed.includes(session.role)) {
    throw new AccessError(
      session.role === "MANAGER"
        ? "This record is locked. Only an admin can make this change."
        : "You do not have permission to perform this action.",
      403,
    );
  }
}

export function requireCapability(session: Session, capability: Capability) {
  if (!roleAllows(session.role, capability)) {
    throw new AccessError(
      session.role === "MANAGER"
        ? "This record is locked. Only an admin can make this change."
        : "You do not have permission to perform this action.",
      403,
    );
  }
}

export class AccessError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}
