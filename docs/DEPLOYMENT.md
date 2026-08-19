# Deployment and runbook

## Cloud resources

`.openai/hosting.json` declares two logical bindings:

- `DB`: Cloudflare D1 for relational operational records.
- `BUCKET`: private Cloudflare R2 for guest ID-proof files.

The Sites lifecycle owns resource creation, migration application, immutable source versions, and production deployment. Do not place provider IDs or credentials in source.

## Release gates

Run before each release:

```bash
npm test
```

This gate performs strict type checking, unit tests for permissions and billing, a production build, artifact validation, and rendered Worker/security-header checks.

When `db/schema.ts` changes:

```bash
npm run db:generate
```

Inspect the SQL in `drizzle/`, confirm every statement is tenant-safe and non-destructive, then include it in the release. Never modify a migration that has already shipped; create a new one.

## Environment

| Name | Required | Purpose |
|---|---:|---|
| `BOOTSTRAP_ADMIN_EMAIL` | Recommended before initialization | Restricts the first admin bootstrap identity. |
| `DB` binding | Yes | Platform-provisioned D1 database. |
| `BUCKET` binding | Yes | Platform-provisioned private R2 bucket. |

No JWT secret, database URL, or payment-gateway key is used.

## First release

1. Deploy with owner-only access.
2. Verify the application title and sign-in screen.
3. Sign in as the configured bootstrap admin.
4. Configure property address, state, GSTIN, and reviewed default GST rate.
5. Confirm room inventory and rates.
6. Add one manager by verified email.
7. Verify manager navigation contains only Overview and Front desk.
8. Create a non-production test check-in, invoice, manual payment, check-out, and room release.
9. Inspect the audit trail for every transition.
10. Remove test records using a controlled retention/admin maintenance procedure before go-live.

## Monitoring

Alert on:

- 5xx response rate and API latency.
- D1 write failures, constraint conflicts above normal concurrency, and migration errors.
- R2 upload/read failures.
- Repeated 401/403 responses by identity or IP.
- Manager access changes.
- Invoice void attempts and payment edits/refunds once those workflows are added.
- SSE failure rate; polling should keep the UI current during transient stream loss.

## Backup and recovery

- Enable and periodically verify platform D1 backups.
- Use R2 versioning/retention where policy permits; avoid retaining ID proof longer than lawful need.
- Export invoices, payments, and audit logs to a controlled archive on a schedule.
- Test restoration into a non-production environment at least quarterly.
- Record RPO/RTO targets before opening the product to hotel operations.

## Rollback

Deployments are immutable. If application code fails, redeploy the last known-good saved version. Do not roll back a database migration by deleting columns or tables during an incident. Ship a forward-compatible corrective migration after backup and review.

## CI/CD sketch

```yaml
steps:
  - npm ci
  - npm run typecheck
  - npm run test:unit
  - npm run build
  - npm run validate:artifact
  - checkpoint immutable source and deploy
  - poll deployment to terminal status
  - smoke-test authenticated admin and manager journeys
```
