import nodemailer from "nodemailer";

import fs from 'fs';
import path from 'path';

// Attempt to manually load .env in development if Vite hasn't exposed it
if (!process.env.SMTP_USER) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  } catch (err) {
    console.error("Failed to load .env manually", err);
  }
}

export async function sendInvoiceEmail(invoiceData: {
  invoiceNumber: string;
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  billingType: string;
  totalPaise: number;
  issuedAt: string;
  paymentMethod?: string;
}) {
  console.log("--> sendInvoiceEmail triggered for:", invoiceData.guestEmail);
  console.log("--> SMTP Config:", process.env.SMTP_USER ? "Present" : "Missing");
  const totalInr = (invoiceData.totalPaise / 100).toFixed(2);
  const isGst = invoiceData.billingType === "GST";
  const taxNote = isGst ? "Includes applicable GST" : "Non-GST Bill";

  const methodMap: Record<string, string> = {
    CASH: "Cash",
    CARD_TERMINAL: "Card",
    UPI_MANUAL: "UPI",
    BANK_TRANSFER: "Bank Transfer",
  };
  const methodName = invoiceData.paymentMethod ? (methodMap[invoiceData.paymentMethod] || invoiceData.paymentMethod) : "Paid";

  const upiId = "hotelos@upi";
  const upiName = "HotelOS";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalInr}&cu=INR&tn=Invoice_${invoiceData.invoiceNumber}`;
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiUrl)}&size=200`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
      
      <!-- Header -->
      <div style="background-color: #1e293b; color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">HotelOS</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Premium Stays & Hospitality</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; font-size: 22px; color: #10b981;">RECEIPT</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${invoiceData.invoiceNumber}</p>
        </div>
      </div>

      <!-- Body -->
      <div style="padding: 40px;">
        <p style="font-size: 16px; color: #334155; margin-top: 0;">Dear <strong>${invoiceData.guestName}</strong>,</p>
        <p style="font-size: 16px; color: #475569; line-height: 1.5;">Thank you for choosing HotelOS. Your stay in Room <strong>${invoiceData.roomNumber}</strong> has been concluded and your payment was successfully processed. Below are the details of your settled invoice.</p>
        
        <!-- Invoice Details Box -->
        <div style="margin: 35px 0; padding: 25px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="margin-top: 0; font-size: 16px; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Details</h3>
          
          <table style="width: 100%; text-align: left; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Invoice Number</td>
              <td style="padding: 12px 0; font-weight: 600; color: #1e293b; text-align: right; border-bottom: 1px solid #e2e8f0;">${invoiceData.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Date Issued</td>
              <td style="padding: 12px 0; font-weight: 600; color: #1e293b; text-align: right; border-bottom: 1px solid #e2e8f0;">${new Date(invoiceData.issuedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Billing Type</td>
              <td style="padding: 12px 0; font-weight: 600; color: #1e293b; text-align: right; border-bottom: 1px solid #e2e8f0;">${isGst ? "GST Tax Invoice" : "Standard Bill"}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Payment Method</td>
              <td style="padding: 12px 0; font-weight: 600; color: #1e293b; text-align: right; border-bottom: 1px solid #e2e8f0;">${methodName}</td>
            </tr>
            <tr>
              <td style="padding: 16px 0 8px 0; font-weight: 700; font-size: 18px; color: #0f172a;">Total Amount</td>
              <td style="padding: 16px 0 8px 0; font-weight: 700; font-size: 22px; color: #10b981; text-align: right;">₹${totalInr}</td>
            </tr>
          </table>
          <p style="font-size: 13px; color: #94a3b8; text-align: right; margin: 5px 0 0 0;">${taxNote}</p>
        </div>

        ${invoiceData.paymentMethod === 'UPI_MANUAL' ? `
        <!-- UPI QR Section -->
        <div style="margin: 35px 0; text-align: center; background-color: #ffffff; padding: 25px; border: 1px dashed #cbd5e1; border-radius: 8px;">
          <h4 style="color: #334155; margin-top: 0; margin-bottom: 15px; font-size: 16px;">UPI Payment Reference</h4>
          <img src="${qrCodeUrl}" alt="UPI QR Code" style="border: 1px solid #f1f5f9; border-radius: 12px; padding: 8px; width: 160px; height: 160px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" />
          <p style="font-size: 14px; color: #64748b; margin-top: 15px; margin-bottom: 0;">Paid directly to <strong>${upiId}</strong></p>
        </div>
        ` : ''}

        <p style="font-size: 15px; color: #475569; text-align: center; margin-top: 40px; font-weight: 500;">We hope you had a pleasant stay and look forward to welcoming you back!</p>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 13px; color: #64748b; margin: 0;">This is an automatically generated receipt by the <strong>HotelOS Management System</strong>.</p>
        <p style="font-size: 12px; color: #94a3b8; margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} HotelOS. All rights reserved.</p>
      </div>
    </div>
  `;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"HotelOS" <${process.env.SMTP_USER}>`,
        to: invoiceData.guestEmail,
        subject: `Your HotelOS Invoice - ${invoiceData.invoiceNumber}`,
        html: htmlContent,
      });

      console.log(`[SUCCESS] Invoice actually sent to ${invoiceData.guestEmail} via Gmail SMTP`);
    } catch (err) {
      console.error("[ERROR] Failed to send real email via Gmail:", err);
    }
  } else {
    // MOCK SENDING - Fallback if no .env config
    console.log("===============================");
    console.log(`[MOCK EMAIL SENT TO ${invoiceData.guestEmail}]`);
    console.log(`SUBJECT: Your HotelOS Invoice - ${invoiceData.invoiceNumber}`);
    console.log("BODY: (HTML rendered template with UPI QR Code included)");
    console.log("NOTE: Add SMTP_USER and SMTP_PASS to .env to send real emails.");
    console.log("===============================");
  }

  return true;
}
