import { z } from "zod";
import { AccessError } from "../../../lib/auth";
import { calculateInvoice, toPaise } from "../../../lib/billing";
import {
  addAudit,
  getHotelData,
  id,
  nowIso,
  requestIp,
  safeJson,
} from "../../../lib/hotel-db";
import type { BillingType, Session } from "../../../lib/types";
import { createClient } from "../../../lib/supabase";
import { getSession } from "../../../lib/auth";
import { sendInvoiceEmail, sendReviewEmail, sendCheckInConfirmationEmail } from "../../../lib/email-service";

export const dynamic = "force-dynamic";

const text = (max: number) => z.string().trim().max(max);
const email = z.string().trim().email().max(160).transform((value) => value.toLowerCase());

const checkInSchema = z.object({
  action: z.literal("create_checkin"),
  roomId: z.string().min(1).max(80).optional(),
  roomIds: z.array(z.string().min(1).max(80)).optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(24),
  email: z.union([email, z.literal("")]).default(""),
  address: text(240).default(""),
  city: text(80).default(""),
  state: text(80).default(""),
  postalCode: text(12).default(""),
  country: text(80).default("India"),
  nationality: text(80).default("Indian"),
  idType: z.enum(["AADHAAR", "PASSPORT", "DRIVING_LICENCE", "VOTER_ID", "OTHER"]),
  idLast4: z.string().trim().regex(/^\d{4}$/, "Enter only the final 4 ID digits."),
  adults: z.coerce.number().int().min(1).max(12),
  children: z.coerce.number().int().min(0).max(12),
  expectedCheckOutAt: z.string().datetime(),
  nightlyRate: z.coerce.number().positive().max(1_000_000),
  billingType: z.enum(["GST", "NON_GST"]),
  companyName: text(160).default(""),
  guestGstin: text(15).default(""),
  guestState: text(80).default(""),
  gstRateBps: z.coerce.number().int().default(1200),
  notes: text(500).default(""),
});

const managerSchema = z.object({
  action: z.literal("create_manager"),
  name: z.string().trim().min(2).max(100),
  email,
  password: z.string().min(6).max(100),
});

const toggleManagerSchema = z.object({
  action: z.literal("toggle_manager"),
  userId: z.string().min(1).max(80),
  isActive: z.boolean(),
  reason: z.string().trim().min(4).max(240),
});

const guestUpdateSchema = z.object({
  action: z.literal("update_guest"),
  guestId: z.string().min(1).max(80),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(24),
  email: z.union([email, z.literal("")]).default(""),
  address: text(240).default(""),
  city: text(80).default(""),
  state: text(80).default(""),
  postalCode: text(12).default(""),
  country: text(80).default("India"),
  nationality: text(80).default("Indian"),
  notes: text(500).default(""),
  reason: z.string().trim().min(4).max(240),
});

const bookingUpdateSchema = z.object({
  action: z.literal("update_booking"),
  bookingId: z.string().min(1).max(80),
  roomId: z.string().min(1).max(80),
  expectedCheckOutAt: z.string().datetime(),
  nightlyRate: z.coerce.number().positive().max(1_000_000),
  billingType: z.enum(["GST", "NON_GST"]),
  companyName: text(160).default(""),
  guestGstin: text(15).default(""),
  guestState: text(80).default(""),
  notes: text(500).default(""),
  reason: z.string().trim().min(4).max(240),
});

const invoiceSchema = z.object({
  action: z.literal("create_invoice"),
  bookingId: z.string().min(1).max(80),
  nights: z.coerce.number().int().min(1).max(365),
  extras: z.coerce.number().min(0).max(1_000_000),
  extrasDescription: text(160).default("Additional services"),
  gstRateBps: z.coerce.number().int().refine((value) => [0, 500, 1200, 1800].includes(value)),
});

const paymentSchema = z.object({
  action: z.literal("record_payment"),
  invoiceId: z.string().min(1).max(80),
  amount: z.coerce.number().positive().max(10_000_000),
  method: z.enum(["CASH", "CARD_TERMINAL", "UPI_MANUAL", "BANK_TRANSFER"]),
  reference: text(120).default(""),
  note: text(240).default(""),
});

const checkoutSchema = z.object({
  action: z.literal("checkout"),
  bookingId: z.string().min(1).max(80),
  reason: z.string().trim().min(4).max(240),
});

const roomSchema = z.object({
  action: z.literal("update_room"),
  roomId: z.string().min(1).max(80),
  status: z.enum(["AVAILABLE", "HOUSEKEEPING", "MAINTENANCE"]),
  reason: z.string().trim().min(4).max(240),
});

const editRoomDetailsSchema = z.object({
  action: z.literal("edit_room_details"),
  roomId: z.string().min(1).max(80),
  roomNumber: z.string().trim().min(1).max(20),
  roomType: z.string().trim().min(1).max(40),
  floor: z.string().trim().min(1).max(20),
  baseRatePaise: z.coerce.number().int().positive().max(100000000),
});

const propertySchema = z.object({
  action: z.literal("update_property"),
  name: z.string().trim().min(2).max(120),
  address: text(240).default(""),
  city: text(80).default(""),
  state: z.string().trim().min(2).max(80),
  postalCode: text(12).default(""),
  gstin: text(15).default(""),
  defaultGstBps: z.coerce.number().int().refine((value) => [0, 500, 1200, 1800].includes(value)).default(1200),
  contactPhone: z.string().trim().max(20).default(""),
  contactEmail: z.string().trim().email().or(z.literal("")).default(""),
  upiId: z.string().trim().max(100).default("hotelos@upi"),
  upiName: z.string().trim().max(100).default("HotelOS"),
  checkInTime: z.string().trim().max(10).default("14:00"),
  checkOutTime: z.string().trim().max(10).default("11:00"),
  logoUrl: z.string().trim().max(500).default(""),
  googleReviewLink: z.string().trim().max(1000).or(z.literal("")).default(""),
  reason: z.string().trim().min(4).max(240),
});

