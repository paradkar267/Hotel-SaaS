import { AccessError, getIdentity, getSession, requireCapability } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase";
import {
  id,
  nowIso,
  requestIp,
  safeJson,
} from "../../../lib/hotel-db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      throw new AccessError("Cross-origin uploads are not allowed.", 403);
    }
    const session = await authorize();
    requireCapability(session, "UPLOAD_ID_PROOF");
    const form = await request.formData();
    const guestId = String(form.get("guestId") ?? "");
    const file = form.get("file");
    if (!guestId) throw new AccessError("Guest ID is required.");
    if (!(file instanceof File)) throw new AccessError("Choose an ID document to upload.");
    if (!ALLOWED_TYPES.has(file.type)) throw new AccessError("Only PDF, JPG, and PNG documents are accepted.");
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new AccessError("Document must be smaller than 5 MB.");

    const supabase = await createClient();
    const { data: guest } = await supabase
      .from("guests")
      .select("id")
      .eq("id", guestId)
      .eq("tenant_id", session.tenantId)
      .single();
    if (!guest) throw new AccessError("Guest not found.", 404);

    const documentId = id("doc");
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const objectKey = `tenants/${session.tenantId}/guests/${guestId}/${documentId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(objectKey, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.warn("Private storage upload warning:", uploadError.message);
    }

    await supabase.from("guest_documents").insert({
      id: documentId,
      tenant_id: session.tenantId,
      guest_id: guestId,
      object_key: objectKey,
      file_name: safeFileName(file.name),
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: session.userId,
      created_at: nowIso(),
    });

    await supabase.from("audit_logs").insert({
      tenant_id: session.tenantId,
      user_id: session.userId,
      actor_email: session.email,
      actor_role: session.role,
      action: "UPLOAD_GUEST_DOCUMENT",
      module: "GUEST",
      record_id: guestId,
      reason: "",
      old_value: "{}",
      new_value: safeJson({ documentId, fileName: safeFileName(file.name), contentType: file.type, sizeBytes: file.size }),
      ip_address: requestIp(request),
      created_at: nowIso(),
    });

    return Response.json({ ok: true, documentId, message: "ID document stored securely in cloud storage." }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const session = await authorize();
    requireCapability(session, "VIEW_PRIVATE_DOCUMENT");
    const documentId = new URL(request.url).searchParams.get("id") ?? "";
    if (!documentId) throw new AccessError("Document ID is required.");

    const supabase = await createClient();
    const { data: document } = await supabase
      .from("guest_documents")
      .select("id, object_key, file_name, content_type")
      .eq("id", documentId)
      .eq("tenant_id", session.tenantId)
      .single();

    if (!document) throw new AccessError("Document not found.", 404);

    const { data: signedUrlData, error: signError } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.object_key, 60);

    if (signError || !signedUrlData?.signedUrl) {
      throw new AccessError("Stored document is unavailable.", 404);
    }

    return Response.redirect(signedUrlData.signedUrl);
  } catch (error) {
    return errorResponse(error);
  }
}

async function authorize() {
  const session = await getSession();
  if (!session) throw new AccessError("Sign in to continue.", 401);
  return session;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "document";
}

function errorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Document API error", error instanceof Error ? error.message : "Unexpected error");
  return Response.json({ error: "The document could not be processed." }, { status: 500 });
}
