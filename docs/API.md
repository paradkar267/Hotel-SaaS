# API contracts

All routes require platform-authenticated identity. Unknown or disabled emails receive 403. Every response containing hotel data is private and non-cacheable.

## `GET /api/hotel`

Returns the role-filtered workspace snapshot.

```json
{
  "session": { "userId": "usr_…", "role": "ADMIN", "email": "owner@example.com" },
  "property": { "id": "property_main", "name": "The Meridian House", "state": "Maharashtra" },
  "metrics": { "totalRooms": 12, "occupiedRooms": 3, "occupancyRate": 25 },
  "rooms": [],
  "bookings": [],
  "guests": [],
  "invoices": [],
  "users": [],
  "auditLogs": [],
  "latestAuditId": 42
}
```

Managers receive rooms and stays but not guest-registry exports, invoices, users, or audit logs.

## `POST /api/hotel`

JSON body with an `action` discriminator. The same route centralizes authentication, CSRF-origin checks, validation, capability enforcement, and consistent errors.

| Action | Role | Required purpose |
|---|---|---|
| `create_checkin` | Admin, Manager | Create guest + locked stay and occupy room. |
| `create_manager` | Admin | Grant a verified email manager access. |
| `toggle_manager` | Admin | Enable or disable a manager with reason. |
| `update_guest` | Admin | Edit guest fields with an audit reason. |
| `update_booking` | Admin | Override an active locked stay with reason. |
| `create_invoice` | Admin | Generate GST or non-GST invoice. |
| `record_payment` | Admin | Record an offline payment; never contacts a gateway. |
| `checkout` | Admin | Close a paid stay and move room to housekeeping. |
| `update_room` | Admin | Set available, housekeeping, or maintenance. |
| `update_property` | Admin | Change hotel identity and GST defaults. |
| `void_invoice` | Admin | Void an unpaid invoice with reason. |

### Check-in sketch

```json
{
  "action": "create_checkin",
  "roomId": "room_101",
  "fullName": "Priya Sharma",
  "phone": "+919800000000",
  "idType": "AADHAAR",
  "idLast4": "1234",
  "expectedCheckOutAt": "2026-08-16T05:30:00.000Z",
  "nightlyRate": 4200,
  "billingType": "NON_GST",
  "adults": 2,
  "children": 0
}
```

### GST invoice sketch

```json
{
  "action": "create_invoice",
  "bookingId": "bkg_…",
  "nights": 2,
  "extras": 850,
  "extrasDescription": "Laundry and restaurant",
  "gstRateBps": 1200
}
```

### Manual payment sketch

```json
{
  "action": "record_payment",
  "invoiceId": "inv_…",
  "amount": 5600,
  "method": "UPI_MANUAL",
  "reference": "UPI-REF-123",
  "note": "Verified in hotel bank app"
}
```

## `POST /api/documents`

Multipart fields:

- `guestId`: tenant-owned guest ID.
- `file`: PDF, JPEG, or PNG, maximum 5 MB.

The route checks identity, upload capability, MIME type, size, and guest tenant. It writes bytes to R2 and metadata to D1. If metadata insertion fails, the uploaded object is deleted.

## `GET /api/documents?id=doc_…`

Admin-only inline read. The document metadata must belong to the current tenant. Responses set private/no-store and `nosniff` headers.

## `GET /api/live?after=<audit-id>`

Authenticated server-sent event stream. It emits `change` when the tenant’s latest audit ID advances and closes after 25 seconds so clients reconnect cleanly. The app also polls every 20 seconds as a network fallback.

## Error shape

```json
{ "error": "This record is locked. Only an admin can make this change." }
```

Validation errors can also include a `fields` object. Expected status codes are 400, 401, 403, 404, 409, 415, and 500.
