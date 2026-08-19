"use client";

import {
  AlertTriangle,
  BadgeIndianRupee,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  FileText,
  Hotel,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Printer,
  Download,
  UploadCloud,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
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
        return <InvoiceForm booking={modal.booking} property={data.property} onClose={onClose} onSuccess={onSuccess} />;
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
      case "print_invoice":
        return <PrintInvoiceModal invoice={modal.invoice} data={data} onClose={onClose} onSwitch={onSwitch} />;
      case "edit_room":
        return <EditRoomForm room={modal.room} onClose={onClose} onSuccess={onSuccess} />;
    }
  })();

  return <>{content}</>;
}

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const GST_STATE_MAP: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh"
};

function GstBillingSection({
  propertyState = "",
  defaultCompanyName = "",
  defaultGstin = "",
  defaultState = "",
  defaultGstBps = 1200,
  nightlyRate = 0,
  roomCount = 1,
  disabled = false,
}: {
  propertyState?: string;
  defaultCompanyName?: string;
  defaultGstin?: string;
  defaultState?: string;
  defaultGstBps?: number;
  nightlyRate?: number;
  roomCount?: number;
  disabled?: boolean;
}) {
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [gstin, setGstin] = useState(defaultGstin);
  const [guestState, setGuestState] = useState(defaultState || propertyState || "Maharashtra");
  
  // Real-world Indian Hotel GST Slab: <= ₹7,500/night -> 12% GST, > ₹7,500/night -> 18% GST
  const autoRate = nightlyRate > 7500 ? "1800" : (defaultGstBps ? String(defaultGstBps) : "1200");
  const [gstRateBps, setGstRateBps] = useState(autoRate);

  useEffect(() => {
    if (nightlyRate > 7500) {
      setGstRateBps("1800");
    } else if (nightlyRate > 0 && !defaultGstBps) {
      setGstRateBps("1200");
    }
  }, [nightlyRate, defaultGstBps]);

  function handleGstinChange(val: string) {
    const uppercaseVal = val.toUpperCase().trim();
    setGstin(uppercaseVal);

    if (uppercaseVal.length >= 2) {
      const code = uppercaseVal.slice(0, 2);
      if (GST_STATE_MAP[code]) {
        setGuestState(GST_STATE_MAP[code]);
      }
    }
  }

  const isSameState = !guestState || !propertyState || propertyState.trim().toLowerCase() === guestState.trim().toLowerCase();
  const gstRatePercent = Number(gstRateBps) / 100;
  const subtotal = (nightlyRate || 0) * (roomCount || 1);
  const totalTax = Math.round((subtotal * Number(gstRateBps)) / 10000);
  const cgst = isSameState ? Math.floor(totalTax / 2) : 0;
  const sgst = isSameState ? totalTax - cgst : 0;
  const igst = isSameState ? 0 : totalTax;
  const grandTotal = subtotal + totalTax;

  return (
    <div style={{ marginTop: "14px", marginBottom: "14px" }}>
      <div className="form-grid two conditional-fields">
        <Field
          label="Company name (optional)"
          name="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Optional for B2B company billing"
          disabled={disabled}
        />
        <Field
          label="Company GSTIN (optional)"
          name="guestGstin"
          value={gstin}
          onChange={(e) => handleGstinChange(e.target.value)}
          placeholder="Optional (e.g. 27ABCDE1234F1Z5)"
          maxLength={15}
          title="Format: 15-character alphanumeric GSTIN"
          disabled={disabled}
        />
        <SelectField
          label="Place of supply"
          name="guestState"
          value={guestState}
          onChange={(e) => setGuestState(e.target.value)}
          options={INDIAN_STATES.map((st) => [st, st])}
          disabled={disabled}
        />
        <SelectField
          label="GST rate"
          name="gstRateBps"
          value={gstRateBps}
          onChange={(e) => setGstRateBps(e.target.value)}
          options={[
            ["1200", "12% GST (Tariff ≤ ₹7,500/night)"],
            ["1800", "18% GST (Luxury Tariff > ₹7,500/night)"],
            ["500", "5% GST"],
            ["0", "0% GST"]
          ]}
          required
          disabled={disabled}
        />
      </div>

      {subtotal > 0 && (
        <div style={{
          marginTop: "12px",
          padding: "12px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          fontSize: "12.5px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#475569" }}>
            <span>Room Tariff (SAC: 996311) {roomCount > 1 ? `(${roomCount} Rooms)` : ""}:</span>
            <strong style={{ color: "#1e293b" }}>₹{subtotal.toLocaleString("en-IN")}</strong>
          </div>
          {isSameState ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#64748b" }}>
                <span>CGST ({gstRatePercent / 2}%):</span>
                <span style={{ fontWeight: 600, color: "#334155" }}>+₹{cgst.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#64748b" }}>
                <span>SGST ({gstRatePercent / 2}%):</span>
                <span style={{ fontWeight: 600, color: "#334155" }}>+₹{sgst.toLocaleString("en-IN")}</span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#64748b" }}>
              <span>IGST ({gstRatePercent}% - Inter-State):</span>
              <span style={{ fontWeight: 600, color: "#334155" }}>+₹{igst.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>Estimated Total Bill (with GST):</span>
            <strong style={{ color: "#15803d", fontSize: "14px" }}>₹{grandTotal.toLocaleString("en-IN")}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckInForm({ data, onClose, onSwitch, onSuccess }: FormProps & { data: HotelData; onSwitch: (modal: ModalState) => void }) {
  const availableRooms = data.rooms.filter((room) => room.status === "AVAILABLE");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(
    availableRooms[0] ? [String(availableRooms[0].id)] : []
  );
  const [nightlyRate, setNightlyRate] = useState(
    Number(availableRooms[0]?.baseRatePaise ?? 0) / 100
  );
  const [billingType, setBillingType] = useState("NON_GST");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleRoom(id: string) {
    setSelectedRoomIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      
      if (next.length > 0) {
        const selectedRooms = availableRooms.filter((r) => next.includes(String(r.id)));
        const totalBaseRate = selectedRooms.reduce((sum, r) => sum + (Number(r.baseRatePaise ?? 0) / 100), 0);
        const avgRate = totalBaseRate / selectedRooms.length;
        setNightlyRate(Math.round(avgRate * 100) / 100);
      } else {
        setNightlyRate(0);
      }
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedRoomIds.length === 0) {
      setError("Please select at least one room.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const expected = String(form.get("expectedCheckOutAt"));
      const result = await submitJson({
        action: "create_checkin",
        roomId: selectedRoomIds[0],
        roomIds: selectedRoomIds,
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
      onClose();
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
            <Field label="City" name="city" placeholder="Pune" />
            <input type="hidden" name="address" value="" />
            <input type="hidden" name="state" value="" />
            <input type="hidden" name="postalCode" value="" />
            <input type="hidden" name="nationality" value="Indian" />
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
          <div className="form-field full-width" style={{ marginBottom: "16px" }}>
            <label className="field-label" style={{ fontWeight: 600, fontSize: "14px", display: "block", marginBottom: "8px" }}>
              Select Rooms (Select one or more)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {availableRooms.map((room) => {
                const isChecked = selectedRoomIds.includes(String(room.id));
                const roomRate = (Number(room.baseRatePaise ?? 0) / 100).toLocaleString("en-IN");
                return (
                  <button
                    key={String(room.id)}
                    type="button"
                    onClick={() => toggleRoom(String(room.id))}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: isChecked ? "2px solid var(--green)" : "1px solid var(--line)",
                      background: isChecked ? "var(--green-soft)" : "var(--paper)",
                      color: isChecked ? "var(--green)" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {isChecked && <Check size={14} strokeWidth={3} />}
                    Room {String(room.roomNumber)} ({String(room.roomType)} - ₹{roomRate})
                  </button>
                );
              })}
            </div>
            {selectedRoomIds.length > 1 && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "var(--paper-soft)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "12.5px" }}>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>Selected Rooms Rate Breakdown:</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                  {availableRooms.filter(r => selectedRoomIds.includes(String(r.id))).map(r => (
                    <span key={String(r.id)} style={{ background: "var(--paper)", border: "1px solid var(--line)", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", color: "var(--ink-soft)" }}>
                      Room {String(r.roomNumber)} ({String(r.roomType)}): <strong style={{ color: "var(--green)" }}>₹{(Number(r.baseRatePaise ?? 0) / 100).toLocaleString("en-IN")}</strong>/night
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedRoomIds.length === 0 && (
              <span style={{ color: "var(--red)", fontSize: "12px", marginTop: "4px", display: "block" }}>
                * Select at least one room
              </span>
            )}
          </div>
          <div className="form-grid three">
            <Field label="Adults (Total)" name="adults" type="number" min={1} max={12} defaultValue="1" required />
            <Field label="Children (Total)" name="children" type="number" min={0} max={12} defaultValue="0" required />
            <Field label="Expected check-out" name="expectedCheckOutAt" type="datetime-local" defaultValue={tomorrowAtEleven()} required />
            <Field label="Nightly rate per room (₹)" name="nightlyRate" type="number" min={1} step="0.01" value={nightlyRate} onChange={(event) => setNightlyRate(Number(event.target.value))} required />
            <SelectField label="Billing" name="billingType" value={billingType} onChange={(event) => setBillingType(event.target.value)} options={[["NON_GST", "Non-GST bill"], ["GST", "GST tax invoice"]]} required />
          </div>
          {billingType === "GST" ? (
            <GstBillingSection
              propertyState={String(data.property?.state || "")}
              defaultState={String(data.property?.state || "Maharashtra")}
              nightlyRate={nightlyRate}
              roomCount={selectedRoomIds.length || 1}
            />
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
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "update_guest", guestId: guest.id, fullName: form.get("fullName"), phone: form.get("phone"), email: form.get("email"), city: form.get("city"), country: form.get("country"), notes: form.get("notes"), reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Edit guest profile" subtitle="Admin override · all differences are audited" icon={<ShieldCheck size={21} />} onClose={onClose} wide><form onSubmit={submit} className="action-form"><FormSection title="Contact & identity" description={`ID proof: ${String(guest.idType || "Not recorded")} · •••• ${String(guest.idLast4 || "—")}`}><div className="form-grid two"><Field label="Full name" name="fullName" defaultValue={String(guest.fullName)} required /><Field label="Mobile number" name="phone" defaultValue={String(guest.phone)} required /><Field label="Email" name="email" type="email" defaultValue={String(guest.email)} /><Field label="City" name="city" defaultValue={String(guest.city)} /><Field label="Country" name="country" defaultValue={String(guest.country || "India")} /></div><TextArea label="Guest notes" name="notes" defaultValue={String(guest.notes)} /></FormSection><TextArea label="Reason for editing this record" name="reason" placeholder="Required for the audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Save audited changes" /></form></Modal>;
}

function StayForm({ booking, data, onClose, onSwitch, onSuccess }: FormProps & { booking: Row; data: HotelData; onSwitch: (modal: ModalState) => void }) {
  const [billingType, setBillingType] = useState(String(booking.billingType));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const rooms = data.rooms.filter((room) => room.status === "AVAILABLE" || room.id === booking.roomId);
  const hasInvoice = !!booking.invoiceId;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await submitJson({
        action: "update_booking",
        bookingId: booking.id,
        roomId: form.get("roomId"),
        expectedCheckOutAt: new Date(String(form.get("expectedCheckOutAt"))).toISOString(),
        nightlyRate: form.get("nightlyRate"),
        billingType,
        companyName: billingType === "GST" ? form.get("companyName") : "",
        guestGstin: billingType === "GST" ? form.get("guestGstin") : "",
        guestState: billingType === "GST" ? form.get("guestState") : (form.get("guestState") || String(data.property?.state || "")),
        notes: form.get("notes"),
        reason: form.get("reason")
      });
      await onSuccess(String(result.message)); onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Manage stay · Room ${String(booking.roomNumber)}`} subtitle={`${String(booking.guestName)} · ${String(booking.bookingNumber)}`} icon={<DoorOpen size={21} />} onClose={onClose} wide>
      {hasInvoice ? (
        <div className="record-lock-banner" style={{ background: "#fffbeb", border: "1px solid #fef3c7", color: "#b45309" }}>
          <AlertTriangle size={18} />
          <div>
            <b>Stay details are locked</b>
            <span>An active invoice has already been issued. Void the invoice to modify stay details.</span>
          </div>
        </div>
      ) : (
        <div className="record-lock-banner"><LockKeyhole size={18} /><div><b>Confirmed record is locked</b><span>Only an admin override with a reason can change it.</span></div></div>
      )}
      <div className="modal-action-strip">
        {!booking.invoiceId ? <button className="secondary-button" onClick={() => onSwitch({ type: "invoice", booking })}><FileText size={16} /> Create invoice</button> : <span className="invoice-state"><FileText size={15} /> Invoice {pretty(String(booking.invoiceStatus))}</span>}
        <button className="primary-button compact" onClick={() => onSwitch({ type: "checkout", booking })}><DoorOpen size={16} /> Complete check-out</button>
      </div>
      <form onSubmit={submit} className="action-form">
        <FormSection title="Stay details" description="Changing rooms releases the previous room to housekeeping.">
          <div className="form-grid two">
            <SelectField label="Assigned room" name="roomId" defaultValue={String(booking.roomId)} options={rooms.map((room) => [String(room.id), `${String(room.roomNumber)} · ${String(room.roomType)}`])} disabled={hasInvoice} />
            <Field label="Expected check-out" name="expectedCheckOutAt" type="datetime-local" defaultValue={toLocalInput(String(booking.expectedCheckOutAt))} required disabled={hasInvoice} />
            <Field label="Nightly rate (₹)" name="nightlyRate" type="number" min={1} step="0.01" defaultValue={String(Number(booking.nightlyRatePaise) / 100)} required disabled={hasInvoice} />
            <SelectField label="Billing type" name="billingType" value={billingType} onChange={(event) => setBillingType(event.target.value)} options={[["NON_GST", "Non-GST bill"], ["GST", "GST tax invoice"]]} disabled={hasInvoice} />
          </div>
          {billingType === "GST" ? (
            <GstBillingSection
              propertyState={String(data.property?.state || "")}
              defaultCompanyName={String(booking.companyName || "")}
              defaultGstin={String(booking.guestGstin || "")}
              defaultState={String(booking.guestState || data.property?.state || "Maharashtra")}
              disabled={hasInvoice}
            />
          ) : (
            <input type="hidden" name="guestState" value={String(booking.guestState || data.property?.state || "Maharashtra")} />
          )}
          <TextArea label="Stay notes" name="notes" defaultValue={String(booking.notes)} disabled={hasInvoice} />
        </FormSection>
        <TextArea label="Admin override reason" name="reason" placeholder={hasInvoice ? "Stay locked (invoice exists)" : "Required and stored permanently"} required disabled={hasInvoice} />
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel="Apply admin override" icon={<ShieldCheck size={16} />} disabled={hasInvoice} />
      </form>
    </Modal>
  );
}

function InvoiceForm({ booking, property, onClose, onSuccess }: FormProps & { booking: Row; property: Row }) {
  const suggestedNights = Math.max(1, Math.ceil((new Date(String(booking.expectedCheckOutAt)).getTime() - new Date(String(booking.checkInAt)).getTime()) / 86_400_000));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "create_invoice", bookingId: booking.id, nights: form.get("nights"), extras: form.get("extras"), extrasDescription: form.get("extrasDescription"), gstRateBps: form.get("gstRateBps") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  const gst = booking.billingType === "GST";
  return <Modal title={`${gst ? "GST" : "Non-GST"} invoice`} subtitle={`${String(booking.guestName)} · Room ${String(booking.roomNumber)}`} icon={<FileText size={21} />} onClose={onClose}><ModalAlert tone="secure" icon={<BadgeIndianRupee size={17} />} text="This creates an invoice record only. Payment is collected offline and entered separately—no gateway is called." /><form onSubmit={submit} className="action-form"><FormSection title="Invoice calculation" description={`Nightly rate ${money(Number(booking.nightlyRatePaise))}. Tax rates remain configurable.`}><div className="form-grid two"><Field label="Chargeable nights" name="nights" type="number" min={1} max={365} defaultValue={String(suggestedNights)} required /><Field label="Additional charges (₹)" name="extras" type="number" min={0} step="0.01" defaultValue="0" required /><Field label="Additional charge description" name="extrasDescription" defaultValue="Additional services" /><SelectField label="GST rate" name="gstRateBps" defaultValue={gst ? String(property.defaultGstBps ?? 1200) : "0"} disabled={!gst} options={[["0", "0%"], ["500", "5%"], ["1200", "12%"], ["1800", "18%"]]} /></div></FormSection>{gst ? <p className="tax-note">Same-state supply splits GST into CGST + SGST; another state uses IGST. Confirm the applicable hotel tariff and tax rate with your accountant.</p> : null}<FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Issue invoice" icon={<FileText size={16} />} /></form></Modal>;
}

function PaymentForm({ invoice, property, onClose, onSuccess }: FormProps & { invoice: Row; property: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(String(Number(invoice.balancePaise) / 100));
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const totalInr = Number(amount) || 0;
  const upiId = String(property?.upiId || property?.upi_id || "hotelos@upi");
  const upiName = String(property?.upiName || property?.upi_name || "HotelOS");
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalInr.toFixed(2)}&cu=INR&tn=Invoice_${invoice.invoiceNumber}`;

  useEffect(() => {
    if (upiUrl) {
      QRCode.toDataURL(upiUrl, { width: 200, margin: 1 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error("Error generating QR", err));
    }
  }, [upiUrl]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      let reference = "";
      if (method === "UPI_MANUAL") {
        const upiRef = String(form.get("upiRef") || "");
        reference = upiRef ? `UPI: ${upiRef}` : `UPI Ref: ${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      } else if (method === "CARD_TERMINAL") {
        const last4 = String(form.get("cardLast4") || "");
        const approvalCode = String(form.get("approvalCode") || "");
        reference = `Card ****${last4} | Approval: ${approvalCode}`;
      } else if (method === "BANK_TRANSFER") {
        reference = String(form.get("reference") || "");
      }
      const result = await submitJson({ action: "record_payment", invoiceId: invoice.id, amount: form.get("amount"), method, reference, note: form.get("note") || "" });
      await onSuccess(String(result.message)); onClose();
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  }

  return (
    <Modal title="Record payment" subtitle={`${String(invoice.invoiceNumber)} · ${String(invoice.guestName)}`} icon={<CreditCard size={21} />} onClose={onClose}>
      <div className="balance-callout"><span>Invoice balance</span><strong>{money(Number(invoice.balancePaise))}</strong></div>
      <form onSubmit={submit} className="action-form">
        <div className="form-grid two">
          <Field label="Amount received (₹)" name="amount" type="number" min={0.01} max={Number(invoice.balancePaise) / 100} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <SelectField label="Payment method" name="method" value={method} onChange={(e) => setMethod(e.target.value)} options={[["CASH", "💵 Cash"], ["UPI_MANUAL", "📱 UPI"], ["CARD_TERMINAL", "💳 Card (POS terminal)"], ["BANK_TRANSFER", "🏦 Bank transfer / NEFT / RTGS"]]} />
        </div>

        {method === "UPI_MANUAL" && totalInr > 0 ? (
          <div style={{ marginTop: "12px", marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "22px 18px",
                background: "linear-gradient(180deg, #f0fdf4 0%, #f7fee7 100%)",
                borderRadius: "16px",
                border: "1px solid #bbf7d0",
                boxShadow: "0 4px 16px -2px rgba(16, 185, 129, 0.08)",
                textAlign: "center",
              }}
            >
              {/* Header Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 14px",
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: "20px",
                  color: "#15803d",
                  fontSize: "12px",
                  fontWeight: "600",
                  marginBottom: "14px",
                }}
              >
                <span>📱 Scan & Pay with any UPI App</span>
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "10px",
                  borderRadius: "14px",
                  border: "1px solid #86efac",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "14px",
                }}
              >
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="UPI QR"
                    style={{
                      display: "block",
                      width: "160px",
                      height: "160px",
                      borderRadius: "8px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "160px",
                      height: "160px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#166534",
                      fontSize: "12px",
                    }}
                  >
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Amount & UPI Details */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "19px", fontWeight: "800", color: "#14532d", letterSpacing: "-0.5px" }}>
                  ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "6px",
                    padding: "4px 12px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <span style={{ color: "#64748b" }}>UPI ID:</span>
                  <strong style={{ color: "#0f172a", userSelect: "all" }}>{upiId}</strong>
                </div>
              </div>

              {/* Supported apps */}
              <p style={{ margin: 0, fontSize: "11px", color: "#16a34a", fontWeight: "500" }}>
                Google Pay • PhonePe • Paytm • BHIM • Cred
              </p>
            </div>
            <div style={{ marginTop: "12px" }}>
              <Field label="UPI Transaction Ref / UTR (optional)" name="upiRef" placeholder="e.g. 423189028341 (auto-generated if left blank)" />
            </div>
          </div>
        ) : null}

        {method === "CARD_TERMINAL" ? (
          <div className="payment-method-section">
            <ModalAlert tone="secure" icon={<ShieldCheck size={17} />} text="Enter the details from the POS terminal receipt. HotelOS does not process the card directly." />
            <div className="form-grid two">
              <Field label="Card last 4 digits" name="cardLast4" placeholder="1234" maxLength={4} inputMode="numeric" pattern="[0-9]{4}" required />
              <Field label="Approval / Auth code" name="approvalCode" placeholder="From terminal slip" required />
            </div>
          </div>
        ) : null}

        {/* ─── Bank transfer: Reference number ─── */}
        {method === "BANK_TRANSFER" ? (
          <div className="payment-method-section">
            <Field label="Transaction reference (NEFT/RTGS/IMPS)" name="reference" placeholder="UTR or reference number" required />
          </div>
        ) : null}

        {/* ─── Cash: nothing extra needed ─── */}
        {method === "CASH" ? (
          <ModalAlert tone="secure" icon={<Check size={17} />} text="No receipt reference needed for cash. The system will log the amount and timestamp automatically." />
        ) : null}

        <TextArea label="Payment note (optional)" name="note" placeholder="Internal note — not shown to guest" />
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel={`Record ₹${totalInr.toFixed(0)} payment`} icon={<Check size={16} />} />
      </form>
    </Modal>
  );
}

function CheckoutForm({ booking, onClose, onSuccess }: FormProps & { booking: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const canCheckout = booking.invoiceStatus === "PAID";
  
  async function submit(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); 
    if (!canCheckout) return;
    setBusy(true); setError(""); 
    try { 
      const form = new FormData(event.currentTarget); 
      const result = await submitJson({ action: "checkout", bookingId: booking.id, reason: form.get("reason") }); 
      await onSuccess(String(result.message)); 
      onClose(); 
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } 
  }
  
  return (
    <Modal title="Complete guest check-out" subtitle={`${String(booking.guestName)} · Room ${String(booking.roomNumber)}`} icon={<DoorOpen size={21} />} onClose={onClose}>
      {!canCheckout ? (
        <ModalAlert tone="warning" icon={<AlertTriangle size={17} />} text={!booking.invoiceId ? "Cannot check out. No invoice has been generated for this stay." : "Cannot check out. The invoice for this stay is not fully paid."} />
      ) : (
        <ModalAlert tone="secure" icon={<Check size={17} />} text="The invoice is paid in full. Check-out will move the room to Housekeeping." />
      )}
      <form onSubmit={submit} className="action-form">
        {canCheckout ? (
          <>
            <TextArea label="Check-out note / reason" name="reason" defaultValue="Guest departed; account settled" required />
            <FormError message={error} />
            <ModalFooter onClose={onClose} busy={busy} submitLabel="Confirm check-out & send review email" />
          </>
        ) : (
          <ModalFooter onClose={onClose} busy={false} submitLabel="Close" />
        )}
      </form>
    </Modal>
  );
}

function RoomForm({ room, onClose, onSuccess }: FormProps & { room: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "update_room", roomId: room.id, status: form.get("status"), reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title={`Room ${String(room.roomNumber)}`} subtitle={`${String(room.roomType)} · current: ${pretty(String(room.status))}`} icon={<Hotel size={21} />} onClose={onClose}><form onSubmit={submit} className="action-form"><SelectField label="New room status" name="status" defaultValue={room.status === "OCCUPIED" ? "HOUSEKEEPING" : String(room.status)} options={[["AVAILABLE", "Available · clean and ready"], ["HOUSEKEEPING", "Housekeeping"], ["MAINTENANCE", "Maintenance block"]]} /><TextArea label="Reason for status change" name="reason" placeholder="Required for audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Update room" /></form></Modal>;
}

function EditRoomForm({ room, onClose, onSuccess }: FormProps & { room: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await submitJson({
        action: "edit_room_details",
        roomId: room.id,
        roomNumber: form.get("roomNumber"),
        roomType: form.get("roomType"),
        floor: form.get("floor"),
        baseRatePaise: Number(form.get("baseRate")) * 100
      });
      await onSuccess(String(result.message));
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Edit Room ${String(room.roomNumber)}`} subtitle="Update room details" icon={<Hotel size={21} />} onClose={onClose}>
      <form onSubmit={submit} className="action-form">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field label="Room Number" name="roomNumber" defaultValue={String(room.roomNumber)} required />
          <Field label="Floor" name="floor" defaultValue={String(room.floor)} required />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field label="Room Type" name="roomType" defaultValue={String(room.roomType)} required />
          <Field label="Base Rate (₹)" name="baseRate" type="number" step="0.01" min="0" defaultValue={String(Number(room.baseRatePaise) / 100)} required />
        </div>
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel="Save changes" />
      </form>
    </Modal>
  );
}

function PropertyForm({ property, onClose, onSuccess }: FormProps & { property: Row }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState(String(property.logoUrl || property.logo_url || ""));
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await submitJson({
        action: "update_property",
        name: form.get("name"),
        address: form.get("address"),
        city: form.get("city"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
        gstin: form.get("gstin"),
        defaultGstBps: form.get("defaultGstBps"),
        contactPhone: form.get("contactPhone"),
        contactEmail: form.get("contactEmail"),
        upiId: form.get("upiId"),
        upiName: form.get("upiName"),
        checkInTime: form.get("checkInTime"),
        checkOutTime: form.get("checkOutTime"),
        googleReviewLink: form.get("googleReviewLink"),
        logoUrl: logoUrl,
        reason: form.get("reason"),
      });
      await onSuccess(String(result.message));
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Hotel settings" subtitle="Admin configuration · branding & invoice defaults" icon={<Hotel size={21} />} onClose={onClose} wide>
      <form onSubmit={submit} className="action-form">
        <FormSection title="Property identity & branding" description="Appears on guest screens, bills, and tax invoices.">
          <div className="form-grid two">
            <Field label="Property name" name="name" defaultValue={String(property.name)} required />
            <Field label="Registered address" name="address" defaultValue={String(property.address || "")} />
            <Field label="City" name="city" defaultValue={String(property.city || "")} />
            <Field label="Registered state" name="state" defaultValue={String(property.state || "Maharashtra")} required />
            <Field label="Postal code" name="postalCode" defaultValue={String(property.postalCode || property.postal_code || "")} />
            <Field label="Hotel GSTIN" name="gstin" defaultValue={String(property.gstin || "")} maxLength={15} />
            <SelectField label="Default GST rate" name="defaultGstBps" defaultValue={String(property.defaultGstBps ?? property.default_gst_bps ?? 1200)} options={[["0", "0%"], ["500", "5%"], ["1200", "12%"], ["1800", "18%"]]} />
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Brand Logo</span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ flex: 1 }} />
                {uploadingLogo && <LoaderCircle className="spin" size={16} />}
              </div>
              {logoUrl && logoUrl !== "null" && (
                <div style={{ marginTop: "6px" }}>
                  <img src={logoUrl} alt="Logo preview" style={{ height: "36px", objectFit: "contain", borderRadius: "4px", border: "1px solid var(--line)" }} />
                </div>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Contact & Payments" description="Used on invoices and for generating payment QR codes.">
          <div className="form-grid two">
            <Field label="Contact phone" name="contactPhone" defaultValue={String(property.contactPhone || property.contact_phone || "")} placeholder="+91 98765 43210" />
            <Field label="Contact email" name="contactEmail" defaultValue={String(property.contactEmail || property.contact_email || "")} placeholder="info@hotel.com" type="email" />
            <Field label="UPI ID (VPA)" name="upiId" defaultValue={String(property.upiId || property.upi_id || "hotelos@upi")} placeholder="merchant@upi" required />
            <Field label="UPI Receiver Name" name="upiName" defaultValue={String(property.upiName || property.upi_name || property.name || "HotelOS")} placeholder="Hotel Legal Name" required />
            <Field label="Default check-in time" name="checkInTime" defaultValue={String(property.checkInTime || property.check_in_time || "14:00")} type="time" />
            <Field label="Default check-out time" name="checkOutTime" defaultValue={String(property.checkOutTime || property.check_out_time || "11:00")} type="time" />
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Google Review Link" name="googleReviewLink" defaultValue={String(property.googleReviewLink || property.google_review_link || "")} placeholder="https://g.page/r/.../review" />
            </div>
          </div>
        </FormSection>

        <TextArea label="Reason for configuration change" name="reason" placeholder="Required for audit trail" required />
        <FormError message={error} />
        <ModalFooter onClose={onClose} busy={busy} submitLabel="Save hotel settings" />
      </form>
    </Modal>
  );
}

function VoidInvoiceForm({ invoice, onClose, onSuccess }: FormProps & { invoice: Row }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const form = new FormData(event.currentTarget); const result = await submitJson({ action: "void_invoice", invoiceId: invoice.id, reason: form.get("reason") }); await onSuccess(String(result.message)); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } }
  return <Modal title="Void invoice" subtitle={`${String(invoice.invoiceNumber)} · ${money(Number(invoice.totalPaise))}`} icon={<AlertTriangle size={21} />} onClose={onClose}><ModalAlert tone="warning" icon={<AlertTriangle size={17} />} text="Only an invoice with no recorded payments can be voided. The invoice and reason remain in the audit history." /><form onSubmit={submit} className="action-form"><TextArea label="Reason for voiding" name="reason" placeholder="Required for audit trail" required /><FormError message={error} /><ModalFooter onClose={onClose} busy={busy} submitLabel="Void invoice" danger /></form></Modal>;
}

function PrintInvoiceModal({
  invoice,
  data,
  onClose,
  onSwitch,
}: {
  invoice: Row;
  data: HotelData;
  onClose: () => void;
  onSwitch: (modal: ModalState) => void;
}) {
  const property = data.property;
  const booking = data.bookings.find((b) => String(b.id) === String(invoice.bookingId)) || {};
  const guest = data.guests.find((g) => String(g.id) === String(booking.guestId)) || {};
  
  console.log("PrintInvoiceModal Debug:", {
    invoiceBookingId: invoice.bookingId,
    invoiceId: invoice.id,
    bookingIdType: typeof invoice.bookingId,
    foundBooking: booking,
    foundGuest: guest,
    dataBookingsLength: data.bookings.length
  });
  const isGst = invoice.billingType === "GST";

  const totalPaise = Number(invoice.totalPaise) || 0;
  const paidPaise = Number(invoice.paidPaise) || 0;
  const balancePaise = Number(invoice.balancePaise) || 0;
  const subtotalPaise = Number(invoice.subtotalPaise) || 0;
  const cgstPaise = Number(invoice.cgstPaise) || 0;
  const sgstPaise = Number(invoice.sgstPaise) || 0;
  const igstPaise = Number(invoice.igstPaise) || 0;

  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const upiId = String(property.upiId || property.upi_id || "hotelos@upi");
  const upiName = String(property.upiName || property.upi_name || property.name || "HotelOS");
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${(balancePaise / 100).toFixed(2)}&cu=INR&tn=Invoice_${invoice.invoiceNumber}`;

  useEffect(() => {
    if (upiUrl) {
      QRCode.toDataURL(upiUrl, { width: 160, margin: 1 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error("Error generating QR", err));
    }
  }, [upiUrl]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const element = document.getElementById("invoice-printable-content");
      if (!element) return;
      
      const opt = {
        margin:       [10, 10, 10, 10] as [number, number, number, number],
        filename:     `Invoice_${invoice.invoiceNumber}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Dynamically import to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (val: string | unknown) => {
    if (!val) return "N/A";
    return new Date(String(val)).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (val: string | unknown) => {
    if (!val) return "N/A";
    const date = new Date(String(val));
    const d = date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const t = date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return `${d} ${t}`;
  };

  const logo = property.logoUrl || property.logo_url;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal-card wide print-modal-card" role="dialog" aria-modal="true">
        <header className="modal-header with-actions print-hide">
          <span className="modal-icon"><FileText size={21} /></span>
          <div>
            <h2>Invoice {String(invoice.invoiceNumber)}</h2>
            <p>Official Tax Document · {isGst ? "GST Registered" : "Non-GST Bill"}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", marginLeft: "auto", marginRight: "12px" }}>
            <button className="primary-button compact" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} 
              {isDownloading ? "Generating PDF..." : "Download PDF"}
            </button>
            {balancePaise > 0 && (
              <button className="secondary-button compact" onClick={() => onSwitch({ type: "payment", invoice })}>
                <CreditCard size={16} /> Record Payment
              </button>
            )}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="printable-invoice-container" id="invoice-printable-content" style={{ padding: "24px 32px", background: "#ffffff", color: "#334155" }}>
          <div className="printable-invoice" style={{ maxWidth: "100%", margin: "0 auto" }}>
            {/* Header: Hotel Brand & Invoice Title */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b", margin: 0 }}>{String(property.name)}</h2>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0", maxWidth: "400px", lineHeight: "1.4" }}>
                  {String(property.address || "")}{property.city ? `, ${property.city}` : ""}{property.state ? `, ${property.state}` : ""}{property.postalCode ? ` - ${property.postalCode}` : ""}
                </p>
                {Boolean(property.contactPhone) && (
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
                    Phone: {String(property.contactPhone)}
                  </p>
                )}
                {Boolean(property.gstin) && (
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
                    <strong>GSTIN:</strong> {String(property.gstin)}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  display: "inline-block",
                  background: "#334155",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  {isGst ? "Tax Invoice" : "Guest Bill"}
                </div>
                <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                  Invoice No: <strong style={{ color: "#1e293b" }}>{String(invoice.invoiceNumber)}</strong>
                </p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                  Date: <strong style={{ color: "#1e293b" }}>{formatDate(invoice.issuedAt)}</strong>
                </p>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "16px 0" }} />

            {/* Guest & Stay Info in 2 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              <div>
                <h3 style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", margin: "0 0 8px 0", letterSpacing: "0.5px" }}>Billed To</h3>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", margin: "0 0 4px 0" }}>{String(booking.companyName || invoice.guestName || guest.fullName || "Valued Guest")}</p>
                {Boolean(booking.companyName) && Boolean(guest.fullName) && (
                  <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 2px 0" }}>Attn: <strong>{String(guest.fullName)}</strong></p>
                )}
                {Boolean(booking.guestGstin) && (
                  <p style={{ fontSize: "12px", color: "#0369a1", margin: "0 0 2px 0" }}><strong>Guest GSTIN:</strong> {String(booking.guestGstin)}</p>
                )}
                {Boolean(guest.phone) && <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>Phone: {String(guest.phone)}</p>}
                {Boolean(guest.email) && <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>Email: {String(guest.email)}</p>}
                {isGst && Boolean(booking.guestState || property.state) && (
                  <p style={{ fontSize: "11.5px", color: "#64748b", margin: "2px 0 0 0" }}>Place of Supply: <strong>{String(booking.guestState || property.state)}</strong></p>
                )}
              </div>
              <div>
                <h3 style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", margin: "0 0 8px 0", letterSpacing: "0.5px" }}>Stay Details</h3>
                <p style={{ fontSize: "13px", color: "#1e293b", margin: "0 0 4px 0" }}>
                  Room Number: <strong>{String(invoice.roomNumber || booking.roomNumber || "N/A")}</strong>
                </p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
                  Check-in: <strong style={{ color: "#334155" }}>{formatDateTime(booking.checkInAt)}</strong>
                </p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                  Check-out: <strong style={{ color: "#334155" }}>{formatDateTime(booking.actualCheckOutAt || booking.expectedCheckOutAt)}</strong>
                </p>
                <p style={{ fontSize: "11px", color: "#047857", margin: "4px 0 0 0", fontWeight: "600" }}>
                  Service Category: SAC 996311 (Hotel Accommodation)
                </p>
              </div>
            </div>

            {/* Charges Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Description</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>SAC</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                  <td style={{ padding: "12px", fontSize: "13px", color: "#334155" }}>
                    Room Accommodation Charges (Room {String(invoice.roomNumber || booking.roomNumber || "N/A")})
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
                    996311
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                    {money(subtotalPaise)}
                  </td>
                </tr>
                {/* Additional / Extra Charges if present */}
                {Number(invoice.totalPaise) - subtotalPaise - cgstPaise - sgstPaise - igstPaise > 0 && (
                  <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                    <td style={{ padding: "12px", fontSize: "13px", color: "#334155" }}>
                      Additional / Extras Services
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
                      996331
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                      {money(Number(invoice.totalPaise) - subtotalPaise - cgstPaise - sgstPaise - igstPaise)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Payments History (Full Width) */}
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px 0", fontWeight: "700" }}>Payments Received</h4>
              {invoice.payments && (invoice.payments as any[]).length > 0 ? (
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #cbd5e1", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "6px 0", fontWeight: "600" }}>Date</th>
                      <th style={{ padding: "6px 0", fontWeight: "600" }}>Method</th>
                      <th style={{ padding: "6px 0", fontWeight: "600" }}>Reference / Receipt No</th>
                      <th style={{ padding: "6px 0", fontWeight: "600", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.payments as any[]).map((p, idx) => (
                      <tr key={String(p.id || idx)} style={{ borderBottom: "1px solid #edf2f7" }}>
                        <td style={{ padding: "8px 0", color: "#64748b" }}>{formatDate(p.receivedAt)}</td>
                        <td style={{ padding: "8px 0", color: "#334155", fontWeight: "500" }}>{String(p.method)}</td>
                        <td style={{ padding: "8px 0", color: "#64748b" }}>{String(p.reference || "-")}</td>
                        <td style={{ padding: "8px 0", color: "#334155", textAlign: "right", fontWeight: "600" }}>{money(Number(p.amountPaise))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No payments recorded.</p>
              )}
            </div>

            {/* UPI QR / Paid Seal & Totals (Flex Layout) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              {/* Left Column: Paid Seal or QR */}
              <div>
                {balancePaise <= 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#16a34a", background: "#f0fdf4", padding: "8px 12px", borderRadius: "6px", width: "fit-content" }}>
                    <CheckCircle2 size={18} />
                    <strong style={{ fontSize: "12px", textTransform: "uppercase" }}>Paid In Full</strong>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#fffbeb", padding: "10px", borderRadius: "8px", border: "1px solid #fef3c7", width: "fit-content" }}>
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="UPI QR" style={{ width: "64px", height: "64px" }} />
                    ) : (
                      <div style={{ width: "64px", height: "64px", background: "#f1f5f9" }} />
                    )}
                    <div>
                      <h5 style={{ fontSize: "12px", fontWeight: "700", color: "#78350f", margin: 0 }}>Scan to Pay Balance</h5>
                      <p style={{ fontSize: "11px", color: "#92400e", margin: "2px 0 0 0" }}>UPI ID: <strong>{upiId}</strong></p>
                      <p style={{ fontSize: "11px", color: "#92400e", margin: 0 }}>Amount: <strong>{money(balancePaise)}</strong></p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Totals summary */}
              <div style={{ width: "260px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0", color: "#64748b" }}>
                  <span>Taxable Subtotal:</span>
                  <strong style={{ color: "#334155" }}>{money(subtotalPaise)}</strong>
                </div>
                {isGst && cgstPaise > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0", color: "#64748b" }}>
                    <span>CGST ({((Number(invoice.gstRateBps) || 1200) / 200)}%):</span>
                    <strong style={{ color: "#334155" }}>{money(cgstPaise)}</strong>
                  </div>
                )}
                {isGst && sgstPaise > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0", color: "#64748b" }}>
                    <span>SGST ({((Number(invoice.gstRateBps) || 1200) / 200)}%):</span>
                    <strong style={{ color: "#334155" }}>{money(sgstPaise)}</strong>
                  </div>
                )}
                {isGst && igstPaise > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0", color: "#64748b" }}>
                    <span>IGST ({((Number(invoice.gstRateBps) || 1200) / 100)}%):</span>
                    <strong style={{ color: "#334155" }}>{money(igstPaise)}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "700", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", margin: "8px 0", padding: "8px 0", color: "#1e293b" }}>
                  <span>Total Amount Payable:</span>
                  <span>{money(totalPaise)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0", color: "#64748b" }}>
                  <span>Paid:</span>
                  <strong style={{ color: "#16a34a" }}>{money(paidPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", marginTop: "8px", paddingTop: "8px", fontSize: "13px", fontWeight: "700", color: balancePaise > 0 ? "#b45309" : "#64748b" }}>
                  <span>Balance:</span>
                  <span>{money(balancePaise)}</span>
                </div>
              </div>
            </div>

            {/* Signature Line */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "32px" }}>
              <div style={{ textAlign: "center", minWidth: "150px" }}>
                <div style={{ borderTop: "1px solid #cbd5e1", marginTop: "24px", paddingTop: "4px" }} />
                <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
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
