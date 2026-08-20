# HotelOS Management SaaS — Unified Master System Flowchart

> **Document Type**: Master Visual Flowchart & Architecture Blueprint  
> **Status**: Final Production Architecture  
> **Design Principle**: Complete End-to-End Visibility (From Physical Walk-In to Database & Owner Dashboard)  

---

## 🌟 The Complete Unified Master Flowchart

```mermaid
flowchart TD
    %% ─────────────────────────────────────────────────────────────
    %% STAGE 1: FRONT-DESK PHYSICAL ENTRY
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_1 ["🏢 STAGE 1: FRONT-DESK RECEPTION (COUNTER INTERACTION)"]
        Guest["🚶 Walk-In Guest Arrives at Hotel Counter"] --> Desk["👩‍💼 Receptionist Front-Desk Terminal"]
        Desk --> FormInput["📝 Enter Guest Details:<br>• Name, Phone Number<br>• ID Type & Masked Last-4 Digits<br>• Select Room & Tariff"]
        FormInput --> AttachID["📷 Upload Photo / Scan of ID Proof"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 2: EDGE SECURITY & GATEWAYS
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_2 ["🛡️ STAGE 2: AWS SECURITY GATES & MIDDLEWARE"]
        AttachID -->|HTTPS / TLS 1.3| CF["Amazon CloudFront CDN + AWS WAF"]
        CF --> WAF_Check{"WAF Security Check<br>• DDoS Shield<br>• SQLi / XSS Filters<br>• Rate Limiter (30 req/min)"}
        
        WAF_Check -->|❌ Malicious / Spammer| Block403["⛔ Reject with HTTP 403 / 429"]
        WAF_Check -->|✅ Clean Request| ALB["Application Load Balancer (ALB)"]
        
        ALB --> AuthGuard{"🔐 App Security Middleware<br>• Verified JWT Session<br>• Role Capability Check<br>• Tenant Scoping (ABAC)"}
        AuthGuard -->|❌ Unauthorized| AuthFail["⛔ Reject: 401 / 403 Forbidden"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 3: APPLICATION LOGIC & STATE ENGINE
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_3 ["⚙️ STAGE 3: BUSINESS LOGIC & ENGINES (NODE.JS 22)"]
        AuthGuard -->|✅ Authorized| RoomFSM{"🏠 Room State Machine Check<br>Is Selected Room 'AVAILABLE'?"}
        
        RoomFSM -->|❌ Room Occupied/Dirty| RoomErr["⛔ Reject: Room is not available"]
        RoomFSM -->|✅ Room is Available| S3Upload["🔒 Amazon S3 Upload (Private Bucket)<br>Encrypt ID scan with AWS KMS CMK"]
        
        S3Upload --> LockRecord["🔒 Zero-Trust Record Locking<br>Stamp booking with locked_at = NOW()<br>(Staff cannot tamper with rate/bill)"]
        
        LockRecord --> BillRouter{"🧾 Select Billing Type"}
        
        BillRouter -->|GST Tax Invoice| GSTEngine["🔵 Indian GST Tax Engine<br>• SAC: 996311<br>• Integer Paise Math<br>• Intra-state: 50% CGST + 50% SGST<br>• Inter-state: 100% IGST"]
        BillRouter -->|Non-GST Bill| NonGSTEngine["🟢 Non-GST Bill Engine<br>• Clean Hospitality Folio<br>• Zero Tax Fields<br>• Net Room & Amenities Total"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 4: PERSISTENCE & DATABASE STORAGE (AWS RDS)
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_4 ["🗄️ STAGE 4: AWS RDS POSTGRESQL (MULTI-AZ PERSISTENCE)"]
        GSTEngine --> DB_Tx["⚡ Single Atomic SQL Transaction (Port 5432)"]
        NonGSTEngine --> DB_Tx
        
        DB_Tx --> T1[("guests table<br>(Masked ID Last-4)")]
        DB_Tx --> T2[("bookings table<br>(Status: CHECKED_IN, locked_at)")]
        DB_Tx --> T3[("rooms table<br>(Status: OCCUPIED)")]
        DB_Tx --> T4[("gst_invoices / non_gst_bills<br>(Separate Tables & Sequences)")]
        DB_Tx --> T5[("audit_logs table<br>(Append-only JSON Diff & IP)")]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 5: REAL-TIME BROADCAST & OPERATIONAL PULSE
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_5 ["📡 STAGE 5: REAL-TIME SYNC & OWNER SURVEILLANCE"]
        DB_Tx -->|Audit Event Emitted| SSE["📡 Server-Sent Events Broadcaster (/api/live)"]
        
        SSE --> Screen1["🖥️ Front Desk Screen<br>(Room marked RED - Occupied)"]
        SSE --> Screen2["📱 Housekeeping Mobile Board<br>(Knows occupied rooms)"]
        SSE --> Screen3["📊 Hotel Owner Remote Dashboard<br>(Live Occupancy % & Collection)"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 6: COUNTER PAYMENT & SETTLEMENT
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_6 ["💰 STAGE 6: COUNTER PAYMENT & SHIFT HANDOVER"]
        DB_Tx --> QRGen["📲 Generate Dynamic UPI QR Code<br>(Exact invoice amount embedded)"]
        QRGen --> PayMethod{"💳 Guest Payment Method at Counter"}
        
        PayMethod -->|Cash in Drawer| CashEntry["💵 Record Cash in Drawer"]
        PayMethod -->|Card Terminal| CardEntry["💳 Swipe on POS Card Machine"]
        PayMethod -->|Scan UPI QR| UpiEntry["📱 GPay / PhonePe / Paytm Scan"]
        
        CashEntry --> Settle["Invoice Status = PAID / Balance = ₹0.00"]
        CardEntry --> Settle
        UpiEntry --> Settle
        
        Settle --> ShiftClose["📋 End of 8-Hour Shift Handover<br>Calculate Expected Drawer Cash vs Actual Cash<br>Email Variance Snapshot to Hotel Owner"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 7: CHECKOUT & HOUSEKEEPING CYCLE
    %% ─────────────────────────────────────────────────────────────
    subgraph STAGE_7 ["🧹 STAGE 7: CHECKOUT & CLEANING LIFECYCLE"]
        Settle --> CheckOut["🚪 Guest Check-Out Completed"]
        CheckOut --> RoomDirty["Room status -> HOUSEKEEPING (Dirty)"]
        RoomDirty --> Cleaned["🧹 Staff cleans room & supervisor inspects"]
        Cleaned --> RoomReady["Room status -> AVAILABLE (Ready for new walk-in)"]
    end

    %% Styling
    classDef stageStyle fill:#f8fafc,stroke:#334155,stroke-width:2px,color:#0f172a;
    classDef gateStyle fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#1e3a8a;
    classDef dbStyle fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d;
    classDef alertStyle fill:#fef2f2,stroke:#dc2626,stroke-width:2px,color:#991b1b;
    classDef liveStyle fill:#faf5ff,stroke:#9333ea,stroke-width:2px,color:#581c87;

    class STAGE_1,STAGE_6,STAGE_7 stageStyle;
    class STAGE_2,STAGE_3 gateStyle;
    class STAGE_4 dbStyle;
    class STAGE_5 liveStyle;
    class Block403,AuthFail,RoomErr alertStyle;
```

