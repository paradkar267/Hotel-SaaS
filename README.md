# HotelOS Management SaaS

HotelOS is a cloud hotel-operations product for a single property or tenant-isolated hotel group. It gives the admin full control while keeping the manager role deliberately narrow: managers can register and check in guests, upload ID proof, and view live operations; confirmed records are locked against manager edits.

The application is a deployable full-stack TypeScript project. The React interface, server-rendered entry point, APIs, database access, cloud document storage, authentication integration, live synchronization, and security headers ship together as one Cloudflare-compatible Worker.

## What is included

- Admin-created manager access using verified email identity—no reusable password database.
- Strict server-side capabilities for `ADMIN` and `MANAGER` on every write route.
- Guest registration, ID-last-four minimization, optional private proof upload, room assignment, and atomic check-in.
- Manager record locking immediately after confirmation.
- Admin overrides for guest and active-stay corrections, each requiring a reason.
- Live room status, occupancy, active stays, daily receipts, outstanding balance, and activity feed.
- GST and non-GST invoices with configurable 0%, 5%, 12%, and 18% rates.
- Intra-state CGST/SGST split and inter-state IGST calculation.
- Manual payment records for cash, card terminal, UPI reference, and bank transfer. No gateway is present.
- Paid-account check-out and automatic housekeeping status.
- Append-only audit history with actor, role, action, module, old/new values, reason, IP, and timestamp.
- Cloudflare D1 structured storage, R2 private document storage, migrations, tests, and deployment configuration.

## Roles

| Capability | Admin | Manager |
|---|:---:|:---:|
| View operational dashboard and room state | Yes | Yes |
| Create a guest check-in | Yes | Yes |
| Upload ID proof during check-in | Yes | Yes |
| Edit a confirmed guest or stay | Yes, with reason | No |
| Create/void invoices and record payments | Yes | No |
| Check out a guest | Yes | No |
| Change room status | Yes | No |
| Create, disable, or enable managers | Yes | No |
| View audit log and private ID documents | Yes | No |
| Configure hotel and GST defaults | Yes | No |

This matrix is defined in `lib/permissions.ts` and enforced again in API handlers. Hiding an admin control in the browser is never treated as authorization.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Next-compatible App Router through Vinext, Tailwind base plus product CSS |
| State | React state for UI; server data is authoritative |
| Backend | TypeScript route handlers in the same Worker deployment |
| Authentication | Dispatch-owned Sign in with ChatGPT; verified identity headers |
| Authorization | Tenant-scoped application roles and server-side capability checks |
| Database | Cloudflare D1 / SQLite with Drizzle schema and migrations |
| Documents | Private Cloudflare R2 objects with D1 metadata |
| Live sync | Server-sent events with 20-second polling fallback |
| Deployment | Cloudflare-compatible immutable Sites deployments |

This architecture replaces a separate Express container, PostgreSQL cluster, Redis, and Kubernetes for the current product size. D1 and R2 provide managed cloud persistence with a much smaller operational surface. See [Architecture](docs/ARCHITECTURE.md) for the scale-out path.

## Local setup

Prerequisites: Node.js 22.13 or newer and a Linux environment with `bash`, `flock`, `curl`, and GNU `timeout`.

```bash
npm run install:ci
npm run dev
```

The project-scoped scripts keep caches and runtime files inside `.sites-runtime/`. D1 and R2 are simulated locally by the Cloudflare development runtime.

In development only, an identity fallback creates `admin@hotelos.demo` as the first administrator. Production never uses that fallback.

## First production sign-in

1. Keep the first deployment owner-only.
2. Optionally configure `BOOTSTRAP_ADMIN_EMAIL` to the exact verified email that may initialize the workspace.
3. Sign in with that identity. HotelOS creates the tenant, property, admin membership, and initial room inventory atomically.
4. Open **Team access** and add each manager’s verified email.
5. Widen the hosting access policy only to the intended workspace or approved identities.

Manager “credentials” are secure identity grants: the admin adds an email and the manager proves control through the platform sign-in flow. HotelOS does not create, expose, email, or reset passwords.

## Commands

```bash
npm run typecheck      # strict TypeScript validation
npm run test:unit      # billing and permission contracts
npm test               # typecheck, unit tests, production build, rendered-worker checks
npm run build          # production Worker build and artifact validation
npm run db:generate    # generate a migration after db/schema.ts changes
```

## Data safety defaults

- Every operational table carries `tenant_id`; all application queries scope by the authenticated membership’s tenant.
- Active rooms have a partial unique index preventing concurrent double check-ins.
- Monetary amounts are integer paise, never floating-point currency.
- Manager-created stays are locked at creation. The manager API has no edit, delete, billing, team, or settings capability.
- Full identity numbers are not collected. Only the final four digits are searchable; uploaded proof remains private in R2.
- Document reads require an admin capability and tenant ownership check.
- All mutation routes validate content, origin, identity, role, tenant, record state, and input shape.
- Security headers deny framing, MIME sniffing, unnecessary device permissions, and cross-origin resource loads.

## Documentation

- [System architecture and data model](docs/ARCHITECTURE.md)
- [API contracts](docs/API.md)
- [UI and component inventory](docs/UI.md)
- [Security and privacy](docs/SECURITY.md)
- [Deployment and runbook](docs/DEPLOYMENT.md)
- [Operations, billing, and GST notes](docs/OPERATIONS.md)

## Production note

GST classification and tax rates depend on current law, room tariff, place of supply, and the hotel’s registration. HotelOS makes the calculation configurable but does not replace review by a qualified accountant or tax adviser.
