import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tls from 'tls';
import net from 'net';
import { Resend } from 'resend';
import { generateMonthlyRecordsPDF } from './pdfGenerator.js';
import { generateMonthlyRecordsExcelBuffer, generateRecordsCSV } from './excelGenerator.js';

import Record from '../models/Record.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// 1. Generate Full Database Snapshot in JSON
export const generateFullBackupData = async () => {
  const [records, users, settings] = await Promise.all([
    Record.find({ isDeleted: { $ne: true } }).sort({ date: 1, sl: 1 }).lean(),
    User.find().select('+password').lean(),
    Settings.findOne().lean(),
  ]);

  const timestamp = new Date().toISOString();
  return {
    version: '1.0.0',
    system: 'Hospital Over Duty / Patient Record Management System',
    timestamp,
    counts: {
      totalRecords: records.length,
      totalUsers: users.length,
    },
    data: {
      records,
      users,
      settings,
    },
  };
};

// 2. Generate User Specific Backup Data
export const generateUserBackupData = async (userId) => {
  const [user, records, settings] = await Promise.all([
    User.findById(userId).lean(),
    Record.find({ createdBy: userId, isDeleted: { $ne: true } }).sort({ date: 1, sl: 1 }).lean(),
    Settings.findOne().lean(),
  ]);

  return {
    user,
    records,
    settings,
  };
};

// 3. Re-export Excel & CSV generators
export { generateMonthlyRecordsExcelBuffer, generateRecordsCSV };

// 4. Save Local File Snapshot
export const saveLocalSnapshot = async () => {
  try {
    const backupData = await generateFullBackupData();
    const dateStr = new Date().toISOString().split('T')[0];
    const filePath = path.join(BACKUPS_DIR, `backup-${dateStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`[Backup] Local database snapshot saved: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error('[Backup] Failed to save local snapshot:', err.message);
    return null;
  }
};

// 5. Official Resend SDK Email Sender with High Deliverability Headers
export const sendResendEmail = async ({ apiKey, from, to, subject, html, text, attachments = [] }) => {
  const resendApiKey = apiKey || process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Resend API Key is missing. Please configure it in .env (RESEND_API_KEY).');
  }

  const resend = new Resend(resendApiKey.trim());

  const formattedAttachments = attachments.map((att) => ({
    filename: att.filename,
    content: Buffer.isBuffer(att.content)
      ? att.content
      : Buffer.from(att.content || att.data || ''),
  }));

  // Auto-generate plaintext from html if not provided to pass Google Anti-Spam filter
  const plainText =
    text ||
    (html
      ? html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
      : '');

  const payload = {
    from: from || 'OverDuty Hospital Backup <backup@roni.kodl.uk>',
    to: Array.isArray(to) ? to : [to],
    replyTo: 'backup@roni.kodl.uk',
    subject,
    html,
    text: plainText,
    headers: {
      'X-Entity-Ref-ID': 'hospital-system-transactional',
    },
  };

  if (formattedAttachments.length > 0) {
    payload.attachments = formattedAttachments;
  }

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error('[Resend SDK Error]:', error);
    throw new Error(error.message || 'Failed to dispatch email via Resend');
  }

  return data;
};

