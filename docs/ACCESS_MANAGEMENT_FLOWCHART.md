# HotelOS Management SaaS — Access Management & RBAC Flowchart Specification

> **Document Type**: Access Control Architecture, Role Hierarchy & Security Matrix  
> **Status**: Final Production Specification  
> **Scope**: Authentication, Authorization, RBAC Matrix, ABAC Tenant Isolation, and Anti-Fraud Record Locking  

---

## Table of Contents
1. [Master Access Management Flowchart](#1-master-access-management-flowchart)
2. [5-Tier Role Hierarchy & Staff Personas](#2-5-tier-role-hierarchy--staff-personas)
3. [Complete Role-Based Access Control (RBAC) Matrix](#3-complete-role-based-access-control-rbac-matrix)
4. [Anti-Fraud Record Locking & Admin Override Flow](#4-anti-fraud-record-locking--admin-override-flow)
5. [Attribute-Based Access Control (ABAC) Multi-Tenant Isolation](#5-attribute-based-access-control-abac-multi-tenant-isolation)
6. [Session Lifecycle & Security Enforcement](#6-session-lifecycle--security-enforcement)

---

## 1. Master Access Management Flowchart

```mermaid
flowchart TD
    %% ─────────────────────────────────────────────────────────────
    %% STAGE 1: USER LOGIN & IDENTITY
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_1 ["🔐 1. AUTHENTICATION & LOGIN"]
        User["👤 Staff / Admin / Owner enters Email & Password"] --> LoginAPI["POST /api/auth/login"]
        LoginAPI --> RateLimit{"Token Bucket Check<br>Attempts < 5 per min?"}
        
        RateLimit -->|❌ Too many tries| LockIP["⛔ 15-Minute IP Lockout"]
        RateLimit -->|✅ Allowed| VerifyUser{"Validate Credentials in Supabase Auth & 'users' Table"}
        
        VerifyUser -->|❌ Invalid Password| FailAuth["⛔ 401 Unauthorized"]
        VerifyUser -->|❌ Account Inactive| DisabledUser["⛔ 403 Account Disabled"]
        VerifyUser -->|✅ Valid & Active| GenToken["Generate Secure Session (JWT)<br>Store in HttpOnly, SameSite=Strict Cookie"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 2: REQUEST INTERCEPTION & CAPABILITY GUARDS
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_2 ["🛡️ 2. MIDDLEWARE SECURITY GUARDS (PER REQUEST)"]
        GenToken --> IncomingReq["🌐 Client sends API Request (e.g. Check-in, Bill Edit, Override)"]
        IncomingReq --> SessionGuard{"1. Session Resolver<br>Is user signed in?"}
        
        SessionGuard -->|No| RedirLogin["⛔ 401 Unauthorized -> Redirect to Login"]
        SessionGuard -->|Yes| TenantGuard{"2. ABAC Tenant Boundary<br>Does resource belong to user's tenant_id?"}
        
        TenantGuard -->|No / Cross-Tenant| CrossTenant403["⛔ 403 Forbidden (Cross-Tenant Blocked)"]
        TenantGuard -->|Yes| CapabilityGuard{"3. Capability Enforcer<br>Does role permit this action?"}
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 3: ROLE-BASED ROUTING
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_3 ["👥 3. ROLE DISPATCHING ENGINE"]
        CapabilityGuard --> RoleType{"Identify User Role"}
        
        RoleType -->|SUPER_ADMIN| SuperAdminBox["👑 Super Admin (Platform Owner)<br>• Manage all Tenants & Hotels<br>• Platform Global Analytics"]
        RoleType -->|HOTEL_ADMIN| AdminBox["👔 Hotel Admin (Owner / GM)<br>• Full Property Control<br>• Can Override Locked Stays (with Reason)<br>• Manage Staff Accounts & Invoices"]
        RoleType -->|MANAGER| ManagerBox["👩‍💼 Hotel Manager (Front Desk)<br>• Create Walk-In Check-In<br>• Upload ID Proof<br>• ❌ CANNOT edit confirmed bills"]
        RoleType -->|HOUSEKEEPING| HKBox["🧹 Housekeeping Staff<br>• View dirty rooms<br>• Reset cleaned rooms to 'AVAILABLE'"]
        RoleType -->|ACCOUNTANT| AccBox["📊 Accountant / Auditor<br>• View GST Invoices & Non-GST Bills<br>• Export GSTR-1 & Tally Reports"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 4: EXECUTION & AUDITING
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_4 ["⚡ 4. ATOMIC EXECUTION & AUDIT TRAIL"]
        SuperAdminBox --> ExecuteDB["⚡ Execute Database Mutation (AWS RDS)"]
        AdminBox --> ExecuteDB
        ManagerBox --> CheckLock{"Is Record Locked?"}
        
        CheckLock -->|Yes & Manager tries edit| LockErr["⛔ 403 Forbidden: Record is Locked!"]
        CheckLock -->|New Check-In| ExecuteDB
        HKBox --> ExecuteDB
        AccBox --> ExecuteDB
        
        ExecuteDB --> WriteAudit["📝 Append-Only Audit Log (Actor, IP, Old/New JSON Diff, Reason)"]
        WriteAudit --> Finish["✅ 200/201 Success Response"]
    end

    %% Styling
    classDef stageStyle fill:#f8fafc,stroke:#334155,stroke-width:2px,color:#0f172a;
    classDef authStyle fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#1e3a8a;
    classDef alertStyle fill:#fef2f2,stroke:#dc2626,stroke-width:2px,color:#991b1b;
    classDef successStyle fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d;

    class STAGE_1,STAGE_2 stageStyle;
    class SuperAdminBox,AdminBox,ManagerBox,HKBox,AccBox authStyle;
    class LockIP,FailAuth,DisabledUser,RedirLogin,CrossTenant403,LockErr alertStyle;
    class Finish,ExecuteDB successStyle;
```

---

## 2. 5-Tier Role Hierarchy & Staff Personas

```
                            ┌────────────────────────────────────────────────────────┐
                            │                    1. SUPER ADMIN                      │
                            │              (SaaS Platform Owner / HQ)                │
                            │  • Provisions new hotel tenants & properties           │
                            │  • Global SaaS revenue & subscription health           │
                            └───────────────────────────┬────────────────────────────┘
                                                        │
                                                        ▼
                            ┌────────────────────────────────────────────────────────┐
                            │                    2. HOTEL ADMIN                      │
                            │              (Hotel Owner / General Manager)           │
                            │  • Full control of single hotel property               │
                            │  • Can override locked stays (Mandatory reason needed) │
                            │  • Provisions & disables staff accounts                │
                            │  • Views complete audit trail & financial ledger       │
                            └───────────────────────────┬────────────────────────────┘
                                                        │
                      ┌─────────────────────────────────┼─────────────────────────────────┐
                      ▼                                 ▼                                 ▼
       ┌─────────────────────────────┐   ┌─────────────────────────────┐   ┌─────────────────────────────┐
       │      3. HOTEL MANAGER       │   │       4. HOUSEKEEPING       │   │        5. ACCOUNTANT        │
       │    (Front-Desk Cashier)     │   │     (Cleaning Supervisor)   │   │     (Financial Auditor)     │
       │ • Register walk-in check-in │   │ • View dirty rooms list     │   │ • View all GST/Non-GST bills│
       │ • Upload guest ID proof     │   │ • Reset cleaned rooms to    │   │ • Export GSTR-1, GSTR-3B    │
       │ • Collect cash/card/UPI     │   │   "AVAILABLE"               │   │ • Record payment audit      │
       │ ❌ CANNOT edit locked bills │   │ • Flag maintenance issues   │   │ ❌ CANNOT check in guests   │
       │ ❌ CANNOT delete records    │   │ ❌ CANNOT touch billing     │   │ ❌ CANNOT change room state │
       └─────────────────────────────┘   └─────────────────────────────┘   └─────────────────────────────┘
```

---

## 3. Complete Role-Based Access Control (RBAC) Matrix

| Feature / Operation | Super Admin | Hotel Admin | Hotel Manager | Housekeeping | Accountant |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **SaaS Tenant & Hotel Onboarding** | `FULL` | `NONE` | `NONE` | `NONE` | `NONE` |
| **Global Platform Metrics** | `FULL` | `NONE` | `NONE` | `NONE` | `NONE` |
| **Live Room Pulse & Occupancy View** | `VIEW` | `FULL` | `VIEW` | `VIEW` | `VIEW` |
| **Create Front-Desk Walk-In Check-In** | `NONE` | `FULL` | `FULL` | `NONE` | `NONE` |
| **Upload Guest ID Proof Scan** | `NONE` | `FULL` | `FULL` | `NONE` | `NONE` |
| **View Full Guest ID Document (S3)** | `NONE` | `VIEW` | `NONE` | `NONE` | `NONE` |
| **Edit / Override Confirmed Stay** | `NONE` | `OVERRIDE (Reason Req)` | `LOCKED (Blocked)` | `NONE` | `NONE` |
| **Change Room: Clean to Available** | `NONE` | `FULL` | `UPDATE` | `FULL` | `NONE` |
| **Change Room: Out of Order (Maintenance)**| `NONE`| `FULL` | `NONE` | `NONE` | `NONE` |
| **Generate GST Tax Invoice (`INV-GST-XXXX`)**| `NONE`| `FULL` | `NONE` | `NONE` | `FULL` |
| **Generate Non-GST Bill (`BILL-NON-XXXX`)** | `NONE`| `FULL` | `NONE` | `NONE` | `FULL` |
| **Record Counter Payment (Cash/Card/UPI)** | `NONE` | `FULL` | `FULL (At Check-in)`| `NONE`| `FULL` |
| **Void / Cancel Bill or Invoice** | `NONE` | `FULL (Reason Req)` | `NONE` | `NONE` | `FULL (Reason Req)`|
| **Complete Guest Check-Out** | `NONE` | `FULL` | `NONE` | `NONE` | `NONE` |
| **Manage Staff Accounts (Add/Disable)**| `NONE` | `FULL (Reason Req)` | `NONE` | `NONE` | `NONE` |
| **Configure Property State & GSTIN** | `NONE` | `FULL` | `NONE` | `NONE` | `NONE` |
| **View Complete Immutable Audit Trail**| `PLATFORM` | `PROPERTY` | `NONE` | `NONE` | `BILLING ONLY` |
| **Export GSTR-1 / Tally Tax Reports** | `NONE` | `FULL` | `NONE` | `NONE` | `FULL` |

---

## 4. Anti-Fraud Record Locking & Admin Override Flow

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Front Desk Receptionist
    actor Admin as Hotel Owner / Admin
    participant API as Backend API Guard
    participant DB as AWS RDS PostgreSQL

    Note over Staff,DB: SCENARIO A: RECEPTIONIST TRIES TO EDIT A CONFIRMED STAY
    Staff->>API: POST /api/hotel (action: "update_booking", bookingId: "bkg_123", newRate: ₹2000)
    API->>API: Check caller role -> "MANAGER"
    API->>DB: Fetch booking "bkg_123" -> locked_at is NOT NULL
    API-->>Staff: ⛔ 403 Forbidden: "This record is locked. Only an admin can make changes."
    Note over Staff: Tampering Blocked! Cash theft prevented.

    Note over Admin,DB: SCENARIO B: OWNER MAKES A LEGITIMATE CORRECTION
    Admin->>API: POST /api/hotel (action: "update_booking", bookingId: "bkg_123", reason: "Guest extended stay by 1 day")
    API->>API: Check caller role -> "ADMIN" & verify reason length >= 4
    API->>DB: Fetch current state (Old JSON Snapshot)
    API->>DB: UPDATE bookings SET nightly_rate, checkout_date
    API->>DB: INSERT into audit_logs (Actor: Admin, Reason: "Guest extended...", Old JSON, New JSON, IP)
    API-->>Admin: ✅ 200 OK: "Locked stay updated with an audited admin override."
```

---

## 5. Attribute-Based Access Control (ABAC) Multi-Tenant Isolation

### The Invariant Rule:
Every database read and write query enforces tenant scoping automatically:
$$\text{Query Filter: } \text{WHERE } \text{tenant\_id} = \text{session.tenantId} \;\land\; \text{property\_id} = \text{session.propertyId}$$

```
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ HOTEL A (Tenant ID: ten_hotel_A)              │ HOTEL B (Tenant ID: ten_hotel_B)              │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ • Staff A logs in $\rightarrow$ session.tenantId = 'ten_hotel_A'  │ • Staff B logs in $\rightarrow$ session.tenantId = 'ten_hotel_B'  │
│ • Database queries strictly append:           │ • Database queries strictly append:           │
│   `WHERE tenant_id = 'ten_hotel_A'`           │   `WHERE tenant_id = 'ten_hotel_B'`           │
│ • Staff A CANNOT see Hotel B's guests,        │ • Staff B CANNOT see Hotel A's guests,        │
│   rooms, revenue, or bills.                   │   rooms, revenue, or bills.                   │
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 6. Session Lifecycle & Security Enforcement

```
┌─────────────────────────────┬─────────────────────────────────────────────────────────────────────────────┐
│ SECURITY LAYER              │ IMPLEMENTATION STANDARD                                                     │
├─────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ 1. Token Type               │ Asymmetric Signed JWT (RS256)                                               │
│ 2. Storage Location          │ HttpOnly, Secure, SameSite=Strict Cookie (XSS Immune)                       │
│ 3. Access Token Expiry       │ 15 Minutes (Short-Lived)                                                    │
│ 4. Refresh Token Lifecycle   │ 7 Days with Automatic Refresh Token Rotation (RTR)                          │
│ 5. Session Invalidation      │ Disabling a staff user in `users` table immediately revokes API access      │
│ 6. IP & Device Pinning       │ Detects abrupt IP/User-Agent changes and forces re-authentication           │
└─────────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘
```
