import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tls from 'tls';
import net from 'net';

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
    Record.find().sort({ date: 1, sl: 1 }).lean(),
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
    Record.find({ createdBy: userId }).sort({ date: 1, sl: 1 }).lean(),
    Settings.findOne().lean(),
  ]);

  return {
    user,
    records,
    settings,
  };
};

// 3. Generate CSV representation of records for Excel
export const generateRecordsCSV = (records = []) => {
  const headers = ['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark (Amount)', 'Month', 'Year'];
  const rows = records.map((r, idx) => [
    r.sl || idx + 1,
    `="${String(r.patientId || '')}"`, // force string format in Excel
    `"${String(r.patientName || '').replace(/"/g, '""')}"`,
    r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    r.time || '',
    `"${String(r.remark || '').replace(/"/g, '""')}"`,
    r.month || '',
    r.year || '',
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
};

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

// 5. Resend API Email Sender (Modern, High-Deliverability, Zero npm dependency)
export const sendResendEmail = async ({ apiKey, from, to, subject, html, attachments = [] }) => {
  const resendApiKey = apiKey || process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Resend API Key is missing. Please configure it in .env (RESEND_API_KEY).');
  }

  const payload = {
    from: from || 'OverDuty Backup <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    attachments: attachments.map((att) => ({
      filename: att.filename,
      content: att.content ? att.content.toString('base64') : Buffer.from(att.data || '').toString('base64'),
    })),
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData?.message || `Resend API error: HTTP ${response.status}`);
  }

  return resData;
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