// 6. Pure Node.js SMTP Sender (Fallback for Custom Domain / cPanel / Gmail SMTP)
export const sendSmtpEmail = ({ host, port = 465, user, pass, secure = true, from, to, subject, htmlBody, attachments = [] }) => {
  return new Promise((resolve, reject) => {
    if (!host || !user || !pass || !to) {
      return reject(new Error('Incomplete SMTP configuration. Host, User, Pass, and To Email are required.'));
    }

    const isExplicitSsl = secure || Number(port) === 465;
    const client = isExplicitSsl
      ? tls.connect(Number(port), host, { rejectUnauthorized: false })
      : net.connect(Number(port), host);

    let stage = 0;
    let buffer = '';

    const send = (cmd) => {
      client.write(cmd + '\r\n');
    };

    client.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // keep partial line

      for (const line of lines) {
        if (!line.trim()) continue;
        const code = parseInt(line.substring(0, 3), 10);
        if (isNaN(code)) continue;

        // Skip multiline replies (e.g. 250-...)
        if (line.charAt(3) === '-') continue;

        if (code >= 400) {
          client.end();
          return reject(new Error(`SMTP Server Error: ${line}`));
        }

        switch (stage) {
          case 0: // Greeting (220)
            if (code === 220) {
              stage = 1;
              send(`EHLO ${host}`);
            }
            break;

          case 1: // EHLO response (250)
            if (code === 250) {
              stage = 2;
              send('AUTH LOGIN');
            }
            break;

          case 2: // AUTH LOGIN prompt (334)
            if (code === 334) {
              stage = 3;
              send(Buffer.from(user).toString('base64'));
            }
            break;

          case 3: // Password prompt (334)
            if (code === 334) {
              stage = 4;
              send(Buffer.from(pass).toString('base64'));
            }
            break;

          case 4: // Auth Success (235)
            if (code === 235) {
              stage = 5;
              const sender = from || user;
              send(`MAIL FROM:<${sender}>`);
            }
            break;

          case 5: // Sender accepted (250)
            if (code === 250) {
              stage = 6;
              send(`RCPT TO:<${to}>`);
            }
            break;

          case 6: // Recipient accepted (250)
            if (code === 250) {
              stage = 7;
              send('DATA');
            }
            break;

          case 7: // Ready for DATA (354)
            if (code === 354) {
              stage = 8;
              const boundary = `====_NextPart_${Date.now()}_====`;
              const sender = from || `OverDuty Pro <${user}>`;

              let rawMsg = `From: ${sender}\r\n`;
              rawMsg += `To: <${to}>\r\n`;
              rawMsg += `Subject: ${subject}\r\n`;
              rawMsg += `MIME-Version: 1.0\r\n`;
              rawMsg += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

              // HTML Body Part
              rawMsg += `--${boundary}\r\n`;
              rawMsg += `Content-Type: text/html; charset=UTF-8\r\n`;
              rawMsg += `Content-Transfer-Encoding: base64\r\n\r\n`;
              rawMsg += Buffer.from(htmlBody, 'utf-8').toString('base64') + '\r\n\r\n';

              // Attachments
              for (const att of attachments) {
                const b64Data = att.content
                  ? att.content.toString('base64')
                  : Buffer.from(att.data || '').toString('base64');
                const contentType = att.contentType || 'application/octet-stream';
                rawMsg += `--${boundary}\r\n`;
                rawMsg += `Content-Type: ${contentType}; name="${att.filename}"\r\n`;
                rawMsg += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
                rawMsg += `Content-Transfer-Encoding: base64\r\n\r\n`;
                rawMsg += b64Data + '\r\n\r\n';
              }

              rawMsg += `--${boundary}--\r\n.\r\n`;
              client.write(rawMsg);
            }
            break;

          case 8: // Data accepted (250)
            if (code === 250) {
              stage = 9;
              send('QUIT');
              client.end();
              return resolve({ success: true, message: 'Email sent successfully via SMTP' });
            }
            break;

          default:
            break;
        }
      }
    });

    client.on('error', (err) => {
      reject(new Error(`SMTP Connection Error: ${err.message}`));
    });

    setTimeout(() => {
      client.destroy();
      reject(new Error('SMTP Connection timed out (15s limit reached)'));
    }, 15000);
  });
};

