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
    Record.find().lean(),
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

// 2. Generate CSV representation of records for easy viewing
export const generateRecordsCSV = (records = []) => {
  const headers = ['SL', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Remark', 'Month', 'Year', 'Created By ID'];
  const rows = records.map((r) => [
    r.sl || '',
    `="${String(r.patientId || '')}"`, // force text in Excel
    `"${String(r.patientName || '').replace(/"/g, '""')}"`,
    r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    r.time || '',
    `"${String(r.remark || '').replace(/"/g, '""')}"`,
    r.month || '',
    r.year || '',
    r.createdBy || '',
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
};

// 3. Save Local File Snapshot
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

// 4. Pure Node.js SMTP Sender (Zero external npm dependency)
export const sendSmtpEmail = ({ host, port = 465, user, pass, secure = true, from, to, subject, htmlBody, attachments = [] }) => {
  return new Promise((resolve, reject) => {
    if (!host || !user || !pass || !to) {
      return reject(new Error('Incomplete SMTP configuration. Host, User, Pass, and To Email are required.'));
    }

    const isExplicitSsl = secure || port === 465;
    const client = isExplicitSsl
      ? tls.connect(port, host, { rejectUnauthorized: false })
      : net.connect(port, host);

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
        if (line.charAt(3) === '-') continue; // intermediate multiline reply

        if (code >= 400) {
          client.end();
          return reject(new Error(`SMTP Server Error (${code}): ${line}`));
        }

        switch (stage) {
          case 0: // Connected, greeting 220 received
            stage = 1;
            send(`EHLO localhost`);
            break;

          case 1: // EHLO 250 response
            stage = 2;
            send(`AUTH LOGIN`);
            break;

          case 2: // 334 Username challenge
            stage = 3;
            send(Buffer.from(user).toString('base64'));
            break;

          case 3: // 334 Password challenge
            stage = 4;
            send(Buffer.from(pass).toString('base64'));
            break;

          case 4: // 235 Authentication successful
            stage = 5;
            send(`MAIL FROM:<${from || user}>`);
            break;

          case 5: // 250 Sender OK
            stage = 6;
            send(`RCPT TO:<${to}>`);
            break;

          case 6: // 250 Recipient OK
            stage = 7;
            send(`DATA`);
            break;

          case 7: // 354 Start mail input
            stage = 8;
            const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            let message = '';
            message += `From: "Hospital OverDuty System" <${from || user}>\r\n`;
            message += `To: <${to}>\r\n`;
            message += `Subject: ${subject}\r\n`;
            message += `MIME-Version: 1.0\r\n`;
            message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

            // HTML Body part
            message += `--${boundary}\r\n`;
            message += `Content-Type: text/html; charset=utf-8\r\n`;
            message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
            message += `${htmlBody}\r\n\r\n`;

            // Attachments
            for (const att of attachments) {
              message += `--${boundary}\r\n`;
              message += `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
              message += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
              message += `Content-Transfer-Encoding: base64\r\n\r\n`;
              message += `${att.content.toString('base64').replace(/(.{76})/g, '$1\r\n')}\r\n\r\n`;
            }

            message += `--${boundary}--\r\n.\r\n`;
            client.write(message);
            break;

          case 8: // 250 Message accepted for delivery
            stage = 9;
            send(`QUIT`);
            resolve({ success: true, message: 'Email dispatched successfully' });
            break;

          case 9:
            client.end();
            break;
        }
      }
    });

    client.on('error', (err) => {
      reject(new Error(`SMTP Connection Error: ${err.message}`));
    });

    client.setTimeout(20000, () => {
      client.destroy();
      reject(new Error('SMTP connection timed out after 20 seconds'));
    });
  });
};

// 5. Execute Full Email Backup Operation
export const executeEmailBackup = async (customRecipient = null) => {
  const settings = await Settings.findOne();
  if (!settings) {
    throw new Error('Settings not initialized');
  }

  const recipientEmail = customRecipient || settings.backupEmail || 'admin@hospital.com';
  const smtpHost = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = settings.smtpPort || Number(process.env.SMTP_PORT) || 465;
  const smtpUser = settings.smtpUser || process.env.SMTP_USER || '';
  const smtpPass = settings.smtpPass || process.env.SMTP_PASS || '';
  const smtpSecure = settings.smtpSecure !== undefined ? settings.smtpSecure : true;

  // 1. Gather all database records & JSON backup
  const backupData = await generateFullBackupData();
  const dateStr = new Date().toISOString().split('T')[0];
  const totalCount = backupData.counts.totalRecords;
  const userCount = backupData.counts.totalUsers;

  // 2. Also write local snapshot
  await saveLocalSnapshot();

  // 3. Prepare CSV and JSON attachments
  const jsonBuffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8');
  const csvBuffer = Buffer.from(generateRecordsCSV(backupData.data.records), 'utf-8');

  // If SMTP is not yet configured with a password, save local snapshot and log clear guide
  if (!smtpUser || !smtpPass) {
    settings.lastBackupAt = new Date();
    settings.lastBackupStatus = 'idle';
    settings.lastBackupMessage = `Local snapshot saved (SMTP credentials not configured yet in Settings). Total records backed up: ${totalCount}`;
    await settings.save();
    return {
      success: true,
      mode: 'local_only',
      message: `Local backup saved successfully (${totalCount} records). To enable direct Email delivery, configure your Gmail/SMTP credentials in Settings.`,
      backupData,
    };
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-radius: 12px; background-color: #ffffff;">
      <div style="background-color: #0f172a; color: #ffffff; padding: 18px; border-radius: 8px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Hospital OverDuty Pro — Automated Database Backup</h2>
        <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">Daily Disaster Recovery Snapshot & Patient Records Archive</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 14px; color: #334155;">Hello Administrator,</p>
        <p style="font-size: 13px; color: #475569; line-height: 1.6;">
          Your automated daily hospital patient log and system backup has been successfully compiled on <strong>${new Date().toLocaleString()}</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px;">📊 Backup Overview</h4>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #64748b;">Hospital Name:</td><td style="font-weight: bold; color: #0f172a;">${settings.hospitalName}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Total Patient Records:</td><td style="font-weight: bold; color: #0284c7;">${totalCount} records</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Registered Staff Accounts:</td><td style="font-weight: bold; color: #16a34a;">${userCount} accounts</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Snapshot Date:</td><td style="color: #334155;">${dateStr}</td></tr>
          </table>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          📎 <strong>Attachments included:</strong><br/>
          1. <code>database-backup-${dateStr}.json</code> (Complete database snapshot for 1-click restore)<br/>
          2. <code>patient-records-${dateStr}.csv</code> (Excel-compatible spreadsheet containing all patient entries)
        </p>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
        This is an automated system email generated by Ad-din Akij Medical College Hospital OverDuty Management Server.
      </div>
    </div>
  `;

  try {
    await sendSmtpEmail({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      secure: smtpSecure,
      from: smtpUser,
      to: recipientEmail,
      subject: `[Daily Backup] Hospital OverDuty Records Archive — ${dateStr} (${totalCount} Records)`,
      htmlBody,
      attachments: [
        {
          filename: `database-backup-${dateStr}.json`,
          contentType: 'application/json',
          content: jsonBuffer,
        },
        {
          filename: `patient-records-${dateStr}.csv`,
          contentType: 'text/csv',
          content: csvBuffer,
        },
      ],
    });

    settings.lastBackupAt = new Date();
    settings.lastBackupStatus = 'success';
    settings.lastBackupMessage = `Backup successfully emailed to ${recipientEmail} (${totalCount} records).`;
    await settings.save();

    return {
      success: true,
      mode: 'email_and_local',
      message: `Database backup (${totalCount} records) successfully delivered to ${recipientEmail} and saved locally.`,
    };
  } catch (err) {
    settings.lastBackupAt = new Date();
    settings.lastBackupStatus = 'error';
    settings.lastBackupMessage = `Email dispatch failed: ${err.message}. Local snapshot preserved.`;
    await settings.save();
    throw err;
  }
};

// 6. Safe Database Restore / Disaster Recovery Importer
export const restoreFullBackupData = async (backupJson) => {
  if (!backupJson || typeof backupJson !== 'object') {
    throw new Error('Invalid backup file payload');
  }

  const { data } = backupJson;
  if (!data || !Array.isArray(data.records)) {
    throw new Error('Malformed backup structure: records array missing');
  }

  let restoredRecordsCount = 0;
  let restoredUsersCount = 0;

  // 1. Restore Users (Preserving existing or upserting by email/username)
  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      if (!u.email) continue;
      const existingUser = await User.findOne({ email: u.email.toLowerCase() });
      if (!existingUser) {
        // Create user with preserved password hash and role
        await User.collection.insertOne({
          _id: u._id,
          name: u.name,
          username: u.username || u.email.split('@')[0],
          email: u.email.toLowerCase(),
          password: u.password,
          role: u.role || 'staff',
          status: u.status || 'active',
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
        });
        restoredUsersCount++;
      }
    }
  }

  // 2. Restore Records (Upsert by _id or patientId + date + time)
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

  // 3. Restore Settings if available
  if (data.settings && data.settings.hospitalName) {
    const currentSettings = await Settings.findOne();
    if (currentSettings) {
      if (data.settings.hospitalName) currentSettings.hospitalName = data.settings.hospitalName;
      if (data.settings.location) currentSettings.location = data.settings.location;
      await currentSettings.save();
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

// 7. Automated Daily Midnight Scheduler (Runs every 24h at 00:00:00)
let schedulerInitialized = false;

export const initDailyBackupScheduler = () => {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Run a local snapshot immediately on startup
  saveLocalSnapshot();

  // Check every 30 minutes if midnight has crossed and backup is due
  const CHECK_INTERVAL = 30 * 60 * 1000;
  setInterval(async () => {
    try {
      const now = new Date();
      // Check if it's within the midnight window (between 00:00 and 00:40)
      if (now.getHours() === 0 && now.getMinutes() <= 35) {
        const settings = await Settings.findOne();
        if (settings && settings.autoEmailBackup) {
          const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
          const todayDateStr = now.toISOString().split('T')[0];
          const lastDateStr = lastBackup ? lastBackup.toISOString().split('T')[0] : '';

          // Only send once per calendar day
          if (todayDateStr !== lastDateStr) {
            console.log('[Scheduler] Daily midnight backup triggered...');
            await executeEmailBackup();
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Automatic daily backup error:', err.message);
    }
  }, CHECK_INTERVAL);

  console.log('[Scheduler] Daily midnight automated backup scheduler initialized.');
};