// 7. Dispatcher (Chooses Resend API or SMTP based on settings)
export const dispatchEmail = async ({ settings, to, subject, html, attachments = [] }) => {
  const currentSettings = settings || (await Settings.findOne().lean()) || {};
  const provider = currentSettings.emailProvider || (process.env.RESEND_API_KEY ? 'resend' : 'smtp');

  const senderName = currentSettings.senderName || 'OverDuty Hospital Backup';
  const senderEmail = process.env.RESEND_SENDER_EMAIL || currentSettings.senderEmail || 'backup@roni.kodl.uk';
  const fromFormatted = `${senderName} <${senderEmail}>`;

  if (provider === 'resend' || currentSettings.resendApiKey || process.env.RESEND_API_KEY) {
    return await sendResendEmail({
      apiKey: currentSettings.resendApiKey || process.env.RESEND_API_KEY,
      from: fromFormatted,
      to,
      subject,
      html,
      attachments,
    });
  } else {
    return await sendSmtpEmail({
      host: currentSettings.smtpHost || 'smtp.gmail.com',
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
  }
};

// 8. Send Personalized Backup to a Specific User
export const sendUserBackupEmail = async (userId, customRecipientEmail = null) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const recipient = customRecipientEmail || user.backupEmail || user.email;
  if (!recipient) throw new Error('No recipient email specified for this user');

  const settings = (await Settings.findOne().lean()) || {};
  const hospitalName = settings.hospitalName || 'Ad-din Akij Medical College Hospital';

  const userRecords = await Record.find({ createdBy: userId }).sort({ date: 1, sl: 1 }).lean();
  const dateStr = new Date().toISOString().split('T')[0];
  const nowDisplay = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Calculate statistics
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const thisMonthRecords = userRecords.filter((r) => r.month === currentMonth && r.year === currentYear);
  const totalAmountThisMonth = thisMonthRecords.reduce((sum, r) => sum + (parseFloat(r.remark) || 0), 0);

  // CSV attachment
  const csvContent = generateRecordsCSV(userRecords);

  // User backup JSON
  const userJsonBackup = JSON.stringify(
    {
      system: 'OverDuty Patient Record System',
      backupType: 'User Personal Archive',
      timestamp: new Date().toISOString(),
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
      stats: {
        totalAllTimeRecords: userRecords.length,
        thisMonthRecords: thisMonthRecords.length,
        thisMonthTotalRemark: totalAmountThisMonth,
      },
      records: userRecords,
    },
    null,
    2
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">🏥 ${hospitalName}</h1>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Over Duty & Patient Records Daily Backup</p>
        </div>

        <div style="padding: 24px;">
          <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">Hello ${user.name},</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Here is your daily automated clinical & over duty records backup. All your entered patient entries are securely archived in the attached spreadsheets.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Staff Member:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${user.name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Email Address:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Current Month Entries:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0284c7; text-align: right;">${thisMonthRecords.length} patients</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Current Month Over Duty Sum:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #059669; text-align: right;">${totalAmountThisMonth.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">All-Time Records Stored:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${userRecords.length} records</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Backup Timestamp:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${nowDisplay}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">
            📎 <strong>2 Attached Files:</strong><br>
            1. <code>records-${user.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}-${dateStr}.csv</code> (Open directly in Microsoft Excel / Google Sheets)<br>
            2. <code>user-archive-${dateStr}.json</code> (Raw JSON data backup)
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
      filename: `records-${user.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}-${dateStr}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: Buffer.from('\uFEFF' + csvContent, 'utf-8'), // UTF-8 BOM for Excel
    },
    {
      filename: `user-archive-${dateStr}.json`,
      contentType: 'application/json',
      content: Buffer.from(userJsonBackup, 'utf-8'),
    },
  ];

  await dispatchEmail({
    settings,
    to: recipient,
    subject: `🏥 Daily Patient Records Backup (${nowDisplay}) - ${user.name}`,
    html,
    attachments,
  });

  return { success: true, recipient, recordCount: userRecords.length };
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
    Record.find().sort({ date: 1, sl: 1 }).lean(),
  ]);

  const dateStr = new Date().toISOString().split('T')[0];
  const nowDisplay = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const hospitalName = settings?.hospitalName || 'Ad-din Akij Medical College Hospital';

  const csvContent = generateRecordsCSV(allRecords);
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
            2. <code>all-hospital-records-${dateStr}.csv</code> (Excel Spreadsheet)
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
      filename: `all-hospital-records-${dateStr}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: Buffer.from('\uFEFF' + csvContent, 'utf-8'),
    },
  ];

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

// 10. Run Full Midnight Backup Loop for All Users
export const runMidnightAllUsersBackup = async () => {
  console.log('[Scheduler] Starting midnight automated backup for all users...');
  const settings = await Settings.findOne();
  
  // 1. Save local disk snapshot
  await saveLocalSnapshot();

  // 2. Find all active users with autoEmailBackup enabled
  const activeUsers = await User.find({
    status: { $in: ['active', 'pending'] },
    autoEmailBackup: { $ne: false },
  }).lean();

  let sentCount = 0;
  const errors = [];

  for (const user of activeUsers) {
    const userEmail = user.backupEmail || user.email;
    if (!userEmail) continue;

    try {
      await sendUserBackupEmail(user._id, userEmail);
      sentCount++;
      console.log(`[Scheduler] Backup delivered to user: ${user.name} <${userEmail}>`);
    } catch (err) {
      console.error(`[Scheduler] Failed delivering to ${user.email}:`, err.message);
      errors.push({ user: user.email, error: err.message });
    }
  }

  // 3. Send Master DB Snapshot to Super Admin
  if (settings && settings.backupEmail) {
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
    settings.lastBackupMessage = `Nightly backup finished. Delivered to ${sentCount} users. ${errors.length} failed.`;
    await settings.save();
  }

  return { sentCount, errorsCount: errors.length };
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

// 12. Automated Daily Midnight Scheduler
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
        const settings = await Settings.findOne();
        if (settings && settings.autoEmailBackup) {
          const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
          const todayDateStr = now.toISOString().split('T')[0];
          const lastDateStr = lastBackup ? lastBackup.toISOString().split('T')[0] : '';

          // Only run once per day
          if (todayDateStr !== lastDateStr) {
            console.log('[Scheduler] Daily midnight backup triggered for all registered users...');
            await runMidnightAllUsersBackup();
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Automatic daily backup error:', err.message);
    }
  }, CHECK_INTERVAL);

  console.log('[Scheduler] Daily midnight automated backup scheduler initialized.');
};