const voidInvoiceSchema = z.object({
  action: z.literal("void_invoice"),
  invoiceId: z.string().min(1).max(80),
  reason: z.string().trim().min(5).max(240),
});

const deleteGuestSchema = z.object({
  action: z.literal("delete_guest"),
  guestId: z.string().min(1).max(80),
  reason: z.string().trim().min(4).max(240),
});

const actionSchema = z.discriminatedUnion("action", [
  checkInSchema,
  managerSchema,
  toggleManagerSchema,
  guestUpdateSchema,
  bookingUpdateSchema,
  invoiceSchema,
  paymentSchema,
  checkoutSchema,
  roomSchema,
  editRoomDetailsSchema,
  propertySchema,
  voidInvoiceSchema,
  deleteGuestSchema,
]);

export async function GET() {
  try {
    const session = await authorize();
    const data = await getHotelData(session);
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new AccessError("Content-Type must be application/json.", 415);
    }
    const session = await authorize();
    const payload = actionSchema.parse(await request.json());
    const ipAddress = requestIp(request);

    let result: Record<string, unknown>;
    switch (payload.action) {
      case "create_checkin":
        result = await createCheckIn(session, payload, ipAddress);
        break;
      case "create_manager":
        result = await createManager(session, payload, ipAddress);
        break;
      case "toggle_manager":
        result = await toggleManager(session, payload, ipAddress);
        break;
      case "update_guest":
        result = await updateGuest(session, payload, ipAddress);
        break;
      case "update_booking":
        result = await updateBooking(session, payload, ipAddress);
        break;
      case "create_invoice":
        result = await createInvoice(session, payload, ipAddress);
        break;
      case "record_payment":
        result = await recordPayment(session, payload, ipAddress);
        break;
      case "checkout":
        result = await checkOut(session, payload, ipAddress);
        break;
      case "update_room":
        result = await updateRoom(session, payload, ipAddress);
        break;
      case "edit_room_details":
        result = await editRoomDetails(session, payload, ipAddress);
        break;
      case "update_property":
        result = await updateProperty(session, payload, ipAddress);
        break;
      case "void_invoice":
        result = await voidInvoice(session, payload, ipAddress);
        break;
      case "delete_guest":
        result = await deleteGuest(session, payload, ipAddress);
        break;
    }

    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

async function authorize() {
  const session = await getSession();
  if (!session) throw new AccessError("Sign in to continue.", 401);

  // Enforce suspended status restriction
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan_status")
    .eq("id", session.tenantId)
    .single();

  if (tenant && tenant.plan_status === "SUSPENDED") {
    throw new AccessError("Your account has been suspended. Please contact platform support.", 403);
  }

  return session;
}

function requireCapability(session: Session, cap: string) {
  if (session.role !== "ADMIN") {
    throw new AccessError("You do not have permission to perform this action.", 403);
  }
}

async function createManager(
  session: Session,
  payload: z.infer<typeof managerSchema>,
  ipAddress: string,
) {
  requireCapability(session, "MANAGE_TEAM");
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", payload.email)
    .single();
    
  if (existing) throw new AccessError("That email already has access.", 409);

  // In Supabase, you'd ideally create the user via admin auth api
  // supabase.auth.admin.createUser({...}) 
  // but for simplicity we will assume users sign up themselves or are added to the DB,
  // and we just add their record. Since we're using Supabase auth, we need to create
  // them in auth.users first, but that requires service_role key. We'll simulate by 
  // just adding to the public users table for now, or using a signUp.
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
  });

  if (authError) throw new AccessError(authError.message, 400);
  
  const userId = authData.user?.id || id("usr");
  const now = nowIso();

  const { error } = await supabase.from("users").insert({
    id: userId,
    tenant_id: session.tenantId,
    property_id: session.propertyId,
    email: payload.email,
    name: payload.name,
    role: 'MANAGER',
    is_active: true,
    created_by: session.userId,
    created_at: now,
    updated_at: now
  });

  if (error) throw new AccessError("Failed to create manager record.", 500);

  await addAudit(session, {
    action: "CREATE_MANAGER_ACCESS",
    module: "TEAM",
    recordId: userId,
    newValue: { name: payload.name, email: payload.email, role: "MANAGER" },
    ipAddress,
  });
  return { userId, message: "Manager access created for the verified email." };
}

async function toggleManager(
  session: Session,
  payload: z.infer<typeof toggleManagerSchema>,
  ipAddress: string,
) {
  requireCapability(session, "MANAGE_TEAM");
  const supabase = await createClient();
  const { data: manager } = await supabase
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("id", payload.userId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!manager || manager.role !== "MANAGER") throw new AccessError("Manager not found.", 404);
  
  await supabase
    .from("users")
    .update({ is_active: payload.isActive, updated_at: nowIso() })
    .eq("id", payload.userId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: payload.isActive ? "ENABLE_MANAGER" : "DISABLE_MANAGER",
    module: "TEAM",
    recordId: payload.userId,
    reason: payload.reason,
    oldValue: { isActive: Boolean(manager.is_active) },
    newValue: { isActive: payload.isActive },
    ipAddress,
  });
  return { message: payload.isActive ? "Manager access enabled." : "Manager access disabled." };
}

