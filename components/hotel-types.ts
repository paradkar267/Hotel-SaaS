export type Identity = { email: string; displayName: string };
export type Role = "ADMIN" | "MANAGER";
export type View = "overview" | "frontdesk" | "rooms" | "guests" | "billing" | "team" | "audit" | "settings";

export type Row = Record<string, unknown>;

export type HotelData = {
  session: { userId: string; name: string; email: string; role: Role };
  property: Row;
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
  rooms: Row[];
  bookings: Row[];
  guests: Row[];
  invoices: Row[];
  users: Row[];
  auditLogs: Row[];
  latestAuditId: number;
  announcement?: string;
};

export type ModalState =
  | { type: "checkin" }
  | { type: "manager" }
  | { type: "toggle_manager"; user: Row }
  | { type: "guest"; guest: Row }
  | { type: "stay"; booking: Row }
  | { type: "invoice"; booking: Row }
  | { type: "payment"; invoice: Row }
  | { type: "checkout"; booking: Row }
  | { type: "room"; room: Row }
  | { type: "settings" }
  | { type: "void_invoice"; invoice: Row }
  | { type: "print_invoice"; invoice: Row }
  | { type: "edit_room"; room: Row }
  | null;
