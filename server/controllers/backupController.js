import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateFullBackupData,
  saveLocalSnapshot,
  executeEmailBackup,
  restoreFullBackupData,
  sendSmtpEmail,
} from '../services/backupService.js';
import Settings from '../models/Settings.js';
import Record from '../models/Record.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// @desc    Get current backup status and local snapshot list
// @route   GET /api/backup/status
// @access  Private/SuperAdmin/Admin
export const getBackupStatus = async (req, res, next) => {
  try {
    const [settings, totalRecords, totalUsers] = await Promise.all([
      Settings.findOne(),
      Record.countDocuments(),
      User.countDocuments(),
    ]);

    // List local snapshot files
    let localSnapshots = [];
    if (fs.existsSync(BACKUPS_DIR)) {
      const files = fs.readdirSync(BACKUPS_DIR);
      localSnapshots = files
        .filter((f) => f.endsWith('.json'))
        .map((filename) => {
          const stat = fs.statSync(path.join(BACKUPS_DIR, filename));
          return {
            filename,
            sizeBytes: stat.size,
            createdAt: stat.birthtime || stat.mtime,
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.status(200).json({
      success: true,
      data: {
        totalRecords,
        totalUsers,
        backupEmail: settings?.backupEmail || 'admin@hospital.com',
        autoEmailBackup: settings?.autoEmailBackup ?? true,
        smtpHost: settings?.smtpHost || 'smtp.gmail.com',
        smtpPort: settings?.smtpPort || 465,
        smtpUser: settings?.smtpUser || '',
        hasSmtpPass: Boolean(settings?.smtpPass),
        smtpSecure: settings?.smtpSecure ?? true,
        lastBackupAt: settings?.lastBackupAt || null,
        lastBackupStatus: settings?.lastBackupStatus || 'idle',
        lastBackupMessage: settings?.lastBackupMessage || '',
        localSnapshots,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export and download full JSON database backup file
// @route   GET /api/backup/export
// @access  Private/SuperAdmin/Admin
export const exportBackup = async (req, res, next) => {
  try {
    const backupData = await generateFullBackupData();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `hospital-overduty-backup-${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    next(error);
  }
};

// @desc    Restore database from uploaded backup JSON file
// @route   POST /api/backup/restore
// @access  Private/SuperAdmin
export const restoreBackup = async (req, res, next) => {
  try {
    const backupJson = req.body;
    if (!backupJson) {
      return res.status(400).json({
        success: false,
        message: 'No backup data provided in request body',
      });
    }

    const result = await restoreFullBackupData(backupJson);

    res.status(200).json({
      success: true,
      message: `Database restored successfully! (${result.restoredRecordsCount} records restored, ${result.restoredUsersCount} users restored).`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger immediate daily backup email dispatch
// @route   POST /api/backup/email-now
// @access  Private/SuperAdmin/Admin
export const triggerEmailBackup = async (req, res, next) => {
  try {
    const { customRecipient } = req.body;
    const result = await executeEmailBackup(customRecipient);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test SMTP email connection
// @route   POST /api/backup/test-email
// @access  Private/SuperAdmin/Admin
export const testEmailSettings = async (req, res, next) => {
  try {
    const { host, port, user, pass, secure, to } = req.body;

    if (!host || !user || !pass || !to) {
      return res.status(400).json({
        success: false,
        message: 'Please provide SMTP Host, User (Email), App Password, and Recipient Email',
      });
    }

    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #0284c7; margin-top: 0;">✅ Hospital OverDuty Pro — Email Test Successful</h3>
        <p style="font-size: 13px; color: #334155;">
          Your SMTP connection is working correctly. Daily automated database backups will be delivered to this email address every night at midnight.
        </p>
        <p style="font-size: 11px; color: #94a3b8;">Timestamp: ${new Date().toLocaleString()}</p>
      </div>
    `;

    await sendSmtpEmail({
      host,
      port: Number(port) || 465,
      user,
      pass,
      secure: secure !== undefined ? Boolean(secure) : true,
      from: user,
      to,
      subject: '✅ [Test] Hospital OverDuty Email Backup Verification',
      htmlBody: testHtml,
    });

    res.status(200).json({
      success: true,
      message: `Test email successfully sent to ${to}! Your SMTP configuration is working properly.`,
    });
  } catch (error) {
    next(error);
  }
};