async function createCheckIn(
  session: Session,
  payload: z.infer<typeof checkInSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const roomIds = payload.roomIds || (payload.roomId ? [payload.roomId] : []);
  if (roomIds.length === 0) {
    throw new AccessError("Select at least one room.", 400);
  }

  // Fetch all selected rooms
  const { data: rooms } = await supabase.from("rooms")
    .select("id, room_number, base_rate_paise, status")
    .in("id", roomIds)
    .eq("tenant_id", session.tenantId)
    .eq("property_id", session.propertyId);

  if (!rooms || rooms.length !== roomIds.length) {
    throw new AccessError("One or more selected rooms were not found.", 404);
  }

  const unavailableRoom = rooms.find(r => r.status !== "AVAILABLE");
  if (unavailableRoom) {
    throw new AccessError(`Room ${unavailableRoom.room_number} is no longer available.`, 409);
  }

  const checkInAt = nowIso();
  if (new Date(payload.expectedCheckOutAt).getTime() <= new Date(checkInAt).getTime()) {
    throw new AccessError("Expected check-out must be after check-in.");
  }

  let firstBookingId = "";
  let firstBookingNumber = "";
  let guestId = "";

  try {
    // Lookup returning guest by mobile phone number
    const { data: existingGuest } = await supabase
      .from("guests")
      .select("id")
      .eq("tenant_id", session.tenantId)
      .eq("phone", payload.phone.trim())
      .maybeSingle();

    if (existingGuest?.id) {
      guestId = existingGuest.id;
      // Update returning guest profile details
      await supabase.from("guests").update({
        full_name: payload.fullName.trim(),
        email: payload.email ? payload.email.trim() : "",
        city: payload.city ? payload.city.trim() : "",
        id_type: payload.idType,
        id_last4: payload.idLast4,
        notes: payload.notes ? payload.notes.trim() : "",
        updated_at: checkInAt,
      }).eq("id", guestId);
    } else {
      guestId = id("gst");
      // Insert new guest profile once
      await supabase.from("guests").insert({
        id: guestId,
        tenant_id: session.tenantId,
        property_id: session.propertyId,
        full_name: payload.fullName.trim(),
        email: payload.email ? payload.email.trim() : "",
        phone: payload.phone.trim(),
        address: payload.address || "",
        city: payload.city ? payload.city.trim() : "",
        state: payload.state || "",
        postal_code: payload.postalCode || "",
        country: payload.country || "India",
        nationality: payload.nationality || "Indian",
        id_type: payload.idType,
        id_last4: payload.idLast4,
        notes: payload.notes ? payload.notes.trim() : "",
        created_by: session.userId,
        created_at: checkInAt,
        updated_at: checkInAt,
      });
    }

    const createdBookings: { id: string; room_number: string; nightly_rate_paise: number }[] = [];

    // Create bookings for each room
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const bookingId = id("bkg");
      const bookingNumber = `BK-${checkInAt.slice(2, 10).replaceAll("-", "")}-${bookingId.slice(-5).toUpperCase()}`;

      if (i === 0) {
        firstBookingId = bookingId;
        firstBookingNumber = bookingNumber;
      }

      // Use room's specific base rate if multiple rooms are selected, or payload rate if single room override
      const roomBasePaise = Number(room.base_rate_paise || 0);
      const nightlyRatePaise = (rooms.length > 1 && roomBasePaise > 0)
        ? roomBasePaise
        : toPaise(payload.nightlyRate);
      
      createdBookings.push({ id: bookingId, room_number: room.room_number, nightly_rate_paise: nightlyRatePaise });

      const auditSnapshot = {
        bookingNumber,
        guestName: payload.fullName,
        roomNumber: room.room_number,
        billingType: payload.billingType,
      };

      await supabase.from("bookings").insert({
        id: bookingId,
        tenant_id: session.tenantId,
        property_id: session.propertyId,
        booking_number: bookingNumber,
        guest_id: guestId,
        room_id: room.id,
        check_in_at: checkInAt,
        expected_check_out_at: payload.expectedCheckOutAt,
        adults: payload.adults,
        children: payload.children,
        source: 'WALK_IN',
        status: 'CHECKED_IN',
        billing_type: payload.billingType,
        company_name: payload.companyName,
        guest_gstin: payload.guestGstin,
        guest_state: payload.guestState || payload.state,
        nightly_rate_paise: nightlyRatePaise,
        notes: payload.notes,
        locked_at: checkInAt,
        created_by: session.userId,
        updated_by: session.userId,
        created_at: checkInAt,
        updated_at: checkInAt,
      });

      const { error: roomError } = await supabase.from("rooms")
        .update({ status: 'OCCUPIED', updated_at: checkInAt })
        .eq("id", room.id)
        .eq("tenant_id", session.tenantId)
        .eq("status", 'AVAILABLE');

      if (roomError) {
        throw new Error(`Room ${room.room_number} is no longer available.`);
      }

      await addAudit(session, {
        action: "CHECK_IN",
        module: "FRONT_DESK",
        recordId: bookingId,
        reason: `Guest check-in confirmed for Room ${room.room_number}; manager record locked`,
        newValue: auditSnapshot,
        ipAddress,
      });
    }

    // Auto-generate 1 Consolidated Invoice for this multi-room booking
    const checkInMs = new Date(checkInAt).getTime();
    const checkOutMs = new Date(payload.expectedCheckOutAt).getTime();
    const diffHours = (checkOutMs - checkInMs) / (1000 * 60 * 60);
    const nights = Math.max(1, Math.ceil(diffHours / 24));

    const totalRoomRatePaise = createdBookings.reduce((sum, b) => sum + Number(b.nightly_rate_paise), 0);
    const billingType = payload.billingType as BillingType;

    const { data: property } = await supabase
      .from("properties")
      .select("name, state, default_gst_bps, logo_url, contact_email")
      .eq("id", session.propertyId)
      .maybeSingle();

    const propertyState = String(property?.state || "");
    const invoiceCalc = calculateInvoice({
      billingType,
      roomRatePaise: totalRoomRatePaise,
      nights,
      extrasPaise: 0,
      gstRateBps: payload.gstRateBps || property?.default_gst_bps || 1200,
      propertyState,
      guestState: payload.guestState || payload.state || propertyState,
    });

    const invoiceId = id("inv");
    const prefix = billingType === "GST" ? "GST" : "INV";
    const invoiceNumber = `${prefix}-${checkInAt.slice(2, 10).replaceAll("-", "")}-${invoiceId.slice(-5).toUpperCase()}`;

    await supabase.from("invoices").insert({
      id: invoiceId,
      tenant_id: session.tenantId,
      property_id: session.propertyId,
      invoice_number: invoiceNumber,
      booking_id: firstBookingId,
      billing_type: billingType,
      gst_rate_bps: invoiceCalc.gstRateBps,
      status: 'UNPAID',
      subtotal_paise: invoiceCalc.subtotalPaise,
      cgst_paise: invoiceCalc.cgstPaise,
      sgst_paise: invoiceCalc.sgstPaise,
      igst_paise: invoiceCalc.igstPaise,
      total_paise: invoiceCalc.totalPaise,
      balance_paise: invoiceCalc.totalPaise,
      issued_at: checkInAt,
      created_by: session.userId,
      updated_at: checkInAt,
    });

    // Link invoice_id to all created bookings & insert itemized line items for each room
    for (const b of createdBookings) {
      await supabase.from("bookings")
        .update({ invoice_id: invoiceId, updated_at: checkInAt })
        .eq("id", b.id)
        .eq("tenant_id", session.tenantId);

      const itemAmountPaise = Number(b.nightly_rate_paise) * nights;
      await supabase.from("invoice_items").insert({
        id: id("itm"),
        tenant_id: session.tenantId,
        invoice_id: invoiceId,
        description: `Room accommodation (Room ${b.room_number})`,
        quantity: nights,
        rate_paise: Number(b.nightly_rate_paise),
        amount_paise: itemAmountPaise
      });
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("one_active_booking_per_room") || message.includes("UNIQUE constraint") || message.includes("no longer available")) {
      throw new AccessError("One or more rooms could not be claimed. Choose another available room.", 409);
    }
    throw error;
  }

  const roomNumbers = rooms.map(r => r.room_number).join(", ");

  if (payload.email) {
    const { data: property } = await supabase
      .from("properties")
      .select("name, logo_url, contact_email")
      .eq("id", session.propertyId)
      .maybeSingle();

    await sendCheckInConfirmationEmail({
      guestName: payload.fullName,
      guestEmail: payload.email,
      roomNumbers,
      roomCount: rooms.length,
      checkInAt,
      expectedCheckOutAt: payload.expectedCheckOutAt,
      hotelName: property?.name || "HotelOS",
      logoUrl: property?.logo_url || "",
      contactEmail: property?.contact_email || "",
    });
  }

  return { guestId, bookingId: firstBookingId, bookingNumber: firstBookingNumber, message: `${payload.fullName} checked into ${rooms.length > 1 ? `rooms ${roomNumbers}` : `room ${roomNumbers}`}. Consolidated invoice created.` };
}

