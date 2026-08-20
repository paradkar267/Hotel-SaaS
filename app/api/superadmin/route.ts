import { z } from "zod";
import { AccessError, getSession } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase";
import { id, nowIso } from "../../../lib/hotel-db";

export const dynamic = "force-dynamic";

export async function authorize() {
  const session = await getSession();
  if (!session) throw new AccessError("Not signed in.", 401);
  if (session.role !== "SUPER_ADMIN") throw new AccessError("Platform access only.", 403);
  return session;
}

// ── GET: list all tenants with properties, rooms, users ──
export async function GET() {
  try {
    await authorize();
    const supabase = await createClient();

    const [
      { data: tenants },
      { data: properties },
      { data: users },
      { data: roomCounts },
      { data: revenueSummary },
      { data: invoices },
      { data: auditLogs },
    ] = await Promise.all([
      supabase.from("tenants").select("*").neq("id", "platform").order("created_at", { ascending: false }),
      supabase.from("properties").select("*").neq("tenant_id", "platform"),
      supabase.from("users").select("id, tenant_id, property_id, email, name, role, is_active, created_at").neq("tenant_id", "platform"),
      supabase.from("rooms").select("id, tenant_id, property_id, status"),
      supabase.from("payments").select("id, invoice_id, amount_paise, method, received_at, tenant_id"),
      supabase.from("invoices").select("*, bookings(guest_id, rooms(room_number))").order("issued_at", { ascending: false }).limit(200),
      supabase.from("audit_logs").select("*").neq("tenant_id", "platform").order("created_at", { ascending: false }).limit(200),
    ]);

    // Aggregate per-tenant
    const tenantList = (tenants ?? []).map((t: any) => {
      const tProps = (properties ?? []).filter((p: any) => p.tenant_id === t.id);
      const tUsers = (users ?? []).filter((u: any) => u.tenant_id === t.id);
      const tRooms = (roomCounts ?? []).filter((r: any) => r.tenant_id === t.id);
      const tLogs = (auditLogs ?? []).filter((l: any) => l.tenant_id === t.id);
      
      const tPayments = (revenueSummary ?? []).filter((p: any) => p.tenant_id === t.id);
      const tInvoices = (invoices ?? []).filter((inv: any) => inv.tenant_id === t.id).map((inv: any) => {
        const invPayments = tPayments.filter((p: any) => p.invoice_id === inv.id);
        const paidPaise = invPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paise), 0);
        return { ...inv, paidPaise, payments: invPayments };
      });
      
      const tRevenue = tPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paise), 0);

      return {
        ...t,
        properties: tProps,
        users: tUsers,
        invoices: tInvoices,
        auditLogs: tLogs,
        roomCount: tRooms.length,
        occupiedCount: tRooms.filter((r: any) => r.status === "OCCUPIED").length,
        totalRevenuePaise: tRevenue,
      };
    });

    const totalRooms = (roomCounts ?? []).length;
    const totalOccupied = (roomCounts ?? []).filter((r: any) => r.status === "OCCUPIED").length;
    const totalRevenue = (revenueSummary ?? []).reduce((s: number, p: any) => s + Number(p.amount_paise), 0);

    return Response.json({
      tenants: tenantList,
      auditLogs: auditLogs ?? [],
      metrics: {
        totalTenants: tenantList.length,
        totalProperties: (properties ?? []).length,
        totalRooms,
        totalOccupied,
        totalRevenuePaise: totalRevenue,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST: actions ──
const createTenantSchema = z.object({
  action: z.literal("create_tenant"),
  name: z.string().trim().min(2).max(120),
});

const createPropertySchema = z.object({
  action: z.literal("create_property"),
  tenantId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).default(""),
  city: z.string().trim().max(80).default(""),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(12).default(""),
  gstin: z.string().trim().max(15).default(""),
  defaultGstBps: z.coerce.number().int().refine((v) => [0, 500, 1200, 1800].includes(v)).default(1200),
  contactPhone: z.string().trim().max(20).default(""),
  contactEmail: z.string().trim().email().or(z.literal("")).default(""),
  upiId: z.string().trim().max(100).default("hotelos@upi"),
  upiName: z.string().trim().max(100).default("HotelOS"),
  checkInTime: z.string().trim().max(10).default("14:00"),
  checkOutTime: z.string().trim().max(10).default("11:00"),
  logoUrl: z.string().trim().max(500).default(""),
});

const createRoomsSchema = z.object({
  action: z.literal("create_rooms"),
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  rooms: z.array(z.object({
    roomNumber: z.string().trim().min(1).max(10),
    floor: z.string().trim().min(1).max(10),
    roomType: z.string().trim().min(1).max(40),
    baseRatePaise: z.coerce.number().int().positive(),
  })).min(1).max(200),
});

const createHotelAdminSchema = z.object({
  action: z.literal("create_hotel_admin"),
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(100),
});

const toggleTenantSchema = z.object({
  action: z.literal("toggle_tenant"),
  tenantId: z.string().min(1),
  isActive: z.boolean(),
});

const actionSchema = z.discriminatedUnion("action", [
  createTenantSchema,
  createPropertySchema,
  createRoomsSchema,
  createHotelAdminSchema,
  toggleTenantSchema,
]);

export async function POST(request: Request) {
  try {
    await authorize();
    const payload = actionSchema.parse(await request.json());
    const supabase = await createClient();

    switch (payload.action) {
      case "create_tenant": {
        const tenantId = id("ten");
        await supabase.from("tenants").insert({
          id: tenantId,
          name: payload.name,
          created_at: nowIso(),
        });
        return Response.json({ tenantId, message: `Tenant "${payload.name}" created.` });
      }

      case "create_property": {
        const propertyId = id("prop");
        await supabase.from("properties").insert({
          id: propertyId,
          tenant_id: payload.tenantId,
          name: payload.name,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          postal_code: payload.postalCode,
          gstin: payload.gstin,
          default_gst_bps: payload.defaultGstBps,
          contact_phone: payload.contactPhone,
          contact_email: payload.contactEmail,
          upi_id: payload.upiId,
          upi_name: payload.upiName,
          check_in_time: payload.checkInTime,
          check_out_time: payload.checkOutTime,
          logo_url: payload.logoUrl,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
        return Response.json({ propertyId, message: `Property "${payload.name}" created.` });
      }

      case "create_rooms": {
        const roomRows = payload.rooms.map((r) => ({
          id: id("room"),
          tenant_id: payload.tenantId,
          property_id: payload.propertyId,
          room_number: r.roomNumber,
          floor: r.floor,
          room_type: r.roomType,
          base_rate_paise: r.baseRatePaise,
          status: "AVAILABLE",
          updated_at: nowIso(),
        }));
        for (const row of roomRows) {
          await supabase.from("rooms").upsert(row, { onConflict: "property_id,room_number" });
        }
        return Response.json({ count: roomRows.length, message: `${roomRows.length} rooms created.` });
      }

      case "create_hotel_admin": {
        // Use service role key to create confirmed auth user
        const { createClient: createServiceClient } = await import("@supabase/supabase-js");
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) throw new AccessError("Service role key not configured.");
        const adminClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { error: authErr } = await adminClient.auth.admin.createUser({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
        });
        if (authErr && !authErr.message.includes("already been registered")) {
          throw new AccessError(`Auth error: ${authErr.message}`);
        }

        // Create users row
        const userId = id("usr");
        const { error: uErr } = await supabase.from("users").upsert({
          id: userId,
          tenant_id: payload.tenantId,
          property_id: payload.propertyId,
          email: payload.email.toLowerCase(),
          name: payload.name,
          role: "ADMIN",
          is_active: true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }, { onConflict: "email" });

        if (uErr) throw new AccessError(`User creation failed: ${uErr.message}`);
        return Response.json({ userId, message: `Admin account "${payload.name}" created. They can now log in.` });
      }

      case "toggle_tenant": {
        // Disable/enable all users for this tenant
        await supabase.from("users")
          .update({ is_active: payload.isActive, updated_at: nowIso() })
          .eq("tenant_id", payload.tenantId);
        return Response.json({ message: payload.isActive ? "Tenant enabled." : "Tenant disabled." });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Please check the form fields.", fields: error.flatten().fieldErrors }, { status: 400 });
  }
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("SuperAdmin API error", message);
  return Response.json({ error: "Request failed. Please try again." }, { status: 500 });
}