---

## 🔍 Stage-by-Stage Operational Summary

```
┌─────────────────┬──────────────────────────────────┬───────────────────────────────────────────────────────────┐
│ STAGE           │ CORE ACTION                      │ HOW IT WORKS & SECURITY INVOLVED                          │
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 1. Front Desk   │ Walk-In Registration             │ Guest arrives physically; receptionist inputs details,   │
│                 │                                  │ masks ID to last-4, and selects an available room.        │
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 2. Security     │ Perimeter & Identity Defense     │ AWS WAF blocks bots/attacks; JWT session enforces         │
│                 │                                  │ server-side RBAC permissions and tenant isolation.        │
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 3. App Logic    │ State Machine & Record Locking   │ Verifies room is AVAILABLE; locks record immediately so  │
│                 │                                  │ receptionist cannot alter rates; routes GST vs Non-GST.   │
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 4. Database     │ AWS RDS PostgreSQL Commit        │ Atomic SQL transaction writes guest, locked booking,      │
│                 │                                  │ room OCCUPIED, separated invoice, and immutable audit.    │
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 5. Real-Time    │ SSE Operational Live Pulse       │ Server-Sent Events instantly update front-desk screens,  │
│                 │                                  │ housekeeping mobile app, and Owner surveillance dashboard.│
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 6. Payment      │ Counter Settlement & Shift End   │ Dynamic UPI QR, Cash, or Card swipe settles bill; shift   │
│                 │                                  │ drawer cash reconciliation emailed to Owner.              │
├─────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ 7. Checkout     │ Housekeeping Recycling           │ Checkout automatically marks room HOUSEKEEPING (dirty);   │
│                 │                                  │ cleaning supervisor inspects and resets room to AVAILABLE.│
└─────────────────┴──────────────────────────────────┴───────────────────────────────────────────────────────────┘
```