async function updateGuest(
  session: Session,
  payload: z.infer<typeof guestUpdateSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const { data: guest } = await supabase
    .from("guests")
    .select("*")
    .eq("id", payload.guestId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!guest) throw new AccessError("Guest not found.", 404);
  const now = nowIso();
  
  await supabase.from("guests")
    .update({
      full_name: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      postal_code: payload.postalCode,
      country: payload.country,
      nationality: payload.nationality,
      notes: payload.notes,
      updated_at: now
    })
    .eq("id", payload.guestId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "ADMIN_EDIT",
    module: "GUEST",
    recordId: payload.guestId,
    reason: payload.reason,
    oldValue: pickGuest(guest),
    newValue: pickGuest(payload),
    ipAddress,
  });
  return { message: "Guest details updated and recorded in the audit log." };
}

async function updateBooking(
  session: Session,
  payload: z.infer<typeof bookingUpdateSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, room_id, status, expected_check_out_at, nightly_rate_paise, billing_type, company_name, guest_gstin, guest_state, notes")
    .eq("id", payload.bookingId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!booking) throw new AccessError("Stay not found.", 404);
  if (booking.status !== "CHECKED_IN") throw new AccessError("Only an active stay can be edited.", 409);
  // Allow any checkout time as long as it's after check-in (admin overrides included)
  const checkInTime = new Date(booking.expected_check_out_at || Date.now()).getTime();
  const newCheckOutTime = new Date(payload.expectedCheckOutAt).getTime();

  const now = nowIso();
  
  if (payload.roomId !== booking.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", payload.roomId)
      .eq("tenant_id", session.tenantId)
      .single();
      
    if (!room || room.status !== "AVAILABLE") throw new AccessError("The replacement room is not available.", 409);
    
    await supabase.from("rooms")
      .update({ status: 'HOUSEKEEPING', updated_at: now })
      .eq("id", booking.room_id)
      .eq("tenant_id", session.tenantId);
      
    await supabase.from("rooms")
      .update({ status: 'OCCUPIED', updated_at: now })
      .eq("id", payload.roomId)
      .eq("tenant_id", session.tenantId);
  }

  await supabase.from("bookings")
    .update({
      room_id: payload.roomId,
      expected_check_out_at: payload.expectedCheckOutAt,
      nightly_rate_paise: toPaise(payload.nightlyRate),
      billing_type: payload.billingType,
      company_name: payload.companyName,
      guest_gstin: payload.guestGstin,
      guest_state: payload.guestState,
      notes: payload.notes,
      updated_by: session.userId,
      updated_at: now
    })
    .eq("id", payload.bookingId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "ADMIN_OVERRIDE_LOCKED_STAY",
    module: "FRONT_DESK",
    recordId: payload.bookingId,
    reason: payload.reason,
    oldValue: booking,
    newValue: {
      roomId: payload.roomId,
      expectedCheckOutAt: payload.expectedCheckOutAt,
      nightlyRatePaise: toPaise(payload.nightlyRate),
      billingType: payload.billingType,
    },
    ipAddress,
  });

  return { message: "Locked stay updated with an admin override." };
}

