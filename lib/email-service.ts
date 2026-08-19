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
  reference?: string;
  hotelName?: string;
  logoUrl?: string;
  contactEmail?: string;
}) {
  console.log("--> sendInvoiceEmail triggered for:", invoiceData.guestEmail);
  console.log("--> SMTP Config:", process.env.SMTP_USER ? "Present" : "Missing");
  const totalInr = (invoiceData.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const isGst = invoiceData.billingType === "GST";
  const taxLabel = isGst ? "GST Tax Invoice" : "Standard Bill";
  const hotelName = invoiceData.hotelName || "HotelOS";
  const paidDate = new Date(invoiceData.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const methodMap: Record<string, string> = {
    CASH: "Cash",
    CARD_TERMINAL: "Card",
    UPI_MANUAL: "UPI",
    BANK_TRANSFER: "Bank Transfer",
  };
  const methodName = invoiceData.paymentMethod ? (methodMap[invoiceData.paymentMethod] || invoiceData.paymentMethod) : "Paid";

  const isMultiRoom = invoiceData.roomNumber.includes(",") || invoiceData.roomNumber.includes("&");
  const roomLabelText = isMultiRoom ? "ROOMS" : "ROOM";
  const roomIntroText = isMultiRoom ? `Rooms <strong>${invoiceData.roomNumber}</strong>` : `Room <strong>${invoiceData.roomNumber}</strong>`;

  const htmlContent = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.08);">
      
      <!-- Brand Header -->
      <div style="background-color: #0b1329; padding: 28px 32px; border-bottom: 3px solid #d97706;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${invoiceData.logoUrl && invoiceData.logoUrl !== 'null' ? `
                    <td style="padding-right: 14px;">
                      <div style="background: #000000; border: 1px solid #ca8a04; border-radius: 10px; padding: 6px 12px; display: inline-block;">
                        <img src="${invoiceData.logoUrl}" alt="${hotelName}" style="max-height: 40px; max-width: 110px; display: block; object-fit: contain;" />
                      </div>
                    </td>
                  ` : ''}
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${hotelName}</h1>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">Premium Stays & Hospitality</p>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right;">
              <span style="display: inline-block; background: #059669; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px;">PAID</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main Content -->
      <div style="padding: 36px 32px; background-color: #ffffff;">
        
        <!-- Checkmark Circle -->
        <div style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid #059669; color: #059669; font-size: 22px; font-weight: 700; line-height: 40px; text-align: center; margin: 0 auto 16px auto;">✓</div>
        
        <!-- Title -->
        <h1 style="font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 400; color: #0b1329; margin: 0 0 12px 0; text-align: center;">Payment confirmed</h1>
        
        <p style="font-size: 14px; color: #475569; text-align: center; line-height: 1.6; margin: 0 0 28px 0;">
          Dear <strong>${invoiceData.guestName}</strong>, your payment for ${roomIntroText} has been confirmed. Here is your official receipt.
        </p>

        <!-- Payment Receipt Card -->
        <div style="background-color: #fffdfa; border: 1px solid #fef3c7; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 12px;">
            <tr>
              <td><span style="font-size: 11px; font-weight: 700; color: #b45309; letter-spacing: 1px; text-transform: uppercase;">PAYMENT RECEIPT</span></td>
              <td style="text-align: right;"><span style="font-size: 13px; font-weight: 700; color: #0f172a;">${invoiceData.invoiceNumber}</span></td>
            </tr>
          </table>

          <div style="border-top: 1px solid #fef3c7; margin-bottom: 20px;"></div>

          <!-- 2x2 Grid Table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 12px; margin: -12px;">
            <tr>
              <!-- Grid 1: Date -->
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; vertical-align: top;">
                <div style="font-size: 20px; margin-bottom: 8px;">📅</div>
                <div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">DATE</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${paidDate}</div>
              </td>
              <!-- Grid 2: Room -->
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; vertical-align: top;">
                <div style="font-size: 20px; margin-bottom: 8px;">🛏️</div>
                <div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">${roomLabelText}</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${invoiceData.roomNumber}</div>
              </td>
            </tr>
            <tr>
              <!-- Grid 3: Billing Type -->
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; vertical-align: top;">
                <div style="font-size: 20px; margin-bottom: 8px;">📄</div>
                <div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">BILLING TYPE</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${taxLabel}</div>
              </td>
              <!-- Grid 4: Payment Method -->
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; vertical-align: top;">
                <div style="font-size: 20px; margin-bottom: 8px;">💳</div>
                <div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">PAYMENT METHOD</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${methodName}</div>
              </td>
            </tr>
          </table>

          <!-- Status Pill -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center; font-size: 11px; font-weight: 700; color: #059669; letter-spacing: 1px; margin-top: 20px;">
            STATUS &nbsp;•&nbsp; PAID
          </div>
        </div>

        <!-- Total Paid Card -->
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 14px; padding: 18px 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: 700; color: #166534; letter-spacing: 0.5px; text-transform: uppercase;">TOTAL PAID AMOUNT</span>
          <div style="font-size: 26px; font-weight: 800; color: #15803d; margin-top: 2px;">₹${totalInr}</div>
          ${invoiceData.reference ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #059669;">Ref / UTR: <strong>${invoiceData.reference}</strong></p>` : ''}
        </div>

        <!-- Gold Line Footer -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 32px auto 16px auto; text-align: center;">
          <span style="color: #fde68a;">————</span>
          <span style="color: #d97706; font-size: 10px;">◆</span>
          <span style="color: #fde68a;">————</span>
        </div>

        <p style="font-size: 13px; color: #64748b; text-align: center; margin: 0;">Thank you for choosing <strong>${hotelName}</strong>.</p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 18px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Automated receipt from ${hotelName}.</p>
        <p style="font-size: 11px; color: #cbd5e1; margin: 4px 0 0 0;">&copy; ${new Date().getFullYear()} ${hotelName}. All rights reserved.</p>
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
        from: `"${hotelName}" <${process.env.SMTP_USER}>`,
        to: invoiceData.guestEmail,
        replyTo: invoiceData.contactEmail || undefined,
        subject: `Payment Receipt — ${invoiceData.invoiceNumber} | ${hotelName}`,
        html: htmlContent,
      });

      console.log(`[SUCCESS] Receipt sent to ${invoiceData.guestEmail}`);
    } catch (err) {
      console.error("[ERROR] Failed to send receipt email:", err);
    }
  } else {
    console.log("===============================");
    console.log(`[MOCK RECEIPT EMAIL TO ${invoiceData.guestEmail}]`);
    console.log(`SUBJECT: Payment Receipt — ${invoiceData.invoiceNumber}`);
    console.log("NOTE: Add SMTP_USER and SMTP_PASS to .env to send real emails.");
    console.log("===============================");
  }

  return true;
}

