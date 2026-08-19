import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoice, toPaise } from "../../lib/billing";

test("non-GST invoices never add tax", () => {
  const invoice = calculateInvoice({
    billingType: "NON_GST",
    roomRatePaise: 420_000,
    nights: 2,
    extrasPaise: 50_000,
    gstRateBps: 1800,
    propertyState: "Maharashtra",
    guestState: "Maharashtra",
  });
  assert.equal(invoice.subtotalPaise, 890_000);
  assert.equal(invoice.totalPaise, 890_000);
  assert.equal(invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise, 0);
});

test("same-state GST splits evenly into CGST and SGST", () => {
  const invoice = calculateInvoice({
    billingType: "GST",
    roomRatePaise: 100_000,
    nights: 1,
    extrasPaise: 0,
    gstRateBps: 1200,
    propertyState: "Maharashtra",
    guestState: "maharashtra",
  });
  assert.equal(invoice.cgstPaise, 6_000);
  assert.equal(invoice.sgstPaise, 6_000);
  assert.equal(invoice.igstPaise, 0);
  assert.equal(invoice.totalPaise, 112_000);
});

test("interstate GST is recorded as IGST", () => {
  const invoice = calculateInvoice({
    billingType: "GST",
    roomRatePaise: 100_000,
    nights: 1,
    extrasPaise: 0,
    gstRateBps: 1200,
    propertyState: "Maharashtra",
    guestState: "Karnataka",
  });
  assert.equal(invoice.cgstPaise, 0);
  assert.equal(invoice.sgstPaise, 0);
  assert.equal(invoice.igstPaise, 12_000);
});

test("money is converted to integer paise", () => {
  assert.equal(toPaise(10.255), 1_026);
  assert.throws(() => toPaise(-1), /positive number/);
});