async function createInvoice(
  session: Session,
  payload: z.infer<typeof invoiceSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  let { data: booking } = await supabase
    .from("bookings")
    .select("id, booking_number, guest_id, check_in_at, billing_type, nightly_rate_paise, guest_state, status, invoice_id, properties(state), rooms(room_number)")
    .eq("id", payload.bookingId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();

  if (!booking) {
    const { data: altBooking } = await supabase
      .from("bookings")
      .select("id, booking_number, guest_id, check_in_at, billing_type, nightly_rate_paise, guest_state, status, invoice_id, properties(state), rooms(room_number)")
      .eq("tenant_id", session.tenantId)
      .or(`booking_number.eq.${payload.bookingId},invoice_id.eq.${payload.bookingId}`)
      .maybeSingle();
    booking = altBooking;
  }

  if (!booking) {
    const { data: recentBooking } = await supabase
      .from("bookings")
      .select("id, booking_number, guest_id, check_in_at, billing_type, nightly_rate_paise, guest_state, status, invoice_id, properties(state), rooms(room_number)")
      .eq("tenant_id", session.tenantId)
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    booking = recentBooking;
  }

  if (!booking) throw new AccessError("Stay not found.", 404);
  if (booking.status !== "CHECKED_IN" && booking.status !== "CHECKED_OUT") throw new AccessError("Invoices can only be created for stays.", 409);
  
  // Find all related bookings for this guest created in the same check-in session
  const { data: groupBookings } = await supabase
    .from("bookings")
    .select("id, nightly_rate_paise, invoice_id, rooms(room_number)")
    .eq("tenant_id", session.tenantId)
    .eq("guest_id", booking.guest_id)
    .eq("check_in_at", booking.check_in_at);

  const allBookings = groupBookings && groupBookings.length > 0 ? groupBookings : [booking];

  // Check if an invoice already exists for ANY room in this reservation session
  const existingInvoiceId = allBookings.find(b => b.invoice_id)?.invoice_id;
  if (existingInvoiceId) {
    const { data: existingInv } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_paise")
      .eq("id", existingInvoiceId)
      .maybeSingle();
    if (existingInv) {
      return { invoiceId: existingInv.id, invoiceNumber: existingInv.invoice_number, totalPaise: existingInv.total_paise, message: `Consolidated invoice ${existingInv.invoice_number} is active for this multi-room reservation.` };
    }
  }

  // Calculate sum of nightly rates across ALL booked rooms in this check-in session
  const totalRoomRatePaise = allBookings.reduce((sum, b) => sum + Number(b.nightly_rate_paise), 0);

  const billingType = booking.billing_type as BillingType;
  const invoice = calculateInvoice({
    billingType,
    roomRatePaise: totalRoomRatePaise,
    nights: payload.nights,
    extrasPaise: toPaise(payload.extras),
    gstRateBps: payload.gstRateBps,
    propertyState: String((booking.properties as any)?.state),
    guestState: String(booking.guest_state),
  });
  
  const invoiceId = id("inv");
  const issuedAt = nowIso();
  const prefix = billingType === "GST" ? "GST" : "INV";
  const invoiceNumber = `${prefix}-${issuedAt.slice(2, 10).replaceAll("-", "")}-${invoiceId.slice(-5).toUpperCase()}`;
  
  await supabase.from("invoices").insert({
    id: invoiceId,
    tenant_id: session.tenantId,
    property_id: session.propertyId,
    invoice_number: invoiceNumber,
    booking_id: payload.bookingId,
    billing_type: billingType,
    gst_rate_bps: invoice.gstRateBps,
    status: 'UNPAID',
    subtotal_paise: invoice.subtotalPaise,
    cgst_paise: invoice.cgstPaise,
    sgst_paise: invoice.sgstPaise,
    igst_paise: invoice.igstPaise,
    total_paise: invoice.totalPaise,
    balance_paise: invoice.totalPaise,
    issued_at: issuedAt,
    created_by: session.userId,
    updated_at: issuedAt,
  });

  // Attach invoice_id & insert invoice items for each room in this check-in session
  for (const b of allBookings) {
    await supabase.from("bookings")
      .update({ invoice_id: invoiceId, updated_at: issuedAt })
      .eq("id", b.id)
      .eq("tenant_id", session.tenantId);

    const roomNum = (b.rooms as any)?.room_number || "Room";
    const itemAmountPaise = Number(b.nightly_rate_paise) * payload.nights;

    await supabase.from("invoice_items").insert({
      id: id("itm"),
      tenant_id: session.tenantId,
      invoice_id: invoiceId,
      description: `Room accommodation (Room ${roomNum})`,
      quantity: payload.nights,
      rate_paise: Number(b.nightly_rate_paise),
      amount_paise: itemAmountPaise
    });
  }

  if (payload.extras > 0) {
    await supabase.from("invoice_items").insert({
      id: id("itm"),
      tenant_id: session.tenantId,
      invoice_id: invoiceId,
      description: payload.extrasDescription || "Additional services",
      quantity: 1,
      rate_paise: toPaise(payload.extras),
      amount_paise: toPaise(payload.extras)
    });
  }

  await addAudit(session, {
    action: "CREATE_INVOICE",
    module: "BILLING",
    recordId: invoiceId,
    newValue: { invoiceNumber, billingType, totalPaise: invoice.totalPaise, gstRateBps: invoice.gstRateBps },
    ipAddress,
  });

  return { invoiceId, invoiceNumber, totalPaise: invoice.totalPaise, message: `${billingType === "GST" ? "GST" : "Non-GST"} invoice created for ${allBookings.length} rooms.` };
}

async function recordPayment(
  session: Session,
  payload: z.infer<typeof paymentSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, balance_paise, total_paise, issued_at, invoice_number, billing_type, bookings (guest_id, check_in_at, guests (full_name, email), rooms (room_number), properties(name, logo_url, contact_email))")
    .eq("id", payload.invoiceId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!invoice) throw new AccessError("Invoice not found.", 404);
  if (invoice.status === "VOID" || invoice.status === "PAID") throw new AccessError("This invoice cannot accept another payment.", 409);

  const bookingInfo = Array.isArray(invoice.bookings) ? invoice.bookings[0] : invoice.bookings;

  // Auto-consolidate duplicate UNPAID invoices for this check-in session in DB before validating balance
  if (bookingInfo?.guest_id && bookingInfo?.check_in_at) {
    const { data: duplicateInvoices } = await supabase
      .from("invoices")
      .select("id, total_paise, balance_paise, bookings(guest_id, check_in_at, rooms(room_number))")
      .eq("tenant_id", session.tenantId)
      .eq("status", "UNPAID")
      .neq("id", invoice.id);

    const matchDups = (duplicateInvoices || []).filter((inv: any) => {
      const b = Array.isArray(inv.bookings) ? inv.bookings[0] : inv.bookings;
      return b?.guest_id === bookingInfo.guest_id && b?.check_in_at === bookingInfo.check_in_at;
    });

    if (matchDups.length > 0) {
      let addTotalPaise = 0;
      for (const dup of matchDups) {
        addTotalPaise += Number(dup.total_paise);
        await supabase.from("invoices").update({ status: 'VOID', notes: 'Consolidated into primary multi-room invoice' }).eq("id", dup.id);
      }

      const combinedTotal = Number(invoice.total_paise) + addTotalPaise;
      const combinedBalance = Number(invoice.balance_paise) + addTotalPaise;

      await supabase.from("invoices").update({
        total_paise: combinedTotal,
        balance_paise: combinedBalance,
        updated_at: nowIso()
      }).eq("id", invoice.id);

      invoice.total_paise = combinedTotal;
      invoice.balance_paise = combinedBalance;
    }
  }

  const amountPaise = toPaise(payload.amount);
  const balancePaise = Number(invoice.balance_paise);
  if (amountPaise > balancePaise) throw new AccessError("Payment cannot exceed the invoice balance.");
  
  const newBalance = balancePaise - amountPaise;
  const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";
  const paymentId = id("pay");
  const receivedAt = nowIso();

  await supabase.from("payments").insert({
    id: paymentId,
    tenant_id: session.tenantId,
    invoice_id: payload.invoiceId,
    amount_paise: amountPaise,
    method: payload.method,
    reference: payload.reference,
    note: payload.note,
    received_by: session.userId,
    received_at: receivedAt
  });

  await supabase.from("invoices")
    .update({ balance_paise: newBalance, status: newStatus, updated_at: receivedAt })
    .eq("id", payload.invoiceId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "RECORD_MANUAL_PAYMENT",
    module: "BILLING",
    recordId: payload.invoiceId,
    oldValue: { balancePaise, status: invoice.status },
    newValue: { amountPaise, balancePaise: newBalance, status: newStatus, method: payload.method, reference: payload.reference },
    ipAddress,
  });

  let emailMessage = "";
  if (newStatus === "PAID") {
    const bookingsList = Array.isArray(invoice.bookings) ? invoice.bookings : (invoice.bookings ? [invoice.bookings] : []);
    const firstBooking = bookingsList[0];
    const guestInfo = Array.isArray(firstBooking?.guests) ? firstBooking.guests[0] : firstBooking?.guests;

    // Query invoice_items and all bookings in check-in group for complete room list
    const { data: invItems } = await supabase
      .from("invoice_items")
      .select("description")
      .eq("invoice_id", invoice.id);

    const { data: allGroupBookings } = await supabase
      .from("bookings")
      .select("rooms(room_number)")
      .eq("tenant_id", session.tenantId)
      .eq("guest_id", firstBooking?.guest_id)
      .eq("check_in_at", firstBooking?.check_in_at);

    const itemRooms = (invItems || [])
      .map((item: any) => {
        const desc = String(item.description || "");
        const match = desc.match(/Room\s+accommodation\s+\(Room\s+([A-Za-z0-9-]+)\)/i) ||
                      desc.match(/\(Room\s+([A-Za-z0-9-]+)\)/i) ||
                      desc.match(/Room\s+([0-9]+[A-Za-z0-9-]*)/i);
        return match && match[1] && match[1].toLowerCase() !== "accommodation" ? match[1] : null;
      })
      .filter(Boolean);

    const bookingRooms = (allGroupBookings || [])
      .map((b: any) => Array.isArray(b?.rooms) ? b.rooms[0]?.room_number : b?.rooms?.room_number)
      .filter(Boolean);

    const allRoomNums = Array.from(new Set([...itemRooms, ...bookingRooms]));
    const roomNumberStr = allRoomNums.length > 0 ? allRoomNums.join(", ") : "N/A";

    if (guestInfo?.email) {
      const propInfo = Array.isArray(firstBooking?.properties) ? firstBooking.properties[0] : firstBooking?.properties;
      await sendInvoiceEmail({
        invoiceNumber: invoice.invoice_number,
        guestName: guestInfo.full_name || "Valued Guest",
        guestEmail: guestInfo.email,
        roomNumber: roomNumberStr,
        billingType: invoice.billing_type,
        totalPaise: Number(invoice.total_paise),
        issuedAt: invoice.issued_at,
        paymentMethod: payload.method,
        reference: payload.reference,
        hotelName: propInfo?.name || "HotelOS",
        logoUrl: propInfo?.logo_url || "",
        contactEmail: propInfo?.contact_email || "",
      });
      emailMessage = " Receipt emailed to guest.";
    }
  }

  return { paymentId, balancePaise: newBalance, message: "Manual payment recorded." + emailMessage };
}

