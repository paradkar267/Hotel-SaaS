# Security and privacy

## Threat boundaries

- Authentication is owned by the hosting dispatcher. The client cannot choose its identity or role.
- Application authorization is server-side and capability-based. UI visibility is only a convenience.
- `tenant_id` from the membership session—not request JSON—is used for all data access.
- D1 and R2 bindings are available only to server code.

## Controls implemented

1. **Identity:** verified platform email; optional `BOOTSTRAP_ADMIN_EMAIL` restriction.
2. **Membership:** explicit `users` record with active flag, tenant, property, and role.
3. **Least privilege:** manager capability set is view operations, create check-in, and upload proof only.
4. **Record locks:** every check-in receives `locked_at`; only admin APIs expose overrides.
5. **Audit:** critical mutations write actor, role, action, record, reason, before/after JSON, IP, and timestamp.
6. **Validation:** Zod allowlists actions, enums, bounds, dates, money, email, and field lengths.
7. **CSRF boundary:** mutation routes reject mismatched `Origin`; JSON routes require JSON content type.
8. **Concurrency:** active-room partial unique index plus a batched check-in prevents double occupancy.
9. **Money:** all persisted amounts are integer paise.
10. **Documents:** MIME/size allowlist, private object keys, tenant metadata, admin-only reads, and cleanup on partial failure.
11. **Browser hardening:** CSP, HSTS on HTTPS, deny framing, no MIME sniffing, limited referrer, and disabled camera/microphone/location/payment permissions.
12. **Secret hygiene:** no credentials, database identifiers, or object-store keys in source or `.env.example`.

## PII policy

HotelOS intentionally avoids storing full government-ID numbers in searchable tables. The front desk records only ID type and last four digits; the optional proof file remains private in R2. Do not add full ID numbers, card data, authentication secrets, or payment-gateway credentials to guest notes.

Recommended retention defaults:

| Data | Suggested policy |
|---|---|
| Guest contact and stay records | Retain only for legal/operational need; document policy per jurisdiction. |
| ID-proof file | Shortest lawful period; automatically purge after the policy window. |
| Invoice/payment records | Retain for the statutory accounting period. |
| Audit records | At least as long as the records they protect; export to immutable archive if required. |

## Production checklist

- Keep the initial Site owner-only and configure the intended access policy before manager onboarding.
- Set `BOOTSTRAP_ADMIN_EMAIL` before first sign-in when the platform environment allows it.
- Enable platform rate limiting/WAF on mutation and document routes.
- Configure D1 backups and test restore procedures.
- Configure R2 object retention and deletion jobs for ID proof.
- Review audit export and incident response ownership.
- Review Indian DPDP Act obligations and any applicable local guest-register requirements with counsel.
- Run dependency and source scanning in CI; block deployment on critical findings.
- Review role membership at least quarterly and immediately disable departed staff.

## Known design boundary

This build is a complete operational product, but compliance is organization- and jurisdiction-specific. The code provides technical controls; the hotel must define lawful basis, privacy notice, retention, breach response, and GST/accounting procedures.
