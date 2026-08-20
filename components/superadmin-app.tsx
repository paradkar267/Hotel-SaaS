"use client";

import {
  Activity,
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Hotel,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { logoutAction } from "../app/actions/auth";

type Tenant = {
  id: string;
  name: string;
  created_at: string;
  properties: any[];
  users: any[];
  roomCount: number;
  occupiedCount: number;
  totalRevenuePaise: number;
  invoices?: any[];
  auditLogs?: any[];
};

type Metrics = {
  totalTenants: number;
  totalProperties: number;
  totalRooms: number;
  totalOccupied: number;
  totalRevenuePaise: number;
};

type PlatformData = { tenants: Tenant[]; metrics: Metrics; auditLogs: any[] };

type WizardStep = "tenant" | "property" | "rooms" | "admin" | "done";

export default function SuperAdminApp() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"dashboard" | "hotels" | "onboard" | "activity">("dashboard");
  const [toast, setToast] = useState("");

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await fetch("/api/superadmin", { cache: "no-store" });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json as PlatformData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const poll = setInterval(() => loadData(true), 30_000);
    return () => clearInterval(poll);
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  if (loading) {
    return (
      <div className="sa-loading">
        <LoaderCircle className="sa-spin" size={32} />
        <p>Loading platform data…</p>
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="sa-shell">
      {/* Sidebar */}
      <aside className="sa-sidebar">
        <div className="sa-sidebar-brand">
          <Building2 size={22} />
          <div>
            <strong>BizLeap</strong>
            <small>SaaS Platform</small>
          </div>
        </div>

        <nav className="sa-nav">
          <button className={view === "dashboard" ? "sa-nav-active" : ""} onClick={() => setView("dashboard")}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={view === "hotels" ? "sa-nav-active" : ""} onClick={() => setView("hotels")}>
            <Hotel size={18} /> Hotels
          </button>
          <button className={view === "activity" ? "sa-nav-active" : ""} onClick={() => setView("activity")}>
            <Activity size={18} /> Global Activity
          </button>
          <button className={view === "onboard" ? "sa-nav-active" : ""} onClick={() => setView("onboard")}>
            <Plus size={18} /> Onboard Hotel
          </button>
        </nav>

        <div className="sa-sidebar-footer">
          <button onClick={() => logoutAction()} className="sa-logout-btn">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="sa-main">
        <header className="sa-topbar">
          <div>
            <h1 className="sa-page-title">
              {view === "dashboard" && "Platform Dashboard"}
              {view === "hotels" && "All Hotels"}
              {view === "activity" && "Global Activity Logs"}
              {view === "onboard" && "Onboard New Hotel"}
            </h1>
            <p className="sa-page-sub">
              {view === "dashboard" && "Overview of all hotel tenants on the platform"}
              {view === "hotels" && "Manage and monitor individual hotel tenants"}
              {view === "activity" && "Live feed of all actions across the entire platform"}
              {view === "onboard" && "Set up a new hotel from scratch"}
            </p>
          </div>
          <button className="sa-refresh-btn" onClick={() => loadData()} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "sa-spin" : ""} /> Refresh
          </button>
        </header>

        {toast && (
          <div className="sa-toast">
            <CheckCircle2 size={16} /> {toast}
            <button onClick={() => setToast("")}><X size={14} /></button>
          </div>
        )}

        {view === "dashboard" && <DashboardView metrics={m!} tenants={data?.tenants ?? []} />}
        {view === "hotels" && <HotelsView tenants={data?.tenants ?? []} onRefresh={() => loadData()} showToast={showToast} />}
        {view === "activity" && <ActivityView auditLogs={data?.auditLogs ?? []} tenants={data?.tenants ?? []} />}
        {view === "onboard" && <OnboardWizard onComplete={() => { loadData(); setView("hotels"); }} showToast={showToast} />}
      </main>
    </div>
  );
}