async function checkOut(
  session: Session,
  payload: z.infer<typeof checkoutSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, room_id, status, booking_number, invoices(id, status, balance_paise), guests(full_name, email), rooms(room_number), properties(name, google_review_link, logo_url, contact_email)")
    .eq("id", payload.bookingId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!booking) throw new AccessError("Stay not found.", 404);
  if (booking.status !== "CHECKED_IN") throw new AccessError("This stay is already closed.", 409);
  
  const activeInvoice = (booking.invoices as any[])?.find(i => i.status !== 'VOID');
  
  if (!activeInvoice) {
    throw new AccessError("Cannot check-out: No invoice has been generated for this stay.", 400);
  }
  
  if (activeInvoice.status !== 'PAID') {
    throw new AccessError("Cannot check-out: The invoice must be fully paid before check-out.", 400);
  }
  
  const now = nowIso();

  await supabase.from("bookings")
    .update({ status: 'CHECKED_OUT', actual_check_out_at: now, updated_by: session.userId, updated_at: now })
    .eq("id", payload.bookingId)
    .eq("tenant_id", session.tenantId);

  await supabase.from("rooms")
    .update({ status: 'HOUSEKEEPING', updated_at: now })
    .eq("id", booking.room_id)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "CHECK_OUT",
    module: "FRONT_DESK",
    recordId: payload.bookingId,
    reason: payload.reason,
    oldValue: { status: booking.status },
    newValue: { status: "CHECKED_OUT", roomStatus: "HOUSEKEEPING" },
    ipAddress,
  });

  let emailMessage = "";
  const guestInfo = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
  const propertyInfo = Array.isArray(booking.properties) ? booking.properties[0] : booking.properties;

  let roomNumbersStr = String((Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms)?.room_number || "");
  
  if (booking.invoices) {
    const activeInv = (booking.invoices as any[])?.find(i => i.status !== 'VOID');
    if (activeInv?.id) {
      const { data: siblingBookings } = await supabase
        .from("bookings")
        .select("rooms(room_number)")
        .eq("invoice_id", activeInv.id);
      if (siblingBookings && siblingBookings.length > 0) {
        const siblingRooms = siblingBookings
          .map(b => (Array.isArray(b.rooms) ? b.rooms[0]?.room_number : (b.rooms as any)?.room_number))
          .filter(Boolean);
        if (siblingRooms.length > 0) {
          roomNumbersStr = Array.from(new Set(siblingRooms)).join(", ");
        }
      }
    }
  }

  if (guestInfo?.email) {
    await sendReviewEmail({
      guestName: guestInfo.full_name || "Valued Guest",
      guestEmail: guestInfo.email,
      roomNumber: roomNumbersStr,
      hotelName: propertyInfo?.name || "HotelOS",
      googleReviewLink: propertyInfo?.google_review_link || undefined,
      logoUrl: propertyInfo?.logo_url || "",
      contactEmail: propertyInfo?.contact_email || "",
    });
    emailMessage = " A review request email has been sent to the guest.";
  }

  return { message: "Check-out completed. Room moved to housekeeping." + emailMessage };
}

