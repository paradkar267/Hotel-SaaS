// lib/server/repositories/room-repository.ts
// Room Persistence & Inventory Management

import { createClient } from "../../supabase";
import type { Session, RoomStatus } from "../types";
import { validateRoomTransition } from "../services/room-service";

export async function updateRoomStatus(
  session: Session,
  roomId: string,
  targetStatus: RoomStatus
) {
  const supabase = await createClient();

  // 1. Fetch current room
  const { data: room, error: fetchErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (fetchErr || !room) throw new Error("Room not found.");

  // 2. Validate finite state machine transition
  validateRoomTransition(room.room_number, room.status as RoomStatus, targetStatus);

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("rooms")
    .update({
      status: targetStatus,
      updated_at: now,
    })
    .eq("id", roomId);

  if (updateErr) throw new Error(`Room update failed: ${updateErr.message}`);

  return { roomId, roomNumber: room.room_number, oldStatus: room.status, newStatus: targetStatus };
}
