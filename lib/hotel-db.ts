import { createClient } from "./supabase";
import type { HotelData, Session } from "./types";
import { AccessError } from "./auth";

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeJson(value: unknown) {
  return JSON.stringify(value, (key, item) => {
    const lowered = key.toLowerCase();
    if (lowered.includes("password") || lowered.includes("token") || lowered.includes("secret")) {
      return "[REDACTED]";
    }
    return item;
  });
}

export function requestIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

export async function addAudit(
  session: Session,
  details: {
    action: string;
    module: string;
    recordId: string;
    reason?: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
  },
) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    tenant_id: session.tenantId,
    user_id: session.userId,
    actor_email: session.email,
    actor_role: session.role,
    action: details.action,
    module: details.module,
    record_id: details.recordId,
    reason: details.reason ?? "",
    old_value: safeJson(details.oldValue ?? {}),
    new_value: safeJson(details.newValue ?? {}),
    ip_address: details.ipAddress ?? "",
    created_at: nowIso(),
  });
}

export async function getHotelData(session: Session): Promise<HotelData> {
  const supabase = await createClient();
  const today = nowIso().slice(0, 10);

  const [
    { data: property },
    { data: roomsResult },
    { data: bookingsResult },
    { data: guestsResult },
    { data: invoicesResult },
    { data: paymentsResult },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("id", session.propertyId)
      .eq("tenant_id", session.tenantId)
      .single(),
    supabase
      .from("rooms")
      .select("*")
      .eq("tenant_id", session.tenantId)
      .eq("property_id", session.propertyId)
      .order("room_number", { ascending: true }),
    supabase
      .from("bookings")
      .select("*, guests(*), rooms(*), invoices(*)")
      .eq("tenant_id", session.tenantId)
      .eq("property_id", session.propertyId)
      .order("check_in_at", { ascending: false })
      .limit(100),
    supabase
      .from("guests")
      .select("*, bookings(count), guest_documents(count)")
      .eq("tenant_id", session.tenantId)
      .eq("property_id", session.propertyId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("invoices")
      .select("*, bookings(*, guests(*), rooms(*)), payments(amount_paise)")
      .eq("tenant_id", session.tenantId)
      .eq("property_id", session.propertyId)
      .order("issued_at", { ascending: false })
      .limit(100),
    supabase
      .from("payments")
      .select("amount_paise")
      .eq("tenant_id", session.tenantId)
      .gte("received_at", today)
  ]);

  let users: any[] = [];
  let auditLogs: any[] = [];
  
  if (session.role === "ADMIN") {
    const [
      { data: usersData },
      { data: auditData }
    ] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .eq("tenant_id", session.tenantId)
        .order("role", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", session.tenantId)
        .order("id", { ascending: false })
        .limit(100)
    ]);
    
    users = (usersData || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.is_active,
      lastSeenAt: u.last_seen_at,
      createdAt: u.created_at,
    }));
    
    auditLogs = (auditData || []).map(a => ({
      id: a.id,
      actorEmail: a.actor_email,
      actorRole: a.actor_role,
      action: a.action,
      module: a.module,
      recordId: a.record_id,
      reason: a.reason,
      oldValue: a.old_value,
      newValue: a.new_value,
      createdAt: a.created_at,
    }));
  }

  const mappedRooms = (roomsResult || []).map(r => ({
    id: r.id,
    roomNumber: r.room_number,
    floor: r.floor,
    roomType: r.room_type,
    baseRatePaise: r.base_rate_paise,
    status: r.status,
    updatedAt: r.updated_at,
  }));

  const mappedBookings = (bookingsResult || []).map(b => {
    const guest = b.guests || {};
    const room = b.rooms || {};
    const activeInvoice = (b.invoices || []).find((i: any) => i.status !== 'VOID');
    
    return {
      id: b.id,
      bookingNumber: b.booking_number,
      guestId: b.guest_id,
      roomId: b.room_id,
      checkInAt: b.check_in_at,
      expectedCheckOutAt: b.expected_check_out_at,
      actualCheckOutAt: b.actual_check_out_at,
      adults: b.adults,
      children: b.children,
      source: b.source,
      status: b.status,
      billingType: b.billing_type,
      companyName: b.company_name,
      guestGstin: b.guest_gstin,
      guestState: b.guest_state,
      nightlyRatePaise: b.nightly_rate_paise,
      notes: b.notes,
      lockedAt: b.locked_at,
      createdAt: b.created_at,
      guestName: guest.full_name,
      phone: guest.phone,
      email: guest.email,
      idType: guest.id_type,
      idLast4: guest.id_last4,
      state: guest.state,
      roomNumber: room.room_number,
      roomType: room.room_type,
      documentCount: 0,
      invoiceId: activeInvoice?.id,
      invoiceStatus: activeInvoice?.status
    };
  }).sort((a, b) => {
    if (a.status === 'CHECKED_IN' && b.status !== 'CHECKED_IN') return -1;
    if (a.status !== 'CHECKED_IN' && b.status === 'CHECKED_IN') return 1;
    return 0;
  });

  const mappedGuests = (guestsResult || []).map(g => {
    return {
      id: g.id,
      fullName: g.full_name,
      email: g.email,
      phone: g.phone,
      address: g.address,
      city: g.city,
      state: g.state,
      country: g.country,
      postalCode: g.postal_code,
      nationality: g.nationality,
      idType: g.id_type,
      idLast4: g.id_last4,
      notes: g.notes,
      createdAt: g.created_at,
      totalStays: Array.isArray(g.bookings) ? g.bookings[0]?.count : 0,
      totalSpendPaise: 0, 
      documentCount: Array.isArray(g.guest_documents) ? g.guest_documents[0]?.count : 0,
      latestDocumentId: null
    };
  });

  const mappedInvoices = (invoicesResult || []).map(i => {
    const booking = i.bookings || {};
    const guest = booking.guests || {};
    const room = booking.rooms || {};
    const paidPaise = (i.payments || []).reduce((sum: number, p: any) => sum + (p.amount_paise || 0), 0);

    return {
      id: i.id,
      invoiceNumber: i.invoice_number,
      bookingId: i.booking_id,
      billingType: i.billing_type,
      gstRateBps: i.gst_rate_bps,
      status: i.status,
      subtotalPaise: i.subtotal_paise,
      cgstPaise: i.cgst_paise,
      sgstPaise: i.sgst_paise,
      igstPaise: i.igst_paise,
      totalPaise: i.total_paise,
      balancePaise: i.balance_paise,
      issuedAt: i.issued_at,
      guestName: guest.full_name,
      roomNumber: room.room_number,
      paidPaise
    };
  });

  const occupiedRooms = mappedRooms.filter((room) => room.status === "OCCUPIED").length;
  const todayRevenuePaise = (paymentsResult || []).reduce((sum, p) => sum + p.amount_paise, 0);
  const outstandingPaise = mappedInvoices.reduce(
    (total, invoice) => total + (invoice.status === "VOID" ? 0 : Number(invoice.balancePaise)),
    0,
  );

  return {
    session,
    property: {
      id: property?.id,
      name: property?.name,
      address: property?.address,
      city: property?.city,
      state: property?.state,
      postalCode: property?.postal_code,
      gstin: property?.gstin,
      currency: property?.currency,
      defaultGstBps: property?.default_gst_bps,
    } as any,
    metrics: {
      totalRooms: mappedRooms.length,
      occupiedRooms,
      availableRooms: mappedRooms.filter((room) => room.status === "AVAILABLE").length,
      occupancyRate: mappedRooms.length ? Math.round((occupiedRooms / mappedRooms.length) * 100) : 0,
      todayRevenuePaise,
      outstandingPaise,
      activeStays: mappedBookings.filter((booking) => booking.status === "CHECKED_IN").length,
      todayCheckIns: mappedBookings.filter((booking) => String(booking.checkInAt).slice(0, 10) === today).length,
    },
    rooms: mappedRooms,
    bookings: mappedBookings,
    guests: mappedGuests,
    invoices: mappedInvoices,
    users,
    auditLogs,
    latestAuditId: auditLogs.length > 0 ? auditLogs[0].id : 0,
  };
}