// 7. Dispatcher (Directly uses Resend API with verified domain roni.kodl.uk)
export const dispatchEmail = async ({ settings, to, subject, html, attachments = [] }) => {
  const currentSettings = settings || (await Settings.findOne().lean()) || {};
  const resendKey = process.env.RESEND_API_KEY || currentSettings.resendApiKey;

  const senderName = currentSettings.senderName || 'OverDuty Hospital Backup';
  const senderEmail = process.env.RESEND_SENDER_EMAIL || currentSettings.senderEmail || 'backup@roni.kodl.uk';
  const fromFormatted = `${senderName} <${senderEmail}>`;

  // Always prefer Resend API if API Key is available
  if (resendKey && (currentSettings.emailProvider !== 'smtp' || !currentSettings.smtpUser)) {
    return await sendResendEmail({
      apiKey: resendKey,
      from: fromFormatted,
      to,
      subject,
      html,
      attachments,
    });
  } else if (currentSettings.smtpHost && currentSettings.smtpUser && currentSettings.smtpPass) {
    return await sendSmtpEmail({
      host: currentSettings.smtpHost,
      port: currentSettings.smtpPort || 465,
      user: currentSettings.smtpUser,
      pass: currentSettings.smtpPass,
      secure: currentSettings.smtpSecure !== false,
      from: fromFormatted,
      to,
      subject,
      htmlBody: html,
      attachments,
    });
  } else if (resendKey) {
    return await sendResendEmail({
      apiKey: resendKey,
      from: fromFormatted,
      to,
      subject,
      html,
      attachments,
    });
  } else {
    throw new Error('Email sending failed: Resend API Key is missing. Please set RESEND_API_KEY in server environment.');
  }
};