/* ── Dashboard View ── */
function DashboardView({ metrics, tenants }: { metrics: Metrics; tenants: Tenant[] }) {
  const formatInr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="sa-content">
      <div className="sa-metrics-grid">
        <div className="sa-metric-card sa-metric-blue">
          <div className="sa-metric-icon"><Hotel size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{metrics.totalTenants}</span>
            <span className="sa-metric-label">Hotel Tenants</span>
          </div>
        </div>
        <div className="sa-metric-card sa-metric-emerald">
          <div className="sa-metric-icon"><Building2 size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{metrics.totalProperties}</span>
            <span className="sa-metric-label">Properties</span>
          </div>
        </div>
        <div className="sa-metric-card sa-metric-violet">
          <div className="sa-metric-icon"><BedDouble size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{metrics.totalRooms}</span>
            <span className="sa-metric-label">Total Rooms</span>
          </div>
        </div>
        <div className="sa-metric-card sa-metric-amber">
          <div className="sa-metric-icon"><CircleDollarSign size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{formatInr(metrics.totalRevenuePaise)}</span>
            <span className="sa-metric-label">Total Revenue</span>
          </div>
        </div>
      </div>

      <div className="sa-section">
        <h2>Recent Hotels</h2>
        {tenants.length === 0 ? (
          <div className="sa-empty">
            <Hotel size={40} strokeWidth={1.2} />
            <p>No hotels onboarded yet.</p>
            <small>Use "Onboard Hotel" to set up your first hotel.</small>
          </div>
        ) : (
          <div className="sa-tenant-list">
            {tenants.slice(0, 5).map((t) => (
              <div key={t.id} className="sa-tenant-card">
                <div className="sa-tenant-header">
                  <Hotel size={18} />
                  <strong>{t.name}</strong>
                  <span className="sa-badge">{t.properties.length} {t.properties.length === 1 ? "property" : "properties"}</span>
                </div>
                <div className="sa-tenant-stats">
                  <span><BedDouble size={14} /> {t.roomCount} rooms</span>
                  <span><Activity size={14} /> {t.occupiedCount} occupied</span>
                  <span><CircleDollarSign size={14} /> ₹{(t.totalRevenuePaise / 100).toLocaleString("en-IN")}</span>
                  <span><Users size={14} /> {t.users.length} users</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Hotels View ── */
function HotelsView({ tenants, onRefresh, showToast }: { tenants: Tenant[]; onRefresh: () => void; showToast: (m: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleTenant = async (tenantId: string, isActive: boolean) => {
    await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_tenant", tenantId, isActive }),
    });
    showToast(isActive ? "Tenant enabled." : "Tenant disabled.");
    onRefresh();
  };

  if (tenants.length === 0) {
    return (
      <div className="sa-content">
        <div className="sa-empty">
          <Hotel size={40} strokeWidth={1.2} />
          <p>No hotels onboarded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-content">
      <div className="sa-tenant-list">
        {tenants.map((t) => (
          <div key={t.id} className="sa-tenant-card">
            <div className="sa-tenant-header" onClick={() => setExpanded(expanded === t.id ? null : t.id)} style={{ cursor: "pointer" }}>
              <ChevronRight size={16} className={`sa-chevron ${expanded === t.id ? "sa-chevron-open" : ""}`} />
              <Hotel size={18} />
              <strong>{t.name}</strong>
              <span className="sa-badge">{t.roomCount} rooms</span>
              <span className="sa-badge sa-badge-green">₹{(t.totalRevenuePaise / 100).toLocaleString("en-IN")}</span>
            </div>

            {expanded === t.id && (
              <div className="sa-tenant-details">
                <h4>Properties</h4>
                {t.properties.map((p: any) => (
                  <div key={p.id} className="sa-detail-row">
                    <Building2 size={14} />
                    <span><strong>{p.name}</strong> — {p.city || "N/A"}, {p.state}</span>
                    {p.gstin && <span className="sa-badge">GSTIN: {p.gstin}</span>}
                  </div>
                ))}

                <h4>Users</h4>
                {t.users.map((u: any) => (
                  <div key={u.id} className="sa-detail-row">
                    <Users size={14} />
                    <span><strong>{u.name}</strong> ({u.email})</span>
                    <span className={`sa-badge ${u.role === "ADMIN" ? "sa-badge-blue" : ""}`}>{u.role}</span>
                    <span className={`sa-badge ${u.is_active ? "sa-badge-green" : "sa-badge-red"}`}>{u.is_active ? "Active" : "Disabled"}</span>
                  </div>
                ))}

                <h4>Recent Billing & Invoices</h4>
                {t.invoices && t.invoices.length > 0 ? (
                  <div className="sa-billing-history">
                    {t.invoices.slice(0, 10).map((inv: any) => (
                      <div key={inv.id} className="sa-invoice-row">
                        <div className="sa-invoice-header">
                          <strong>{inv.invoice_number}</strong>
                          <span className={`sa-badge ${inv.status === "PAID" ? "sa-badge-green" : inv.status === "VOID" ? "sa-badge-red" : "sa-badge-amber"}`}>
                            {inv.status}
                          </span>
                        </div>
                        <div className="sa-invoice-details">
                          <small>Date: {new Date(inv.issued_at).toLocaleDateString()}</small>
                          <small>Room: {inv.bookings?.rooms?.room_number || "N/A"}</small>
                          <small>Total: ₹{(inv.total_paise / 100).toLocaleString("en-IN")}</small>
                          {inv.paidPaise > 0 && <small className="sa-paid-text">Paid: ₹{(inv.paidPaise / 100).toLocaleString("en-IN")}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="sa-empty-text" style={{ paddingLeft: 12, fontSize: '0.85rem', color: '#64748b' }}>No billing history found.</p>
                )}

                <div className="sa-detail-actions">
                  <button className="sa-btn-danger" onClick={() => toggleTenant(t.id, false)}>Disable All Users</button>
                  <button className="sa-btn-success" onClick={() => toggleTenant(t.id, true)}>Enable All Users</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Onboard Wizard ── */
function OnboardWizard({ onComplete, showToast }: { onComplete: () => void; showToast: (m: string) => void }) {
  const [step, setStep] = useState<WizardStep>("tenant");
  const [busy, setBusy] = useState(false);

  // Collected data
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");

  // Forms
  const [tenantName, setTenantName] = useState("");
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propCity, setPropCity] = useState("");
  const [propState, setPropState] = useState("Maharashtra");
  const [propPostal, setPropPostal] = useState("");
  const [propGstin, setPropGstin] = useState("");
  const [propGstBps, setPropGstBps] = useState(1200);

  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [logoUrl, setLogoUrl] = useState("");

  const [rooms, setRooms] = useState([{ roomNumber: "", floor: "1", roomType: "Standard", baseRate: "2500" }]);

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");

  const [error, setError] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setLogoUrl(data?.url || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const api = async (body: any): Promise<any> => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const stepCreateTenant = async () => {
    if (!tenantName.trim()) { setError("Enter a hotel business name."); return; }
    const result = await api({ action: "create_tenant", name: tenantName });
    if (result) {
      setTenantId(result.tenantId);
      showToast(result.message);
      setStep("property");
    }
  };

  const stepCreateProperty = async () => {
    if (!propName.trim() || !propState.trim()) { setError("Hotel name and state are required."); return; }
    const result = await api({
      action: "create_property",
      tenantId,
      name: propName,
      address: propAddress,
      city: propCity,
      state: propState,
      postalCode: propPostal,
      gstin: propGstin,
      defaultGstBps: propGstBps,
      contactPhone,
      contactEmail,
      upiId: upiId || "hotelos@upi",
      upiName: upiName || "HotelOS",
      checkInTime,
      checkOutTime,
      logoUrl,
    });
    if (result) {
      setPropertyId(result.propertyId);
      showToast(result.message);
      setStep("rooms");
    }
  };

  const stepCreateRooms = async () => {
    const validRooms = rooms.filter((r) => r.roomNumber.trim());
    if (validRooms.length === 0) { setError("Add at least one room."); return; }
    const result = await api({
      action: "create_rooms",
      tenantId,
      propertyId,
      rooms: validRooms.map((r) => ({
        roomNumber: r.roomNumber,
        floor: r.floor,
        roomType: r.roomType,
        baseRatePaise: Math.round(Number(r.baseRate) * 100),
      })),
    });
    if (result) {
      showToast(result.message);
      setStep("admin");
    }
  };

  const stepCreateAdmin = async () => {
    if (!adminName.trim() || !adminEmail.trim() || !adminPass.trim()) { setError("All fields are required."); return; }
    if (adminPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    const result = await api({
      action: "create_hotel_admin",
      tenantId,
      propertyId,
      name: adminName,
      email: adminEmail,
      password: adminPass,
    });
    if (result) {
      showToast(result.message);
      setStep("done");
    }
  };

  const addRoom = () => setRooms([...rooms, { roomNumber: "", floor: "1", roomType: "Standard", baseRate: "2500" }]);
  const removeRoom = (i: number) => setRooms(rooms.filter((_, idx) => idx !== i));
  const updateRoom = (i: number, field: string, value: string) => {
    const updated = [...rooms];
    (updated[i] as any)[field] = value;
    setRooms(updated);
  };

  const steps: { key: WizardStep; label: string }[] = [
    { key: "tenant", label: "Business" },
    { key: "property", label: "Property" },
    { key: "rooms", label: "Rooms" },
    { key: "admin", label: "Owner" },
    { key: "done", label: "Done" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="sa-content">
      {/* Step indicator */}
      <div className="sa-steps">
        {steps.map((s, i) => (
          <div key={s.key} className={`sa-step ${i < currentIdx ? "sa-step-done" : ""} ${i === currentIdx ? "sa-step-active" : ""}`}>
            <div className="sa-step-circle">{i < currentIdx ? <CheckCircle2 size={16} /> : i + 1}</div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Step 1: Tenant */}
      {step === "tenant" && (
        <div className="sa-wizard-card">
          <h2>Hotel Business Name</h2>
          <p>This is the legal entity or brand name of the hotel business.</p>
          <div className="sa-field">
            <label>Business Name</label>
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="e.g. The Grand Palace Hotels" />
          </div>
          <div className="sa-field">
            <label>Brand Logo (Optional)</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ flex: 1 }} />
              {uploadingLogo && <LoaderCircle className="sa-spin" size={16} />}
            </div>
            {logoUrl && <div style={{ marginTop: "10px" }}><img src={logoUrl} alt="Logo Preview" style={{ height: "40px", objectFit: "contain", borderRadius: "4px" }} /></div>}
          </div>
          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateTenant} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <ArrowRight size={16} />} Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Property */}
      {step === "property" && (
        <div className="sa-wizard-card">
          <h2>Property Details</h2>
          <p>Configure the hotel property — name, address, and GST settings.</p>
          <div className="sa-field-grid">
            <div className="sa-field sa-field-full">
              <label>Hotel Name *</label>
              <input value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="e.g. Grand Palace Mumbai" />
            </div>
            <div className="sa-field sa-field-full">
              <label>Address</label>
              <input value={propAddress} onChange={(e) => setPropAddress(e.target.value)} placeholder="Street address" />
            </div>
            <div className="sa-field">
              <label>City</label>
              <input value={propCity} onChange={(e) => setPropCity(e.target.value)} placeholder="Mumbai" />
            </div>
            <div className="sa-field">
              <label>State *</label>
              <input value={propState} onChange={(e) => setPropState(e.target.value)} placeholder="Maharashtra" />
            </div>
            <div className="sa-field">
              <label>Postal Code</label>
              <input value={propPostal} onChange={(e) => setPropPostal(e.target.value)} placeholder="400001" />
            </div>
            <div className="sa-field">
              <label>GSTIN</label>
              <input value={propGstin} onChange={(e) => setPropGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="sa-field">
              <label>Default GST Rate</label>
              <select value={propGstBps} onChange={(e) => setPropGstBps(Number(e.target.value))}>
                <option value={0}>No GST</option>
                <option value={500}>5%</option>
                <option value={1200}>12%</option>
                <option value={1800}>18%</option>
              </select>
            </div>
            
            <div className="sa-field-full" style={{ marginTop: 12, marginBottom: 4, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>Contact & Billing Information</h4>
            </div>
            <div className="sa-field">
              <label>Contact Phone</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="sa-field">
              <label>Contact Email</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@grandpalace.com" type="email" />
            </div>
            <div className="sa-field">
              <label>UPI ID (For Guest Payments) *</label>
              <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="grandpalace@upi" />
            </div>
            <div className="sa-field">
              <label>UPI Receiver Name *</label>
              <input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Grand Palace Hotels" />
            </div>
            
            <div className="sa-field-full" style={{ marginTop: 12, marginBottom: 4, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>Hotel Policies</h4>
            </div>
            <div className="sa-field">
              <label>Default Check-in Time</label>
              <input value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} placeholder="14:00" type="time" />
            </div>
            <div className="sa-field">
              <label>Default Check-out Time</label>
              <input value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} placeholder="11:00" type="time" />
            </div>
          </div>
          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateProperty} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <ArrowRight size={16} />} Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Rooms */}
      {step === "rooms" && (
        <div className="sa-wizard-card">
          <h2>Room Setup</h2>
          <p>Add all the rooms for this property.</p>

          <div className="sa-rooms-table">
            <div className="sa-rooms-header">
              <span>Room No.</span>
              <span>Floor</span>
              <span>Type</span>
              <span>Nightly Rate (₹)</span>
              <span></span>
            </div>
            {rooms.map((r, i) => (
              <div key={i} className="sa-rooms-row">
                <input value={r.roomNumber} onChange={(e) => updateRoom(i, "roomNumber", e.target.value)} placeholder="101" />
                <input value={r.floor} onChange={(e) => updateRoom(i, "floor", e.target.value)} placeholder="1" />
                <select value={r.roomType} onChange={(e) => updateRoom(i, "roomType", e.target.value)}>
                  <option>Standard</option>
                  <option>Deluxe</option>
                  <option>Suite</option>
                  <option>Premium</option>
                </select>
                <input value={r.baseRate} onChange={(e) => updateRoom(i, "baseRate", e.target.value)} placeholder="2500" type="number" />
                <button onClick={() => removeRoom(i)} className="sa-btn-icon" title="Remove"><X size={14} /></button>
              </div>
            ))}
          </div>

          <button className="sa-btn-secondary" onClick={addRoom}><Plus size={14} /> Add Room</button>

          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateRooms} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <ArrowRight size={16} />} Next
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Admin */}
      {step === "admin" && (
        <div className="sa-wizard-card">
          <h2>Hotel Owner Account</h2>
          <p>Create login credentials for the hotel owner/admin. They will use these to access their dashboard.</p>
          <div className="sa-field-grid">
            <div className="sa-field sa-field-full">
              <label>Owner Name *</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="sa-field">
              <label>Email *</label>
              <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="owner@hotel.com" type="email" />
            </div>
            <div className="sa-field">
              <label>Password *</label>
              <input value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Min 6 characters" type="password" />
            </div>
          </div>
          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateAdmin} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <CheckCircle2 size={16} />} Create & Finish
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && (
        <div className="sa-wizard-card sa-done-card">
          <div className="sa-done-icon"><CheckCircle2 size={56} /></div>
          <h2>Hotel Onboarded Successfully!</h2>
          <p>The hotel owner can now log in with their credentials and start using the dashboard immediately.</p>
          <div className="sa-done-summary">
            <div><strong>Business:</strong> {tenantName}</div>
            <div><strong>Property:</strong> {propName}</div>
            <div><strong>Rooms:</strong> {rooms.filter((r) => r.roomNumber).length}</div>
            <div><strong>Admin:</strong> {adminEmail}</div>
          </div>
          <button className="sa-btn-primary" onClick={onComplete}>
            <ArrowRight size={16} /> Go to Hotels
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Activity View ── */
function ActivityView({ auditLogs, tenants }: { auditLogs: any[]; tenants: Tenant[] }) {
  if (auditLogs.length === 0) {
    return (
      <div className="sa-content">
        <div className="sa-empty">
          <Activity size={40} strokeWidth={1.2} />
          <p>No activity logged yet.</p>
        </div>
      </div>
    );
  }

  const formatDateTime = (val: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(val));
  const actionLabel = (val: string) => val.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).replace("Admin ", "");
  
  return (
    <div className="sa-content">
      <div className="sa-section">
        <h2>Global Activity Feed</h2>
        <div className="sa-tenant-card" style={{ padding: 0 }}>
          <div className="table-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 20px", color: "#64748b", fontWeight: 600, fontSize: "13px" }}>Tenant / Hotel</th>
                  <th style={{ padding: "14px 20px", color: "#64748b", fontWeight: 600, fontSize: "13px" }}>Action</th>
                  <th style={{ padding: "14px 20px", color: "#64748b", fontWeight: 600, fontSize: "13px" }}>User</th>
                  <th style={{ padding: "14px 20px", color: "#64748b", fontWeight: 600, fontSize: "13px" }}>Reason</th>
                  <th style={{ padding: "14px 20px", color: "#64748b", fontWeight: 600, fontSize: "13px" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => {
                  const t = tenants.find((x) => x.id === log.tenant_id);
                  const colors = ["sa-badge-blue", "sa-badge-green", "sa-badge-amber", "sa-badge-violet", "sa-badge-pink", "sa-badge-cyan"];
                  let hash = 0;
                  const idStr = t?.id || log.tenant_id || "unknown";
                  for (let i = 0; i < idStr.length; i++) hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
                  const badgeColor = colors[Math.abs(hash) % colors.length];

                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 20px" }}><span className={`sa-badge ${badgeColor}`}>{t?.name || "Unknown"}</span></td>
                      <td style={{ padding: "14px 20px" }}><span className="sa-badge">{actionLabel(log.action)}</span></td>
                      <td style={{ padding: "14px 20px", color: "#475569" }}>{log.actor_email}</td>
                      <td style={{ padding: "14px 20px", color: "#475569" }}>{log.reason || "System Action"}</td>
                      <td style={{ padding: "14px 20px", color: "#94a3b8", fontSize: "13px" }}>{formatDateTime(log.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