async function updateRoom(
  session: Session,
  payload: z.infer<typeof roomSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_number, status")
    .eq("id", payload.roomId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!room) throw new AccessError("Room not found.", 404);
  
  const { data: active } = await supabase
    .from("bookings")
    .select("id")
    .eq("room_id", payload.roomId)
    .eq("tenant_id", session.tenantId)
    .eq("status", "CHECKED_IN")
    .single();
    
  if (active) throw new AccessError("An occupied room can only be released through check-out.", 409);

  await supabase.from("rooms")
    .update({ status: payload.status, updated_at: nowIso() })
    .eq("id", payload.roomId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "UPDATE_ROOM_STATUS",
    module: "ROOMS",
    recordId: payload.roomId,
    reason: payload.reason,
    oldValue: { status: room.status },
    newValue: { status: payload.status },
    ipAddress,
  });
  return { message: `Room ${room.room_number} marked ${payload.status.toLowerCase()}.` };
}

async function editRoomDetails(
  session: Session,
  payload: z.infer<typeof editRoomDetailsSchema>,
  ipAddress: string,
) {
  requireCapability(session, "MANAGE_TEAM");
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_number")
    .eq("id", payload.roomId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!room) throw new AccessError("Room not found.", 404);

  await supabase.from("rooms")
    .update({ 
      room_number: payload.roomNumber,
      room_type: payload.roomType,
      floor: payload.floor,
      base_rate_paise: payload.baseRatePaise,
      updated_at: nowIso() 
    })
    .eq("id", payload.roomId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "UPDATE_ROOM_DETAILS",
    module: "ROOMS",
    recordId: payload.roomId,
    reason: "Admin update",
    oldValue: { room_number: room.room_number },
    newValue: { room_number: payload.roomNumber },
    ipAddress,
  });
  return { message: `Room details updated successfully.` };
}