// 8. Send Personalized Monthly / Daily Backup with BOTH Excel (.csv) AND PDF Report
export const sendUserBackupEmail = async (
  userId,
  customRecipientEmail = null,
  targetMonth = null,
  targetYear = null,
  isMonthlyClosing = false
) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const recipient = customRecipientEmail || user.backupEmail || user.email;
  if (!recipient) throw new Error('No recipient email specified for this user');

  const settings = (await Settings.findOne().lean()) || {};
  const hospitalName = settings.hospitalName || 'Ad-din Akij Medical College Hospital';
  const location = settings.location || 'Clinical Wards';

  const filter = { createdBy: userId, isDeleted: { $ne: true } };
  if (targetMonth && targetMonth !== 'all') {
    filter.month = Number(targetMonth);
  }
  if (targetYear && targetYear !== 'all') {
    filter.year = Number(targetYear);
  }

  const userRecords = await Record.find(filter).sort({ date: 1, sl: 1 }).lean();
  const dateStr = new Date().toISOString().split('T')[0];
  const nowDisplay = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Calculate high-fidelity clinical and financial metrics
  const totalEntries = userRecords.length;
  const uniquePatients = new Set(userRecords.map((r) => String(r.patientId || '').trim()).filter(Boolean)).size;
  const totalAmount = userRecords.reduce((sum, r) => {
    const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
    return sum + val;
  }, 0);
  const avgAmount = totalEntries > 0 ? Math.round(totalAmount / totalEntries) : 0;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthLabel = targetMonth && targetMonth !== 'all'
    ? `${monthNames[Number(targetMonth) - 1] || 'Month ' + targetMonth} ${targetYear || ''}`
    : 'Cumulative All-Time Records';

  // 1. Generate Formatted Excel (.xlsx) buffer with Ad-din headers & One Call banner
  let excelBuffer = null;
  try {
    excelBuffer = await generateMonthlyRecordsExcelBuffer({
      records: userRecords,
      hospitalName,
      location,
      month: targetMonth,
      year: targetYear,
    });
  } catch (excelErr) {
    console.error('[Backup Excel Gen Error]:', excelErr.message);
  }

  // 2. Generate Professional PDF Statement Buffer
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateMonthlyRecordsPDF({
      records: userRecords,
      staffName: user.name,
      hospitalName,
      location,
      month: targetMonth,
      year: targetYear,
      totalAmount,
    });
  } catch (pdfErr) {
    console.error('[Backup PDF Gen Error]:', pdfErr.message);
  }

  const safeStaffSlug = (user.username || user.name || 'staff').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const safeMonthSlug = monthLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const attachments = [
    {
      filename: `OverDuty_Statement_${safeStaffSlug}_${safeMonthSlug}.pdf`,
      contentType: 'application/pdf',
      content: pdfBuffer,
    },
    {
      filename: `OverDuty_Records_${safeStaffSlug}_${safeMonthSlug}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: excelBuffer,
    },
  ].filter((a) => a.content);

  const headerTitle = isMonthlyClosing
    ? `🏆 Monthly Closing Grand Statement`
    : `🏥 Patient Records & Over Duty Statement`;

  const subject = isMonthlyClosing
    ? `🏆 [মাসিক চূড়ান্ত ক্লোজিং রিপোর্ট] ${monthLabel} — ${user.name} (মোট টাকা: Tk. ${totalAmount.toLocaleString()} | ${totalEntries} রোগী)`
    : `🏥 [ওভার ডিউটি রিপোর্ট] ${monthLabel} — ${user.name} (Tk. ${totalAmount.toLocaleString()} | ${totalEntries} রোগী)`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px 28px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">🏥 ${hospitalName}</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #e0f2fe;">${headerTitle}</p>
        </div>

        <!-- Body -->
        <div style="padding: 26px 28px;">
          <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">Hello ${user.name},</h2>
          <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
            ${
              isMonthlyClosing
                ? `আপনার <strong>${monthLabel}</strong> মাসের সম্পূর্ণ মাসিক হিসাব ও ওভার ডিউটি স্টেটমেন্ট সফলভাবে প্রস্তুত করা হয়েছে। নিচে সারাংশ এবং সাথে <strong>PDF ও Excel উভয় ফাইল</strong> সংযুক্ত করা হলো:`
                : `আপনার <strong>${monthLabel}</strong> পর্বের ওভার ডিউটি রোগীর রেকর্ড ও আর্থিক হিসাব বিবরণী নিচে তুলে ধরা হলো:`
            }
          </p>

          <!-- 4-Box Metric Highlight Grid -->
          <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            <tr>
              <td width="48%" style="padding: 12px 14px; background-color: #f1f5f9; border-radius: 10px; border: 1px solid #e2e8f0;">
                <span style="font-size: 10.5px; font-weight: bold; color: #64748b; text-transform: uppercase;">মোট পেশেন্ট এন্ট্রি</span>
                <div style="font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px;">${totalEntries} টি</div>
              </td>
              <td width="4%"></td>
              <td width="48%" style="padding: 12px 14px; background-color: #e0f2fe; border-radius: 10px; border: 1px solid #bae6fd;">
                <span style="font-size: 10.5px; font-weight: bold; color: #0369a1; text-transform: uppercase;">ইউনিক পেশেন্ট</span>
                <div style="font-size: 18px; font-weight: bold; color: #0284c7; margin-top: 4px;">${uniquePatients} জন</div>
              </td>
            </tr>
            <tr><td height="10" colspan="3"></td></tr>
            <tr>
              <td width="48%" style="padding: 12px 14px; background-color: #dcfce7; border-radius: 10px; border: 1px solid #bbf7d0;">
                <span style="font-size: 10.5px; font-weight: bold; color: #166534; text-transform: uppercase;">মোট টাকা (Remark)</span>
                <div style="font-size: 18px; font-weight: bold; color: #16a34a; margin-top: 4px;">Tk. ${totalAmount.toLocaleString()}</div>
              </td>
              <td width="4%"></td>
              <td width="48%" style="padding: 12px 14px; background-color: #f3e8ff; border-radius: 10px; border: 1px solid #e9d5ff;">
                <span style="font-size: 10.5px; font-weight: bold; color: #6b21a8; text-transform: uppercase;">গড় প্রতি এন্ট্রি</span>
                <div style="font-size: 18px; font-weight: bold; color: #7c3aed; margin-top: 4px;">Tk. ${avgAmount.toLocaleString()}</div>
              </td>
            </tr>
          </table>

          <!-- Attachments Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 22px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #0f172a; text-transform: uppercase;">
              📎 সংযুক্ত ফাইলসমূহ (Attached Files):
            </p>
            <p style="margin: 4px 0; font-size: 12.5px; color: #334155;">
              📄 <strong>1. Official PDF Statement:</strong> <code>OverDuty_Statement_${safeStaffSlug}_${safeMonthSlug}.pdf</code>
            </p>
            <p style="margin: 4px 0; font-size: 12.5px; color: #334155;">
              📊 <strong>2. Excel Spreadsheet:</strong> <code>OverDuty_Records_${safeStaffSlug}_${safeMonthSlug}.xlsx</code> (Official Excel Spreadsheet)
            </p>
          </div>

          <div style="text-align: center; margin: 20px 0 10px;">
            <a href="https://roni.kodl.uk" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: bold; font-size: 13px; padding: 12px 26px; border-radius: 8px; text-decoration: none;">
              ওভার ডিউটি পোর্টালে যান (Open Portal)
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          OverDuty Hospital Pro System &copy; ${new Date().getFullYear()} ${hospitalName} | Date: ${nowDisplay}
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${hospitalName}\n${headerTitle}\n\nHello ${user.name},\n\nReport Period: ${monthLabel}\nTotal Patient Entries: ${totalEntries}\nUnique Patients: ${uniquePatients}\nTotal Amount / Earned: Tk. ${totalAmount.toLocaleString()}\nAverage per Entry: Tk. ${avgAmount.toLocaleString()}\n\nAttached Files:\n1. OverDuty_Statement_${safeStaffSlug}_${safeMonthSlug}.pdf (Official PDF Statement)\n2. OverDuty_Records_${safeStaffSlug}_${safeMonthSlug}.xlsx (Formatted Excel Spreadsheet)\n\nPortal: https://roni.kodl.uk\n© ${new Date().getFullYear()} ${hospitalName}`;

  await dispatchEmail({
    settings,
    to: recipient,
    subject,
    html,
    text,
    attachments,
  });

  return {
    success: true,
    recipient,
    recordCount: userRecords.length,
    totalAmount,
    uniquePatients,
    monthLabel,
  };
};

// 9. Execute Master System Backup (Full DB Dump to Admin)
export const executeEmailBackup = async (customRecipient = null) => {
  const settings = await Settings.findOne();
  const recipient = customRecipient || settings?.backupEmail || 'admin@hospital.com';

  if (!recipient) {
    throw new Error('No recipient email address specified for backup.');
  }

  const [fullBackup, allRecords] = await Promise.all([
    generateFullBackupData(),
    Record.find({ isDeleted: { $ne: true } }).sort({ date: 1, sl: 1 }).lean(),
  ]);

  const dateStr = new Date().toISOString().split('T')[0];
  const nowDisplay = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const hospitalName = settings?.hospitalName || 'Ad-din Akij Medical College Hospital';

  let excelBuffer = null;
  try {
    excelBuffer = await generateMonthlyRecordsExcelBuffer({
      records: allRecords,
      hospitalName,
      location: 'All Departments / Wards',
      month: 'all',
      year: new Date().getFullYear(),
    });
  } catch (excelErr) {
    console.error('[Master Backup Excel Gen Error]:', excelErr.message);
  }
  const jsonContent = JSON.stringify(fullBackup, null, 2);

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">🏥 ${hospitalName}</h1>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Master System & Database Backup</p>
        </div>

        <div style="padding: 24px;">
          <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">Full Database Snapshot & Reports</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            This is the master cumulative backup containing all user accounts, configuration, and patient entries across all staff members.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Total Records:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0284c7; text-align: right;">${fullBackup.counts.totalRecords} entries</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Registered Staff/Users:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${fullBackup.counts.totalUsers} accounts</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Backup Timestamp:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${nowDisplay}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">
            📎 <strong>Attachments:</strong><br>
            1. <code>full-database-backup-${dateStr}.json</code> (Disaster Recovery file)<br>
            2. <code>all-hospital-records-${dateStr}.xlsx</code> (Formatted Excel Spreadsheet)
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          Automated by OverDuty Pro System &copy; ${new Date().getFullYear()} ${hospitalName}
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = [
    {
      filename: `full-database-backup-${dateStr}.json`,
      contentType: 'application/json',
      content: Buffer.from(jsonContent, 'utf-8'),
    },
    {
      filename: `all-hospital-records-${dateStr}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: excelBuffer,
    },
  ].filter((a) => a.content);

  await dispatchEmail({
    settings,
    to: recipient,
    subject: `🛡️ [Master Database Backup] ${hospitalName} - ${nowDisplay}`,
    html,
    attachments,
  });

  if (settings) {
    settings.lastBackupAt = new Date();
    settings.lastBackupStatus = 'success';
    settings.lastBackupMessage = `Master backup sent successfully to ${recipient}`;
    await settings.save();
  }

  return { success: true, recipient, recordCount: fullBackup.counts.totalRecords };
};

// 10. Run Full Midnight Backup Loop for All Users & Monthly Closing Detection
export const runMidnightAllUsersBackup = async () => {
  console.log('[Scheduler] Starting midnight automated backup process...');
  const settings = await Settings.findOne();
  const now = new Date();

  // 1. Save local disk snapshot
  await saveLocalSnapshot();

  // 2. Determine if tonight is Monthly Closing (1st day of month -> closing previous month)
  const isFirstDayOfMonth = now.getDate() === 1;
  let targetMonth = now.getMonth() + 1; // default current month
  let targetYear = now.getFullYear();

  if (isFirstDayOfMonth) {
    // 1st of month means previous month just completed
    if (targetMonth === 1) {
      targetMonth = 12;
      targetYear = targetYear - 1;
    } else {
      targetMonth = targetMonth - 1;
    }
  }

  // 3. Find target users:
  // On Monthly Closing (1st of month): 100% ALWAYS delivered to ALL active staff & admins
  // On regular daily midnight: delivered only if autoEmailBackup is ON
  const userQuery = isFirstDayOfMonth
    ? { status: { $in: ['active', 'pending'] } }
    : { status: { $in: ['active', 'pending'] }, autoEmailBackup: { $ne: false } };

  const activeUsers = await User.find(userQuery).lean();

  let sentCount = 0;
  const errors = [];

  for (const user of activeUsers) {
    const userEmail = user.backupEmail || user.email;
    if (!userEmail) continue;

    try {
      await sendUserBackupEmail(user._id, userEmail, targetMonth, targetYear, isFirstDayOfMonth);
      sentCount++;
      console.log(`[Scheduler] Backup delivered to: ${user.name} <${userEmail}> (Month: ${targetMonth}/${targetYear}, Monthly Closing: ${isFirstDayOfMonth})`);
    } catch (err) {
      console.error(`[Scheduler] Failed delivering to ${user.email}:`, err.message);
      errors.push({ user: user.email, error: err.message });
    }
  }

  // 4. Send Master DB Snapshot to Super Admin (100% on monthly closing or if enabled)
  const shouldSendAdminMaster = isFirstDayOfMonth || (settings && settings.autoEmailBackup !== false);
  if (settings && shouldSendAdminMaster && settings.backupEmail) {
    try {
      await executeEmailBackup(settings.backupEmail);
      console.log(`[Scheduler] Master database backup delivered to Admin: ${settings.backupEmail}`);
    } catch (err) {
      console.error(`[Scheduler] Master backup email error:`, err.message);
    }
  }

  if (settings) {
    settings.lastBackupAt = new Date();
    settings.lastBackupStatus = errors.length > 0 ? 'error' : 'success';
    settings.lastBackupMessage = `Backup finished for Month ${targetMonth}/${targetYear} (${isFirstDayOfMonth ? 'Monthly Closing (100% Delivered)' : 'Daily'}). Delivered to ${sentCount} users.`;
    await settings.save();
  }

  return { sentCount, errorsCount: errors.length, isFirstDayOfMonth, targetMonth, targetYear };
};

// 11. Restore Database from JSON
export const restoreDatabaseFromJson = async (jsonData) => {
  let data = jsonData;
  if (typeof jsonData === 'string') {
    data = JSON.parse(jsonData);
  }

  if (data.data) {
    data = data.data;
  }

  if (!data.records || !Array.isArray(data.records)) {
    throw new Error('Invalid backup file format: missing records array');
  }

  let restoredUsersCount = 0;
  let restoredRecordsCount = 0;

  // Restore Users
  if (data.users && Array.isArray(data.users)) {
    for (const u of data.users) {
      if (!u.email) continue;
      const existing = await User.findOne({ email: u.email.toLowerCase() });
      if (!existing) {
        await User.collection.insertOne({
          _id: u._id,
          name: u.name || 'Restored User',
          username: u.username || u.email.split('@')[0],
          email: u.email.toLowerCase(),
          password: u.password,
          role: u.role || 'staff',
          status: u.status || 'active',
          autoEmailBackup: u.autoEmailBackup !== false,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
        });
        restoredUsersCount++;
      }
    }
  }

  // Restore Records
  for (const r of data.records) {
    if (!r.patientId || !r.date) continue;
    const existing = await Record.findOne({
      $or: [
        ...(r._id ? [{ _id: r._id }] : []),
        { patientId: String(r.patientId).trim(), date: new Date(r.date), time: r.time },
      ],
    });

    if (!existing) {
      await Record.collection.insertOne({
        _id: r._id,
        sl: Number(r.sl) || 1,
        patientId: String(r.patientId).trim(),
        patientName: r.patientName || 'PATIENT',
        date: new Date(r.date),
        time: r.time || '12:00PM',
        remark: r.remark || '100',
        month: Number(r.month) || new Date(r.date).getMonth() + 1,
        year: Number(r.year) || new Date(r.date).getFullYear(),
        createdBy: r.createdBy || null,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
      });
      restoredRecordsCount++;
    }
  }

  return {
    success: true,
    restoredRecordsCount,
    restoredUsersCount,
    totalRecordsInFile: data.records.length,
    totalUsersInFile: (data.users || []).length,
  };
};

// 12. Automated Daily Midnight & Monthly Closing Scheduler
let schedulerInitialized = false;

export const initDailyBackupScheduler = () => {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Run a local snapshot immediately on startup
  saveLocalSnapshot();

  // Check every 20 minutes if midnight has crossed and backup is due
  const CHECK_INTERVAL = 20 * 60 * 1000;
  setInterval(async () => {
    try {
      const now = new Date();
      // Check if it's within the midnight window (between 00:00 and 00:30)
      if (now.getHours() === 0 && now.getMinutes() <= 30) {
        const isFirstDayOfMonth = now.getDate() === 1;
        const settings = await Settings.findOne();

        // Run if autoEmailBackup is active OR if tonight is the 1st of month (Mandatory Monthly Closing)
        if (isFirstDayOfMonth || (settings && settings.autoEmailBackup !== false)) {
          const lastBackup = settings?.lastBackupAt ? new Date(settings.lastBackupAt) : null;
          const todayDateStr = now.toISOString().split('T')[0];
          const lastDateStr = lastBackup ? lastBackup.toISOString().split('T')[0] : '';

          // Only run once per day
          if (todayDateStr !== lastDateStr) {
            console.log(`[Scheduler] Midnight backup triggered (Monthly Closing: ${isFirstDayOfMonth})...`);
            await runMidnightAllUsersBackup();
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Automatic daily backup error:', err.message);
    }
  }, CHECK_INTERVAL);

  console.log('[Scheduler] Daily midnight & monthly closing automated backup scheduler initialized.');
};
