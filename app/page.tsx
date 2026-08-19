import { ArrowRight, Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { chatGPTSignOutPath } from "./chatgpt-auth";
import { getIdentity, getSession } from "../lib/auth";
import HotelApp from "../components/hotel-app";
import SuperAdminApp from "../components/superadmin-app";
import { loginAction } from "./actions/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getIdentity();

  if (!identity) {
    return (
      <main className="signin-page">
        <div className="signin-orb signin-orb-one" />
        <div className="signin-orb signin-orb-two" />
        <nav className="signin-nav">
          <Brand />
          <span className="security-pill"><LockKeyhole size={14} /> Protected workspace</span>
        </nav>
        <section className="signin-card">
          <div className="signin-copy">
            <span className="eyebrow"><ShieldCheck size={15} /> Hotel operations, under control</span>
            <h1>One calm command centre for every stay.</h1>
            <p>
              Check guests in, secure their records, issue GST or non-GST invoices,
              and give owners a live view of the entire property.
            </p>
            <form action={loginAction} className="login-form">
              <input type="email" name="email" placeholder="Email address" required className="auth-input" />
              <input type="password" name="password" placeholder="Password" required className="auth-input" />
              <button type="submit" className="primary-button signin-button">
                Sign in securely <ArrowRight size={17} />
              </button>
            </form>
            <p className="signin-help">Sign in with your admin or manager credentials.</p>
          </div>
          <div className="signin-preview" aria-hidden="true">
            <div className="preview-top"><span>Today at The Meridian</span><span className="live-dot">Live</span></div>
            <div className="preview-metric"><strong>68%</strong><span>Occupancy</span></div>
            <div className="preview-rooms">
              {["101", "102", "103", "201", "202", "203"].map((room, index) => (
                <span className={index === 1 || index === 4 ? "occupied" : "available"} key={room}>{room}</span>
              ))}
            </div>
            <div className="preview-line"><span>Latest check-in</span><strong>Room 202 · 2 min ago</strong></div>
          </div>
        </section>
        <section className="signin-features">
          <article><strong>Admin control</strong><span>Create manager accounts and control the whole property.</span></article>
          <article><strong>Secure front desk</strong><span>Managers create check-ins; confirmed records become read-only.</span></article>
          <article><strong>Manual billing</strong><span>GST and non-GST invoices, with cash or offline payment records.</span></article>
        </section>
      </main>
    );
  }

  // Check if Super Admin
  const session = await getSession();
  if (session?.role === "SUPER_ADMIN") {
    return <SuperAdminApp />;
  }

  return <HotelApp identity={identity} signOutPath={chatGPTSignOutPath("/")} />;
}

function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark"><Building2 size={20} strokeWidth={2.2} /></span>
      <span><b>HotelOS</b><small>Operations cloud</small></span>
    </span>
  );
}
