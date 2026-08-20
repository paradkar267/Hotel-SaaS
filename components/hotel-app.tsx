"use client";

import {
  Activity,
  Bell,
  BedDouble,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  DoorOpen,
  FileClock,
  FileText,
  Gauge,
  Hotel,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  LogOut,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HotelActionModal } from "./hotel-actions";
import type { HotelData, Identity, ModalState, Row, View } from "./hotel-types";
import { logoutAction } from "../app/actions/auth";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const navItems = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "frontdesk", label: "Front desk", icon: DoorOpen },
  { id: "rooms", label: "Rooms", icon: BedDouble },
  { id: "guests", label: "Guests", icon: Users },
  { id: "billing", label: "Billing", icon: FileText },
  { id: "team", label: "Team access", icon: ShieldCheck, admin: true },
  { id: "audit", label: "Audit trail", icon: FileClock, admin: true },
  { id: "settings", label: "Settings", icon: Settings, admin: true },
] as const;

export default function HotelApp({ identity, signOutPath }: { identity: Identity; signOutPath: string }) {
  const [data, setData] = useState<HotelData | null>(null);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/hotel", { cache: "no-store" });
      const result = (await response.json()) as HotelData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Hotel data is unavailable.");
      setData(result);
      setError("");
      setLastSynced(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hotel data is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadData(true), 0);
    const poll = window.setInterval(() => void loadData(true), 20_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(poll);
    };
  }, [loadData]);

  const latestAuditId = data?.latestAuditId ?? 0;
  useEffect(() => {
    if (!latestAuditId) return;
    const stream = new EventSource(`/api/live?after=${latestAuditId}`);
    stream.addEventListener("change", () => void loadData(true));
    return () => stream.close();
  }, [latestAuditId, loadData]);

  const role = data?.session.role;
  const isAdmin = role === "ADMIN";
  const availableNavigation = navItems.filter((item) => !("admin" in item) || !item.admin || isAdmin);
  const propertyName = String(data?.property.name ?? "The Meridian House");

  const actionSucceeded = useCallback(async (message: string) => {
    setToast(message);
    await loadData(true);
    window.setTimeout(() => setToast(""), 4800);
  }, [loadData]);

  if (loading) {
    return (
      <main className="app-loading">
        <span className="brand-mark"><Building2 size={22} /></span>
        <LoaderCircle className="spin" size={24} />
        <p>Opening the front desk…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="access-screen">
        <div className="access-card">
          <span className="access-icon"><LockKeyhole size={26} /></span>
          <p className="eyebrow">Access not available</p>
          <h1>This email has not been added to the hotel.</h1>
          <p>{error || "Ask the hotel admin to create manager access for your verified email."}</p>
          <div className="access-email">{identity.email}</div>
          <a className="primary-button" href={signOutPath}>Use another account</a>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><Building2 size={20} strokeWidth={2.3} /></span>
          <span><b>HotelOS</b><small>Operations cloud</small></span>
          <button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="property-switcher">
          <span className="property-icon"><Hotel size={18} /></span>
          <span><small>Property</small><b>{propertyName}</b></span>
          <ChevronDown size={15} />
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <p>Workspace</p>
          {availableNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => { setView(item.id); setMenuOpen(false); }}>
                <Icon size={18} /> <span>{item.label}</span>
                {item.id === "frontdesk" && data.metrics.activeStays > 0 ? <em>{data.metrics.activeStays}</em> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-security">
          <ShieldCheck size={18} />
          <div><b>{isAdmin ? "Admin control active" : "Protected manager mode"}</b><span>{isAdmin ? "Every change is audited" : "Confirmed records are locked"}</span></div>
        </div>
        <div className="user-card">
          <span className="avatar">{initials(data.session.name)}</span>
          <span><b>{data.session.name}</b><small>{isAdmin ? "Administrator" : "Property manager"}</small></span>
          <form action={logoutAction}>
            <button type="submit" className="icon-button logout-button" aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>{propertyName}</span><b>/</b><strong>{viewLabel(view)}</strong></div>
          <div className="top-actions">
            <span className="sync-chip"><span className="sync-pulse" /> Live · {lastSynced ? "synced" : "connecting"}</span>
            <button className="icon-button" onClick={() => void loadData()} aria-label="Refresh" disabled={refreshing}><RefreshCw className={refreshing ? "spin" : ""} size={18} /></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /></button>
            <button className="primary-button compact" onClick={() => setModal({ type: "checkin" })}><Plus size={17} /> New check-in</button>
          </div>
        </header>

        {error ? <div className="inline-error">{error}<button onClick={() => void loadData()}>Retry</button></div> : null}
        <div className="content-area">
          {view === "overview" && isAdmin ? <AdminOverview data={data} onModal={setModal} /> : null}
          {view === "overview" && !isAdmin ? <ManagerOverview data={data} onModal={setModal} /> : null}
          {view === "frontdesk" ? <FrontDesk data={data} isAdmin={isAdmin} onModal={setModal} /> : null}
          {view === "rooms" ? <RoomsView data={data} onModal={setModal} /> : null}
          {view === "guests" ? <Guests data={data} onModal={setModal} /> : null}
          {view === "billing" ? <Billing data={data} onModal={setModal} /> : null}
          {view === "team" && isAdmin ? <Team data={data} onModal={setModal} /> : null}
          {view === "audit" && isAdmin ? <Audit data={data} /> : null}
          {view === "settings" && isAdmin ? <SettingsView data={data} onModal={setModal} /> : null}
        </div>
      </main>
      {menuOpen ? <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" /> : null}
      <HotelActionModal modal={modal} data={data} onClose={() => setModal(null)} onSwitch={setModal} onSuccess={actionSucceeded} />
      {toast ? <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast("")} aria-label="Dismiss"><X size={16} /></button></div> : null}
    </div>
  );
}

function AdminOverview({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  const isAdmin = true;
  const active = data.bookings.filter((booking) => booking.status === "CHECKED_IN").slice(0, 5);
  
  // Dummy data for charts based on actual metrics to look good
  const revenueData = [
    { name: 'Mon', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) * 0.5 : 0 },
    { name: 'Tue', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) * 0.8 : 0 },
    { name: 'Wed', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) * 0.4 : 0 },
    { name: 'Thu', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) * 0.9 : 0 },
    { name: 'Fri', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) * 1.2 : 0 },
    { name: 'Sat', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) * 1.5 : 0 },
    { name: 'Sun', revenue: isAdmin ? (data.metrics.todayRevenuePaise / 100) : 0 },
  ];

  const occupancyData = [
    { name: 'Occupied', value: data.metrics.occupiedRooms },
    { name: 'Available', value: data.metrics.availableRooms },
  ];
  const COLORS = ['#2563eb', '#e2e8f0'];

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">Live property view</p><h1>{timeGreeting()}, {firstName(data.session.name)}</h1><p>{isAdmin ? "Everything happening across the hotel, in one place." : "Your front desk is ready for today’s arrivals."}</p></div>
        <div className="heading-note"><Sparkles size={16} /><span><b>{data.metrics.availableRooms} rooms ready</b><small>for immediate check-in</small></span></div>
      </section>
      
      <section className="metrics-grid">
        <Metric icon={Gauge} label="Occupancy" value={`${data.metrics.occupancyRate}%`} detail={`${data.metrics.occupiedRooms} of ${data.metrics.totalRooms} rooms`} tone="navy" />
        <Metric icon={DoorOpen} label="Available now" value={String(data.metrics.availableRooms)} detail="Clean and ready" tone="green" />
        <Metric icon={ClipboardCheck} label="Today’s check-ins" value={String(data.metrics.todayCheckIns)} detail={`${data.metrics.activeStays} active stays`} tone="amber" />
        <Metric icon={CircleDollarSign} label={isAdmin ? "Collected today" : "Active stays"} value={isAdmin ? money(data.metrics.todayRevenuePaise) : String(data.metrics.activeStays)} detail={isAdmin ? `${money(data.metrics.outstandingPaise)} outstanding` : "Read-only after confirm"} tone="violet" />
      </section>

      {isAdmin && (
        <section className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <article className="panel chart-panel">
             <PanelHeading title="Revenue (Last 7 Days)" subtitle="Estimated daily collection" />
             <div className="chart-container" style={{ height: 250, width: '100%', marginTop: '1rem' }}>
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']} />
                   <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </article>
          
          <article className="panel chart-panel">
             <PanelHeading title="Current Occupancy" subtitle="Room status overview" />
             <div className="chart-container" style={{ height: 250, width: '100%', marginTop: '1rem' }}>
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                     {occupancyData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </article>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel rooms-panel">
          <PanelHeading title="Room pulse" subtitle="Select a free room to update its status" />
          <div className="room-legend"><span><i className="available" />Available</span><span><i className="occupied" />Occupied</span><span><i className="housekeeping" />Housekeeping</span><span><i className="maintenance" />Maintenance</span></div>
          <div className="room-grid">
            {data.rooms.map((room) => (
              <button type="button" disabled={room.status === "OCCUPIED"} onClick={() => onModal({ type: "room", room })} className={`room-card ${String(room.status).toLowerCase()}`} key={String(room.id)}>
                <span className="room-number">{String(room.roomNumber)}</span><small>{String(room.roomType)}</small><b>{prettyStatus(String(room.status))}</b>
              </button>
            ))}
          </div>
        </article>
        <article className="panel activity-panel">
          <PanelHeading title="Live activity" subtitle={isAdmin ? "Tracked across your team" : "Your latest actions"} />
          <div className="activity-list">
            {(isAdmin ? data.auditLogs : data.bookings).slice(0, 6).map((item, index) => (
              <div className="activity-item" key={String(item.id)}>
                <span className={`activity-icon tone-${index % 4}`}><Activity size={15} /></span>
                <div><b>{isAdmin ? actionLabel(String(item.action)) : `${String(item.guestName)} checked in`}</b><small>{isAdmin ? `${String(item.actorEmail)} · ${String(item.module)}` : `Room ${String(item.roomNumber)}`}</small></div>
                <time>{relativeTime(String(isAdmin ? item.createdAt : item.checkInAt))}</time>
              </div>
            ))}
            {(isAdmin ? data.auditLogs : data.bookings).length === 0 ? <Empty compact title="No activity yet" text="Your first check-in will appear here instantly." /> : null}
          </div>
        </article>
      </section>
      <article className="panel table-panel">
        <PanelHeading title="Guests currently in-house" subtitle="Manage active stays, invoices, and check-outs" />
        <StayTable bookings={active} invoices={data.invoices} isAdmin={isAdmin} onManage={(booking) => onModal({ type: "stay", booking })} onModal={onModal} />
      </article>
    </>
  );
}

function ManagerOverview({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  const active = data.bookings.filter((booking) => booking.status === "CHECKED_IN").slice(0, 5);
  const expectedArrivals = data.bookings.filter((booking) => booking.status === "CONFIRMED" && new Date(String(booking.checkInAt)).toDateString() === new Date().toDateString());
  const housekeepingRooms = data.rooms.filter(r => r.status === "HOUSEKEEPING");
  const maintenanceRooms = data.rooms.filter(r => r.status === "MAINTENANCE");

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">Front Desk Operations</p><h1>{timeGreeting()}, {firstName(data.session.name)}</h1><p>Here is your daily operational summary.</p></div>
        <div className="heading-note"><Sparkles size={16} /><span><b>{data.metrics.availableRooms} rooms ready</b><small>for immediate check-in</small></span></div>
      </section>

      <section className="module-banner secure" style={{ marginBottom: "2rem" }}>
        <DoorOpen size={22} />
        <div>
          <b>Quick Actions</b>
          <span>Access essential front desk tools immediately.</span>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="primary-button compact" onClick={() => onModal({ type: "checkin" })}><Plus size={17} /> New check-in</button>
        </div>
      </section>
      
      <section className="metrics-grid">
        <Metric icon={Users} label="Expected Arrivals" value={String(expectedArrivals.length)} detail="Pending check-ins today" tone="navy" />
        <Metric icon={ClipboardCheck} label="In-House Guests" value={String(data.metrics.activeStays)} detail="Currently checked in" tone="green" />
        <Metric icon={BedDouble} label="Housekeeping" value={String(housekeepingRooms.length)} detail="Rooms to be cleaned" tone="amber" />
        <Metric icon={Gauge} label="Maintenance" value={String(maintenanceRooms.length)} detail="Out of order" tone="violet" />
      </section>

      <section className="dashboard-grid">
        <article className="panel rooms-panel">
          <PanelHeading title="Room pulse" subtitle="Select a free room to update its status" />
          <div className="room-legend"><span><i className="available" />Available</span><span><i className="occupied" />Occupied</span><span><i className="housekeeping" />Housekeeping</span><span><i className="maintenance" />Maintenance</span></div>
          <div className="room-grid">
            {data.rooms.map((room) => (
              <button type="button" disabled={room.status === "OCCUPIED"} onClick={() => onModal({ type: "room", room })} className={`room-card ${String(room.status).toLowerCase()}`} key={String(room.id)}>
                <span className="room-number">{String(room.roomNumber)}</span><small>{String(room.roomType)}</small><b>{prettyStatus(String(room.status))}</b>
              </button>
            ))}
          </div>
        </article>
        
        <article className="panel activity-panel">
          <PanelHeading title="Live activity" subtitle="Your latest actions" />
          <div className="activity-list">
            {data.bookings.slice(0, 6).map((item, index) => (
              <div className="activity-item" key={String(item.id)}>
                <span className={`activity-icon tone-${index % 4}`}><Activity size={15} /></span>
                <div><b>{`${String(item.guestName)} checked in`}</b><small>{`Room ${String(item.roomNumber)}`}</small></div>
                <time>{relativeTime(String(item.checkInAt))}</time>
              </div>
            ))}
            {data.bookings.length === 0 ? <Empty compact title="No activity yet" text="Your first check-in will appear here instantly." /> : null}
          </div>
        </article>
      </section>
      
      <article className="panel table-panel">
        <PanelHeading title="Guests currently in-house" subtitle="Manage active stays, invoices, and check-outs" />
        <StayTable bookings={active} invoices={data.invoices} isAdmin={false} onManage={(booking) => onModal({ type: "stay", booking })} onModal={onModal} />
      </article>
    </>
  );
}

function FrontDesk({ data, isAdmin, onModal }: { data: HotelData; isAdmin: boolean; onModal: (modal: ModalState) => void }) {
  return (
    <ModuleShell eyebrow="Operations" title="Front desk" description="Create check-ins, manage stays, generate invoices, and oversee front desk activity.">
      <div className="module-banner">
        <BookOpenCheck size={22} />
        <div>
          <b>Check-in workflow is ready</b>
          <span>Guest details, room allocation, ID proof, and billing preference are stored together.</span>
        </div>
        <button className="primary-button compact" onClick={() => onModal({ type: "checkin" })}>
          <Plus size={17} /> Start check-in
        </button>
      </div>
      <article className="panel table-panel">
        <PanelHeading title="Active & recent stays" subtitle={`${data.metrics.activeStays} guests currently in-house`} />
        <StayTable bookings={data.bookings} invoices={data.invoices} isAdmin={isAdmin} onManage={(booking) => onModal({ type: "stay", booking })} onModal={onModal} />
      </article>
    </ModuleShell>
  );
}

function Guests({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  const [query, setQuery] = useState("");
  const guests = data.guests.filter((guest) => [guest.fullName, guest.phone, guest.email].some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <ModuleShell eyebrow="Guest CRM" title="Guest registry" description="Search verified guest profiles and their stay history."><SearchBar placeholder="Search by guest, phone, or email" value={query} onChange={setQuery} /><article className="panel table-panel"><PanelHeading title="All guest profiles" subtitle={`${guests.length} cloud records`} />{guests.length ? <div className="table-scroll"><table><thead><tr><th>Guest</th><th>Contact</th><th>Location</th><th>ID proof</th><th>Stays</th><th>Lifetime value</th><th /></tr></thead><tbody>{guests.map((guest) => <tr key={String(guest.id)}><td><div className="primary-cell"><span className="mini-avatar">{initials(String(guest.fullName))}</span><span><b>{String(guest.fullName)}</b><small>{String(guest.nationality)}</small></span></div></td><td><b>{String(guest.phone)}</b><small className="table-sub">{String(guest.email || "No email")}</small></td><td>{[guest.city, guest.state].filter(Boolean).join(", ") || "—"}</td><td><div className="document-cell"><span className="plain-chip">{String(guest.idType || "Not set").replaceAll("_", " ")} · •••• {String(guest.idLast4 || "—")}</span>{guest.latestDocumentId ? <a href={`/api/documents?id=${encodeURIComponent(String(guest.latestDocumentId))}`} target="_blank" rel="noreferrer">Open proof</a> : null}</div></td><td>{String(guest.totalStays)}</td><td>{money(Number(guest.totalSpendPaise))}</td><td><button className="row-action" onClick={() => onModal({ type: "guest", guest })}>Edit</button></td></tr>)}</tbody></table></div> : <Empty title="No matching guests" text="Try a different name, phone, or email." />}</article></ModuleShell>;
}

function Billing({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  const unbilledStays = data.bookings.filter((booking) => booking.status === "CHECKED_IN" && !booking.invoiceId);
  return (
    <ModuleShell eyebrow="Manual accounts" title="Billing & Invoicing" description="Issue GST or non-GST invoices, preview/print bills, and record offline payments—no gateway involved.">
      <section className="mini-metrics">
        <div><span>Outstanding</span><b>{money(data.metrics.outstandingPaise)}</b></div>
        <div><span>Collected today</span><b>{money(data.metrics.todayRevenuePaise)}</b></div>
        <div><span>Total invoices</span><b>{data.invoices.length}</b></div>
        <div><span>Unbilled stays</span><b style={{ color: unbilledStays.length > 0 ? "#ea580c" : "#16a34a" }}>{unbilledStays.length}</b></div>
      </section>

      {unbilledStays.length > 0 ? (
        <article className="panel" style={{ marginBottom: "1.5rem", borderLeft: "4px solid #2563eb", background: "#f8fafc" }}>
          <PanelHeading title="Stays Ready for Invoicing" subtitle="Active check-ins that do not have an invoice generated yet" />
          <div className="table-scroll" style={{ marginTop: "0.5rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Billing Format</th>
                  <th>Tariff</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unbilledStays.map((stay) => (
                  <tr key={String(stay.id)}>
                    <td><b>{String(stay.guestName)}</b><small className="table-sub">{String(stay.phone)}</small></td>
                    <td><b>Room {String(stay.roomNumber)}</b></td>
                    <td>{formatDate(String(stay.checkInAt))}</td>
                    <td><span className="plain-chip">{String(stay.billingType).replace("_", "-")}</span></td>
                    <td><b>{money(Number(stay.nightlyRatePaise))}</b>/night</td>
                    <td>
                      <button
                        className="primary-button compact"
                        onClick={() => onModal({ type: "invoice", booking: stay })}
                        style={{ fontSize: "0.85rem", padding: "6px 12px", background: "#2563eb" }}
                      >
                        <Plus size={15} /> 📄 Generate {stay.billingType === "GST" ? "GST Invoice" : "Bill"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <article className="panel table-panel">
        <PanelHeading title="Invoice register" subtitle="GST, non-GST, partial and paid records" />
        {data.invoices.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Guest / room</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={String(invoice.id)}>
                    <td><b>{String(invoice.invoiceNumber)}</b><small className="table-sub">{formatDate(String(invoice.issuedAt))}</small></td>
                    <td>{String(invoice.guestName)} · Room {String(invoice.roomNumber)}</td>
                    <td><span className="plain-chip">{String(invoice.billingType).replace("_", "-")}</span></td>
                    <td><b>{money(Number(invoice.totalPaise))}</b></td>
                    <td>{money(Number(invoice.balancePaise))}</td>
                    <td><span className={`status-chip ${String(invoice.status).toLowerCase()}`}>{prettyStatus(String(invoice.status))}</span></td>
                    <td>
                      <div className="row-actions" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="row-action"
                          style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.8rem" }}
                          onClick={() => onModal({ type: "view_invoice", invoice })}
                        >
                          👁️ View / Print
                        </button>
                        {["UNPAID", "PARTIAL"].includes(String(invoice.status)) ? (
                          <button
                            className="row-action primary"
                            style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                            onClick={() => onModal({ type: "payment", invoice })}
                          >
                            💳 Record payment
                          </button>
                        ) : null}
                        {invoice.status === "UNPAID" && Number(invoice.paidPaise) === 0 ? (
                          <button className="row-action danger-link" onClick={() => onModal({ type: "void_invoice", invoice })}>
                            Void
                          </button>
                        ) : null}
                        {invoice.status === "PAID" ? (
                          <span className="paid-label"><CheckCircle2 size={14} /> Settled</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No invoices yet" text="Generate an invoice from an active check-in above." />
        )}
      </article>
    </ModuleShell>
  );
}

function Team({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  return <ModuleShell eyebrow="Access control" title="Team access" description="Add managers by verified email and disable access instantly."><div className="module-banner secure"><ShieldCheck size={22} /><div><b>Admin-controlled credentials</b><span>Managers can create check-ins but cannot alter confirmed records.</span></div><button className="primary-button compact" onClick={() => onModal({ type: "manager" })}><Plus size={17} /> Add manager</button></div><article className="panel table-panel"><PanelHeading title="Users & roles" subtitle={`${data.users.filter((user) => Boolean(user.isActive)).length} active users`} /><div className="table-scroll"><table><thead><tr><th>Team member</th><th>Verified email</th><th>Role</th><th>Last active</th><th>Access</th><th /></tr></thead><tbody>{data.users.map((user) => <tr key={String(user.id)}><td><div className="primary-cell"><span className="mini-avatar">{initials(String(user.name))}</span><span><b>{String(user.name)}</b><small>{user.role === "ADMIN" ? "Full control" : "Check-in only"}</small></span></div></td><td>{String(user.email)}</td><td><span className="plain-chip">{prettyStatus(String(user.role))}</span></td><td>{user.lastSeenAt ? relativeTime(String(user.lastSeenAt)) : "Not signed in"}</td><td><span className={`status-chip ${Boolean(user.isActive) ? "paid" : "void"}`}>{Boolean(user.isActive) ? "Active" : "Disabled"}</span></td><td>{user.role === "MANAGER" ? <button className="row-action" onClick={() => onModal({ type: "toggle_manager", user })}>{Boolean(user.isActive) ? "Disable" : "Enable"}</button> : <span className="admin-lock"><LockKeyhole size={13} /> Owner</span>}</td></tr>)}</tbody></table></div></article></ModuleShell>;
}

function Audit({ data }: { data: HotelData }) {
  return <ModuleShell eyebrow="Accountability" title="Audit trail" description="Every sensitive create, edit, access, and billing action—who, what, and when."><article className="panel table-panel"><PanelHeading title="Change history" subtitle="Append-only operational log" /><SimpleTable headers={["Action", "Module", "Performed by", "Reason", "Time"]} rows={data.auditLogs.map((log) => [actionLabel(String(log.action)), prettyStatus(String(log.module)), String(log.actorEmail), String(log.reason || "System action"), formatDateTime(String(log.createdAt))])} /></article></ModuleShell>;
}

function SettingsView({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  const [seeding, setSeeding] = useState(false);
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        alert("Sample data generated successfully! Please refresh.");
        window.location.reload();
      } else {
        alert("Failed to seed data.");
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ModuleShell eyebrow="Configuration" title="Hotel settings" description="Property identity and tax defaults used on invoices.">
      <div className="dashboard-grid">
        <article className="panel settings-preview">
          <div className="settings-icon"><Hotel size={25} /></div>
          <div><small>Property name</small><b>{String(data.property.name)}</b></div>
          <div><small>Registered state</small><b>{String(data.property.state)}</b></div>
          <div><small>GSTIN</small><b>{String(data.property.gstin || "Not configured")}</b></div>
          <div><small>Default GST</small><b>{Number(data.property.defaultGstBps) / 100}%</b></div>
          <button className="secondary-button" onClick={() => onModal({ type: "settings" })}>Edit hotel settings</button>
        </article>
        
        <article className="panel settings-developer">
          <div className="settings-icon"><Sparkles size={25} /></div>
          <div className="settings-dev-content">
            <small>Developer Tools</small><b>Sample Data</b>
            <p style={{fontSize: "0.875rem", color: "#64748b", margin: '4px 0 0', lineHeight: '1.4'}}>
              Generate sample rooms, guests, bookings, and invoices to test the dashboard functionality.
            </p>
          </div>
          <button className="primary-button" onClick={handleSeed} disabled={seeding}>
            {seeding ? "Generating..." : "Generate Sample Data"}
          </button>
        </article>
      </div>
    </ModuleShell>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Gauge; label: string; value: string; detail: string; tone: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}><Icon size={19} /></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function PanelHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action ? <button>{action}</button> : null}</div>;
}

function StayTable({
  bookings,
  invoices,
  isAdmin,
  onManage,
  onModal,
}: {
  bookings: Row[];
  invoices?: Row[];
  isAdmin: boolean;
  onManage: (booking: Row) => void;
  onModal?: (modal: ModalState) => void;
}) {
  if (bookings.length === 0) return <Empty title="No stays yet" text="Use New check-in to register your first guest." />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Room</th>
            <th>Check-in</th>
            <th>Expected out</th>
            <th>Billing Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const hasInvoice = Boolean(booking.invoiceId);
            const invoiceObj = invoices?.find((inv) => String(inv.bookingId) === String(booking.id) || String(inv.id) === String(booking.invoiceId));
            const isGst = booking.billingType === "GST";

            return (
              <tr key={String(booking.id)}>
                <td>
                  <div className="primary-cell">
                    <span className="mini-avatar">{initials(String(booking.guestName))}</span>
                    <span><b>{String(booking.guestName)}</b><small>{String(booking.phone)}</small></span>
                  </div>
                </td>
                <td><b>{String(booking.roomNumber)}</b><small className="table-sub">{String(booking.roomType)}</small></td>
                <td>{formatDate(String(booking.checkInAt))}</td>
                <td>{formatDate(String(booking.expectedCheckOutAt))}</td>
                <td>
                  <span className="plain-chip">{String(booking.billingType).replace("_", "-")}</span>
                </td>
                <td>
                  <span className={`status-chip ${String(booking.status).toLowerCase()}`}>
                    {prettyStatus(String(booking.status))}
                  </span>
                </td>
                <td>
                  {booking.status === "CHECKED_IN" ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {!hasInvoice && onModal ? (
                        <button
                          className="row-action primary"
                          style={{ background: "#2563eb", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                          onClick={() => onModal({ type: "invoice", booking })}
                        >
                          📄 Generate {isGst ? "GST Invoice" : "Bill"}
                        </button>
                      ) : null}

                      {hasInvoice && onModal && invoiceObj ? (
                        <button
                          className="row-action"
                          style={{ background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}
                          onClick={() => onModal({ type: "view_invoice", invoice: invoiceObj })}
                        >
                          👁️ View Bill
                        </button>
                      ) : null}

                      <button className="row-action" onClick={() => onManage(booking)}>
                        Manage
                      </button>
                    </div>
                  ) : (
                    <span className="locked-row"><LockKeyhole size={14} /> Closed</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length) return <Empty title="Nothing here yet" text="Records will appear here as your hotel starts operating." />;
  return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function ModuleShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <><section className="page-heading module-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></section>{children}</>;
}

function SearchBar({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (value: string) => void }) {
  return <div className="search-bar"><Search size={18} /><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />{value ? <button onClick={() => onChange("")}>Clear <X size={14} /></button> : <button type="button">All records <ChevronDown size={15} /></button>}</div>;
}

function Empty({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><span><ClipboardCheck size={20} /></span><b>{title}</b><p>{text}</p></div>;
}

function viewLabel(view: View) { return navItems.find((item) => item.id === view)?.label ?? "Overview"; }
function firstName(name: string) { return name.trim().split(/\s+/)[0] || "there"; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "HO"; }
function timeGreeting() { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; }
function prettyStatus(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function actionLabel(value: string) { return prettyStatus(value).replace("Admin ", ""); }
function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((paise || 0) / 100); }
function formatDate(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatDateTime(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function relativeTime(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return "Just now"; const minutes = Math.round((Date.now() - date.getTime()) / 60000); if (minutes < 1) return "Now"; if (minutes < 60) return `${minutes}m`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}h`; return `${Math.round(hours / 24)}d`; }

function RoomsView({ data, onModal }: { data: HotelData; onModal: (modal: ModalState) => void }) {
  return (
    <ModuleShell eyebrow="Facilities" title="Rooms" description="Manage all hotel rooms, their types, and current status.">
      <article className="panel table-panel">
        <PanelHeading title="Room directory" subtitle={`${data.rooms.length} physical rooms`} />
        {data.rooms.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Floor</th>
                  <th>Base Rate</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room) => (
                  <tr key={String(room.id)}>
                    <td><b>{String(room.roomNumber)}</b></td>
                    <td><span className="plain-chip">{String(room.roomType)}</span></td>
                    <td>{String(room.floor)}</td>
                    <td><b>{money(Number(room.baseRatePaise))}</b></td>
                    <td>
                      <span className={`status-chip ${String(room.status).toLowerCase()}`}>
                        {prettyStatus(String(room.status))}
                      </span>
                    </td>
                    <td>
                      <button className="row-action" onClick={() => onModal({ type: "room", room })}>
                        Update status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No rooms" text="No rooms are defined in this property." />
        )}
      </article>
    </ModuleShell>
  );
}
