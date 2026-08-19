import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase";
import { getSession } from "../../../lib/auth";
import { id, nowIso } from "../../../lib/hotel-db";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin only." }, { status: 403 });
    }

    const supabase = await createClient();
    const tenantId = session.tenantId;
    const propertyId = session.propertyId;

    // Generate Rooms
    const rooms = [
      { id: id("room"), tenant_id: tenantId, property_id: propertyId, room_number: "101", floor: "1", room_type: "Standard", base_rate_paise: 250000, status: "AVAILABLE", updated_at: nowIso() },
      { id: id("room"), tenant_id: tenantId, property_id: propertyId, room_number: "102", floor: "1", room_type: "Standard", base_rate_paise: 250000, status: "OCCUPIED", updated_at: nowIso() },
      { id: id("room"), tenant_id: tenantId, property_id: propertyId, room_number: "103", floor: "1", room_type: "Standard", base_rate_paise: 250000, status: "HOUSEKEEPING", updated_at: nowIso() },
      { id: id("room"), tenant_id: tenantId, property_id: propertyId, room_number: "201", floor: "2", room_type: "Deluxe", base_rate_paise: 400000, status: "AVAILABLE", updated_at: nowIso() },
      { id: id("room"), tenant_id: tenantId, property_id: propertyId, room_number: "202", floor: "2", room_type: "Deluxe", base_rate_paise: 400000, status: "OCCUPIED", updated_at: nowIso() },
      { id: id("room"), tenant_id: tenantId, property_id: propertyId, room_number: "301", floor: "3", room_type: "Suite", base_rate_paise: 750000, status: "MAINTENANCE", updated_at: nowIso() },
    ];

    for (const room of rooms) {
       await supabase.from("rooms").upsert(room, { onConflict: "property_id,room_number" });
    }

    const { data: dbRooms } = await supabase.from("rooms").select("*").eq("property_id", propertyId);
    
    if (!dbRooms || dbRooms.length === 0) {
        return NextResponse.json({ error: "Failed to seed rooms" }, { status: 500 });
    }

    const room102 = dbRooms.find(r => r.room_number === "102");
    const room202 = dbRooms.find(r => r.room_number === "202");

    // Generate Guests
    const guests = [
      { id: id("gst"), tenant_id: tenantId, property_id: propertyId, full_name: "Rahul Sharma", email: "rahul.s@example.com", phone: "+919876543210", city: "Mumbai", state: "Maharashtra", id_type: "AADHAAR", id_last4: "1234", created_by: session.userId },
      { id: id("gst"), tenant_id: tenantId, property_id: propertyId, full_name: "Priya Patel", email: "priya.p@example.com", phone: "+919876543211", city: "Ahmedabad", state: "Gujarat", id_type: "PAN", id_last4: "9012", created_by: session.userId },
      { id: id("gst"), tenant_id: tenantId, property_id: propertyId, full_name: "Amit Kumar", email: "amit.k@example.com", phone: "+919876543212", city: "Delhi", state: "Delhi", id_type: "DRIVING_LICENSE", id_last4: "5678", created_by: session.userId },
    ];

    for (const guest of guests) {
        await supabase.from("guests").insert(guest);
    }

    // Generate Bookings
    const bookings = [
      {
        id: id("bkg"), tenant_id: tenantId, property_id: propertyId, booking_number: `BKG-${Math.floor(Math.random()*10000)}`,
        guest_id: guests[0].id, room_id: room102?.id, check_in_at: nowIso(), expected_check_out_at: new Date(Date.now() + 86400000 * 2).toISOString(),
        status: "CHECKED_IN", billing_type: "GST", nightly_rate_paise: 250000, locked_at: nowIso(), created_by: session.userId, updated_by: session.userId
      },
      {
        id: id("bkg"), tenant_id: tenantId, property_id: propertyId, booking_number: `BKG-${Math.floor(Math.random()*10000)}`,
        guest_id: guests[1].id, room_id: room202?.id, check_in_at: nowIso(), expected_check_out_at: new Date(Date.now() + 86400000 * 3).toISOString(),
        status: "CHECKED_IN", billing_type: "NON_GST", nightly_rate_paise: 400000, locked_at: nowIso(), created_by: session.userId, updated_by: session.userId
      }
    ];

    for (const booking of bookings) {
        await supabase.from("bookings").insert(booking);
    }

    // Generate Invoices and Payments for one of them
    const invoice1 = {
        id: id("inv"), tenant_id: tenantId, property_id: propertyId, invoice_number: `INV-${Math.floor(Math.random()*10000)}`,
        booking_id: bookings[0].id, billing_type: "GST", gst_rate_bps: 1200, status: "PARTIAL",
        subtotal_paise: 500000, cgst_paise: 30000, sgst_paise: 30000, igst_paise: 0, total_paise: 560000, balance_paise: 260000,
        issued_at: nowIso(), created_by: session.userId, updated_at: nowIso()
    };
    
    await supabase.from("invoices").insert(invoice1);

    const payment1 = {
        id: id("pay"), tenant_id: tenantId, invoice_id: invoice1.id, amount_paise: 300000, method: "UPI",
        reference: "UPI123456789", received_by: session.userId, received_at: nowIso()
    };

    await supabase.from("payments").insert(payment1);

    return NextResponse.json({ success: true, message: "Sample data generated successfully" });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
