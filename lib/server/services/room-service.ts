// lib/server/services/room-service.ts
// Room Lifecycle State Machine & Transition Guards

import type { RoomStatus } from "../types";

export const ALLOWED_TRANSITIONS: Record<RoomStatus, ReadonlySet<RoomStatus>> = {
  AVAILABLE: new Set(["OCCUPIED", "MAINTENANCE", "HOUSEKEEPING"]),
  OCCUPIED: new Set(["HOUSEKEEPING", "MAINTENANCE"]),
  HOUSEKEEPING: new Set(["AVAILABLE", "MAINTENANCE"]),
  MAINTENANCE: new Set(["AVAILABLE", "HOUSEKEEPING"]),
};

export function canTransitionRoom(
  currentStatus: RoomStatus,
  targetStatus: RoomStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  return ALLOWED_TRANSITIONS[currentStatus]?.has(targetStatus) ?? false;
}

export function validateRoomTransition(
  roomNumber: string,
  currentStatus: RoomStatus,
  targetStatus: RoomStatus
): void {
  if (!canTransitionRoom(currentStatus, targetStatus)) {
    throw new Error(
      `Cannot transition Room ${roomNumber} from ${currentStatus} to ${targetStatus}.`
    );
  }
}
