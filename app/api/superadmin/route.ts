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
      { data: rooms },
      { data: revenueSummary },
      { data: invoices },
      { data: auditLogs },
    ] = await Promise.all([
      supabase.from("tenants").select("*").neq("id", "platform").order("created_at", { ascending: false }),
      supabase.from("properties").select("*").neq("tenant_id", "platform"),
      supabase.from("users").select("id, tenant_id, property_id, email, name, role, is_active, created_at").neq("tenant_id", "platform"),
      supabase.from("rooms").select("*").neq("tenant_id", "platform").order("room_number", { ascending: true }),
      supabase.from("payments").select("id, invoice_id, amount_paise, method, received_at, tenant_id"),
      supabase.from("invoices").select("*, bookings(guest_id, rooms(room_number))").order("issued_at", { ascending: false }).limit(200),
      supabase.from("audit_logs").select("*").neq("tenant_id", "platform").order("created_at", { ascending: false }).limit(200),
    ]);

    // Compute monthly platform revenue trends (last 6 months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const today = new Date();
    const monthlyTrends: { month: string; revenue: number; bookingsCount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      const mPrefix = d.toISOString().slice(0, 7);
      const mPayments = (revenueSummary ?? []).filter((p: any) => String(p.received_at).startsWith(mPrefix));
      const mRev = mPayments.reduce((sum: number, p: any) => sum + (Number(p.amount_paise) || 0), 0) / 100;
      const mInvoices = (invoices ?? []).filter((inv: any) => String(inv.issued_at).startsWith(mPrefix));
      monthlyTrends.push({ month: mLabel, revenue: mRev, bookingsCount: mInvoices.length });
    }

    // Aggregate per-tenant
    const tenantList = (tenants ?? []).map((t: any) => {
      const tProps = (properties ?? []).filter((p: any) => p.tenant_id === t.id);
      const tUsers = (users ?? []).filter((u: any) => u.tenant_id === t.id);
      const tRooms = (rooms ?? []).filter((r: any) => r.tenant_id === t.id);
      const tLogs = (auditLogs ?? []).filter((l: any) => l.tenant_id === t.id);
      
      const tPayments = (revenueSummary ?? []).filter((p: any) => p.tenant_id === t.id);
      const tInvoices = (invoices ?? []).filter((inv: any) => inv.tenant_id === t.id).map((inv: any) => {
        const invPayments = tPayments.filter((p: any) => p.invoice_id === inv.id);
        const paidPaise = invPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paise), 0);
        return { ...inv, paidPaise, payments: invPayments };
      });
      
      const tRevenue = tPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paise), 0);
      const occCount = tRooms.filter((r: any) => r.status === "OCCUPIED").length;
      const occRate = tRooms.length > 0 ? Math.round((occCount / tRooms.length) * 100) : 0;

      return {
        ...t,
        plan: t.plan || "STARTER",
        planStatus: t.plan_status || "ACTIVE",
        renewalDate: t.renewal_date || null,
        properties: tProps,
        users: tUsers,
        rooms: tRooms,
        invoices: tInvoices,
        auditLogs: tLogs,
        roomCount: tRooms.length,
        occupiedCount: occCount,
        occupancyRate: occRate,
        totalRevenuePaise: tRevenue,
      };
    });

    const totalRooms = (rooms ?? []).length;
    const totalOccupied = (rooms ?? []).filter((r: any) => r.status === "OCCUPIED").length;
    const totalRevenue = (revenueSummary ?? []).reduce((s: number, p: any) => s + Number(p.amount_paise), 0);

    const { data: platformTenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", "platform")
      .maybeSingle();
    const announcement = platformTenant?.name ?? "";

    return Response.json({
      tenants: tenantList,
      auditLogs: auditLogs ?? [],
      monthlyTrends,
      announcement,
      metrics: {
        totalTenants: tenantList.length,
        totalProperties: (properties ?? []).length,
        totalRooms,
        totalOccupied,
        overallOccupancyRate: totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0,
        totalRevenuePaise: totalRevenue,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function verifyRoomLimit(supabase: any, tenantId: string, roomsToAddCount: number) {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .single();

  if (!tenant) throw new AccessError("Tenant not found.", 404);

  const plan = tenant.plan || "STARTER";
  let limit = Infinity;
  if (plan === "TRIAL") limit = 15;
  else if (plan === "STARTER") limit = 15;
  else if (plan === "GROWTH") limit = 50;

  if (limit === Infinity) return;

  const { count, error } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (error) throw new AccessError("Failed to verify room count limit.");

  const currentCount = count || 0;
  if (currentCount + roomsToAddCount > limit) {
    throw new AccessError(
      `Plan room limit exceeded. The ${plan.toLowerCase()} plan allows up to ${limit} rooms. Currently has ${currentCount} rooms.`,
      403
    );
  }
}

// ── POST: actions ──
const createTenantSchema = z.object({
  action: z.literal("create_tenant"),
  name: z.string().trim().min(2).max(120),
  plan: z.enum(["TRIAL", "STARTER", "GROWTH", "ENTERPRISE"]).default("STARTER"),
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
  googleReviewLink: z.string().trim().max(1000).or(z.literal("")).default(""),
});

const editPropertySchema = z.object({
  action: z.literal("edit_property"),
  propertyId: z.string().min(1),
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
  googleReviewLink: z.string().trim().max(1000).or(z.literal("")).default(""),
});

const updateTenantPlanSchema = z.object({
  action: z.literal("update_tenant_plan"),
  tenantId: z.string().min(1),
  plan: z.enum(["TRIAL", "STARTER", "GROWTH", "ENTERPRISE"]),
  planStatus: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "PAST_DUE"]),
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

const addRoomSchema = z.object({
  action: z.literal("add_room"),
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  roomNumber: z.string().trim().min(1).max(10),
  floor: z.string().trim().min(1).max(10),
  roomType: z.string().trim().min(1).max(40),
  baseRatePaise: z.coerce.number().int().positive(),
});

const deleteRoomSchema = z.object({
  action: z.literal("delete_room"),
  tenantId: z.string().min(1),
  roomId: z.string().min(1),
});

const createHotelAdminSchema = z.object({
  action: z.literal("create_hotel_admin"),
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "MANAGER"]).default("ADMIN"),
});

const toggleUserSchema = z.object({
  action: z.literal("toggle_user"),
  userId: z.string().min(1),
  isActive: z.boolean(),
});

const toggleTenantSchema = z.object({
  action: z.literal("toggle_tenant"),
  tenantId: z.string().min(1),
  isActive: z.boolean(),
});

const deleteTenantSchema = z.object({
  action: z.literal("delete_tenant"),
  tenantId: z.string().min(1),
});

const saveAnnouncementSchema = z.object({
  action: z.literal("save_announcement"),
  announcement: z.string().trim().max(500),
});

const actionSchema = z.discriminatedUnion("action", [
  createTenantSchema,
  createPropertySchema,
  editPropertySchema,
  updateTenantPlanSchema,
  createRoomsSchema,
  addRoomSchema,
  deleteRoomSchema,
  createHotelAdminSchema,
  toggleUserSchema,
  toggleTenantSchema,
  deleteTenantSchema,
  saveAnnouncementSchema,
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
          plan: payload.plan || "STARTER",
          plan_status: "ACTIVE",
          created_at: nowIso(),
        });
        return Response.json({ tenantId, message: `Tenant "${payload.name}" created.` });
      }

      case "update_tenant_plan": {
        await supabase.from("tenants").update({
          plan: payload.plan,
          plan_status: payload.planStatus,
        }).eq("id", payload.tenantId);
        return Response.json({ message: `Subscription plan updated to ${payload.plan} (${payload.planStatus}).` });
      }

      case "create_property": {
        const propertyId = id("prop");
        const { error: createError } = await supabase.from("properties").insert({
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
          google_review_link: payload.googleReviewLink,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
        if (createError) throw new Error(createError.message);
        return Response.json({ propertyId, message: `Property "${payload.name}" created.` });
      }

      case "edit_property": {
        const { error: editError } = await supabase.from("properties").update({
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
          google_review_link: payload.googleReviewLink,
          updated_at: nowIso(),
        }).eq("id", payload.propertyId).eq("tenant_id", payload.tenantId);

        if (editError) throw new Error(editError.message);
        return Response.json({ message: `Property settings for "${payload.name}" updated successfully.` });
      }

      case "create_rooms": {
        await verifyRoomLimit(supabase, payload.tenantId, payload.rooms.length);
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

      case "add_room": {
        await verifyRoomLimit(supabase, payload.tenantId, 1);
        const roomId = id("room");
        await supabase.from("rooms").insert({
          id: roomId,
          tenant_id: payload.tenantId,
          property_id: payload.propertyId,
          room_number: payload.roomNumber,
          floor: payload.floor,
          room_type: payload.roomType,
          base_rate_paise: payload.baseRatePaise,
          status: "AVAILABLE",
          updated_at: nowIso(),
        });
        return Response.json({ roomId, message: `Room ${payload.roomNumber} added.` });
      }

      case "delete_room": {
        await supabase.from("rooms").delete().eq("id", payload.roomId).eq("tenant_id", payload.tenantId);
        return Response.json({ message: "Room deleted successfully." });
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

        const { data: createdAuthUser, error: authErr } = await adminClient.auth.admin.createUser({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
        });

        let authUserId = createdAuthUser?.user?.id;

        if (authErr) {
          if (authErr.message.includes("already been registered") || authErr.message.includes("already registered") || authErr.message.includes("exists")) {
            // Find existing user and auto-confirm them
            const { data: userData } = await adminClient.auth.admin.listUsers();
            const existing = userData?.users?.find((u) => u.email?.toLowerCase() === payload.email.toLowerCase());
            if (existing) {
              authUserId = existing.id;
              await adminClient.auth.admin.updateUserById(existing.id, {
                password: payload.password,
                email_confirm: true,
              });
            }
          } else {
            throw new AccessError(`Auth error: ${authErr.message}`);
          }
        }

        // Create or update users row
        const userId = authUserId || id("usr");
        const { error: uErr } = await supabase.from("users").upsert({
          id: userId,
          tenant_id: payload.tenantId,
          property_id: payload.propertyId,
          email: payload.email.toLowerCase(),
          name: payload.name,
          role: payload.role || "ADMIN",
          is_active: true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }, { onConflict: "id" });

        if (uErr) throw new AccessError(`User creation failed: ${uErr.message}`);
        return Response.json({ userId, message: `Account "${payload.name}" (${payload.role || "ADMIN"}) created.` });
      }

      case "toggle_user": {
        await supabase.from("users")
          .update({ is_active: payload.isActive, updated_at: nowIso() })
          .eq("id", payload.userId);
        return Response.json({ message: payload.isActive ? "User enabled." : "User disabled." });
      }

      case "toggle_tenant": {
        // Disable/enable all users for this tenant
        await supabase.from("users")
          .update({ is_active: payload.isActive, updated_at: nowIso() })
          .eq("tenant_id", payload.tenantId);
        return Response.json({ message: payload.isActive ? "Tenant enabled." : "Tenant disabled." });
      }

      case "delete_tenant": {
        // Cascade delete all tenant resources in correct order (child records first)
        await supabase.from("payments").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("invoice_items").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("invoices").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("guest_documents").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("bookings").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("guests").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("rooms").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("users").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("properties").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("audit_logs").delete().eq("tenant_id", payload.tenantId);
        await supabase.from("tenants").delete().eq("id", payload.tenantId);
        return Response.json({ message: "Tenant and all associated data permanently deleted." });
      }

      case "save_announcement": {
        await supabase.from("tenants").upsert({
          id: "platform",
          name: payload.announcement,
          created_at: nowIso()
        }, { onConflict: "id" });
        return Response.json({ message: "Platform announcement published successfully." });
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
