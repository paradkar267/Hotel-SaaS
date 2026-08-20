// lib/server/services/audit-service.ts
// Append-Only Audit Trail Engine

import type { Session } from "../types";
import { createClient } from "../../supabase";

export function safeJson(value: unknown): string {
  return JSON.stringify(value, (key, item) => {
    const lowered = key.toLowerCase();
    if (
      lowered.includes("password") ||
      lowered.includes("token") ||
      lowered.includes("secret")
    ) {
      return "[REDACTED]";
    }
    return item;
  });
}

export function requestIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export interface AuditEntryInput {
  action: string;
  module: string;
  recordId: string;
  reason?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

export async function recordAuditLog(
  session: Session,
  entry: AuditEntryInput
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    tenant_id: session.tenantId,
    user_id: session.userId,
    actor_email: session.email,
    actor_role: session.role,
    action: entry.action,
    module: entry.module,
    record_id: entry.recordId,
    reason: entry.reason ?? "",
    old_value: safeJson(entry.oldValue ?? {}),
    new_value: safeJson(entry.newValue ?? {}),
    ip_address: entry.ipAddress ?? "",
    created_at: new Date().toISOString(),
  });
}
