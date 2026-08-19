import { AccessError, getIdentity, getSession } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await getIdentity();
    if (!identity) throw new AccessError("Sign in to continue.", 401);
    const session = await getSession();
    if (!session) throw new AccessError("Session expired.", 401);
    const supabase = await createClient();
    let lastId = Number(new URL(request.url).searchParams.get("after") ?? 0);
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let lifetime: ReturnType<typeof setTimeout> | undefined;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ lastId })}\n\n`));
        timer = setInterval(async () => {
          try {
            const { data } = await supabase
              .from("audit_logs")
              .select("id")
              .eq("tenant_id", session.tenantId)
              .order("id", { ascending: false })
              .limit(1)
              .single();
            const nextId = Number(data?.id ?? 0);
            if (nextId > lastId) {
              lastId = nextId;
              controller.enqueue(encoder.encode(`event: change\nid: ${lastId}\ndata: ${JSON.stringify({ lastId })}\n\n`));
            } else {
              controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
            }
          } catch {
            controller.close();
            if (timer) clearInterval(timer);
          }
        }, 3000);
        lifetime = setTimeout(() => {
          if (timer) clearInterval(timer);
          controller.close();
        }, 25_000);
      },
      cancel() {
        if (timer) clearInterval(timer);
        if (lifetime) clearTimeout(lifetime);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    const message = error instanceof AccessError ? error.message : "Live sync is unavailable.";
    return Response.json({ error: message }, { status });
  }
}
