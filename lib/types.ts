export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER";
export type RoomStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "HOUSEKEEPING"
  | "MAINTENANCE";
export type BillingType = "GST" | "NON_GST";
export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID";

export type Identity = {
  email: string;
  displayName: string;
};

export type Session = {
  userId: string;
  tenantId: string;
  propertyId: string;
  email: string;
  name: string;
  role: Role;
};

export type D1ResultSet<T> = {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
};

export type HotelData = {
  session: Session;
  property: Record<string, unknown>;
  metrics: {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number;
    todayRevenuePaise: number;
    outstandingPaise: number;
    activeStays: number;
    todayCheckIns: number;
  };
  rooms: Array<Record<string, unknown>>;
  bookings: Array<Record<string, unknown>>;
  guests: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  latestAuditId: number;
};
