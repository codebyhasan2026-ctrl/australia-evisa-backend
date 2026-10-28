const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

// Document category labels mapping
const DOCUMENT_CATEGORY_NAMES = {
  jobLetter: "Job Offer & Employment Letter",
  lmias: "LMIA / Labour Market Assessment",
  workPermit: "Work Permit Authorization",
  visa: "Official Visa Grant Notification",
  visaForm: "Official Visa Application Form",
  airTicket: "Flight Itinerary & Air Ticket"
};

// Create reusable nodemailer transporter
const getTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.warn("[EmailService] EMAIL_USER or EMAIL_PASS is not configured in .env. Emails will not be sent.");
    return null;
  }

  // Gmail App Password setup
  return nodemailer.createTransport({
    service: "gmail",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "465", 10),
    secure: process.env.EMAIL_SECURE !== "false", // true for port 465
    auth: {
      user: emailUser.trim(),
      pass: emailPass.trim().replace(/\s+/g, "") // remove any spaces if user pasted "xxxx xxxx xxxx xxxx"
    }
  });
};

// Ensure From header has standard "Display Name" <user@domain.com> RFC format
const getFromAddress = () => {
  const senderEmail = (process.env.EMAIL_USER || "").trim();
  let fromSetting = (process.env.EMAIL_FROM || "Australia Work E-Visa Portal").trim();
  fromSetting = fromSetting.replace(/^["']|["']$/g, "").trim();
  if (fromSetting.includes("<") && fromSetting.includes(">")) {
    return fromSetting;
  }
  return `"${fromSetting}" <${senderEmail}>`;
};

// Dispatch email via Brevo HTTPS REST API (Port 443) or fallback to Nodemailer SMTP
const sendMailMessage = async ({ to, toName, subject, text, html, attachments = [] }) => {
  const brevoApiKey = (process.env.BREVO_API_KEY || "").trim();
  const brevoSenderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || "").trim();
  const brevoSenderName = (process.env.BREVO_SENDER_NAME || process.env.EMAIL_FROM || "Australia Work E-Visa Portal").trim().replace(/^["']|["']$/g, "");

  // Priority 1: Brevo HTTPS REST API (100% firewall proof on shared hosting/Webuzo/cPanel)
  if (brevoApiKey && brevoSenderEmail) {
    try {
      const payload = {
        sender: {
          name: brevoSenderName,
          email: brevoSenderEmail
        },
        to: [
          {
            email: to.trim(),
            ...(toName ? { name: toName.trim() } : {})
          }
        ],
        subject: subject,
        htmlContent: html,
        textContent: text
      };

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || `Brevo API HTTP error: ${res.status}`);
      }

      console.log(`[EmailService] Brevo API Email dispatched successfully to ${to}. MessageId: ${data.messageId}`);
      return { success: true, messageId: data.messageId, provider: "brevo" };
    } catch (brevoErr) {
      console.error("[EmailService] Brevo API failed, trying SMTP fallback...", brevoErr.message);
    }
  }

  // Priority 2: Nodemailer SMTP
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("Neither Brevo API nor Nodemailer SMTP is configured in .env");
  }

  const fromAddress = getFromAddress();
  const info = await transporter.sendMail({
    from: fromAddress,
    to: to.trim(),
    subject: subject,
    text: text,
    html: html,
    attachments
  });

  console.log(`[EmailService] SMTP email dispatched successfully to ${to}. MessageId: ${info.messageId}`);
  return { success: true, messageId: info.messageId, provider: "smtp" };
};

// Get the logo attachment configuration
const getLogoAttachment = () => {
  const frontendUrl = (process.env.FRONTEND_URL || "https://australiaworkevisa.com").replace(/\/+$/, "");
  return {
    attachments: [],
    imgSrc: `${frontendUrl}/logo1.png`
  };
};

/**
 * 1. Send Email Notification when Admin creates a new Visa Entry
 */
