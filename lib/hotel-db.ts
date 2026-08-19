import { createClient } from "./supabase";
import { sendManagerActionEmail } from "./email-service";
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

  if (session.role === "MANAGER") {
    // Fetch admin email for the tenant
    const { data: adminUser } = await supabase
      .from("users")
      .select("name, email")
      .eq("tenant_id", session.tenantId)
      .eq("role", "ADMIN")
      .limit(1)
      .single();

    if (adminUser?.email) {
      await sendManagerActionEmail(adminUser.email, {
        managerName: session.name || "Manager",
        managerEmail: session.email,
        action: details.action,
        module: details.module,
        reason: details.reason ?? "System Action",
        recordId: details.recordId,
      });
    }
  }
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
      .select("*, bookings(*, guests(*), rooms(*)), invoice_items(*), payments(*)")
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

  const { data: platformTenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", "platform")
    .maybeSingle();
  const announcement = platformTenant?.name ?? "";

  let users: any[] = [];
  
  if (session.role === "ADMIN") {
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .eq("tenant_id", session.tenantId)
      .order("role", { ascending: true })
      .order("name", { ascending: true });
      
    users = (usersData || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.is_active,
      lastSeenAt: u.last_seen_at,
      createdAt: u.created_at,
    }));
  }

  const { data: auditData } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tenant_id", session.tenantId)
    .order("id", { ascending: false })
    .limit(session.role === "ADMIN" ? 100 : 20);
    
  const auditLogs = (auditData || []).map(a => ({
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

  // Auto-consolidate duplicate unpaid invoices for multi-room check-in sessions
  const rawInvoices = invoicesResult || [];
  const activeInvoicesMap = new Map<string, any>();
  const duplicateInvoiceIdsToVoid: string[] = [];

  for (const inv of rawInvoices) {
    if (inv.status === 'UNPAID') {
      const booking = inv.bookings || {};
      const guestId = booking.guest_id || "";
      const checkInAt = booking.check_in_at || "";
      const key = `${inv.tenant_id}_${guestId}_${checkInAt}`;

      if (guestId && checkInAt && activeInvoicesMap.has(key)) {
        const primary = activeInvoicesMap.get(key);
        primary.total_paise = Number(primary.total_paise) + Number(inv.total_paise);
        primary.subtotal_paise = Number(primary.subtotal_paise) + Number(inv.subtotal_paise);
        primary.cgst_paise = Number(primary.cgst_paise) + Number(inv.cgst_paise);
        primary.sgst_paise = Number(primary.sgst_paise) + Number(inv.sgst_paise);
        primary.balance_paise = primary.total_paise;

        const mainRoom = primary.bookings?.rooms?.room_number;
        const dupRoom = inv.bookings?.rooms?.room_number;
        if (!primary.extraRoomNumbers) primary.extraRoomNumbers = [];
        if (mainRoom && !primary.extraRoomNumbers.includes(mainRoom)) primary.extraRoomNumbers.push(mainRoom);
        if (dupRoom && !primary.extraRoomNumbers.includes(dupRoom)) primary.extraRoomNumbers.push(dupRoom);

        duplicateInvoiceIdsToVoid.push(inv.id);
      } else {
        activeInvoicesMap.set(key, inv);
      }
    }
  }

  // Cleanup void duplicate invoices in DB asynchronously
  if (duplicateInvoiceIdsToVoid.length > 0) {
    Promise.all(duplicateInvoiceIdsToVoid.map(dupId =>
      supabase.from("invoices").update({ status: 'VOID', notes: 'Consolidated into primary multi-room invoice' }).eq("id", dupId)
    )).catch(err => console.error("Error voiding duplicate invoices:", err));
  }

  const filteredInvoices = rawInvoices.filter(i => !duplicateInvoiceIdsToVoid.includes(i.id));

  const mappedInvoices = filteredInvoices.map(i => {
    const booking = i.bookings || {};
    const guest = booking.guests || {};
    const room = booking.rooms || {};
    const payments = (i.payments || []).map((p: any) => ({
      id: p.id,
      amountPaise: p.amount_paise,
      method: p.method,
      reference: p.reference,
      receivedAt: p.received_at,
    }));
    const paidPaise = payments.reduce((sum: number, p: any) => sum + (p.amountPaise || 0), 0);

    // Extract actual numeric or alphanumeric room numbers (ignoring generic words like 'accommodation')
    const items = i.invoice_items || [];
    const itemRoomNumbers = items
      .map((item: any) => {
        const desc = String(item.description || "");
        const match = desc.match(/Room\s+accommodation\s+\(Room\s+([A-Za-z0-9-]+)\)/i) ||
                      desc.match(/\(Room\s+([A-Za-z0-9-]+)\)/i) ||
                      desc.match(/Room\s+([0-9]+[A-Za-z0-9-]*)/i);
        if (match && match[1] && match[1].toLowerCase() !== "accommodation") {
          return match[1];
        }
        return null;
      })
      .filter(Boolean);

    const mainRoomNumber = room.room_number ? String(room.room_number) : null;
    const extraRooms = (i.extraRoomNumbers || []).map(String);
    const validMainRoom = (mainRoomNumber && mainRoomNumber.toLowerCase() !== "accommodation") ? [mainRoomNumber] : [];

    const allRoomNumbers = Array.from(new Set([...itemRoomNumbers, ...extraRooms, ...validMainRoom]))
      .filter(r => r && r.toLowerCase() !== "accommodation" && r.toLowerCase() !== "null" && r.toLowerCase() !== "undefined");

    const roomDisplay = allRoomNumbers.length > 1
      ? `${allRoomNumbers.join(", ")} (${allRoomNumbers.length} Rooms)`
      : (allRoomNumbers[0] ? `${allRoomNumbers[0]}` : (mainRoomNumber ? `${mainRoomNumber}` : "—"));

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
      guestName: guest.full_name || "Guest",
      guestEmail: guest.email || "",
      roomNumber: roomDisplay,
      payments,
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
      postal_code: property?.postal_code,
      gstin: property?.gstin,
      currency: property?.currency || "INR",
      defaultGstBps: property?.default_gst_bps ?? 1200,
      default_gst_bps: property?.default_gst_bps ?? 1200,
      contactPhone: property?.contact_phone || "",
      contact_phone: property?.contact_phone || "",
      contactEmail: property?.contact_email || "",
      contact_email: property?.contact_email || "",
      upiId: property?.upi_id || "hotelos@upi",
      upi_id: property?.upi_id || "hotelos@upi",
      upiName: property?.upi_name || property?.name || "HotelOS",
      upi_name: property?.upi_name || property?.name || "HotelOS",
      checkInTime: property?.check_in_time || "14:00",
      check_in_time: property?.check_in_time || "14:00",
      checkOutTime: property?.check_out_time || "11:00",
      check_out_time: property?.check_out_time || "11:00",
      logoUrl: property?.logo_url || "",
      logo_url: property?.logo_url || "",
      googleReviewLink: property?.google_review_link || "",
      google_review_link: property?.google_review_link || "",
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
    announcement,
  };
}
