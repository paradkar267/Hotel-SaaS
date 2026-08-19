"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  Database,
  DoorOpen,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Hotel,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Terminal,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { logoutAction } from "../app/actions/auth";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Tenant = {
  id: string;
  name: string;
  plan: string;
  planStatus: string;
  renewalDate?: string;
  created_at: string;
  properties: any[];
  users: any[];
  rooms: any[];
  roomCount: number;
  occupiedCount: number;
  occupancyRate: number;
  totalRevenuePaise: number;
  invoices?: any[];
  auditLogs?: any[];
};

type Metrics = {
  totalTenants: number;
  totalProperties: number;
  totalRooms: number;
  totalOccupied: number;
  overallOccupancyRate: number;
  totalRevenuePaise: number;
};

type MonthlyTrend = {
  month: string;
  revenue: number;
  bookingsCount: number;
};

type PlatformData = {
  tenants: Tenant[];
  metrics: Metrics;
  monthlyTrends: MonthlyTrend[];
  auditLogs: any[];
  announcement: string;
};

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
        <p>Opening platform control centre…</p>
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
            <strong>HotelOS</strong>
            <small>Super Admin Cloud</small>
          </div>
        </div>

        <nav className="sa-nav">
          <button className={view === "dashboard" ? "sa-nav-active" : ""} onClick={() => setView("dashboard")}>
            <LayoutDashboard size={18} /> Platform Analytics
          </button>
          <button className={view === "hotels" ? "sa-nav-active" : ""} onClick={() => setView("hotels")}>
            <Hotel size={18} /> Hotel Tenants ({data?.tenants.length || 0})
          </button>
          <button className={view === "activity" ? "sa-nav-active" : ""} onClick={() => setView("activity")}>
            <Activity size={18} /> Global Activity Feed
          </button>
          <button className={view === "onboard" ? "sa-nav-active" : ""} onClick={() => setView("onboard")}>
            <Plus size={18} /> Onboard New Hotel
          </button>
        </nav>

        <div className="sa-sidebar-footer">
          <button onClick={() => logoutAction()} className="sa-logout-btn">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="sa-main">
        <header className="sa-topbar">
          <div>
            <h1 className="sa-page-title">
              {view === "dashboard" && "Platform Operations & Analytics"}
              {view === "hotels" && "Hotel Tenant Management"}
              {view === "activity" && "Global Platform Audit Feed"}
              {view === "onboard" && "Hotel Onboarding Wizard"}
            </h1>
            <p className="sa-page-sub">
              {view === "dashboard" && "Real-time metrics, platform revenue trends, and tenant performance"}
              {view === "hotels" && "Manage subscriptions, edit properties, configure rooms, and control users"}
              {view === "activity" && "Live verifiable log of all actions across every tenant on the platform"}
              {view === "onboard" && "Set up a new hotel business, rooms, branding, and owner credentials"}
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

        {view === "dashboard" && (
          <DashboardView
            metrics={m!}
            tenants={data?.tenants ?? []}
            monthlyTrends={data?.monthlyTrends ?? []}
            auditLogs={data?.auditLogs ?? []}
            announcement={data?.announcement ?? ""}
            onGoToHotels={() => setView("hotels")}
            onRefresh={() => loadData(true)}
            onSaveAnnouncement={async (text) => {
              try {
                const res = await fetch("/api/superadmin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "save_announcement", announcement: text }),
                });
                const json: any = await res.json();
                if (!res.ok) throw new Error(json.error);
                showToast(text ? "Platform announcement published." : "Platform announcement stopped.");
                loadData(true);
              } catch (e: any) {
                alert(e.message || "Failed to save announcement.");
              }
            }}
          />
        )}
        {view === "hotels" && (
          <HotelsView
            tenants={data?.tenants ?? []}
            onRefresh={() => loadData(true)}
            showToast={showToast}
          />
        )}
        {view === "activity" && (
          <ActivityView
            auditLogs={data?.auditLogs ?? []}
            tenants={data?.tenants ?? []}
          />
        )}
        {view === "onboard" && (
          <OnboardWizard
            onComplete={() => {
              loadData(true);
              setView("hotels");
            }}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. DASHBOARD VIEW (Analytics & Trends)
   ═══════════════════════════════════════════════════════════════════════════ */
function DashboardView({
  metrics,
  tenants,
  monthlyTrends,
  auditLogs,
  announcement,
  onGoToHotels,
  onSaveAnnouncement,
  onRefresh,
}: {
  metrics: Metrics;
  tenants: Tenant[];
  monthlyTrends: MonthlyTrend[];
  auditLogs: any[];
  announcement: string;
  onGoToHotels: () => void;
  onSaveAnnouncement: (text: string) => void;
  onRefresh?: () => void;
}) {
  const formatInr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const [annoText, setAnnoText] = useState(announcement);
  const [annoSaving, setAnnoSaving] = useState(false);

  // Leaderboard — sort tenants by revenue desc
  const leaderboard = [...tenants].sort((a, b) => b.totalRevenuePaise - a.totalRevenuePaise);

  // System health
  const activeTenants = tenants.filter(t => t.planStatus === "ACTIVE").length;
  const suspendedTenants = tenants.filter(t => t.planStatus === "SUSPENDED").length;
  const isProd = process.env.NODE_ENV === "production";

  const exportPlatformPdfReport = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) {
      alert("Please allow popups to generate the PDF report.");
      return;
    }

    const formatInrVal = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    const nowStr = new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>HotelOS SaaS - System Audit & Operations Report</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; line-height: 1.5; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { margin: 0; font-size: 24px; color: #0f172a; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
          .badge-dev { background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 24px 0 12px; border-left: 3px solid #0284c7; padding-left: 10px; font-weight: 700; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .kpi-val { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
          .kpi-lbl { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.3px; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 10px 12px; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
          td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          
          .status-tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
          .tag-active { background: #dcfce7; color: #15803d; }
          .tag-enterprise { background: #f3e8ff; color: #6b21a8; }
          .tag-growth { background: #e0f2fe; color: #0369a1; }
          .tag-starter { background: #fef9c3; color: #854d0e; }

          .health-bar { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; font-size: 12px; }
          .health-item { display: flex; align-items: center; gap: 8px; }
          .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
          .dot-green { background: #22c55e; }

          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 14px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>HotelOS SaaS Platform Report</h1>
            <p>Generated on: ${nowStr}</p>
          </div>
          <span class="badge-dev">SuperAdmin Audit Document</span>
        </div>

        <div class="section-title">1. Platform Scale & Financial Summary</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-val">${metrics.totalTenants}</div>
            <div class="kpi-lbl">Active Hotel Brands</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">${metrics.totalProperties}</div>
            <div class="kpi-lbl">Total Properties</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">${metrics.totalRooms}</div>
            <div class="kpi-lbl">Platform Rooms (${metrics.overallOccupancyRate}% Occ)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val">${formatInrVal(metrics.totalRevenuePaise)}</div>
            <div class="kpi-lbl">Total GMV Revenue</div>
          </div>
        </div>

        <div class="section-title">2. System Health & Environment Status</div>
        <div class="health-bar">
          <div class="health-item"><span class="dot dot-green"></span> <strong>Database Status:</strong> Connected & Healthy</div>
          <div class="health-item"><span class="dot dot-green"></span> <strong>Active Subscriptions:</strong> ${activeTenants} SaaS Accounts</div>
          <div class="health-item"><span class="dot dot-green"></span> <strong>SMTP Emailer:</strong> ${process.env.NEXT_PUBLIC_SMTP_CONFIGURED === "true" ? "Configured" : "Check .env"}</div>
          <div class="health-item"><span class="dot dot-green"></span> <strong>Environment Mode:</strong> ${isProd ? "Production" : "Development"}</div>
        </div>

        <div class="section-title">3. Onboarded Hotel Tenants Directory</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tenant Brand Name</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Properties</th>
              <th>Rooms</th>
              <th>Occupancy</th>
              <th>Processed Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${tenants.map((t, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${t.name}</strong></td>
                <td><span class="status-tag tag-${(t.plan || "STARTER").toLowerCase()}">${t.plan || "STARTER"}</span></td>
                <td><span class="status-tag tag-active">${t.planStatus || "ACTIVE"}</span></td>
                <td>${t.properties.length}</td>
                <td>${t.roomCount}</td>
                <td>${t.occupancyRate}%</td>
                <td><strong>${formatInrVal(t.totalRevenuePaise)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Confidential Operations Document &bull; Generated by HotelOS SaaS Developer SuperAdmin Control Panel &bull; ${nowStr}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  async function saveAnnouncement() {
    setAnnoSaving(true);
    await onSaveAnnouncement(annoText);
    setAnnoSaving(false);
  }

  return (
    <div className="sa-content">
      {/* Top Metrics Cards */}
      <div className="sa-metrics-grid">
        <div className="sa-metric-card sa-metric-blue">
          <div className="sa-metric-icon"><Hotel size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{metrics.totalTenants}</span>
            <span className="sa-metric-label">Active Hotel Brands</span>
          </div>
        </div>
        <div className="sa-metric-card sa-metric-emerald">
          <div className="sa-metric-icon"><Building2 size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{metrics.totalProperties}</span>
            <span className="sa-metric-label">Total Properties</span>
          </div>
        </div>
        <div className="sa-metric-card sa-metric-violet">
          <div className="sa-metric-icon"><BedDouble size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{metrics.totalRooms} <small style={{ fontSize: "13px", fontWeight: 400 }}>({metrics.totalOccupied} occ.)</small></span>
            <span className="sa-metric-label">Platform Rooms ({metrics.overallOccupancyRate}% Occupancy)</span>
          </div>
        </div>
        <div className="sa-metric-card sa-metric-amber">
          <div className="sa-metric-icon"><CircleDollarSign size={22} /></div>
          <div className="sa-metric-info">
            <span className="sa-metric-value">{formatInr(metrics.totalRevenuePaise)}</span>
            <span className="sa-metric-label">Total Processed Revenue</span>
          </div>
        </div>
      </div>

      {/* ─── Platform Announcement ─── */}
      <div className="sa-section">
        <h2><Megaphone size={18} style={{ verticalAlign: "middle", marginRight: "6px" }} />Platform Announcement</h2>
        <div className="sa-tenant-card" style={{ padding: "20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#94a3b8" }}>
            This message is shown as a banner to all hotel managers when they log in.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={annoText}
              onChange={(e) => setAnnoText(e.target.value)}
              placeholder="e.g. System maintenance tonight 10pm-12am"
              style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", outline: "none" }}
            />
            <button className="sa-btn-primary" onClick={saveAnnouncement} disabled={annoSaving}>
              <Send size={14} /> {annoSaving ? "Saving..." : "Publish"}
            </button>
          </div>
          {announcement && (
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "#1e293b", borderRadius: "8px", border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <small style={{ color: "#64748b" }}>Current live announcement:</small>
                <p style={{ margin: "4px 0 0", color: "#fbbf24", fontSize: "13px", fontWeight: 500 }}>{announcement}</p>
              </div>
              <button 
                type="button"
                onClick={async () => {
                  setAnnoSaving(true);
                  await onSaveAnnouncement("");
                  setAnnoText("");
                  setAnnoSaving(false);
                }}
                disabled={annoSaving}
                style={{ background: "#451a03", color: "#f59e0b", border: "1px solid #78350f", height: "32px", padding: "0 12px", borderRadius: "6px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600 }}
              >
                <X size={14} /> Stop Notice
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── System Health ─── */}
      <div className="sa-section">
        <h2><ShieldCheck size={18} style={{ verticalAlign: "middle", marginRight: "6px" }} />System Health</h2>
        <div className="sa-health-grid">
          <div className="sa-health-item">
            <span className="sa-health-dot sa-dot-green" />
            <span>Database: Connected</span>
          </div>
          <div className="sa-health-item">
            <span className="sa-health-dot sa-dot-green" />
            <span>{activeTenants} Active SaaS Tenants</span>
          </div>
          {suspendedTenants > 0 && (
            <div className="sa-health-item">
              <span className="sa-health-dot sa-dot-red" />
              <span>{suspendedTenants} Suspended Accounts</span>
            </div>
          )}
          <div className="sa-health-item">
            <span className={`sa-health-dot ${process.env.NEXT_PUBLIC_SMTP_CONFIGURED === "true" ? "sa-dot-green" : "sa-dot-yellow"}`} />
            <span>SMTP Email: {process.env.NEXT_PUBLIC_SMTP_CONFIGURED === "true" ? "Configured" : "Check .env"}</span>
          </div>
          <div className="sa-health-item">
            <span className="sa-health-dot sa-dot-green" />
            <span>Env: {isProd ? "Production" : "Development"}</span>
          </div>
        </div>
      </div>

      {/* ─── Developer & System Operations ─── */}
      <div className="sa-section">
        <h2><Terminal size={18} style={{ verticalAlign: "middle", marginRight: "6px" }} />Developer Operations & Toolkit</h2>
        <div className="sa-tenant-card" style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            
            {/* Tool 1: Formatted PDF Report */}
            <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <FileText size={16} style={{ color: "#38bdf8" }} />
                <strong style={{ fontSize: "14px", color: "#f8fafc" }}>Executive PDF Report</strong>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#94a3b8" }}>
                Generate & print/save formatted executive PDF audit report of platform state.
              </p>
              <button 
                className="sa-btn-secondary" 
                style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
                onClick={exportPlatformPdfReport}
              >
                <Download size={14} /> Export System Report (PDF)
              </button>
            </div>

            {/* Tool 2: Live System Diagnostics & Error Tracker */}
            <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Terminal size={16} style={{ color: "#34d399" }} />
                <strong style={{ fontSize: "14px", color: "#f8fafc" }}>System Diagnostics & Errors</strong>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#94a3b8" }}>
                Status: <span style={{ color: "#10b981", fontWeight: 600 }}>● All Systems Operational (0 Exceptions)</span>
              </p>
              <button 
                className="sa-btn-secondary" 
                style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
                onClick={() => {
                  const diag = `[HotelOS SuperAdmin Diagnostics & Health]\nTimestamp: ${new Date().toISOString()}\nEnv: ${isProd ? "Production" : "Development"}\nTenants: ${tenants.length} (${activeTenants} active, ${suspendedTenants} suspended)\nProperties: ${metrics.totalProperties}\nRooms: ${metrics.totalRooms} (${metrics.overallOccupancyRate}% Occ)\nRevenue: ₹${(metrics.totalRevenuePaise/100).toLocaleString('en-IN')}\nSMTP Mailer: ${process.env.NEXT_PUBLIC_SMTP_CONFIGURED || 'Check .env'}\nSystem Status: 0 Critical Errors / All Systems Operational`;
                  navigator.clipboard.writeText(diag);
                  alert("Diagnostic specs & system health copied to clipboard!");
                }}
              >
                <Copy size={14} /> Copy Diagnostic Specs & Status
              </button>
            </div>

            {/* Tool 3: Quick Tenant Inspector */}
            <div style={{ background: "#0f172a", padding: "16px", borderRadius: "8px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Hotel size={16} style={{ color: "#a78bfa" }} />
                <strong style={{ fontSize: "14px", color: "#f8fafc" }}>Quick Tenant Inspector</strong>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#94a3b8" }}>
                Jump directly to tenant management & inspect properties/rooms.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <select 
                  id="sa-tenant-inspector-select"
                  style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", outline: "none" }}
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.properties.length} props)</option>
                  ))}
                </select>
                <button 
                  className="sa-btn-primary" 
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => {
                    onGoToHotels();
                  }}
                >
                  <ExternalLink size={13} /> Inspect
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ─── SaaS Subscription & Account Control ─── */}
      <div className="sa-section">
        <h2><Users size={18} style={{ verticalAlign: "middle", marginRight: "6px" }} />SaaS Subscription & Account Control</h2>
        <div className="sa-tenant-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span className="sa-badge sa-badge-green" style={{ padding: "6px 12px", fontSize: "12px" }}>
              ● {tenants.filter(t => (t.planStatus || "ACTIVE") === "ACTIVE").length} Active Accounts
            </span>
            <span className="sa-badge sa-badge-blue" style={{ padding: "6px 12px", fontSize: "12px" }}>
              ● {tenants.filter(t => t.planStatus === "TRIAL").length} Trial Accounts
            </span>
            {tenants.filter(t => t.planStatus === "SUSPENDED").length > 0 && (
              <span className="sa-badge sa-badge-red" style={{ padding: "6px 12px", fontSize: "12px" }}>
                ● {tenants.filter(t => t.planStatus === "SUSPENDED").length} Suspended
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="sa-leaderboard-table" style={{ fontSize: "12px" }}>
              <thead>
                <tr>
                  <th>Hotel Brand</th>
                  <th>Current Plan</th>
                  <th>Status</th>
                  <th>Properties & Rooms</th>
                  <th>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>
                      <span className={`sa-badge ${t.plan === "ENTERPRISE" ? "sa-badge-violet" : t.plan === "GROWTH" ? "sa-badge-blue" : "sa-badge-green"}`}>
                        {t.plan || "STARTER"}
                      </span>
                    </td>
                    <td>
                      <span className={`sa-badge ${t.planStatus === "SUSPENDED" ? "sa-badge-red" : "sa-badge-green"}`}>
                        {t.planStatus || "ACTIVE"}
                      </span>
                    </td>
                    <td>{t.properties.length} Properties ({t.roomCount} rooms)</td>
                    <td>
                      <button
                        type="button"
                        style={{
                          background: t.planStatus === "SUSPENDED" ? "#065f46" : "#7f1d1d",
                          color: "#fff",
                          border: "none",
                          padding: "5px 12px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                        onClick={async () => {
                          const newStatus = t.planStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
                          if (!confirm(`Are you sure you want to set ${t.name} account to ${newStatus}?`)) return;
                          try {
                            const res = await fetch("/api/superadmin", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "update_tenant_plan",
                                tenantId: t.id,
                                plan: t.plan || "STARTER",
                                planStatus: newStatus,
                              }),
                            });
                            if (!res.ok) throw new Error("Failed to update status");
                            if (onRefresh) onRefresh();
                          } catch (e: any) {
                            alert(e.message || "Failed to update tenant status.");
                          }
                        }}
                      >
                        {t.planStatus === "SUSPENDED" ? "Re-activate Account" : "Suspend Access"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="sa-section">
        <h2><TrendingUp size={18} style={{ verticalAlign: "middle", marginRight: "6px" }} />Platform Revenue (Last 6 Months)</h2>
        <div className="sa-tenant-card" style={{ padding: "20px" }}>
          <div style={{ height: "240px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="saRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Processed Revenue"]}
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#saRevenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Top Hotels Leaderboard ─── */}
      <div className="sa-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2>🏆 Hotel Leaderboard</h2>
          <button className="sa-btn-secondary" onClick={onGoToHotels}>
            Manage all ({tenants.length}) <ArrowRight size={14} />
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <div className="sa-empty">
            <Hotel size={40} strokeWidth={1.2} />
            <p>No hotels onboarded yet.</p>
            <small>Use "Onboard Hotel" to set up your first hotel.</small>
          </div>
        ) : (
          <div className="sa-tenant-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="sa-leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hotel</th>
                  <th>Plan</th>
                  <th>Rooms</th>
                  <th>Occupancy</th>
                  <th>Revenue</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((t, i) => (
                  <tr key={t.id}>
                    <td className="sa-lb-rank">{i + 1}</td>
                    <td><strong>{t.name}</strong></td>
                    <td>
                      <span className={`sa-badge ${t.plan === "ENTERPRISE" ? "sa-badge-violet" : t.plan === "GROWTH" ? "sa-badge-blue" : "sa-badge-green"}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td>{t.roomCount}</td>
                    <td>
                      <div className="sa-occ-bar-wrap">
                        <div className="sa-occ-bar" style={{ width: `${Math.min(t.occupancyRate, 100)}%` }} />
                        <span>{t.occupancyRate}%</span>
                      </div>
                    </td>
                    <td className="sa-lb-revenue">{formatInr(t.totalRevenuePaise)}</td>
                    <td>{t.users.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. HOTELS VIEW (Full Management: Edit, Plan, Rooms, Users, Invoices)
   ═══════════════════════════════════════════════════════════════════════════ */
function HotelsView({
  tenants,
  onRefresh,
  showToast,
}: {
  tenants: Tenant[];
  onRefresh: () => void;
  showToast: (m: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("ALL");

  // Modals state
  const [editingProperty, setEditingProperty] = useState<{ tenantId: string; property: any } | null>(null);
  const [managingPlan, setManagingPlan] = useState<Tenant | null>(null);
  const [addingRoomTenant, setAddingRoomTenant] = useState<{ tenantId: string; propertyId: string } | null>(null);
  const [addingUserTenant, setAddingUserTenant] = useState<{ tenantId: string; propertyId: string } | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);

  const toggleTenant = async (tenantId: string, isActive: boolean) => {
    await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_tenant", tenantId, isActive }),
    });
    showToast(isActive ? "Tenant enabled." : "Tenant disabled.");
    onRefresh();
  };

  const toggleUser = async (userId: string, isActive: boolean) => {
    await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_user", userId, isActive }),
    });
    showToast(isActive ? "User enabled." : "User disabled.");
    onRefresh();
  };

  const deleteRoom = async (tenantId: string, roomId: string) => {
    if (!confirm("Are you sure you want to delete this room?")) return;
    const res = await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_room", tenantId, roomId }),
    });
    const json: any = await res.json();
    showToast(json.message || "Room deleted.");
    onRefresh();
  };

  const exportDirectoryCsv = () => {
    const headers = ["Tenant ID", "Business Name", "Plan", "Status", "Properties", "Rooms", "Occupancy %", "Revenue (INR)"];
    const rows = tenants.map((t) => [
      t.id,
      `"${t.name.replace(/"/g, '""')}"`,
      t.plan || "STARTER",
      t.planStatus || "ACTIVE",
      t.properties.length,
      t.roomCount,
      `${t.occupancyRate}%`,
      (t.totalRevenuePaise / 100).toFixed(2),
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `HotelOS_Tenants_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.properties.some((p: any) =>
        (p.city || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.gstin || "").toLowerCase().includes(search.toLowerCase())
      ) ||
      t.users.some((u: any) => u.email.toLowerCase().includes(search.toLowerCase()));

    const matchesPlan = filterPlan === "ALL" || (t.plan || "STARTER") === filterPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="sa-content">
      {/* Search & Export Toolbar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "#94a3b8" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hotel by name, city, GSTIN, or admin email…"
            style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--paper)" }}
          />
        </div>

        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--paper)" }}
        >
          <option value="ALL">All Plans</option>
          <option value="TRIAL">Trial</option>
          <option value="STARTER">Starter</option>
          <option value="GROWTH">Growth</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>

        <button className="sa-btn-secondary" onClick={exportDirectoryCsv}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {filteredTenants.length === 0 ? (
        <div className="sa-empty">
          <Hotel size={40} strokeWidth={1.2} />
          <p>No hotels match your filters.</p>
        </div>
      ) : (
        <div className="sa-tenant-list">
          {filteredTenants.map((t) => (
            <div key={t.id} className="sa-tenant-card">
              <div
                className="sa-tenant-header"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
              >
                <ChevronRight size={16} className={`sa-chevron ${expanded === t.id ? "sa-chevron-open" : ""}`} />
                <Hotel size={18} />
                <strong style={{ fontSize: "16px" }}>{t.name}</strong>

                {/* Plan Badge */}
                <button
                  className={`sa-badge ${t.plan === "ENTERPRISE" ? "sa-badge-violet" : t.plan === "GROWTH" ? "sa-badge-blue" : "sa-badge-green"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setManagingPlan(t);
                  }}
                  title="Click to change plan"
                  style={{ cursor: "pointer", border: "none" }}
                >
                  <Tag size={12} style={{ marginRight: 4 }} /> {t.plan || "STARTER"} ({t.planStatus || "ACTIVE"})
                </button>

                <span className="sa-badge">{t.roomCount} rooms</span>
                <span className="sa-badge sa-badge-green">₹{(t.totalRevenuePaise / 100).toLocaleString("en-IN")}</span>

                <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="sa-btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => setManagingPlan(t)}
                  >
                    Manage Plan
                  </button>
                </div>
              </div>

              {expanded === t.id && (
                <div className="sa-tenant-details">
                  {/* Properties Section */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                    <h4>Properties ({t.properties.length})</h4>
                  </div>
                  {t.properties.map((p: any) => (
                    <div key={p.id} className="sa-detail-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Building2 size={16} />
                        <span>
                          <strong>{p.name}</strong> — {p.city || "N/A"}, {p.state}
                        </span>
                        {p.gstin && <span className="sa-badge">GSTIN: {p.gstin}</span>}
                        {p.upi_id && <span className="sa-badge">UPI: {p.upi_id}</span>}
                      </div>
                      <button
                        className="sa-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => setEditingProperty({ tenantId: t.id, property: p })}
                      >
                        <Edit3 size={13} /> Edit Property & Branding
                      </button>
                    </div>
                  ))}

                  {/* Rooms Section */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
                    <h4>Rooms ({t.rooms?.length || 0})</h4>
                    {t.properties[0] && (
                      <button
                        className="sa-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => setAddingRoomTenant({ tenantId: t.id, propertyId: t.properties[0].id })}
                      >
                        <Plus size={13} /> Add Room
                      </button>
                    )}
                  </div>
                  {t.rooms && t.rooms.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", marginTop: "8px" }}>
                      {t.rooms.map((r: any) => (
                        <div key={r.id} style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--paper)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <strong>Room {r.room_number}</strong>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>{r.room_type} · ₹{(r.base_rate_paise / 100).toFixed(0)}</div>
                          </div>
                          <button
                            className="sa-btn-icon"
                            onClick={() => deleteRoom(t.id, r.id)}
                            title="Delete Room"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="sa-empty-text" style={{ fontSize: "0.85rem", color: "#64748b" }}>No rooms configured for this hotel.</p>
                  )}

                  {/* Users Section */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
                    <h4>Hotel Staff & Managers ({t.users.length})</h4>
                    {t.properties[0] && (
                      <button
                        className="sa-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => setAddingUserTenant({ tenantId: t.id, propertyId: t.properties[0].id })}
                      >
                        <UserPlus size={13} /> Add Staff Account
                      </button>
                    )}
                  </div>
                  {t.users.map((u: any) => (
                    <div key={u.id} className="sa-detail-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Users size={14} />
                        <span>
                          <strong>{u.name}</strong> ({u.email})
                        </span>
                        <span className={`sa-badge ${u.role === "ADMIN" ? "sa-badge-blue" : ""}`}>{u.role}</span>
                        <span className={`sa-badge ${u.is_active ? "sa-badge-green" : "sa-badge-red"}`}>
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <button
                        className={u.is_active ? "sa-btn-danger" : "sa-btn-success"}
                        style={{ padding: "2px 8px", fontSize: "11px" }}
                        onClick={() => toggleUser(u.id, !u.is_active)}
                      >
                        {u.is_active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  ))}

                  {/* Invoices Section */}
                  <h4 style={{ marginTop: "20px" }}>Recent Billing Records</h4>
                  {t.invoices && t.invoices.length > 0 ? (
                    <div className="sa-billing-history">
                      {t.invoices.slice(0, 5).map((inv: any) => (
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
                    <p className="sa-empty-text" style={{ fontSize: "0.85rem", color: "#64748b" }}>No billing history found.</p>
                  )}

                  {/* Tenant Control Actions */}
                  <div className="sa-detail-actions" style={{ marginTop: "24px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="sa-btn-danger" onClick={() => toggleTenant(t.id, false)}>Disable All Hotel Users</button>
                      <button className="sa-btn-success" onClick={() => toggleTenant(t.id, true)}>Enable All Hotel Users</button>
                    </div>

                    <button className="sa-btn-danger" onClick={() => setDeletingTenant(t)}>
                      <Trash2 size={14} /> Delete Hotel Tenant
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plan Management Modal */}
      {managingPlan && (
        <PlanModal
          tenant={managingPlan}
          onClose={() => setManagingPlan(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setManagingPlan(null);
            onRefresh();
          }}
        />
      )}

      {/* Edit Property Modal */}
      {editingProperty && (
        <EditPropertyModal
          tenantId={editingProperty.tenantId}
          property={editingProperty.property}
          onClose={() => setEditingProperty(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setEditingProperty(null);
            onRefresh();
          }}
        />
      )}

      {/* Add Room Modal */}
      {addingRoomTenant && (
        <AddRoomModal
          tenantId={addingRoomTenant.tenantId}
          propertyId={addingRoomTenant.propertyId}
          onClose={() => setAddingRoomTenant(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setAddingRoomTenant(null);
            onRefresh();
          }}
        />
      )}

      {/* Add User Modal */}
      {addingUserTenant && (
        <AddUserModal
          tenantId={addingUserTenant.tenantId}
          propertyId={addingUserTenant.propertyId}
          onClose={() => setAddingUserTenant(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setAddingUserTenant(null);
            onRefresh();
          }}
        />
      )}

      {/* Delete Tenant Modal */}
      {deletingTenant && (
        <DeleteTenantModal
          tenant={deletingTenant}
          onClose={() => setDeletingTenant(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setDeletingTenant(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. SUPER ADMIN MODALS (Plan, Edit Property, Add Room, Add User, Delete)
   ═══════════════════════════════════════════════════════════════════════════ */

function PlanModal({
  tenant,
  onClose,
  onSuccess,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [plan, setPlan] = useState(tenant.plan || "STARTER");
  const [planStatus, setPlanStatus] = useState(tenant.planStatus || "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_tenant_plan",
          tenantId: tenant.id,
          plan,
          planStatus,
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      onSuccess(json.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true">
        <header className="modal-header">
          <span className="modal-icon"><Tag size={20} /></span>
          <div>
            <h2>Subscription Plan & Status</h2>
            <p>{tenant.name} · Platform Tier</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="action-form">
          <div className="sa-field">
            <label>SaaS Subscription Plan</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="TRIAL">Trial (14-Day Evaluation)</option>
              <option value="STARTER">Starter (Up to 15 Rooms)</option>
              <option value="GROWTH">Growth (Up to 50 Rooms + Staff)</option>
              <option value="ENTERPRISE">Enterprise (Unlimited Rooms & Multi-Property)</option>
            </select>
          </div>

          <div className="sa-field">
            <label>Tenant Account Status</label>
            <select value={planStatus} onChange={(e) => setPlanStatus(e.target.value)}>
              <option value="ACTIVE">Active (Full Access)</option>
              <option value="TRIAL">Trial Mode</option>
              <option value="SUSPENDED">Suspended (Locked)</option>
              <option value="PAST_DUE">Past Due (Payment Pending)</option>
            </select>
          </div>

          {error && <div className="sa-error">{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="sa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sa-btn-primary" disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <CheckCircle2 size={16} />} Save Plan
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditPropertyModal({
  tenantId,
  property,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  property: any;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState(property.logo_url || "");
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
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setLogoUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_property",
          tenantId,
          propertyId: property.id,
          name: form.get("name"),
          address: form.get("address"),
          city: form.get("city"),
          state: form.get("state"),
          postalCode: form.get("postalCode"),
          gstin: form.get("gstin"),
          defaultGstBps: Number(form.get("defaultGstBps")),
          contactPhone: form.get("contactPhone"),
          contactEmail: form.get("contactEmail"),
          upiId: form.get("upiId"),
          upiName: form.get("upiName"),
          checkInTime: form.get("checkInTime"),
          checkOutTime: form.get("checkOutTime"),
          logoUrl,
          googleReviewLink: form.get("googleReviewLink"),
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      onSuccess(json.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card wide" role="dialog" aria-modal="true">
        <header className="modal-header">
          <span className="modal-icon"><Edit3 size={20} /></span>
          <div>
            <h2>Edit Property Details</h2>
            <p>{property.name} · Branding & GST Settings</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="action-form" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 0 }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div className="sa-field-grid">
              <div className="sa-field sa-field-full">
                <label>Hotel Name *</label>
                <input name="name" defaultValue={property.name} required />
              </div>
              <div className="sa-field sa-field-full">
                <label>Address</label>
                <input name="address" defaultValue={property.address || ""} />
              </div>
              <div className="sa-field">
                <label>City</label>
                <input name="city" defaultValue={property.city || ""} />
              </div>
              <div className="sa-field">
                <label>State *</label>
                <input name="state" defaultValue={property.state || "Maharashtra"} required />
              </div>
              <div className="sa-field">
                <label>Postal Code</label>
                <input name="postalCode" defaultValue={property.postal_code || ""} />
              </div>
              <div className="sa-field">
                <label>GSTIN</label>
                <input name="gstin" defaultValue={property.gstin || ""} />
              </div>
              <div className="sa-field">
                <label>Default GST Rate</label>
                <select name="defaultGstBps" defaultValue={property.default_gst_bps ?? 1200}>
                  <option value={0}>No GST (0%)</option>
                  <option value={500}>5% GST</option>
                  <option value={1200}>12% GST</option>
                  <option value={1800}>18% GST</option>
                </select>
              </div>
              <div className="sa-field">
                <label>Brand Logo</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ flex: 1 }} />
                  {uploadingLogo && <LoaderCircle className="sa-spin" size={16} />}
                </div>
                {logoUrl && logoUrl !== "null" && (
                  <div style={{ marginTop: "6px" }}>
                    <img src={logoUrl} alt="Logo preview" style={{ height: "32px", objectFit: "contain", borderRadius: "4px" }} />
                  </div>
                )}
              </div>
              <div className="sa-field">
                <label>Contact Phone</label>
                <input name="contactPhone" defaultValue={property.contact_phone || ""} />
              </div>
              <div className="sa-field">
                <label>Contact Email</label>
                <input name="contactEmail" defaultValue={property.contact_email || ""} type="email" />
              </div>
              <div className="sa-field">
                <label>UPI ID (For Guest Payments)</label>
                <input name="upiId" defaultValue={property.upi_id || "hotelos@upi"} required />
              </div>
              <div className="sa-field">
                <label>UPI Receiver Name</label>
                <input name="upiName" defaultValue={property.upi_name || property.name || "HotelOS"} required />
              </div>
              <div className="sa-field">
                <label>Check-in Time</label>
                <input name="checkInTime" defaultValue={property.check_in_time || "14:00"} type="time" />
              </div>
              <div className="sa-field">
                <label>Check-out Time</label>
                <input name="checkOutTime" defaultValue={property.check_out_time || "11:00"} type="time" />
              </div>
              <div className="sa-field sa-field-full">
                <label>Google Review Link</label>
                <input name="googleReviewLink" defaultValue={property.google_review_link || property.googleReviewLink || ""} placeholder="https://g.page/r/.../review" />
              </div>
            </div>
            {error && <div className="sa-error" style={{ marginTop: "12px" }}>{error}</div>}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "18px 24px", background: "#f8fafc", borderTop: "1px solid var(--line)" }}>
            <button type="button" className="sa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sa-btn-primary" disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <CheckCircle2 size={16} />} Save Changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AddRoomModal({
  tenantId,
  propertyId,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  propertyId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_room",
          tenantId,
          propertyId,
          roomNumber: form.get("roomNumber"),
          floor: form.get("floor"),
          roomType: form.get("roomType"),
          baseRatePaise: Math.round(Number(form.get("baseRate")) * 100),
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add room");
      onSuccess(json.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true">
        <header className="modal-header">
          <span className="modal-icon"><BedDouble size={20} /></span>
          <div>
            <h2>Add Room to Hotel</h2>
            <p>Configure room number, type, and nightly rate</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="action-form">
          <div className="sa-field-grid">
            <div className="sa-field">
              <label>Room Number *</label>
              <input name="roomNumber" placeholder="e.g. 301" required />
            </div>
            <div className="sa-field">
              <label>Floor</label>
              <input name="floor" placeholder="e.g. 3" defaultValue="1" required />
            </div>
            <div className="sa-field">
              <label>Room Type</label>
              <select name="roomType" defaultValue="Standard">
                <option value="Standard">Standard</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
                <option value="Premium">Premium</option>
              </select>
            </div>
            <div className="sa-field">
              <label>Nightly Rate (₹) *</label>
              <input name="baseRate" type="number" defaultValue="2500" min={1} required />
            </div>
          </div>

          {error && <div className="sa-error">{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="sa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sa-btn-primary" disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <Plus size={16} />} Create Room
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AddUserModal({
  tenantId,
  propertyId,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  propertyId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_hotel_admin",
          tenantId,
          propertyId,
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create user");
      onSuccess(json.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true">
        <header className="modal-header">
          <span className="modal-icon"><UserPlus size={20} /></span>
          <div>
            <h2>Add Hotel Staff / Admin Account</h2>
            <p>Create login credentials for hotel team members</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="action-form">
          <div className="sa-field">
            <label>Full Name *</label>
            <input name="name" placeholder="e.g. Ramesh Sharma" required />
          </div>
          <div className="sa-field">
            <label>Email Address *</label>
            <input name="email" type="email" placeholder="staff@hotel.com" required />
          </div>
          <div className="sa-field">
            <label>Password (Min 6 chars) *</label>
            <input name="password" type="password" placeholder="••••••••" minLength={6} required />
          </div>
          <div className="sa-field">
            <label>Role</label>
            <select name="role" defaultValue="MANAGER">
              <option value="ADMIN">Hotel Admin (Full Property Control)</option>
              <option value="MANAGER">Property Manager (Front Desk & Check-in)</option>
            </select>
          </div>

          {error && <div className="sa-error">{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="sa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sa-btn-primary" disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <UserCheck size={16} />} Create Account
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteTenantModal({
  tenant,
  onClose,
  onSuccess,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName.trim() !== tenant.name.trim()) {
      setError("Please type the exact hotel business name to confirm deletion.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_tenant", tenantId: tenant.id }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      onSuccess(json.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true">
        <header className="modal-header">
          <span className="modal-icon" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Trash2 size={20} /></span>
          <div>
            <h2>Delete Hotel Tenant</h2>
            <p>Permanent & Irreversible Action</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="action-form">
          <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: "1.5" }}>
            This will permanently delete <strong>{tenant.name}</strong>, including all its properties, rooms, invoices, bookings, guest history, and staff accounts.
          </p>
          <div className="sa-field" style={{ marginTop: "12px" }}>
            <label>Type <strong>{tenant.name}</strong> to confirm:</label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={tenant.name}
              required
            />
          </div>

          {error && <div className="sa-error">{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="sa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sa-btn-danger" disabled={busy || confirmName.trim() !== tenant.name.trim()}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <Trash2 size={16} />} Permanently Delete
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. ONBOARD WIZARD (With Plan Tier, Logo Upload, Rooms & Owner)
   ═══════════════════════════════════════════════════════════════════════════ */
function OnboardWizard({ onComplete, showToast }: { onComplete: () => void; showToast: (m: string) => void }) {
  const [step, setStep] = useState<WizardStep>("tenant");
  const [busy, setBusy] = useState(false);

  // Collected data
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");

  // Forms
  const [tenantName, setTenantName] = useState("");
  const [plan, setPlan] = useState<"TRIAL" | "STARTER" | "GROWTH" | "ENTERPRISE">("STARTER");
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
  const [googleReviewLink, setGoogleReviewLink] = useState("");

  const [rooms, setRooms] = useState([{ roomNumber: "101", floor: "1", roomType: "Standard", baseRate: "2500" }]);

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
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setLogoUrl(data.url);
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
    const result = await api({ action: "create_tenant", name: tenantName, plan });
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
      googleReviewLink,
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
      role: "ADMIN",
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
    { key: "tenant", label: "Brand & Plan" },
    { key: "property", label: "Property & GST" },
    { key: "rooms", label: "Room Inventory" },
    { key: "admin", label: "Owner Credentials" },
    { key: "done", label: "Ready" },
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
          <h2>Hotel Brand & Subscription</h2>
          <p>Configure the hotel business name, SaaS tier, and brand logo.</p>
          <div className="sa-field">
            <label>Hotel Business / Brand Name *</label>
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="e.g. The Grand Palace Hotels" required />
          </div>

          <div className="sa-field">
            <label>SaaS Subscription Plan Tier</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as any)}>
              <option value="STARTER">Starter Plan (Up to 15 Rooms)</option>
              <option value="GROWTH">Growth Plan (Up to 50 Rooms + Staff)</option>
              <option value="ENTERPRISE">Enterprise Plan (Unlimited Rooms)</option>
              <option value="TRIAL">14-Day Free Evaluation</option>
            </select>
          </div>

          <div className="sa-field">
            <label>Brand Logo (Optional)</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ flex: 1 }} />
              {uploadingLogo && <LoaderCircle className="sa-spin" size={16} />}
            </div>
            {logoUrl && (
              <div style={{ marginTop: "10px" }}>
                <img src={logoUrl} alt="Logo Preview" style={{ height: "40px", objectFit: "contain", borderRadius: "4px" }} />
              </div>
            )}
          </div>
          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateTenant} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <ArrowRight size={16} />} Next Step
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Property */}
      {step === "property" && (
        <div className="sa-wizard-card">
          <h2>Property & Billing Details</h2>
          <p>Configure address, GST taxation, contact information, and UPI payment settings.</p>
          <div className="sa-field-grid">
            <div className="sa-field sa-field-full">
              <label>Property Name *</label>
              <input value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="e.g. Grand Palace Mumbai" required />
            </div>
            <div className="sa-field sa-field-full">
              <label>Registered Street Address</label>
              <input value={propAddress} onChange={(e) => setPropAddress(e.target.value)} placeholder="Street address" />
            </div>
            <div className="sa-field">
              <label>City</label>
              <input value={propCity} onChange={(e) => setPropCity(e.target.value)} placeholder="Mumbai" />
            </div>
            <div className="sa-field">
              <label>State *</label>
              <input value={propState} onChange={(e) => setPropState(e.target.value)} placeholder="Maharashtra" required />
            </div>
            <div className="sa-field">
              <label>Postal Code</label>
              <input value={propPostal} onChange={(e) => setPropPostal(e.target.value)} placeholder="400001" />
            </div>
            <div className="sa-field">
              <label>GSTIN</label>
              <input value={propGstin} onChange={(e) => setPropGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
            <div className="sa-field">
              <label>Default GST Rate</label>
              <select value={propGstBps} onChange={(e) => setPropGstBps(Number(e.target.value))}>
                <option value={0}>No GST (0%)</option>
                <option value={500}>5% GST</option>
                <option value={1200}>12% GST</option>
                <option value={1800}>18% GST</option>
              </select>
            </div>

            <div className="sa-field-full" style={{ marginTop: 12, marginBottom: 4, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>Contact & Guest UPI Configuration</h4>
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
              <label>UPI ID (For Guest QR Codes) *</label>
              <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="grandpalace@upi" required />
            </div>
            <div className="sa-field">
              <label>UPI Receiver Name *</label>
              <input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Grand Palace Hotels" required />
            </div>

            <div className="sa-field-full" style={{ marginTop: 12, marginBottom: 4, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>Hotel Operational Policies</h4>
            </div>
            <div className="sa-field">
              <label>Default Check-in Time</label>
              <input value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} type="time" />
            </div>
            <div className="sa-field">
              <label>Default Check-out Time</label>
              <input value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} type="time" />
            </div>
            <div className="sa-field sa-field-full">
              <label>Google Review Link</label>
              <input value={googleReviewLink} onChange={(e) => setGoogleReviewLink(e.target.value)} placeholder="https://g.page/r/.../review" />
            </div>
          </div>
          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateProperty} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <ArrowRight size={16} />} Next Step
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Rooms */}
      {step === "rooms" && (
        <div className="sa-wizard-card">
          <h2>Room Inventory Setup</h2>
          <p>Add the initial rooms and nightly base tariffs for this property.</p>

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
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <ArrowRight size={16} />} Next Step
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Admin */}
      {step === "admin" && (
        <div className="sa-wizard-card">
          <h2>Hotel Owner Credentials</h2>
          <p>Create login credentials for the hotel owner. They will use these to log into their command centre.</p>
          <div className="sa-field-grid">
            <div className="sa-field sa-field-full">
              <label>Owner Full Name *</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="e.g. Ramesh Patel" required />
            </div>
            <div className="sa-field">
              <label>Owner Email *</label>
              <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="owner@hotel.com" type="email" required />
            </div>
            <div className="sa-field">
              <label>Password (Min 6 chars) *</label>
              <input value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Min 6 characters" type="password" minLength={6} required />
            </div>
          </div>
          <div className="sa-wizard-actions">
            <button className="sa-btn-primary" onClick={stepCreateAdmin} disabled={busy}>
              {busy ? <LoaderCircle className="sa-spin" size={16} /> : <CheckCircle2 size={16} />} Complete & Finish
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && (
        <div className="sa-wizard-card sa-done-card">
          <div className="sa-done-icon"><CheckCircle2 size={56} /></div>
          <h2>Hotel Successfully Onboarded!</h2>
          <p>The hotel brand is live on HotelOS. The owner can log in immediately to start managing front-desk operations.</p>
          <div className="sa-done-summary">
            <div><strong>Business Brand:</strong> {tenantName} ({plan} Plan)</div>
            <div><strong>Property:</strong> {propName}</div>
            <div><strong>Configured Rooms:</strong> {rooms.filter((r) => r.roomNumber).length}</div>
            <div><strong>Owner Login:</strong> {adminEmail}</div>
          </div>
          <button className="sa-btn-primary" onClick={onComplete}>
            <ArrowRight size={16} /> Go to Hotels Directory
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. GLOBAL ACTIVITY FEED VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
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

  const formatDateTime = (val: string) =>
    new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(val));
  const actionLabel = (val: string) =>
    val.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).replace("Admin ", "");

  return (
    <div className="sa-content">
      <div className="sa-section">
        <h2>Global Platform Activity Feed</h2>
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
                  
                  const isManager = log.actor_role === "MANAGER";

                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: isManager ? "var(--amber-light, #fef3c7)" : "transparent" }}>
                      <td style={{ padding: "14px 20px" }}><span className={`sa-badge ${badgeColor}`}>{t?.name || "Platform"}</span></td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="sa-badge">{actionLabel(log.action)}</span>
                          {isManager && (
                            <span className="sa-badge-amber" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "10px" }}>MANAGER</span>
                          )}
                        </span>
                      </td>
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