const sendVisaCreatedNotification = async (visa) => {
  try {
    if (!visa || !visa.email) {
      console.log("[EmailService] No recipient email provided. Skipping email dispatch.");
      return { success: false, message: "No recipient email" };
    }

    const frontendUrl = (process.env.FRONTEND_URL || "https://australiaworkevisa.com").replace(/\/+$/, "");
    const enquiryUrl = `${frontendUrl}/visa-enquiry`;
    const senderEmail = process.env.EMAIL_USER;
    const fromAddress = getFromAddress();

    const applicantName = `${visa.givenName || ""} ${visa.surname || ""}`.trim().toUpperCase() || "Valued Applicant";
    const applicationId = visa.applicationId || "N/A";
    const passportNumber = visa.passportNumber ? visa.passportNumber.toUpperCase() : "N/A";
    const status = visa.status || "Approved";
    const companyName = visa.companyName ? visa.companyName.toUpperCase() : "N/A";
    const jobTitle = visa.jobTitle ? visa.jobTitle.toUpperCase() : "N/A";
    const salary = visa.salary || "As per contract";
    const nationality = visa.currentNationality || "N/A";

    const { attachments, imgSrc } = getLogoAttachment();

    // High deliverability: Both HTML & Plain text
    const textContent = `
AUSTRALIA WORK E-VISA PORTAL
ImmiVisa - Australian Visas & Migration
--------------------------------------------------------
VISA APPLICATION REGISTRATION CONFIRMATION

Dear ${applicantName},

Your visa application record has been successfully registered in the Australian Work E-Visa Portal database.

Application Details:
- Applicant Name: ${applicantName}
- Application ID: ${applicationId}
- Passport Number: ${passportNumber}
- Nationality: ${nationality}
- Nominated Occupation: ${jobTitle}
- Sponsoring Employer: ${companyName}
- Salary: ${salary}
- Current Status: ${status}

You can track, verify, and view all updates regarding your visa application and associated documents directly on our official portal:
Verify Status Online: ${enquiryUrl}

Required Verification Details:
Enter your Passport Number (${passportNumber}), Nationality, and Date of Birth on the portal to access your file.

If you have any questions or require assistance, please contact our support desk.

Sincerely,
ImmiVisa Australian Visas & Migration Services
Australian Work E-Visa Verification Authority
Website: ${frontendUrl}
--------------------------------------------------------
Notice: This is an automated notification. Please do not reply directly to this email.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visa Application Confirmation - Australia Work E-Visa</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 30px 10px;
    }
    .container {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #034833 0%, #065f46 100%);
      padding: 24px 30px;
      text-align: center;
      border-bottom: 3px solid #78c024;
    }
    .header img {
      max-height: 52px;
      width: auto;
      display: inline-block;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 19px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 4px 0 0;
      color: #a7f3d0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px 30px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .badge-approved {
      display: inline-block;
      background-color: #dcfce7;
      color: #15803d;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #bbf7d0;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 26px;
    }
    .info-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #034833;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 0 0 14px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
    }
    .info-table td {
      padding: 7px 4px;
      font-size: 13px;
      vertical-align: top;
    }
    .info-label {
      color: #64748b;
      width: 42%;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
    }
    .btn-wrap {
      text-align: center;
      margin: 30px 0 24px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #034833 0%, #047857 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 13px 32px;
      border-radius: 8px;
      box-shadow: 0 3px 8px rgba(3, 72, 51, 0.25);
      letter-spacing: 0.5px;
    }
    .notice-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 24px;
      font-size: 12px;
      line-height: 1.5;
      color: #1e40af;
    }
    .footer {
      background-color: #0f172a;
      color: #94a3b8;
      padding: 24px 30px;
      font-size: 11px;
      line-height: 1.6;
      text-align: center;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
    .footer-divider {
      border: 0;
      height: 1px;
      background-color: #334155;
      margin: 16px 0;
    }
    @media only screen and (max-width: 600px) {
      .content { padding: 22px 18px; }
      .header { padding: 20px 16px; }
      .info-table td { font-size: 12px; }
      .btn { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="header">
        <img src="${imgSrc}" alt="Australia Work E-Visa / ImmiVisa">
        <h1>Australia Work E-Visa Portal</h1>
        <p>Department of Home Affairs & Migration Verification</p>
      </div>

      <!-- MAIN CONTENT -->
      <div class="content">
        <h2 class="greeting">Dear ${applicantName},</h2>
        <p class="lead-text">
          We are pleased to inform you that your <strong>Australian Work E-Visa</strong> profile has been successfully registered and recorded in our official immigration verification system.
        </p>

        <!-- INFO CARD -->
        <div class="info-card">
          <div class="info-card-title">Application Summary & Record Details</div>
          <table class="info-table">
            <tr>
              <td class="info-label">Application ID:</td>
              <td class="info-value" style="color: #034833; font-weight: 700;">${applicationId}</td>
            </tr>
            <tr>
              <td class="info-label">Applicant Name:</td>
              <td class="info-value">${applicantName}</td>
            </tr>
            <tr>
              <td class="info-label">Passport Number:</td>
              <td class="info-value">${passportNumber}</td>
            </tr>
            <tr>
              <td class="info-label">Nationality:</td>
              <td class="info-value">${nationality}</td>
            </tr>
            <tr>
              <td class="info-label">Nominated Position:</td>
              <td class="info-value">${jobTitle}</td>
            </tr>
            <tr>
              <td class="info-label">Sponsoring Employer:</td>
              <td class="info-value">${companyName}</td>
            </tr>
            <tr>
              <td class="info-label">Remuneration:</td>
              <td class="info-value">${salary}</td>
            </tr>
            <tr>
              <td class="info-label">Application Status:</td>
              <td class="info-value">
                <span class="badge-approved">${status}</span>
              </td>
            </tr>
          </table>
        </div>

        <div class="notice-box">
          <strong>How to verify online:</strong> You can independently track and verify your live visa file at any time by entering your <strong>Passport Number</strong>, <strong>Nationality</strong>, and <strong>Date of Birth</strong> on our official portal.
        </div>

        <!-- ACTION BUTTON -->
        <div class="btn-wrap">
          <a href="${enquiryUrl}" target="_blank" class="btn">Verify & Check Visa Status Online</a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
          All related employment records, government clearances, and issuance documents will be updated in your file as processing progresses. You will be automatically notified upon any document addition.
        </p>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <p style="margin: 0 0 6px; font-weight: 600; color: #e2e8f0;">
          Australia Work E-Visa &bull; ImmiVisa Australian Visas & Migration
        </p>
        <p style="margin: 0 0 8px;">
          Official Portal: <a href="${frontendUrl}">${frontendUrl}</a> &bull; Verification: <a href="${enquiryUrl}">Visa Enquiry Service</a>
        </p>
        <hr class="footer-divider">
        <p style="margin: 0; font-size: 10px; color: #64748b;">
          CONFIDENTIALITY NOTICE: This transmission contains information intended solely for the person or entity named above. If you are not the intended recipient, please immediately notify the sender and delete this message. This is an automated notification system.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
    `.trim();

    const result = await sendMailMessage({
      to: visa.email.trim(),
      toName: applicantName,
      subject: `Official Visa Application Confirmation: ${applicantName} (Ref: ${applicationId})`,
      text: textContent,
      html: htmlContent,
      attachments
    });

    return result;
  } catch (error) {
    console.error("[EmailService] Error dispatching visa creation email:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 2. Send Email Notification when a Document is added to one of the 6 categories
 */
const sendDocumentAddedNotification = async (visa, docKey, uploadedCount = 1) => {
  try {
    if (!visa || !visa.email) {
      console.log("[EmailService] No recipient email found for document notification. Skipping.");
      return { success: false, message: "No recipient email" };
    }

    const frontendUrl = (process.env.FRONTEND_URL || "https://australiaworkevisa.com").replace(/\/+$/, "");
    const enquiryUrl = `${frontendUrl}/visa-enquiry`;
    const senderEmail = process.env.EMAIL_USER;
    const fromAddress = getFromAddress();

    const applicantName = `${visa.givenName || ""} ${visa.surname || ""}`.trim().toUpperCase() || "Valued Applicant";
    const applicationId = visa.applicationId || "N/A";
    const passportNumber = visa.passportNumber ? visa.passportNumber.toUpperCase() : "N/A";
    const categoryTitle = DOCUMENT_CATEGORY_NAMES[docKey] || docKey.toUpperCase();

    const { attachments, imgSrc } = getLogoAttachment();

    const textContent = `
AUSTRALIA WORK E-VISA PORTAL
ImmiVisa - Australian Visas & Migration
--------------------------------------------------------
NEW DOCUMENT UPDATE NOTIFICATION

Dear ${applicantName},

We are writing to notify you that a new official document has been verified and added to your Australian Work E-Visa application file.

Document Update Details:
- Updated Category: ${categoryTitle}
- File Count: ${uploadedCount} document(s) added
- Applicant Name: ${applicantName}
- Application ID: ${applicationId}
- Passport Number: ${passportNumber}
- Current Status: Available in Portal

Please log in or verify your application on our official portal to view, review, or download your newly updated document.

View Document on Official Portal:
${enquiryUrl}

Instructions: Enter your Passport Number (${passportNumber}), Nationality, and Date of Birth to access your updated file.

Sincerely,
ImmiVisa Australian Visas & Migration Services
Australian Work E-Visa Verification Authority
Website: ${frontendUrl}
--------------------------------------------------------
Notice: This is an automated notification. Please do not reply directly to this email.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Document Added - Australia Work E-Visa</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 30px 10px;
    }
    .container {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #034833 0%, #065f46 100%);
      padding: 24px 30px;
      text-align: center;
      border-bottom: 3px solid #78c024;
    }
    .header img {
      max-height: 52px;
      width: auto;
      display: inline-block;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 19px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 4px 0 0;
      color: #a7f3d0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px 30px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .highlight-card {
      background: linear-gradient(to right, #ecfdf5, #f0fdf4);
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
    }
    .highlight-badge {
      display: inline-block;
      background-color: #034833;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .highlight-title {
      font-size: 16px;
      font-weight: 700;
      color: #065f46;
      margin: 0;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 26px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
    }
    .info-table td {
      padding: 7px 4px;
      font-size: 13px;
      vertical-align: top;
    }
    .info-label {
      color: #64748b;
      width: 42%;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
    }
    .btn-wrap {
      text-align: center;
      margin: 28px 0 24px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #034833 0%, #047857 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 13px 32px;
      border-radius: 8px;
      box-shadow: 0 3px 8px rgba(3, 72, 51, 0.25);
      letter-spacing: 0.5px;
    }
    .footer {
      background-color: #0f172a;
      color: #94a3b8;
      padding: 24px 30px;
      font-size: 11px;
      line-height: 1.6;
      text-align: center;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
    .footer-divider {
      border: 0;
      height: 1px;
      background-color: #334155;
      margin: 16px 0;
    }
    @media only screen and (max-width: 600px) {
      .content { padding: 22px 18px; }
      .header { padding: 20px 16px; }
      .info-table td { font-size: 12px; }
      .btn { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="header">
        <img src="${imgSrc}" alt="Australia Work E-Visa / ImmiVisa">
        <h1>Australia Work E-Visa Portal</h1>
        <p>Department of Home Affairs & Migration Verification</p>
      </div>

      <!-- MAIN CONTENT -->
      <div class="content">
        <h2 class="greeting">Dear ${applicantName},</h2>
        <p class="lead-text">
          An important update has been made to your <strong>Australian Work E-Visa</strong> file. A new official document has been verified and uploaded by the immigration administration team.
        </p>

        <!-- HIGHLIGHT CARD -->
        <div class="highlight-card">
          <div>
            <span class="highlight-badge">Document Uploaded</span>
            <h3 class="highlight-title">${categoryTitle}</h3>
          </div>
        </div>

        <!-- INFO CARD -->
        <div class="info-card">
          <table class="info-table">
            <tr>
              <td class="info-label">Application ID:</td>
              <td class="info-value" style="color: #034833; font-weight: 700;">${applicationId}</td>
            </tr>
            <tr>
              <td class="info-label">Applicant Name:</td>
              <td class="info-value">${applicantName}</td>
            </tr>
            <tr>
              <td class="info-label">Passport Number:</td>
              <td class="info-value">${passportNumber}</td>
            </tr>
            <tr>
              <td class="info-label">Updated Item:</td>
              <td class="info-value" style="color: #047857;">${categoryTitle}</td>
            </tr>
            <tr>
              <td class="info-label">Files Attached:</td>
              <td class="info-value">${uploadedCount} file(s) added</td>
            </tr>
            <tr>
              <td class="info-label">Document Status:</td>
              <td class="info-value" style="color: #15803d; font-weight: 700;">Verified & Ready for Viewing</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #475569; line-height: 1.5;">
          You can now view, inspect, or download this newly added document directly from the official portal. Please click the button below to access your file:
        </p>

        <!-- ACTION BUTTON -->
        <div class="btn-wrap">
          <a href="${enquiryUrl}" target="_blank" class="btn">View & Download Document Online</a>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px;">
          <em>Note: To view your document, simply enter your Passport Number (${passportNumber}) and Date of Birth on the portal enquiry page.</em>
        </p>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <p style="margin: 0 0 6px; font-weight: 600; color: #e2e8f0;">
          Australia Work E-Visa &bull; ImmiVisa Australian Visas & Migration
        </p>
        <p style="margin: 0 0 8px;">
          Official Portal: <a href="${frontendUrl}">${frontendUrl}</a> &bull; Verification: <a href="${enquiryUrl}">Visa Enquiry Service</a>
        </p>
        <hr class="footer-divider">
        <p style="margin: 0; font-size: 10px; color: #64748b;">
          CONFIDENTIALITY NOTICE: This transmission contains information intended solely for the person or entity named above. If you are not the intended recipient, please immediately notify the sender and delete this message. This is an automated notification system.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
    `.trim();

    const result = await sendMailMessage({
      to: visa.email.trim(),
      toName: applicantName,
      subject: `Official Document Update: ${categoryTitle} Uploaded (Ref: ${applicationId})`,
      text: textContent,
      html: htmlContent,
      attachments
    });

    return result;
  } catch (error) {
    console.error("[EmailService] Error dispatching document upload email:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 3. Send Email Notification when Admin updates Visa Particulars or Status
 */
const sendVisaUpdatedNotification = async (visa) => {
  try {
    if (!visa || !visa.email) {
      console.log("[EmailService] No recipient email found for visa update notification. Skipping.");
      return { success: false, message: "No recipient email" };
    }

    const frontendUrl = (process.env.FRONTEND_URL || "https://australiaworkevisa.com").replace(/\/+$/, "");
    const enquiryUrl = `${frontendUrl}/visa-enquiry`;
    const applicantName = `${visa.givenName || ""} ${visa.surname || ""}`.trim().toUpperCase() || "Valued Applicant";
    const applicationId = visa.applicationId || "N/A";
    const passportNumber = visa.passportNumber ? visa.passportNumber.toUpperCase() : "N/A";
    const status = visa.status || "Approved";
    const companyName = visa.companyName ? visa.companyName.toUpperCase() : "N/A";
    const jobTitle = visa.jobTitle ? visa.jobTitle.toUpperCase() : "N/A";
    const salary = visa.salary || "As per contract";
    const nationality = visa.currentNationality || "N/A";

    const { attachments, imgSrc } = getLogoAttachment();

    const statusBadgeBg = status === "Approved" ? "#dcfce7" : (status === "Pending" ? "#fef9c3" : "#fee2e2");
    const statusBadgeColor = status === "Approved" ? "#15803d" : (status === "Pending" ? "#a16207" : "#b91c1c");

    const textContent = `
AUSTRALIA WORK E-VISA PORTAL
ImmiVisa - Australian Visas & Migration
--------------------------------------------------------
VISA APPLICATION STATUS / RECORD UPDATE

Dear ${applicantName},

Your visa application record has been updated in the Australian Work E-Visa Portal database.

Current Application Status: ${status}

Application Details:
- Applicant Name: ${applicantName}
- Application ID: ${applicationId}
- Passport Number: ${passportNumber}
- Nationality: ${nationality}
- Nominated Occupation: ${jobTitle}
- Sponsoring Employer: ${companyName}
- Salary: ${salary}
- Current Status: ${status}

Verify Status Online: ${enquiryUrl}
(Enter your Passport Number: ${passportNumber}, Nationality, and Date of Birth to view your live profile)

Sincerely,
ImmiVisa Australian Visas & Migration Services
Australian Work E-Visa Verification Authority
Website: ${frontendUrl}
--------------------------------------------------------
Notice: This is an automated notification. Please do not reply directly to this email.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visa Application Status Update - Australia Work E-Visa</title>
  <style>
    body {
      margin: 0; padding: 0; background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }
    .wrapper { width: 100%; background-color: #f1f5f9; padding: 30px 10px; }
    .container { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #034833 0%, #065f46 100%); padding: 24px 30px; text-align: center; border-bottom: 3px solid #78c024; }
    .header img { max-height: 52px; width: auto; display: inline-block; margin-bottom: 8px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 19px; font-weight: 700; }
    .header p { margin: 4px 0 0; color: #a7f3d0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px 30px; }
    .greeting { font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0; }
    .lead-text { font-size: 14px; line-height: 1.6; color: #334155; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .info-card-title { font-size: 13px; font-weight: 700; color: #034833; text-transform: uppercase; margin-bottom: 12px; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 7px 0; font-size: 13px; border-bottom: 1px dashed #e2e8f0; }
    .info-label { width: 40%; color: #64748b; font-weight: 500; }
    .info-value { width: 60%; color: #0f172a; font-weight: 600; text-align: right; }
    .badge-status { display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; border-radius: 9999px; background-color: ${statusBadgeBg}; color: ${statusBadgeColor}; }
    .btn-wrap { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background-color: #034833; color: #ffffff !important; padding: 14px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; }
    .footer { background: #0f172a; color: #94a3b8; padding: 24px 30px; text-align: center; font-size: 11px; }
    .footer a { color: #a7f3d0; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${imgSrc}" alt="Australia Work E-Visa">
        <h1>Australia Work E-Visa Portal</h1>
        <p>Visa Status Update Notification</p>
      </div>
      <div class="content">
        <h2 class="greeting">Dear ${applicantName},</h2>
        <p class="lead-text">
          Your <strong>Australian Work E-Visa</strong> application record has been updated in our official immigration verification system.
        </p>
        <div class="info-card">
          <div class="info-card-title">Updated Application Summary</div>
          <table class="info-table">
            <tr>
              <td class="info-label">Application ID:</td>
              <td class="info-value" style="color: #034833; font-weight: 700;">${applicationId}</td>
            </tr>
            <tr>
              <td class="info-label">Applicant Name:</td>
              <td class="info-value">${applicantName}</td>
            </tr>
            <tr>
              <td class="info-label">Passport Number:</td>
              <td class="info-value">${passportNumber}</td>
            </tr>
            <tr>
              <td class="info-label">Nominated Position:</td>
              <td class="info-value">${jobTitle}</td>
            </tr>
            <tr>
              <td class="info-label">Sponsoring Employer:</td>
              <td class="info-value">${companyName}</td>
            </tr>
            <tr>
              <td class="info-label">Current Status:</td>
              <td class="info-value">
                <span class="badge-status">${status}</span>
              </td>
            </tr>
          </table>
        </div>
        <div class="btn-wrap">
          <a href="${enquiryUrl}" target="_blank" class="btn">View Updated Visa File Online</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px; font-weight: 600; color: #e2e8f0;">Australia Work E-Visa &bull; Department of Home Affairs Verification</p>
        <p style="margin: 0;">Website: <a href="${frontendUrl}">${frontendUrl}</a></p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    const result = await sendMailMessage({
      to: visa.email.trim(),
      toName: applicantName,
      subject: `Official Visa Application Status Update: ${applicantName} (Status: ${status})`,
      text: textContent,
      html: htmlContent,
      attachments
    });

    return result;
  } catch (error) {
    console.error("[EmailService] Error dispatching visa update email:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 4. Verify email connection & optionally send a test email
 */
const testEmailConnection = async (targetEmail) => {
  try {
    const { imgSrc } = getLogoAttachment();
    const recipient = (targetEmail || process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || "").trim();

    if (!recipient) {
      return { success: false, message: "No recipient email configured for testing." };
    }

    const result = await sendMailMessage({
      to: recipient,
      toName: "Admin Test",
      subject: "Verification Test: Australia Work E-Visa Notification System",
      text: "Congratulations! Your Australia Work E-Visa email notification system is configured and working properly.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;">
          <div style="background-color: #034833; padding: 16px; text-align: center; border-radius: 6px; margin-bottom: 20px;">
            <img src="${imgSrc}" style="max-height: 45px; width: auto;" alt="Australia Work E-Visa" />
          </div>
          <h2 style="color: #034833; margin-top: 0;">Email System Connected Successfully!</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Congratulations! Your Australia Work E-Visa notification system via Brevo API is configured and working properly.
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            From now on, whenever an admin adds a new visa applicant or uploads any of the 6 documents (Job Letter, LMIA, Work Permit, Visa, Visa Form, Air Ticket), the applicant will automatically receive an official professional email notification directly into their Inbox.
          </p>
          <div style="margin-top: 20px; padding: 12px; background-color: #f1f5f9; border-radius: 6px; font-size: 12px; color: #64748b;">
            Recipient: <strong>${recipient}</strong> &bull; Status: <strong>VERIFIED & ACTIVE</strong>
          </div>
        </div>
      `
    });

    return {
      success: true,
      message: `Test email sent successfully to ${recipient}`,
      provider: result.provider,
      messageId: result.messageId
    };
  } catch (error) {
    console.error("[EmailService] Test email failed:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVisaCreatedNotification,
  sendDocumentAddedNotification,
  sendVisaUpdatedNotification,
  testEmailConnection,
  DOCUMENT_CATEGORY_NAMES
};


