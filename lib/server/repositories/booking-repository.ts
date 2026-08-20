// lib/server/repositories/booking-repository.ts
// Persistence & Atomic Mutations for Guests and Bookings

import { createClient } from "../../supabase";
import type { Session, BillingType, IdType } from "../types";

export function generateGuestId(): string {
  return `gst_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function generateBookingId(): string {
  return `bkg_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export async function getNextBookingNumber(session: Session): Promise<string> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const nextYearShort = String(currentYear + 1).slice(2);
  const fyPrefix = `${currentYear}${nextYearShort}`;

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", session.tenantId)
    .eq("property_id", session.propertyId);

  const nextSeq = (count || 0) + 1;
  return `BKG-${fyPrefix}-${String(nextSeq).padStart(4, "0")}`;
}

export async function createAtomicCheckIn(
  session: Session,
  input: {
    roomId: string;
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    nationality?: string;
    idType: IdType;
    idLast4: string;
    adults: number;
    children: number;
    expectedCheckOutAt: string;
    nightlyRatePaise: number;
    billingType: BillingType;
    companyName?: string;
    guestGstin?: string;
    guestState?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // 1. Verify Room is currently AVAILABLE
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", input.roomId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (roomErr || !room) throw new Error("Selected room not found.");
  if (room.status !== "AVAILABLE") {
    throw new Error(`Room ${room.room_number} is currently ${room.status} and cannot be assigned.`);
  }

  // 2. Insert Guest Profile
  const guestId = generateGuestId();
  const { error: guestErr } = await supabase.from("guests").insert({
    id: guestId,
    tenant_id: session.tenantId,
    property_id: session.propertyId,
    full_name: input.fullName,
    email: input.email || "",
    phone: input.phone,
    address: input.address || "",
    city: input.city || "",
    state: input.state || "",
    country: input.country || "India",
    postal_code: input.postalCode || "",
    nationality: input.nationality || "Indian",
    id_type: input.idType,
    id_last4: input.idLast4,
    notes: input.notes || "",
    created_by: session.userId,
    created_at: now,
    updated_at: now,
  });

  if (guestErr) throw new Error(`Guest registration failed: ${guestErr.message}`);

  // 3. Insert Locked Booking Stay
  const bookingId = generateBookingId();
  const bookingNumber = await getNextBookingNumber(session);

  const { data: booking, error: bkgErr } = await supabase
    .from("bookings")
    .insert({
      id: bookingId,
      tenant_id: session.tenantId,
      property_id: session.propertyId,
      booking_number: bookingNumber,
      guest_id: guestId,
      room_id: input.roomId,
      check_in_at: now,
      expected_check_out_at: input.expectedCheckOutAt,
      adults: input.adults,
      children: input.children,
      source: "WALK_IN",
      status: "CHECKED_IN",
      billing_type: input.billingType,
      company_name: input.companyName || "",
      guest_gstin: input.guestGstin || "",
      guest_state: input.guestState || "",
      nightly_rate_paise: input.nightlyRatePaise,
      notes: input.notes || "",
      locked_at: now,
      created_by: session.userId,
      updated_by: session.userId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (bkgErr) throw new Error(`Booking creation failed: ${bkgErr.message}`);

  // 4. Update Room status to OCCUPIED
  const { error: updateRoomErr } = await supabase
    .from("rooms")
    .update({
      status: "OCCUPIED",
      updated_at: now,
    })
    .eq("id", input.roomId);

  if (updateRoomErr) throw new Error(`Room occupancy update failed: ${updateRoomErr.message}`);

  return { guestId, bookingId, bookingNumber, booking, roomNumber: room.room_number };
}

export async function checkOutBooking(
  session: Session,
  bookingId: string
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // 1. Fetch current booking
  const { data: booking, error: bkgErr } = await supabase
    .from("bookings")
    .select("*, rooms(*)")
    .eq("id", bookingId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (bkgErr || !booking) throw new Error("Booking not found.");
  if (booking.status !== "CHECKED_IN") throw new Error("This stay is already checked out.");

  // 2. Mark booking as CHECKED_OUT
  const { error: updateBkgErr } = await supabase
    .from("bookings")
    .update({
      status: "CHECKED_OUT",
      actual_check_out_at: now,
      updated_by: session.userId,
      updated_at: now,
    })
    .eq("id", bookingId);

  if (updateBkgErr) throw new Error(`Checkout failed: ${updateBkgErr.message}`);

  // 3. Move room to HOUSEKEEPING
  if (booking.room_id) {
    await supabase
      .from("rooms")
      .update({
        status: "HOUSEKEEPING",
        updated_at: now,
      })
      .eq("id", booking.room_id);
  }

  return { bookingId, status: "CHECKED_OUT" };
}