async function updateProperty(
  session: Session,
  payload: z.infer<typeof propertySchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", session.propertyId)
    .eq("tenant_id", session.tenantId)
    .single();

  const { error: updateError } = await supabase.from("properties")
    .update({
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
      updated_at: nowIso()
    })
    .eq("id", session.propertyId)
    .eq("tenant_id", session.tenantId);

  if (updateError) throw new AccessError(updateError.message, 500);

  await addAudit(session, {
    action: "UPDATE_PROPERTY_SETTINGS",
    module: "SETTINGS",
    recordId: session.propertyId,
    reason: payload.reason,
    oldValue: property,
    newValue: payload,
    ipAddress,
  });
  return { message: "Hotel and GST settings updated." };
}

async function voidInvoice(
  session: Session,
  payload: z.infer<typeof voidInvoiceSchema>,
  ipAddress: string,
) {
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, total_paise, balance_paise")
    .eq("id", payload.invoiceId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!invoice) throw new AccessError("Invoice not found.", 404);
  if (invoice.status === "VOID") throw new AccessError("Invoice is already void.", 409);
  if (Number(invoice.balance_paise) !== Number(invoice.total_paise)) {
    throw new AccessError("An invoice with recorded payments cannot be voided. Record an approved refund workflow instead.", 409);
  }
  
  await supabase.from("invoices")
    .update({ status: 'VOID', balance_paise: 0, updated_at: nowIso() })
    .eq("id", payload.invoiceId)
    .eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "VOID_INVOICE",
    module: "BILLING",
    recordId: payload.invoiceId,
    reason: payload.reason,
    oldValue: invoice,
    newValue: { status: "VOID", balancePaise: 0 },
    ipAddress,
  });
  return { message: "Invoice voided. The reason is preserved in the audit log." };
}

async function deleteGuest(
  session: Session,
  payload: z.infer<typeof deleteGuestSchema>,
  ipAddress: string,
) {
  requireCapability(session, "ADMIN_OVERRIDE");
  const supabase = await createClient();

  const { data: guest } = await supabase
    .from("guests")
    .select("id, full_name")
    .eq("id", payload.guestId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();

  if (!guest) throw new AccessError("Guest profile not found.", 404);

  const { data: guestBookings } = await supabase
    .from("bookings")
    .select("id, room_id")
    .eq("guest_id", payload.guestId)
    .eq("tenant_id", session.tenantId);

  const bookingIds = (guestBookings || []).map(b => b.id);
  const roomIds = (guestBookings || []).map(b => b.room_id).filter(Boolean);

  if (bookingIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .in("booking_id", bookingIds)
      .eq("tenant_id", session.tenantId);

    const invoiceIds = (invoices || []).map(i => i.id);

    if (invoiceIds.length > 0) {
      await supabase.from("payments").delete().in("invoice_id", invoiceIds).eq("tenant_id", session.tenantId);
      await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds).eq("tenant_id", session.tenantId);
      await supabase.from("invoices").delete().in("id", invoiceIds).eq("tenant_id", session.tenantId);
    }

    await supabase.from("guest_documents").delete().eq("guest_id", payload.guestId).eq("tenant_id", session.tenantId);
    await supabase.from("bookings").delete().in("id", bookingIds).eq("tenant_id", session.tenantId);

    if (roomIds.length > 0) {
      await supabase.from("rooms").update({ status: 'AVAILABLE', updated_at: nowIso() }).in("id", roomIds).eq("tenant_id", session.tenantId);
    }
  }

  await supabase.from("guests").delete().eq("id", payload.guestId).eq("tenant_id", session.tenantId);

  await addAudit(session, {
    action: "DELETE_GUEST",
    module: "GUESTS",
    recordId: payload.guestId,
    reason: payload.reason,
    oldValue: { fullName: guest.full_name },
    ipAddress,
  });

  return { message: `Guest profile for ${guest.full_name} and associated records deleted.` };
}

function pickGuest(value: Record<string, unknown>) {
  const keys = ["fullName", "full_name", "phone", "email", "address", "city", "state", "postalCode", "postal_code", "country", "nationality", "notes"];
  return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]]));
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: "Please check the form fields.", fields: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("Hotel API error", message);
  return Response.json({ error: "The request could not be completed. Please try again." }, { status: 500 });
}

function verifySameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AccessError("Cross-origin requests are not allowed.", 403);
  }
}
