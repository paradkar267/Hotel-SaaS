// lib/server/services/notification-service.ts
// Dynamic UPI QR & Dual Invoice Email Engine

import nodemailer from "nodemailer";

export function generateUpiUrl(input: {
  upiId: string;
  upiName: string;
  amountInr: string;
  invoiceOrBillNumber: string;
}): { upiUrl: string; qrCodeUrl: string } {
  const upiId = input.upiId || "hotelos@upi";
  const upiName = input.upiName || "HotelOS";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    upiName
  )}&am=${input.amountInr}&cu=INR&tn=${encodeURIComponent(
    input.invoiceOrBillNumber
  )}`;
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
    upiUrl
  )}&size=220`;

  return { upiUrl, qrCodeUrl };
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Sends a Formal GST Tax Invoice Email to Guest
 */
export async function sendGstInvoiceEmail(data: {
  invoiceNumber: string;
  hotelName: string;
  hotelGstin: string;
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  taxableAmountInr: string;
  cgstInr: string;
  sgstInr: string;
  igstInr: string;
  totalInr: string;
  issuedAt: string;
  upiId?: string;
  upiName?: string;
}): Promise<boolean> {
  if (!data.guestEmail) return false;

  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn("SMTP credentials not configured. Skipping email dispatch.");
    return false;
  }

  const { qrCodeUrl } = generateUpiUrl({
    upiId: data.upiId || "hotelos@upi",
    upiName: data.upiName || data.hotelName,
    amountInr: data.totalInr,
    invoiceOrBillNumber: data.invoiceNumber,
  });

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #1e293b; color: white; padding: 24px 32px; display: flex; justify-content: space-between;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${data.hotelName}</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">GSTIN: ${data.hotelGstin || "N/A"}</p>
        </div>
        <div style="text-align: right;">
          <span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">TAX INVOICE</span>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">#${data.invoiceNumber}</p>
        </div>
      </div>

      <div style="padding: 24px 32px;">
        <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Dear <b>${data.guestName}</b>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">Thank you for staying with us. Please find below your official GST Tax Invoice breakdown.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 10px; text-align: left;">Description</th>
            <th style="padding: 10px; text-align: right;">Amount (₹)</th>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">Room Accommodation (${data.roomNumber}) - SAC 996311</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">₹${data.taxableAmountInr}</td>
          </tr>
          ${Number(data.cgstInr) > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b;">CGST Split</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9; color: #64748b;">₹${data.cgstInr}</td>
          </tr>` : ""}
          ${Number(data.sgstInr) > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b;">SGST Split</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9; color: #64748b;">₹${data.sgstInr}</td>
          </tr>` : ""}
          ${Number(data.igstInr) > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b;">IGST (Inter-state)</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9; color: #64748b;">₹${data.igstInr}</td>
          </tr>` : ""}
          <tr style="font-weight: 700; font-size: 16px; background: #f8fafc;">
            <td style="padding: 12px 10px;">Grand Total</td>
            <td style="padding: 12px 10px; text-align: right; color: #0f172a;">₹${data.totalInr}</td>
          </tr>
        </table>

        <div style="text-align: center; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px dashed #cbd5e1;">
          <p style="margin: 0 0 10px; font-weight: 600; color: #334155; font-size: 14px;">Instant Settlement via UPI</p>
          <img src="${qrCodeUrl}" alt="UPI QR" style="width: 150px; height: 150px; display: inline-block;" />
          <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Scan using Google Pay, PhonePe, or Paytm</p>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"HotelOS" <${process.env.SMTP_USER}>`,
      to: data.guestEmail,
      subject: `Tax Invoice #${data.invoiceNumber} from ${data.hotelName}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send GST Invoice email", err);
    return false;
  }
}

/**
 * Sends a Non-GST Hospitality Bill / Folio Email to Guest
 */
export async function sendNonGstBillEmail(data: {
  billNumber: string;
  hotelName: string;
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  roomChargesInr: string;
  amenitiesInr: string;
  discountInr: string;
  totalInr: string;
  checkInAt: string;
  checkOutAt: string;
  upiId?: string;
  upiName?: string;
}): Promise<boolean> {
  if (!data.guestEmail) return false;

  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn("SMTP credentials not configured. Skipping email dispatch.");
    return false;
  }

  const { qrCodeUrl } = generateUpiUrl({
    upiId: data.upiId || "hotelos@upi",
    upiName: data.upiName || data.hotelName,
    amountInr: data.totalInr,
    invoiceOrBillNumber: data.billNumber,
  });

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #0f766e; color: white; padding: 24px 32px; display: flex; justify-content: space-between;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${data.hotelName}</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Hospitality Folio</p>
        </div>
        <div style="text-align: right;">
          <span style="background: #14b8a6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">RECEIPT</span>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">#${data.billNumber}</p>
        </div>
      </div>

      <div style="padding: 24px 32px;">
        <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Dear <b>${data.guestName}</b>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">Thank you for choosing ${data.hotelName}. Here is your stay summary.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr style="background: #f0fdfa; border-bottom: 1px solid #ccfbf1;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: right;">Amount (₹)</th>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">Room Charges (Room ${data.roomNumber})</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">₹${data.roomChargesInr}</td>
          </tr>
          ${Number(data.amenitiesInr) > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b;">Services & Amenities</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9; color: #64748b;">₹${data.amenitiesInr}</td>
          </tr>` : ""}
          ${Number(data.discountInr) > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #059669;">Special Discount</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9; color: #059669;">-₹${data.discountInr}</td>
          </tr>` : ""}
          <tr style="font-weight: 700; font-size: 16px; background: #f0fdfa;">
            <td style="padding: 12px 10px;">Net Payable</td>
            <td style="padding: 12px 10px; text-align: right; color: #0f766e;">₹${data.totalInr}</td>
          </tr>
        </table>

        <div style="text-align: center; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px dashed #cbd5e1;">
          <p style="margin: 0 0 10px; font-weight: 600; color: #334155; font-size: 14px;">Instant Settlement via UPI</p>
          <img src="${qrCodeUrl}" alt="UPI QR" style="width: 150px; height: 150px; display: inline-block;" />
          <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Scan using Google Pay, PhonePe, or Paytm</p>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"HotelOS" <${process.env.SMTP_USER}>`,
      to: data.guestEmail,
      subject: `Stay Receipt #${data.billNumber} from ${data.hotelName}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send Non-GST Bill email", err);
    return false;
  }
}
