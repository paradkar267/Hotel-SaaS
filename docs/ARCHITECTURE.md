# HotelOS Management SaaS — System Architecture & Data Flow Specification

> **Document Type**: Enterprise System Architecture, AWS Infrastructure & Security Data Flow  
> **Status**: Production-Ready Blueprint  
> **Version**: 2.0.0  

---

## Table of Contents
1. [AWS Cloud Infrastructure & Network Topology](#1-aws-cloud-infrastructure--network-topology)
2. [Multi-Tier Security Architecture (Levels 1 to 4)](#2-multi-tier-security-architecture-levels-1-to-4)
   - [Level 1: Perimeter & Network Security](#level-1-perimeter--network-security)
   - [Level 2: Application & Identity Security](#level-2-application--identity-security)
   - [Level 3: Multi-Tenant & Anti-Fraud Boundary](#level-3-multi-tenant--anti-fraud-boundary)
   - [Level 4: Database & Storage Encryption (AWS RDS & S3)](#level-4-database--storage-encryption-aws-rds--s3)
3. [End-to-End Operational Data Flows](#3-end-to-end-operational-data-flows)
   - [Flow 1: Front-Desk Walk-In Check-In & Room Assignment](#flow-1-front-desk-walk-in-check-in--room-assignment)
   - [Flow 2: Billing & Invoice Generation (GST vs. Non-GST Decoupled Routing)](#flow-2-billing--invoice-generation-gst-vs-non-gst-decoupled-routing)
   - [Flow 3: Offline Payment Settlement & Shift Handover](#flow-3-offline-payment-settlement--shift-handover)
   - [Flow 4: Guest Check-Out & Housekeeping Lifecycle](#flow-4-guest-check-out--housekeeping-lifecycle)
   - [Flow 5: Admin Override & Immutable Audit Logging](#flow-5-admin-override--immutable-audit-logging)
   - [Flow 6: Real-Time SSE Operational Pulse Broadcaster](#flow-6-real-time-sse-operational-pulse-broadcaster)
4. [Relational Database Schema (AWS RDS PostgreSQL)](#4-relational-database-schema-aws-rds-postgresql)
5. [Disaster Recovery & High Availability SLAs](#5-disaster-recovery--high-availability-slas)

---

## 1. AWS Cloud Infrastructure & Network Topology

```mermaid
flowchart TB
    subgraph Internet ["🌐 Public Internet"]
        FD["Front Desk Reception Terminal"]
        Admin["Hotel Owner / GM Dashboard"]
        HK["Housekeeping Mobile Device"]
    end

    subgraph Edge ["🛡️ AWS Edge Network"]
        CF["Amazon CloudFront CDN (TLS 1.3)"]
        WAF["AWS WAF (DDoS / SQLi / Rate Limiting)"]
        CF --- WAF
    end

    subgraph VPC ["☁️ AWS Virtual Private Cloud (VPC - 10.0.0.0/16)"]
        subgraph PublicSubnet ["Public Subnet (DMZ)"]
            ALB["Application Load Balancer (ALB)"]
            NAT["NAT Gateway"]
        end

        subgraph AppSubnet ["Private Application Subnet (10.0.10.0/24)"]
            ECS["AWS ECS Fargate Cluster / Next.js Node.js 22"]
            App1["Container Task 1"]
            App2["Container Task 2 (Auto-Scaled)"]
            ECS --- App1
            ECS --- App2
        end

        subgraph DBSubnet ["Isolated Database Subnet (10.0.20.0/24)"]
            Proxy["AWS RDS Proxy (Connection Pooler)"]
            PrimaryRDS[("AWS RDS PostgreSQL 16 (Primary - AZ 1)")]
            StandbyRDS[("AWS RDS PostgreSQL 16 (Standby - AZ 2)")]
            Proxy --> PrimaryRDS
            PrimaryRDS -. Synchronous Replication .-> StandbyRDS
        end

        subgraph SecureStorage ["Encrypted Cloud Storage"]
            S3[("Amazon S3 Private Bucket (ID Proofs & Invoices)")]
            KMS["AWS KMS (Customer Managed Keys - CMK)"]
            S3 --- KMS
        end

        subgraph Monitoring ["Audit & Observability"]
            CW["Amazon CloudWatch (Logs & Metrics)"]
            GD["AWS GuardDuty & Security Hub"]
        end
    end

    FD -->|HTTPS / Port 443| CF
    Admin -->|HTTPS / Port 443| CF
    HK -->|HTTPS / Port 443| CF

    CF --> ALB
    ALB -->|Forward| ECS
    ECS -->|SQL Queries via Port 5432| Proxy
    ECS -->|Signed REST API| S3
    ECS --> NAT
    NAT -->|Outbound Telemetry| CW
    PrimaryRDS -->|WAL Archive| S3
```

---

## 2. Multi-Tier Security Architecture (Levels 1 to 4)

```mermaid
flowchart LR
    L1["<b>LEVEL 1</b><br>Perimeter Security<br>• AWS WAF<br>• CloudFront TLS 1.3<br>• Token Bucket Limiter"] --> 
    L2["<b>LEVEL 2</b><br>Application Security<br>• JWT / Session Guard<br>• Zod Input Allowlist<br>• Server Capability Matrix"] --> 
    L3["<b>LEVEL 3</b><br>Tenant & Domain Security<br>• ABAC Tenant Isolation<br>• Zero-Trust Record Lock<br>• PII Last-4 Masking"] --> 
    L4["<b>LEVEL 4</b><br>Database & Storage<br>• VPC Isolated Subnet<br>• AWS KMS Encryption<br>• Append-Only Audit Log"]
```

---

### Level 1: Perimeter & Network Security
* **AWS CloudFront + AWS WAF**: Blocks malicious SQL injection, cross-site scripting (XSS), and automated bots before reaching backend containers.
* **TLS 1.3 In-Transit Encryption**: All communication enforces HTTPS with strict HSTS (`max-age=63072000; includeSubDomains; preload`).
* **Token Bucket Rate Limiting**: Max 30 mutations/min per staff account; 5 login attempts/min before a 15-minute IP lockout.
* **Strict HTTP Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, and restricted device permissions (`camera=(), microphone=(), payment=()`).

---

### Level 2: Application & Identity Security
* **Session Identity Resolution**: Verified platform identity headers cross-referenced with active `users` records.
* **Server-Side Capability Verification**: Every mutation route executes `enforceCapability()` before processing. Frontend button hiding is **never** treated as authorization.
* **Zod Runtime Type Safety**: Rejects unexpected or malicious JSON keys via strict allowlisting and bounds checking.
* **CSRF Origin Verification**: Mutation routes reject mismatched `Origin` or non-JSON payloads (`Content-Type: application/json`).

---

### Level 3: Multi-Tenant & Anti-Fraud Boundary
* **Attribute-Based Access Control (ABAC)**: All SQL queries automatically enforce `WHERE tenant_id = session.tenantId AND property_id = session.propertyId`.
* **Zero-Trust Record Locking**: Receptionist check-in triggers immediate `locked_at = nowIso()`. Receptionists have **zero edit/delete capability**.
* **PII Minimization (DPDP Act Compliance)**: Government IDs store only the last 4 digits (e.g. `•••• 1234`) in searchable tables. Full scans remain in encrypted S3 buckets.

---

### Level 4: Database & Storage Encryption (AWS RDS & S3)
* **Isolated Private Subnets**: AWS RDS PostgreSQL has **no public IP address** and is accessible only from the application container security group on port 5432.
* **AWS KMS Envelope Encryption**: Database storage, automated snapshots, and S3 objects are encrypted at rest using AES-256 with AWS Key Management Service (KMS).
* **Temporary S3 Pre-Signed URLs**: ID proofs are never made public. Admins receive short-lived (5-minute TTL) signed URLs for verification.
* **Append-Only Immutable Audit Trail**: All overrides, rate changes, and billing mutations record an unchangeable JSON before/after diff with client IP and reason.

---

## 3. End-to-End Operational Data Flows

---

### Flow 1: Front-Desk Walk-In Check-In & Room Assignment

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Walk-In Guest
    actor Staff as Front Desk Receptionist
    participant UI as Front Desk UI
    participant API as Check-In API Handler
    participant Guard as Capability & Tenant Guard
    participant DB as AWS RDS PostgreSQL
    participant S3 as Amazon S3 (KMS Encrypted)
    participant Live as Live SSE Broadcaster

    Guest->>Staff: Arrives at counter, provides details & ID
    Staff->>UI: Fills form (Name, Phone, ID Last-4, Room 102, Tariff)
    Staff->>UI: Attaches ID Scan (PDF/JPG)
    UI->>API: POST /api/hotel (action: "create_checkin")
    
    API->>Guard: Verify session & check "CREATE_CHECKIN" capability
    Guard-->>API: Authorized (Manager / Admin)
    
    API->>DB: Query Room 102 status
    Note over API,DB: FSM Check: Must be "AVAILABLE"
    
    API->>S3: Upload encrypted ID Scan (Private Bucket)
    S3-->>API: Object Key stored
    
    API->>DB: BEGIN ATOMIC TRANSACTION
    API->>DB: INSERT into guests (Name, Phone, ID Last-4)
    API->>DB: INSERT into bookings (Status: CHECKED_IN, locked_at: NOW())
    API->>DB: UPDATE rooms SET status = 'OCCUPIED' WHERE id = 'room_102'
    API->>DB: INSERT into audit_logs (Action: 'CHECK_IN', Actor: Staff)
    API->>DB: COMMIT TRANSACTION
    
    API->>Live: Broadcast latestAuditId event
    Live-->>UI: Real-time update across all screens
    API-->>Staff: 201 Created — Stay Confirmed & Locked
```

---

### Flow 2: Billing & Invoice Generation (GST vs. Non-GST Decoupled Routing)

```mermaid
flowchart TD
    Start["Admin / Staff initiates billing for active stay"] --> CheckType{"Is Billing Type GST or Non-GST?"}

    subgraph GST_Branch ["🔵 GST Tax Invoice Pipeline"]
        CheckType -->|GST| InputGST["Enter B2B GSTIN, Company Name, Place of Supply"]
        InputGST --> CalcGST["Execute calculateGstInvoice()<br>• Integer Paise Math<br>• SAC Code: 996311<br>• Intra-state: 50% CGST + 50% SGST<br>• Inter-state: 100% IGST"]
        CalcGST --> GenGSTSeq["Generate Sequence: INV-GST-2627-XXXX"]
        GenGSTSeq --> SaveGSTDB[("Insert into gst_invoices & gst_invoice_items")]
        SaveGSTDB --> MailGST["Dispatch GST Tax Invoice Email with Dynamic UPI QR"]
    end

    subgraph NonGST_Branch ["🟢 Non-GST Hospitality Bill Pipeline"]
        CheckType -->|Non-GST| InputNonGST["Enter Room Charges & Amenities (Food/Laundry)"]
        InputNonGST --> CalcNonGST["Execute calculateNonGstBill()<br>• Integer Paise Math<br>• Zero Tax Fields<br>• Clean Net Subtotal - Discount"]
        CalcNonGST --> GenNonGSTSeq["Generate Sequence: BILL-NON-2627-XXXX"]
        GenNonGSTSeq --> SaveNonGSTDB[("Insert into non_gst_bills & non_gst_bill_items")]
        SaveNonGSTDB --> MailNonGST["Dispatch Stay Folio Email with Dynamic UPI QR"]
    end

    MailGST --> Audit["Append-Only Audit Log Entry"]
    MailNonGST --> Audit
    Audit --> Done["Invoice / Bill Ready for Counter Payment"]
```

---

### Flow 3: Offline Payment Settlement & Shift Handover

```mermaid
sequenceDiagram
    autonumber
    actor Guest as In-House Guest
    actor Staff as Front Desk Cashier
    participant UI as Counter Terminal UI
    participant API as Payment API
    participant DB as AWS RDS PostgreSQL
    actor Owner as Hotel Owner / GM

    Guest->>Staff: Settles bill via Cash / Card / Counter UPI QR
    Staff->>UI: Records payment (Amount, Method: CASH/UPI, Ref No)
    UI->>API: POST /api/hotel (action: "record_payment")
    
    API->>DB: Fetch invoice balance
    Note over API,DB: Invariant: Payment <= Balance
    API->>DB: INSERT into gst_payments / non_gst_payments
    API->>DB: UPDATE invoice balance & status (PAID / PARTIAL)
    API->>DB: INSERT into audit_logs
    API-->>Staff: 200 OK — Payment Receipt Printed
    
    Note over Staff,UI: END OF 8-HOUR WORK SHIFT
    Staff->>UI: Inputs counted drawer cash (₹500, ₹200, ₹100 notes)
    UI->>API: POST /api/shift/handover
    API->>DB: Compute Expected Drawer Cash vs Physical Cash
    API->>DB: INSERT into shift_handovers (Variance, Reason)
    API-->>Owner: Email Handover Report & Cash Variance Snapshot
```

---

### Flow 4: Guest Check-Out & Housekeeping Lifecycle

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: Clean room ready for walk-in guest
    
    AVAILABLE --> OCCUPIED: Front-Desk Check-In Completed (Locked)
    
    OCCUPIED --> HOUSEKEEPING: Front-Desk Check-Out (Guest Leaves)
    note right of HOUSEKEEPING
        Room automatically flagged dirty.
        Housekeeping staff alerted on mobile.
    end note
    
    HOUSEKEEPING --> AVAILABLE: Housekeeping cleans & supervisor inspects
    
    HOUSEKEEPING --> MAINTENANCE: Repair needed (AC / Plumbing issue)
    MAINTENANCE --> HOUSEKEEPING: Repair completed
    MAINTENANCE --> AVAILABLE: Inspected & ready
```

---

### Flow 5: Admin Override & Immutable Audit Logging

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Hotel Owner / Admin
    participant UI as Admin Dashboard
    participant API as Override API Handler
    participant Guard as Role & Capability Validator
    participant DB as AWS RDS PostgreSQL

    Admin->>UI: Edits locked stay (Changes rate or room move)
    Admin->>UI: Inputs mandatory override reason (>= 4 characters)
    UI->>API: POST /api/hotel (action: "update_booking")
    
    API->>Guard: enforceRole(ADMIN) & enforceCapability(EDIT_LOCKED_RECORD)
    Guard-->>API: Verified
    
    API->>DB: Fetch current stay snapshot (old_value)
    
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE bookings (New Room / New Rate)
    API->>DB: If room changed, update old room -> HOUSEKEEPING, new room -> OCCUPIED
    API->>DB: INSERT into audit_logs (Actor: Admin, Reason, Old JSON, New JSON, IP, Timestamp)
    API->>DB: COMMIT TRANSACTION
    
    API-->>Admin: 200 OK — Override successfully recorded in audit log
```

---

### Flow 6: Real-Time SSE Operational Pulse Broadcaster

```mermaid
sequenceDiagram
    autonumber
    participant UI_FD as Front Desk Terminal
    participant UI_Admin as Owner Remote Dashboard
    participant API as /api/live SSE Route
    participant DB as AWS RDS PostgreSQL

    UI_FD->>API: GET /api/live?after=42 (EventSource Connection)
    UI_Admin->>API: GET /api/live?after=42 (EventSource Connection)
    API-->>UI_FD: event: ready (lastId: 42)
    API-->>UI_Admin: event: ready (lastId: 42)
    
    loop Every 3 Seconds (Polling Worker)
        API->>DB: SELECT MAX(id) FROM audit_logs WHERE tenant_id = 'ten_1'
        DB-->>API: latestAuditId = 43 (New check-in occurred!)
        API-->>UI_FD: event: change (id: 43)
        API-->>UI_Admin: event: change (id: 43)
        UI_FD->>UI_FD: Revalidate room pulse & occupancy %
        UI_Admin->>UI_Admin: Revalidate live revenue & occupied count
    end
    
    Note over API,UI_Admin: At 25 Seconds: Connection cycles cleanly to prevent TCP timeout
```

---

## 4. Relational Database Schema (AWS RDS PostgreSQL)

```mermaid
erDiagram
    TENANTS ||--o{ PROPERTIES : owns
    TENANTS ||--o{ USERS : has
    PROPERTIES ||--o{ ROOMS : contains
    PROPERTIES ||--o{ GUESTS : registers
    GUESTS ||--o{ BOOKINGS : makes
    ROOMS ||--o{ BOOKINGS : assigned
    GUESTS ||--o{ GUEST_DOCUMENTS : has
    
    BOOKINGS ||--o{ GST_INVOICES : bills_gst
    GST_INVOICES ||--|{ GST_INVOICE_ITEMS : contains
    GST_INVOICES ||--o{ GST_PAYMENTS : receives
    
    BOOKINGS ||--o{ NON_GST_BILLS : bills_non_gst
    NON_GST_BILLS ||--|{ NON_GST_BILL_ITEMS : contains
    NON_GST_BILLS ||--o{ NON_GST_PAYMENTS : receives
    
    TENANTS ||--o{ SHIFT_HANDOVERS : balances
    TENANTS ||--o{ AUDIT_LOGS : records
```

### Table Summary:
| Table Name | Primary Purpose | Key Constraints |
| :--- | :--- | :--- |
| `tenants` | Top-level multi-tenant SaaS isolation boundary. | `id PRIMARY KEY` |
| `properties` | Hotel entity, state, GSTIN, and default tax parameters. | `tenant_id REFERENCES tenants(id)` |
| `users` | Staff & admin accounts with role and active status. | `UNIQUE(email)` |
| `rooms` | Physical room inventory, floor, rate in paise, status. | `UNIQUE(property_id, room_number)` |
| `guests` | Contact details, nationality, masked last-4 ID. | `INDEX(tenant_id, phone)` |
| `guest_documents`| Metadata for private S3 ID uploads (bytes never in DB). | `guest_id REFERENCES guests(id)` |
| `bookings` | Stay lifecycle, dates, adults, locked timestamp. | `UNIQUE INDEX ON (room_id) WHERE status = 'CHECKED_IN'` |
| `gst_invoices` | Official GST Tax Invoices with SAC 996311 & tax splits. | `UNIQUE(invoice_number)` (INV-GST-XXXX) |
| `gst_invoice_items`| Itemized tax rows per invoice. | `invoice_id REFERENCES gst_invoices(id)` |
| `gst_payments` | Offline payment entries against GST invoices. | `invoice_id REFERENCES gst_invoices(id)` |
| `non_gst_bills` | Plain hospitality bills without tax fields. | `UNIQUE(bill_number)` (BILL-NON-XXXX) |
| `non_gst_bill_items`| Plain itemized stay & food charges. | `bill_id REFERENCES non_gst_bills(id)` |
| `non_gst_payments`| Offline payment entries against Non-GST bills. | `bill_id REFERENCES non_gst_bills(id)` |
| `shift_handovers`| Front-desk cash drawer balance and shift handovers. | `INDEX(tenant_id, created_at)` |
| `audit_logs` | Append-only immutable log of every system mutation. | `INDEX(tenant_id, id)` (Partitioned Monthly) |

---

## 5. Disaster Recovery & High Availability SLAs

```
┌─────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ METRIC / SLA                                                │ AWS CONFIGURATION & TARGET                                  │
├─────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 1. Uptime Availability SLA                                  │ 99.95% (Multi-AZ RDS + ECS Fargate Auto-Scaled)             │
│ 2. Recovery Point Objective (RPO)                           │ <= 5 Minutes (Continuous WAL Archival to Amazon S3)         │
│ 3. Recovery Time Objective (RTO)                             │ <= 15 Minutes (Automated Multi-AZ Failover < 60 Seconds)    │
│ 4. Point-in-Time Recovery (PITR) Window                     │ Restore database state to any exact second in last 35 days  │
│ 5. Automated Cross-Region DR Backup                         │ Daily snapshot copied from ap-south-1 (Mumbai) to Singapore│
│ 6. Data Encryption Standard                                 │ AES-256 via AWS KMS (Customer Managed Key CMK)             │
└─────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```