export async function sendCheckInConfirmationEmail(data: {
  guestName: string;
  guestEmail: string;
  roomNumbers: string;
  roomCount: number;
  checkInAt: string;
  expectedCheckOutAt: string;
  hotelName?: string;
  logoUrl?: string;
  contactEmail?: string;
}) {
  console.log("--> sendCheckInConfirmationEmail triggered for:", data.guestEmail);
  const hotelName = data.hotelName || "HotelOS";
  const checkInDate = new Date(data.checkInAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const checkOutDate = new Date(data.expectedCheckOutAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const roomLabelText = data.roomCount > 1 ? `ROOMS (${data.roomCount} BOOKED)` : "ROOM";
  const roomDisplayText = data.roomCount > 1 ? `Rooms <strong>${data.roomNumbers}</strong> (${data.roomCount} Rooms)` : `Room <strong>${data.roomNumbers}</strong>`;

  const htmlContent = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.08);">
      <div style="background-color: #0b1329; padding: 28px 32px; border-bottom: 3px solid #d97706;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${hotelName}</h1>
        <p style="margin: 3px 0 0 0; font-size: 12px; color: #94a3b8;">Check-in Confirmation</p>
      </div>
      <div style="padding: 36px 32px; background-color: #ffffff;">
        <div style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid #059669; color: #059669; font-size: 22px; line-height: 40px; text-align: center; margin: 0 auto 16px auto;">✓</div>
        <h1 style="font-size: 26px; font-weight: 700; color: #0b1329; margin: 0 0 12px 0; text-align: center;">Welcome! Check-in Confirmed</h1>
        <p style="font-size: 14px; color: #475569; text-align: center; margin: 0 0 28px 0;">
          Dear <strong>${data.guestName}</strong>, your check-in for ${roomDisplayText} is confirmed.
        </p>
        <div style="background-color: #fffdfa; border: 1px solid #fef3c7; border-radius: 16px; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 12px; margin: -12px;">
            <tr>
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${roomLabelText}</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${data.roomNumbers}</div>
              </td>
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b;">CHECK-IN TIME</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${checkInDate}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b;">EXPECTED CHECK-OUT</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${checkOutDate}</div>
              </td>
              <td width="50%" style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b;">STATUS</div>
                <div style="font-size: 14px; font-weight: 700; color: #059669; margin-top: 4px;">CHECKED-IN</div>
              </td>
            </tr>
          </table>
        </div>
        <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 24px;">Thank you for choosing <strong>${hotelName}</strong>.</p>
      </div>
    </div>
  `;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: `"${hotelName}" <${process.env.SMTP_USER}>`,
        to: data.guestEmail,
        replyTo: data.contactEmail || undefined,
        subject: `Check-in Confirmation — Rooms ${data.roomNumbers} | ${hotelName}`,
        html: htmlContent
      });
      console.log(`[SUCCESS] Check-in confirmation email sent to ${data.guestEmail}`);
    } catch (err) {
      console.error("[ERROR] Failed to send check-in confirmation email:", err);
    }
  } else {
    console.log(`[MOCK CHECKIN EMAIL TO ${data.guestEmail}] Rooms: ${data.roomNumbers}`);
  }

  return true;
}

export async function sendReviewEmail(reviewData: {
  guestName: string;
  guestEmail: string;
  roomNumber?: string;
  googleReviewLink?: string;
  hotelName?: string;
  logoUrl?: string;
  contactEmail?: string;
}) {
  console.log("--> sendReviewEmail triggered for:", reviewData.guestEmail);
  const hotelName = reviewData.hotelName || "HotelOS";
  const rawLink = (reviewData.googleReviewLink || "").trim();
  const hasReviewLink = rawLink.length > 0 && rawLink !== "null" && rawLink !== "undefined";
  const formattedLink = hasReviewLink ? (rawLink.startsWith("http") ? rawLink : `https://${rawLink}`) : "";
  
  const htmlContent = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.08);">
      
      <!-- Header Section -->
      <div style="background-color: #0b1329; padding: 36px 30px; text-align: center; border-bottom: 3px solid #d97706;">
        ${reviewData.logoUrl && reviewData.logoUrl !== 'null' ? `
          <div style="display: inline-block; background-color: #000000; border: 1.5px solid #ca8a04; border-radius: 14px; padding: 10px 16px; margin-bottom: 16px;">
            <img src="${reviewData.logoUrl}" alt="${hotelName}" style="max-height: 48px; max-width: 140px; display: block; object-fit: contain;" />
          </div>
        ` : ''}
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px; font-family: 'Inter', sans-serif;">${hotelName}</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #d97706; font-weight: 500; font-family: 'Inter', sans-serif;">Guest Experience & Feedback</p>
      </div>

      <!-- Main Body -->
      <div style="padding: 36px 30px; background-color: #ffffff; font-family: 'Inter', sans-serif;">
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Dear ${reviewData.guestName},</h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px;">Thank you for choosing us. We hope you enjoyed your time with us!</p>
        
        <!-- YOUR STAY Card -->
        <div style="background-color: #fffdfa; border: 1px solid #fef3c7; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td width="44" style="vertical-align: middle;">
                <div style="width: 36px; height: 36px; background: #fffbeb; border-radius: 10px; border: 1px solid #fde68a; text-align: center; line-height: 36px;">
                  <span style="font-size: 18px; color: #ca8a04;">🏨</span>
                </div>
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">YOUR STAY</div>
                <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${hotelName}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- How was your stay? Card -->
        <div style="background-color: #fffdfa; border: 1px solid #fef3c7; border-radius: 16px; padding: 32px 20px; text-align: center;">
          <h2 style="font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 400; color: #0b1329; margin: 0 0 12px 0;">How was your stay?</h2>
          
          <!-- Diamond Divider -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 auto 20px auto; text-align: center;">
            <span style="color: #fde68a;">————</span>
            <span style="color: #d97706; font-size: 10px;">◆</span>
            <span style="color: #fde68a;">————</span>
          </div>

          <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0;">Tap a star to rate your experience</p>
          
          <!-- 5 Stars Outlines -->
          ${hasReviewLink ? `
          <div style="margin-bottom: 24px;">
            <a href="${formattedLink}" target="_blank" style="text-decoration: none; display: inline-block;">
              <span style="font-size: 36px; color: #ca8a04; letter-spacing: 8px;">☆ ☆ ☆ ☆ ☆</span>
            </a>
          </div>
          ` : `
          <div style="margin-bottom: 24px; font-size: 36px; color: #ca8a04; letter-spacing: 8px;">
            ☆ ☆ ☆ ☆ ☆
          </div>
          `}

          <!-- Inner Divider Line -->
          <div style="border-top: 1px solid #fef3c7; margin: 24px auto; width: 90%;"></div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0; padding: 0 10px;">
            Your feedback helps us continuously elevate our hospitality standards. It only takes a minute to share your review.
          </p>

          ${hasReviewLink ? `
          <div>
            <a href="${formattedLink}" target="_blank" style="background-color: #0b1329; color: #fbbf24; border: 1px solid #d97706; padding: 14px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(11, 19, 41, 0.25); letter-spacing: 0.3px;">
              Rate & Review Your Stay &nbsp;&rsaquo;
            </a>
          </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-family: 'Inter', sans-serif;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Sent with care by ${hotelName}.</p>
        <p style="font-size: 11px; color: #cbd5e1; margin: 4px 0 0 0;">&copy; ${new Date().getFullYear()} ${hotelName}. All rights reserved.</p>
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
        from: `"${hotelName}" <${process.env.SMTP_USER}>`,
        to: reviewData.guestEmail,
        replyTo: reviewData.contactEmail || undefined,
        subject: `How was your stay, ${reviewData.guestName}?`,
        html: htmlContent,
      });

      console.log(`[SUCCESS] Review email sent to ${reviewData.guestEmail}`);
    } catch (err) {
      console.error("[ERROR] Failed to send real review email via Gmail:", err);
    }
  } else {
    // MOCK SENDING
    console.log("===============================");
    console.log(`[MOCK REVIEW EMAIL SENT TO ${reviewData.guestEmail}]`);
    console.log(`SUBJECT: How was your stay, ${reviewData.guestName}?`);
    console.log("BODY: (HTML rendered review template)");
    console.log("===============================");
  }

  return true;
}

export async function sendManagerActionEmail(adminEmail: string, data: {
  managerName: string;
  managerEmail: string;
  action: string;
  module: string;
  reason: string;
  recordId: string;
}) {
  console.log("--> sendManagerActionEmail triggered for:", adminEmail);
  
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Manager Action Alert</h2>
      </div>
      <div style="padding: 30px;">
        <p>A manager has performed an action that requires your attention.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Manager:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.managerName} (${data.managerEmail})</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Action:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.action}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Module:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.module}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Record ID:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.recordId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Reason provided:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${data.reason || "None"}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 14px; color: #64748b;">You can review this change in the Audit Trail on your dashboard.</p>
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
        from: `"HotelOS Alerts" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `Manager Action Alert: ${data.action} on ${data.module}`,
        html: htmlContent,
      });

      console.log(`[SUCCESS] Manager action alert sent to ${adminEmail}`);
    } catch (err) {
      console.error("[ERROR] Failed to send real manager alert email:", err);
    }
  } else {
    // MOCK SENDING
    console.log("===============================");
    console.log(`[MOCK ALERT EMAIL SENT TO ${adminEmail}]`);
    console.log(`SUBJECT: Manager Action Alert: ${data.action} on ${data.module}`);
    console.log("BODY: (HTML rendered alert template)");
    console.log("===============================");
  }

  return true;
}
