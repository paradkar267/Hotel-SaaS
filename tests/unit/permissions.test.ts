import assert from "node:assert/strict";
import test from "node:test";
import { roleAllows } from "../../lib/permissions";

test("manager can create check-ins and upload proof", () => {
  assert.equal(roleAllows("MANAGER", "CREATE_CHECKIN"), true);
  assert.equal(roleAllows("MANAGER", "UPLOAD_ID_PROOF"), true);
});

test("manager cannot manage users, read audit logs, or manage billing", () => {
  assert.equal(roleAllows("MANAGER", "MANAGE_TEAM"), false);
  assert.equal(roleAllows("MANAGER", "VIEW_AUDIT"), false);
  assert.equal(roleAllows("MANAGER", "MANAGE_BILLING"), false);
});

test("manager can edit and manage rooms", () => {
  assert.equal(roleAllows("MANAGER", "EDIT_LOCKED_RECORD"), true);
  assert.equal(roleAllows("MANAGER", "MANAGE_ROOMS"), true);
});

test("admin has every privileged capability", () => {
  for (const capability of [
    "EDIT_LOCKED_RECORD",
    "MANAGE_BILLING",
    "MANAGE_ROOMS",
    "MANAGE_TEAM",
    "VIEW_AUDIT",
    "CONFIGURE_HOTEL",
  ] as const) {
    assert.equal(roleAllows("ADMIN", capability), true);
  }
});
