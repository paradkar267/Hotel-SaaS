"use client";

import {
  AlertTriangle,
  BadgeIndianRupee,
  Check,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  FileText,
  Hotel,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { HotelData, ModalState, Row } from "./hotel-types";

export function HotelActionModal({
  modal,
  data,
  onClose,
  onSwitch,
  onSuccess,
}: {
  modal: ModalState;
  data: HotelData;
  onClose: () => void;
  onSwitch: (modal: ModalState) => void;
  onSuccess: (message: string) => Promise<void> | void;
}) {
  if (!modal) return null;

  const content = (() => {
    switch (modal.type) {
      case "checkin":
        return <CheckInForm data={data} onClose={onClose} onSwitch={onSwitch} onSuccess={onSuccess} />;
      case "manager":
        return <ManagerForm onClose={onClose} onSuccess={onSuccess} />;
      case "toggle_manager":
        return <ToggleManagerForm user={modal.user} onClose={onClose} onSuccess={onSuccess} />;
      case "guest":
        return <GuestForm guest={modal.guest} onClose={onClose} onSuccess={onSuccess} />;
      case "stay":
        return <StayForm booking={modal.booking} data={data} onClose={onClose} onSwitch={onSwitch} onSuccess={onSuccess} />;
      case "invoice":
        return <InvoiceForm booking={modal.booking} property={data.property} onClose={onClose} onSwitch={onSwitch} onSuccess={onSuccess} />;
      case "view_invoice":
        return <InvoiceViewModal invoice={modal.invoice} property={data.property} onClose={onClose} onSwitch={onSwitch} />;
      case "payment":
        return <PaymentForm invoice={modal.invoice} property={data.property} onClose={onClose} onSuccess={onSuccess} />;
      case "checkout":
        return <CheckoutForm booking={modal.booking} onClose={onClose} onSuccess={onSuccess} />;
      case "room":
        return <RoomForm room={modal.room} onClose={onClose} onSuccess={onSuccess} />;
      case "settings":
        return <PropertyForm property={data.property} onClose={onClose} onSuccess={onSuccess} />;
      case "void_invoice":
        return <VoidInvoiceForm invoice={modal.invoice} onClose={onClose} onSuccess={onSuccess} />;
    }
  })();

  return <>{content}</>;
}

function CheckInForm({ data, onClose, onSwitch, onSuccess }: FormProps & { data: HotelData; onSwitch: (modal: ModalState) => void }) {
  const availableRooms = data.rooms.filter((room) => room.status === "AVAILABLE");
  const [roomId, setRoomId] = useState(String(availableRooms[0]?.id ?? ""));
  const selectedRoom = availableRooms.find((room) => String(room.id) === roomId);
  const [nightlyRate, setNightlyRate] = useState(Number(selectedRoom?.baseRatePaise ?? 0) / 100);
  const [billingType, setBillingType] = useState("NON_GST");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeRoom(nextRoomId: string) {
    setRoomId(nextRoomId);
    const room = availableRooms.find((candidate) => String(candidate.id) === nextRoomId);
    setNightlyRate(Number(room?.baseRatePaise ?? 0) / 100);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const expected = String(form.get("expectedCheckOutAt"));
      const result = await submitJson({
        action: "create_checkin",
        roomId,
        fullName: form.get("fullName"),
        phone: form.get("phone"),
        email: form.get("email"),
        address: form.get("address"),
        city: form.get("city"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
        country: form.get("country"),
        nationality: form.get("nationality"),
        idType: form.get("idType"),
        idLast4: form.get("idLast4"),
        adults: form.get("adults"),
        children: form.get("children"),
        expectedCheckOutAt: new Date(expected).toISOString(),
        nightlyRate,
        billingType,
        companyName: billingType === "GST" ? form.get("companyName") : "",
        guestGstin: billingType === "GST" ? form.get("guestGstin") : "",
        guestState: billingType === "GST" ? form.get("guestState") : form.get("state"),
        notes: form.get("notes"),
      });
      let message = String(result.message ?? "Guest checked in.");
      if (file && result.guestId) {
        const upload = new FormData();
        upload.set("guestId", String(result.guestId));
        upload.set("file", file);
        const response = await fetch("/api/documents", { method: "POST", body: upload });
        const uploadResult = await response.json() as { error?: string };
        if (!response.ok) message += ` The check-in is safe, but the ID document needs retrying: ${uploadResult.error ?? "upload failed"}`;
      }
      await onSuccess(message);
      
      const newBooking = {
        id: result.bookingId,
        expectedCheckOutAt: new Date(expected).toISOString(),
        checkInAt: new Date().toISOString(),
        guestName: form.get("fullName"),
        roomNumber: selectedRoom?.roomNumber,
        nightlyRatePaise: nightlyRate * 100,
        billingType: billingType
      };
      onSwitch({ type: "invoice", booking: newBooking as Row });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New guest check-in" subtitle="Front desk · confirmed records lock automatically" icon={<ClipboardCheck size={21} />} onClose={onClose} wide>
      {availableRooms.length === 0 ? <ModalAlert tone="warning" icon={<AlertTriangle size={17} />} text="No clean rooms are available. An admin must release a room first." /> : null}
      <form onSubmit={submit} className="action-form">
        <FormSection title="Guest details" description="Only collect information needed for this stay.">
          <div className="form-grid two">
            <Field label="Full name" name="fullName" placeholder="e.g. Priya Sharma" required />
            <Field label="Mobile number" name="phone" placeholder="+91 98••• •••••" inputMode="tel" required />
            <Field label="Email" name="email" placeholder="guest@example.com" type="email" />
            <Field label="Nationality" name="nationality" defaultValue="Indian" required />
            <Field label="Address" name="address" placeholder="Street address" />
            <Field label="City" name="city" placeholder="Pune" />
            <Field label="State" name="state" placeholder="Maharashtra" required />
            <Field label="Postal code" name="postalCode" placeholder="411001" inputMode="numeric" />
            <input type="hidden" name="country" value="India" />
          </div>
        </FormSection>
        <FormSection title="ID verification" description="Store only the final four digits; upload the full proof privately.">
          <div className="form-grid two">
            <SelectField label="ID proof type" name="idType" defaultValue="AADHAAR" options={[["AADHAAR", "Aadhaar"], ["PASSPORT", "Passport"], ["DRIVING_LICENCE", "Driving licence"], ["VOTER_ID", "Voter ID"], ["OTHER", "Other"]]} />
            <Field label="Final 4 ID digits" name="idLast4" placeholder="1234" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required />
          </div>
          <label className="upload-field">
            <UploadCloud size={20} />
            <span><b>{file ? file.name : "Attach ID proof (optional)"}</b><small>Private PDF, JPG, or PNG · max 5 MB</small></span>
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
        </FormSection>
        <FormSection title="Stay & room" description="Room occupancy is reserved atomically when you confirm.">
          <div className="form-grid three">
            <SelectField label="Available room" name="roomId" value={roomId} onChange={(event) => changeRoom(event.target.value)} options={availableRooms.map((room) => [String(room.id), `${String(room.roomNumber)} · ${String(room.roomType)}`])} required />
            <Field label="Adults" name="adults" type="number" min={1} max={12} defaultValue="1" required />
            <Field label="Children" name="children" type="number" min={0} max={12} defaultValue="0" required />
            <Field label="Expected check-out" name="expectedCheckOutAt" type="datetime-local" defaultValue={tomorrowAtEleven()} required />
            <Field label="Nightly rate (₹)" name="nightlyRate" type="number" min={1} step="0.01" value={nightlyRate} onChange={(event) => setNightlyRate(Number(event.target.value))} required />
            <SelectField label="Billing" name="billingType" value={billingType} onChange={(event) => setBillingType(event.target.value)} options={[["NON_GST", "Non-GST bill"], ["GST", "GST tax invoice"]]} required />
          </div>
          {billingType === "GST" ? (
            <div className="form-grid three conditional-fields">
              <Field label="Company name" name="companyName" placeholder="Guest company" required />
              <Field label="Company GSTIN" name="guestGstin" placeholder="27ABCDE1234F1Z5" maxLength={15} required />
              <Field label="Place of supply" name="guestState" placeholder="Maharashtra" required />
            </div>
          ) : null}
          <TextArea label="Stay notes" name="notes" placeholder="Arrival notes, accessibility needs, preferences…" />
        </FormSection>
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel="Confirm & lock check-in" disabled={!availableRooms.length} icon={<LockKeyhole size={16} />} />
      </form>
    </Modal>
  );
}

function ManagerForm({ onClose, onSuccess }: FormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await submitJson({ action: "create_manager", name: form.get("name"), email: form.get("email"), password: form.get("password") });
      await onSuccess(String(result.message)); onClose();
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  }
  return <Modal title="Create manager access" subtitle="Admin-only · verified identity access" icon={<UserPlus size={21} />} onClose={onClose}><ModalAlert tone="secure" icon={<ShieldCheck size={17} />} text="The manager signs in using this verified email and password." /><form onSubmit={submit} className="action-form"><FormSection title="Manager identity" description="Use the exact email and a password they use to sign in."><div className="form-grid"><Field label="Manager name" name="name" placeholder="Full name" required /><Field label="Verified email" name="email" type="email" placeholder="manager@hotel.com" required /><Field label="Password" name="password" type="password" placeholder="••••••••" required /></div></FormSection><div className="permission-summary"><b>Manager permission</b><span><Check size={14} /> Create guest check-ins and upload ID proof</span><span><LockKeyhole size={14} /> View confirmed stays but never edit, delete, refund, or change billing</span></div><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Create manager access" icon={<UserPlus size={16} />} /></form></Modal>;
}

function ToggleManagerForm({ user, onClose, onSuccess }: FormProps & { user: Row }) {
  const nextActive = !Boolean(user.isActive);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "toggle_manager", userId: user.id, isActive: nextActive, reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title={`${nextActive ? "Enable" : "Disable"} manager access`} subtitle={`${String(user.name)} · ${String(user.email)}`} icon={<ShieldCheck size={21} />} onClose={onClose}><form onSubmit={submit} className="action-form"><ModalAlert tone={nextActive ? "secure" : "warning"} icon={nextActive ? <Check size={17} /> : <AlertTriangle size={17} />} text={nextActive ? "This manager will regain front-desk access immediately." : "This manager will be blocked at their next request. Existing records remain intact."} /><TextArea label="Reason for this access change" name="reason" placeholder="Required for the audit log" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel={`${nextActive ? "Enable" : "Disable"} access`} /></form></Modal>;
}

function GuestForm({ guest, onClose, onSuccess }: FormProps & { guest: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "update_guest", guestId: guest.id, fullName: form.get("fullName"), phone: form.get("phone"), email: form.get("email"), address: form.get("address"), city: form.get("city"), state: form.get("state"), postalCode: form.get("postalCode"), country: form.get("country"), nationality: form.get("nationality"), notes: form.get("notes"), reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Edit guest profile" subtitle="Admin override · all differences are audited" icon={<ShieldCheck size={21} />} onClose={onClose} wide><form onSubmit={submit} className="action-form"><FormSection title="Contact & identity" description={`ID proof: ${String(guest.idType || "Not recorded")} · •••• ${String(guest.idLast4 || "—")}`}><div className="form-grid two"><Field label="Full name" name="fullName" defaultValue={String(guest.fullName)} required /><Field label="Mobile number" name="phone" defaultValue={String(guest.phone)} required /><Field label="Email" name="email" type="email" defaultValue={String(guest.email)} /><Field label="Nationality" name="nationality" defaultValue={String(guest.nationality)} /><Field label="Address" name="address" defaultValue={String(guest.address)} /><Field label="City" name="city" defaultValue={String(guest.city)} /><Field label="State" name="state" defaultValue={String(guest.state)} /><Field label="Postal code" name="postalCode" defaultValue={String(guest.postalCode)} /><Field label="Country" name="country" defaultValue={String(guest.country)} /></div><TextArea label="Guest notes" name="notes" defaultValue={String(guest.notes)} /></FormSection><TextArea label="Reason for editing this record" name="reason" placeholder="Required for the audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Save audited changes" /></form></Modal>;
}

function StayForm({ booking, data, onClose, onSwitch, onSuccess }: FormProps & { booking: Row; data: HotelData; onSwitch: (modal: ModalState) => void }) {
  const [billingType, setBillingType] = useState(String(booking.billingType));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const rooms = data.rooms.filter((room) => room.status === "AVAILABLE" || room.id === booking.roomId);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "update_booking", bookingId: booking.id, roomId: form.get("roomId"), expectedCheckOutAt: new Date(String(form.get("expectedCheckOutAt"))).toISOString(), nightlyRate: form.get("nightlyRate"), billingType, companyName: billingType === "GST" ? form.get("companyName") : "", guestGstin: billingType === "GST" ? form.get("guestGstin") : "", guestState: form.get("guestState"), notes: form.get("notes"), reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  
  const existingInvoice = data.invoices.find((i) => String(i.bookingId) === String(booking.id) || String(i.id) === String(booking.invoiceId));
  
  return (
    <Modal title={`Manage stay · Room ${String(booking.roomNumber)}`} subtitle={`${String(booking.guestName)} · ${String(booking.bookingNumber)}`} icon={<DoorOpen size={21} />} onClose={onClose} wide>
      <div className="record-lock-banner">
        <LockKeyhole size={18} />
        <div><b>Confirmed record is locked</b><span>Only an admin override with a reason can change stay parameters.</span></div>
      </div>
      <div className="modal-action-strip" style={{ display: "flex", gap: "8px", margin: "1rem 0" }}>
        {!existingInvoice ? (
          <button
            type="button"
            className="primary-button compact"
            style={{ background: "#2563eb", color: "#fff" }}
            onClick={() => onSwitch({ type: "invoice", booking })}
          >
            <FileText size={16} /> 📄 Generate {booking.billingType === "GST" ? "GST Invoice" : "Non-GST Bill"}
          </button>
        ) : (
          <button
            type="button"
            className="secondary-button"
            style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
            onClick={() => onSwitch({ type: "view_invoice", invoice: existingInvoice })}
          >
            <FileText size={16} /> 👁️ View & Print Invoice ({pretty(String(existingInvoice.status))})
          </button>
        )}
        <button type="button" className="secondary-button" onClick={() => onSwitch({ type: "checkout", booking })}>
          <DoorOpen size={16} /> Complete check-out
        </button>
      </div>
      <form onSubmit={submit} className="action-form">
        <FormSection title="Stay details" description="Changing rooms releases the previous room to housekeeping.">
          <div className="form-grid two">
            <SelectField label="Assigned room" name="roomId" defaultValue={String(booking.roomId)} options={rooms.map((room) => [String(room.id), `${String(room.roomNumber)} · ${String(room.roomType)}`])} />
            <Field label="Expected check-out" name="expectedCheckOutAt" type="datetime-local" defaultValue={toLocalInput(String(booking.expectedCheckOutAt))} required />
            <Field label="Nightly rate (₹)" name="nightlyRate" type="number" min={1} step="0.01" defaultValue={String(Number(booking.nightlyRatePaise) / 100)} required />
            <SelectField label="Billing type" name="billingType" value={billingType} onChange={(event) => setBillingType(event.target.value)} options={[["NON_GST", "Non-GST bill"], ["GST", "GST tax invoice"]]} />
            <Field label="Place of supply" name="guestState" defaultValue={String(booking.guestState)} required />
            <Field label="Company name" name="companyName" defaultValue={String(booking.companyName)} required={billingType === "GST"} disabled={billingType !== "GST"} />
            <Field label="Company GSTIN" name="guestGstin" defaultValue={String(booking.guestGstin)} required={billingType === "GST"} disabled={billingType !== "GST"} />
          </div>
          <TextArea label="Stay notes" name="notes" defaultValue={String(booking.notes)} />
        </FormSection>
        <TextArea label="Admin override reason" name="reason" placeholder="Required and stored permanently" required />
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel="Apply admin override" icon={<ShieldCheck size={16} />} />
      </form>
    </Modal>
  );
}

function InvoiceForm({ booking, property, onClose, onSwitch, onSuccess }: FormProps & { booking: Row; property: Row; onSwitch: (modal: ModalState) => void }) {
  const suggestedNights = Math.max(1, Math.ceil((new Date(String(booking.expectedCheckOutAt)).getTime() - new Date(String(booking.checkInAt)).getTime()) / 86_400_000));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const gst = booking.billingType === "GST";
  
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await submitJson({
        action: "create_invoice",
        bookingId: booking.id,
        nights: form.get("nights"),
        extras: form.get("extras"),
        extrasDescription: form.get("extrasDescription"),
        gstRateBps: form.get("gstRateBps")
      });
      await onSuccess(String(result.message));
      
      const createdInvoice: Row = {
        id: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        bookingId: booking.id,
        billingType: booking.billingType,
        guestName: booking.guestName,
        roomNumber: booking.roomNumber,
        totalPaise: result.totalPaise,
        balancePaise: result.totalPaise,
        status: "UNPAID",
        issuedAt: new Date().toISOString(),
        companyName: booking.companyName,
        guestGstin: booking.guestGstin,
        guestState: booking.guestState,
      };
      
      onSwitch({ type: "view_invoice", invoice: createdInvoice });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={gst ? "Generate GST Tax Invoice" : "Generate Non-GST Bill"}
      subtitle={`${String(booking.guestName)} · Room ${String(booking.roomNumber)}`}
      icon={<FileText size={21} />}
      onClose={onClose}
    >
      <ModalAlert
        tone="secure"
        icon={<BadgeIndianRupee size={17} />}
        text={`Generating ${gst ? "Section 31 Tax Invoice" : "Hospitality Folio"}. Once generated, you can view, print, or record offline payment.`}
      />
      <form onSubmit={submit} className="action-form">
        <FormSection title="Stay Billing Calculation" description={`Nightly rate: ${money(Number(booking.nightlyRatePaise))}.`}>
          <div className="form-grid two">
            <Field label="Chargeable nights" name="nights" type="number" min={1} max={365} defaultValue={String(suggestedNights)} required />
            <Field label="Additional charges / extras (₹)" name="extras" type="number" min={0} step="0.01" defaultValue="0" required />
            <Field label="Extras description" name="extrasDescription" defaultValue="Room service / Food / Laundry" />
            <SelectField label="GST tax rate" name="gstRateBps" defaultValue={gst ? String(property.defaultGstBps ?? 1200) : "0"} disabled={!gst} options={[["0", "0% (Non-GST)"], ["500", "5% GST"], ["1200", "12% GST"], ["1800", "18% GST"]]} />
          </div>
        </FormSection>
        {gst ? (
          <p className="tax-note" style={{ fontSize: "0.8rem", color: "#475569", background: "#f1f5f9", padding: "8px", borderRadius: "4px" }}>
            💡 Same-state guest splits 50% CGST + 50% SGST. Out-of-state guest applies 100% IGST under SAC Code 996311.
          </p>
        ) : null}
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel={`Generate & Preview ${gst ? "GST Invoice" : "Bill"}`} icon={<FileText size={16} />} />
      </form>
    </Modal>
  );
}

function InvoiceViewModal({ invoice, property, onClose, onSwitch }: { invoice: Row; property: Row; onClose: () => void; onSwitch: (modal: ModalState) => void }) {
  const isGst = invoice.billingType === "GST";
  const balancePaise = Number(invoice.balancePaise || 0);
  const isUnpaid = balancePaise > 0 && invoice.status !== "VOID";
  const totalInr = (Number(invoice.totalPaise) || 0) / 100;
  const balanceInr = balancePaise / 100;

  const upiId = property?.upi_id || "hotelos@upi";
  const upiName = property?.upi_name || property?.name || "HotelOS";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(String(upiName))}&am=${balanceInr.toFixed(2)}&cu=INR&tn=Invoice_${invoice.invoiceNumber}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUrl)}&size=160x160`;

  return (
    <Modal
      title={isGst ? "Tax Invoice (GST)" : "Hospitality Folio (Non-GST)"}
      subtitle={`${String(invoice.invoiceNumber)} · Room ${String(invoice.roomNumber || "")}`}
      icon={<FileText size={21} />}
      onClose={onClose}
      wide
    >
      <div className="invoice-document" style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", color: "#1e293b", fontFamily: "sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #334155", paddingBottom: "1rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#0f172a" }}>{String(property?.name || "The Meridian Grand")}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>{String(property?.address || "")} · {String(property?.state || "")}</p>
            {isGst && property?.gstin ? <p style={{ margin: "2px 0 0", fontSize: "0.85rem", fontWeight: 600 }}>Hotel GSTIN: {String(property.gstin)}</p> : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "inline-block", background: isGst ? "#eff6ff" : "#f0fdf4", color: isGst ? "#1d4ed8" : "#15803d", fontWeight: 700, padding: "4px 10px", borderRadius: "4px", fontSize: "0.85rem", border: `1px solid ${isGst ? "#bfdbfe" : "#bbf7d0"}` }}>
              {isGst ? "TAX INVOICE (Sec 31 CGST Act)" : "GUEST FOLIO / BILL"}
            </span>
            <p style={{ margin: "6px 0 0", fontSize: "0.95rem", fontWeight: 700 }}>{String(invoice.invoiceNumber)}</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>Issued: {invoice.issuedAt ? new Date(String(invoice.issuedAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
          </div>
        </div>

        {/* Guest info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "6px", marginBottom: "1.2rem", fontSize: "0.875rem" }}>
          <div>
            <small style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 600 }}>Billed To (Guest)</small>
            <p style={{ margin: "4px 0 0", fontWeight: 700 }}>{String(invoice.guestName || "Guest")}</p>
            {isGst && invoice.companyName ? <p style={{ margin: "2px 0 0", color: "#334155" }}>Company: <b>{String(invoice.companyName)}</b></p> : null}
            {isGst && invoice.guestGstin ? <p style={{ margin: "2px 0 0", color: "#334155" }}>GSTIN: <b>{String(invoice.guestGstin)}</b></p> : null}
          </div>
          <div>
            <small style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 600 }}>Stay & Room Information</small>
            <p style={{ margin: "4px 0 0" }}>Room Number: <b>{String(invoice.roomNumber || "—")}</b></p>
            {isGst ? <p style={{ margin: "2px 0 0", color: "#334155" }}>SAC Code: <b>996311 (Accommodation)</b></p> : null}
            <p style={{ margin: "2px 0 0", color: "#334155" }}>Payment Status: <b style={{ color: invoice.status === "PAID" ? "#16a34a" : "#ea580c" }}>{String(invoice.status)}</b></p>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ margin: "1rem 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left", background: "#f1f5f9" }}>
                <th style={{ padding: "8px" }}>Description</th>
                {isGst ? <th style={{ padding: "8px" }}>SAC</th> : null}
                <th style={{ padding: "8px", textAlign: "right" }}>Taxable (₹)</th>
                {isGst ? <th style={{ padding: "8px", textAlign: "right" }}>CGST</th> : null}
                {isGst ? <th style={{ padding: "8px", textAlign: "right" }}>SGST / IGST</th> : null}
                <th style={{ padding: "8px", textAlign: "right" }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 8px" }}>Room Accommodation & Hospitality Services</td>
                {isGst ? <td style={{ padding: "10px 8px" }}>996311</td> : null}
                <td style={{ padding: "10px 8px", textAlign: "right" }}>{money(Number(invoice.subtotalPaise || invoice.totalPaise || 0))}</td>
                {isGst ? <td style={{ padding: "10px 8px", textAlign: "right" }}>{money(Number(invoice.cgstPaise || 0))}</td> : null}
                {isGst ? <td style={{ padding: "10px 8px", textAlign: "right" }}>{money(Number(invoice.sgstPaise || 0) + Number(invoice.igstPaise || 0))}</td> : null}
                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>{money(Number(invoice.totalPaise || 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals & UPI QR */}
        <div style={{ display: "grid", gridTemplateColumns: isUnpaid ? "160px 1fr" : "1fr", gap: "1.5rem", alignItems: "center", marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
          {isUnpaid ? (
            <div style={{ textAlign: "center", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <img src={qrCodeUrl} alt="UPI QR" style={{ width: "120px", height: "120px", borderRadius: "4px", background: "white", padding: "4px" }} />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Scan to Pay with GPay/PhonePe</p>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "240px", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: "#64748b" }}>Sub-Total:</span>
                <b>{money(Number(invoice.subtotalPaise || invoice.totalPaise || 0))}</b>
              </div>
              {isGst && (Number(invoice.cgstPaise || 0) > 0 || Number(invoice.sgstPaise || 0) > 0) ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#475569" }}>
                    <span>CGST:</span>
                    <span>{money(Number(invoice.cgstPaise || 0))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#475569" }}>
                    <span>SGST:</span>
                    <span>{money(Number(invoice.sgstPaise || 0))}</span>
                  </div>
                </>
              ) : null}
              {isGst && Number(invoice.igstPaise || 0) > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#475569" }}>
                  <span>IGST:</span>
                  <span>{money(Number(invoice.igstPaise || 0))}</span>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "2px solid #334155", fontSize: "1.05rem", marginTop: "4px" }}>
                <b>Grand Total:</b>
                <b style={{ color: "#0f172a" }}>{money(Number(invoice.totalPaise || 0))}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#16a34a" }}>
                <span>Amount Paid:</span>
                <b>{money(Number(invoice.paidPaise || (Number(invoice.totalPaise) - Number(invoice.balancePaise)) || 0))}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: balancePaise > 0 ? "#dc2626" : "#16a34a", fontSize: "0.95rem" }}>
                <b>Balance Due:</b>
                <b>{money(balancePaise)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="modal-footer" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between" }}>
        <button type="button" className="secondary-button" onClick={() => window.print()}>
          🖨️ Print / Save PDF
        </button>
        <div style={{ display: "flex", gap: "8px" }}>
          {isUnpaid ? (
            <button type="button" className="primary-button" onClick={() => onSwitch({ type: "payment", invoice })}>
              💳 Record Counter Payment
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </footer>
    </Modal>
  );
}

function PaymentForm({ invoice, property, onClose, onSuccess }: FormProps & { invoice: Row; property: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(String(Number(invoice.balancePaise) / 100));

  const totalInr = Number(amount) || 0;
  const upiId = property?.upi_id || "hotelos@upi";
  const upiName = property?.upi_name || "HotelOS";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(String(upiName))}&am=${totalInr.toFixed(2)}&cu=INR&tn=Invoice_${invoice.invoiceNumber}`;
  // Use api.qrserver.com for more reliable free QR code generation
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUrl)}&size=200x200`;

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "record_payment", invoiceId: invoice.id, amount: form.get("amount"), method: form.get("method"), reference: form.get("reference"), note: form.get("note") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Record manual payment" subtitle={`${String(invoice.invoiceNumber)} · ${String(invoice.guestName)}`} icon={<CreditCard size={21} />} onClose={onClose}><div className="balance-callout"><span>Invoice balance</span><strong>{money(Number(invoice.balancePaise))}</strong></div><form onSubmit={submit} className="action-form"><div className="form-grid two"><Field label="Amount received (₹)" name="amount" type="number" min={0.01} max={Number(invoice.balancePaise) / 100} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /><SelectField label="Payment method" name="method" value={method} onChange={(e) => setMethod(e.target.value)} options={[["CASH", "Cash"], ["CARD_TERMINAL", "Card terminal (offline record)"], ["UPI_MANUAL", "UPI (manual reference)"], ["BANK_TRANSFER", "Bank transfer"]]} /></div>
  
  {method === "UPI_MANUAL" && totalInr > 0 ? (
    <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", margin: "10px 0" }}>
      <h4 style={{ margin: "0 0 10px 0", color: "#334155" }}>Guest QR Code (UPI)</h4>
      <img src={qrCodeUrl} alt="UPI QR" style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "5px", background: "white", width: "150px", height: "150px" }} />
      <p style={{ margin: "10px 0 0 0", fontSize: "13px", color: "#64748b" }}>Ask the guest to scan this code to pay ₹{totalInr.toFixed(2)}</p>
    </div>
  ) : null}

  <Field label="Reference / receipt number" name="reference" placeholder={method === "UPI_MANUAL" ? "Enter UPI UTR / Ref No. (e.g. 3123...)" : "Optional for cash"} /><TextArea label="Payment note" name="note" placeholder="Optional internal note" /><ModalAlert tone="secure" icon={<ShieldCheck size={17} />} text="HotelOS records this transaction but does not move money or contact a payment gateway." /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Record payment" icon={<Check size={16} />} /></form></Modal>;
}

function CheckoutForm({ booking, onClose, onSuccess }: FormProps & { booking: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "checkout", bookingId: booking.id, reason: form.get("reason") }); await onSuccess(String(result.message) + " A review request email has been sent to the guest."); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Complete guest check-out" subtitle={`${String(booking.guestName)} · Room ${String(booking.roomNumber)}`} icon={<DoorOpen size={21} />} onClose={onClose}><ModalAlert tone="warning" icon={<AlertTriangle size={17} />} text={booking.invoiceStatus !== "PAID" ? "Warning: The invoice for this stay is not fully paid." : "The room will move to Housekeeping."} /><form onSubmit={submit} className="action-form"><TextArea label="Check-out note / reason" name="reason" defaultValue="Guest departed; account settled" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Confirm check-out & send review email" /></form></Modal>;
}

function RoomForm({ room, onClose, onSuccess }: FormProps & { room: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "update_room", roomId: room.id, status: form.get("status"), reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title={`Room ${String(room.roomNumber)}`} subtitle={`${String(room.roomType)} · current: ${pretty(String(room.status))}`} icon={<Hotel size={21} />} onClose={onClose}><form onSubmit={submit} className="action-form"><SelectField label="New room status" name="status" defaultValue={room.status === "OCCUPIED" ? "HOUSEKEEPING" : String(room.status)} options={[["AVAILABLE", "Available · clean and ready"], ["HOUSEKEEPING", "Housekeeping"], ["MAINTENANCE", "Maintenance block"]]} /><TextArea label="Reason for status change" name="reason" placeholder="Required for audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Update room" /></form></Modal>;
}

function PropertyForm({ property, onClose, onSuccess }: FormProps & { property: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "update_property", name: form.get("name"), address: form.get("address"), city: form.get("city"), state: form.get("state"), postalCode: form.get("postalCode"), gstin: form.get("gstin"), defaultGstBps: form.get("defaultGstBps"), reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Hotel settings" subtitle="Admin configuration · invoice defaults" icon={<Hotel size={21} />} onClose={onClose} wide><form onSubmit={submit} className="action-form"><FormSection title="Property identity" description="Appears on operational screens and invoices."><div className="form-grid two"><Field label="Property name" name="name" defaultValue={String(property.name)} required /><Field label="Registered address" name="address" defaultValue={String(property.address)} /><Field label="City" name="city" defaultValue={String(property.city)} /><Field label="Registered state" name="state" defaultValue={String(property.state)} required /><Field label="Postal code" name="postalCode" defaultValue={String(property.postalCode)} /><Field label="Hotel GSTIN" name="gstin" defaultValue={String(property.gstin)} maxLength={15} /><SelectField label="Default GST rate" name="defaultGstBps" defaultValue={String(property.defaultGstBps)} options={[["0", "0%"], ["500", "5%"], ["1200", "12%"], ["1800", "18%"]]} /></div></FormSection><TextArea label="Reason for configuration change" name="reason" placeholder="Required for audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Save hotel settings" /></form></Modal>;
}

function VoidInvoiceForm({ invoice, onClose, onSuccess }: FormProps & { invoice: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "void_invoice", invoiceId: invoice.id, reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Void invoice" subtitle={`${String(invoice.invoiceNumber)} · ${money(Number(invoice.totalPaise))}`} icon={<AlertTriangle size={21} />} onClose={onClose}><ModalAlert tone="warning" icon={<AlertTriangle size={17} />} text="Only an invoice with no recorded payments can be voided. The invoice and reason remain in the audit history." /><form onSubmit={submit} className="action-form"><TextArea label="Reason for voiding" name="reason" placeholder="Required for audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Void invoice" danger /></form></Modal>;
}

type FormProps = { onClose: () => void; onSuccess: (message: string) => Promise<void> | void };

function Modal({ title, subtitle, icon, onClose, wide = false, children }: { title: string; subtitle: string; icon: ReactNode; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><span className="modal-icon">{icon}</span><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header><div className="modal-body">{children}</div></section></div>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="form-section"><div className="form-section-heading"><h3>{title}</h3><p>{description}</p></div>{children}</section>; }

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string };
function Field({ label, name, ...props }: FieldProps) { return <label className="field"><span>{label}{props.required ? <em>*</em> : null}</span><input name={name} {...props} /></label>; }
function SelectField({ label, name, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: Array<readonly [string, string]> }) { return <label className="field"><span>{label}{props.required ? <em>*</em> : null}</span><select name={name} {...props}>{options.map(([value, optionLabel]) => <option value={value} key={value}>{optionLabel}</option>)}</select></label>; }
function TextArea({ label, name, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) { return <label className="field"><span>{label}{props.required ? <em>*</em> : null}</span><textarea name={name} rows={3} {...props} /></label>; }
function FormError({ message }: { message: string }) { return message ? <div className="form-error"><AlertTriangle size={16} />{message}</div> : null; }
function ModalAlert({ tone, icon, text }: { tone: "warning" | "secure"; icon: ReactNode; text: string }) { return <div className={`modal-alert ${tone}`}>{icon}<span>{text}</span></div>; }
function ModalFooter({ onClose, busy, submitLabel, icon, disabled = false, danger = false }: { onClose: () => void; busy: boolean; submitLabel: string; icon?: ReactNode; disabled?: boolean; danger?: boolean }) { return <footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className={`primary-button ${danger ? "danger" : ""}`} disabled={busy || disabled}>{busy ? <LoaderCircle className="spin" size={17} /> : icon}{busy ? "Saving…" : submitLabel}</button></footer>; }

async function submitJson(payload: Record<string, unknown>) {
  const response = await fetch("/api/hotel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as Record<string, unknown> & { error?: string; fields?: Record<string, string[]> };
  if (!response.ok) {
    const fieldMessage = result.fields ? Object.values(result.fields).flat().find(Boolean) : undefined;
    throw new Error(fieldMessage || result.error || "The request could not be completed.");
  }
  return result;
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }
function tomorrowAtEleven() { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(11, 0, 0, 0); return toLocalInput(date.toISOString()); }
function toLocalInput(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((paise || 0) / 100); }
function pretty(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
