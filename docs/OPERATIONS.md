# Hotel operations and billing

## Daily front-desk flow

1. Manager opens **Front desk** and selects **Start check-in**.
2. Enter the guest’s minimum required contact/address details, ID type, and final four ID digits.
3. Optionally upload the full proof to private storage.
4. Select a currently available room, expected check-out, rate, party size, and billing type.
5. For GST billing, add company, GSTIN, and place of supply.
6. Confirm. HotelOS stores the guest and stay, occupies the room, locks the record, and notifies admin dashboards.

Managers can view the resulting stay but cannot edit, cancel, delete, invoice, collect payment, or check out the guest.

## Admin correction flow

1. Open the active stay and select **Manage**.
2. Change the approved fields.
3. Enter a clear override reason.
4. Save. HotelOS stores old and new values with the admin identity and timestamp.

Room moves put the old room into housekeeping and occupy the new room in the same database batch.

## Billing flow

1. Open an active stay and create an invoice.
2. Confirm chargeable nights and additional service amount.
3. For GST invoices, confirm the reviewed GST rate.
4. HotelOS calculates the integer-paise subtotal and tax:
   - Same registered state and place of supply: CGST + SGST.
   - Different state: IGST.
   - Non-GST: no tax fields are added.
5. Collect money outside HotelOS.
6. Record the payment method, amount, reference, and note.
7. Once the balance is zero, complete check-out.
8. Housekeeping finishes the room and marks it available.

HotelOS does not initiate, authorize, settle, reverse, or refund a financial transaction.

## GST caution

The rate options are configuration choices, not legal advice. Before go-live, a qualified accountant should confirm:

- Whether the property must issue a GST tax invoice.
- Current accommodation and service tax rates/slabs.
- Place-of-supply rules and intra/inter-state treatment.
- HSN/SAC descriptions and invoice numbering requirements.
- Rounding, discounts, credit notes, cancellations, and refund treatment.
- Statutory retention and export requirements.

If the approved workflow needs credit notes or refunds, implement them as separate append-only records. Do not rewrite paid invoice or payment history.
