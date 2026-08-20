import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGstInvoice,
  calculateNonGstBill,
  toPaise,
} from "../../lib/server/services/billing-service";
import {
  canTransitionRoom,
  validateRoomTransition,
} from "../../lib/server/services/room-service";
import { roleAllows } from "../../lib/server/permissions";

test("server billing: GST intra-state splits CGST and SGST accurately", () => {
  const result = calculateGstInvoice({
    roomRatePaise: 400_000,
    nights: 2,
    extrasPaise: 100_000,
    gstRateBps: 1200,
    propertyState: "Maharashtra",
    guestState: "Maharashtra",
  });

  assert.equal(result.roomAmountPaise, 800_000);
  assert.equal(result.subtotalPaise, 900_000);
  assert.equal(result.taxPaise, 108_000);
  assert.equal(result.cgstPaise, 54_000);
  assert.equal(result.sgstPaise, 54_000);
  assert.equal(result.igstPaise, 0);
  assert.equal(result.totalPaise, 1_008_000);
  assert.equal(result.intraState, true);
});

test("server billing: GST inter-state charges 100% IGST", () => {
  const result = calculateGstInvoice({
    roomRatePaise: 500_000,
    nights: 1,
    extrasPaise: 0,
    gstRateBps: 1800,
    propertyState: "Maharashtra",
    guestState: "Delhi",
  });

  assert.equal(result.subtotalPaise, 500_000);
  assert.equal(result.taxPaise, 90_000);
  assert.equal(result.cgstPaise, 0);
  assert.equal(result.sgstPaise, 0);
  assert.equal(result.igstPaise, 90_000);
  assert.equal(result.totalPaise, 590_000);
  assert.equal(result.intraState, false);
});

test("server billing: Non-GST bill calculates clean net charges without tax", () => {
  const result = calculateNonGstBill({
    roomRatePaise: 350_000,
    nights: 3,
    extrasPaise: 50_000,
    discountPaise: 20_000,
  });

  assert.equal(result.roomAmountPaise, 1_050_000);
  assert.equal(result.extrasPaise, 50_000);
  assert.equal(result.subtotalPaise, 1_100_000);
  assert.equal(result.discountPaise, 20_000);
  assert.equal(result.totalPaise, 1_080_000);
});

test("room state machine: enforces valid transitions", () => {
  assert.equal(canTransitionRoom("AVAILABLE", "OCCUPIED"), true);
  assert.equal(canTransitionRoom("OCCUPIED", "HOUSEKEEPING"), true);
  assert.equal(canTransitionRoom("HOUSEKEEPING", "AVAILABLE"), true);
  assert.equal(canTransitionRoom("AVAILABLE", "HOUSEKEEPING"), true);

  // Invalid transitions
  assert.equal(canTransitionRoom("OCCUPIED", "AVAILABLE"), false);
  assert.throws(() => validateRoomTransition("101", "OCCUPIED", "AVAILABLE"), /Cannot transition Room 101/);
});

test("role permissions: enforces least-privilege security", () => {
  assert.equal(roleAllows("ADMIN", "MANAGE_BILLING"), true);
  assert.equal(roleAllows("ADMIN", "EDIT_LOCKED_RECORD"), true);
  assert.equal(roleAllows("ADMIN", "MANAGE_TEAM"), true);

  assert.equal(roleAllows("MANAGER", "CREATE_CHECKIN"), true);
  assert.equal(roleAllows("MANAGER", "VIEW_OPERATIONS"), true);
  assert.equal(roleAllows("MANAGER", "MANAGE_BILLING"), false);
  assert.equal(roleAllows("MANAGER", "EDIT_LOCKED_RECORD"), false);
  assert.equal(roleAllows("MANAGER", "MANAGE_TEAM"), false);
});
