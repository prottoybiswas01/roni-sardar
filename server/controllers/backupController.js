import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateFullBackupData,
  saveLocalSnapshot,
  executeEmailBackup,
  sendUserBackupEmail,
  restoreDatabaseFromJson,
  dispatchEmail,
  sendShareReportEmail,
} from '../services/backupService.js';
import Settings from '../models/Settings.js';
import Record from '../models/Record.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// @desc    Get current backup status and local snapshot list
// @route   GET /api/backup/status
// @access  Private
export const getBackupStatus = async (req, res, next) => {
  try {
    const [settings, totalRecords, totalUsers] = await Promise.all([
      Settings.findOne(),
      Record.countDocuments({ isDeleted: { $ne: true } }),
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
        emailProvider: settings?.emailProvider || 'resend',
        resendApiKey: settings?.resendApiKey ? '••••••••••••••••' : '',
        senderEmail: settings?.senderEmail || 'onboarding@resend.dev',
        senderName: settings?.senderName || 'OverDuty Hospital Backup',
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

    const result = await restoreDatabaseFromJson(backupJson);

    res.status(200).json({
      success: true,
      message: `Database restored successfully! (${result.restoredRecordsCount} records restored, ${result.restoredUsersCount} users restored).`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger immediate master or user backup email dispatch
// @route   POST /api/backup/email-now
// @access  Private
export const triggerEmailBackup = async (req, res, next) => {
  try {
    const { customRecipient, forSelfOnly, month, year } = req.body;

    if (forSelfOnly || req.user.role === 'staff') {
      const result = await sendUserBackupEmail(
        req.user._id,
        customRecipient || req.user.backupEmail || req.user.email,
        month,
        year
      );
      return res.status(200).json({
        success: true,
        message: `Your Excel patient records report was sent to ${result.recipient}!`,
        data: result,
      });
    }

    const result = await executeEmailBackup(customRecipient);
    res.status(200).json({
      success: true,
      message: `Master database backup dispatched successfully to ${result.recipient}!`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test email gateway connection
// @route   POST /api/backup/test-email
// @access  Private/SuperAdmin/Admin
export const testEmailSettings = async (req, res, next) => {
  try {
    const { emailProvider, resendApiKey, senderEmail, senderName, host, port, user, pass, secure, to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a Recipient Email address to receive the test message.',
      });
    }

    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #0284c7; margin-top: 0;">✅ Hospital OverDuty Pro — Email Gateway Active</h3>
        <p style="font-size: 13px; color: #334155;">
          Your automated email gateway is configured properly. Automated daily midnight record backups will be delivered seamlessly.
        </p>
        <p style="font-size: 11px; color: #94a3b8;">Timestamp: ${new Date().toLocaleString()}</p>
      </div>
    `;

    const customSettings = {
      emailProvider: emailProvider || 'resend',
      resendApiKey,
      senderEmail,
      senderName,
      smtpHost: host,
      smtpPort: port,
      smtpUser: user,
      smtpPass: pass,
      smtpSecure: secure,
    };

    await dispatchEmail({
      settings: customSettings,
      to,
      subject: '✅ [Test] Hospital OverDuty Email Backup Verification',
      html: testHtml,
    });

    res.status(200).json({
      success: true,
      message: `Test email successfully delivered to ${to}!`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share OverDuty report (PDF / Excel) via Email to shopkeeper, boss, or external recipient
// @route   POST /api/backup/share-report
// @access  Private
export const shareReport = async (req, res, next) => {
  try {
    const {
      recipientEmail,
      recipientName,
      month,
      year,
      format, // 'pdf' | 'excel' | 'both'
      customNote,
      targetUserId,
    } = req.body;

    if (!recipientEmail || !recipientEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে প্রাপকের ইমেইল অ্যাড্রেস প্রদান করুন। (Recipient email is required)',
      });
    }

    // Only superadmin can share another user's records; staff can only share their own
    const effectiveTargetUserId =
      req.user.role === 'superadmin' && targetUserId ? targetUserId : req.user._id;

    const result = await sendShareReportEmail({
      userId: req.user._id,
      targetUserId: effectiveTargetUserId,
      recipientEmail: recipientEmail.trim(),
      recipientName: (recipientName || '').trim(),
      targetMonth: month,
      targetYear: year,
      format: format || 'pdf',
      customNote: (customNote || '').trim(),
    });

    res.status(200).json({
      success: true,
      message: `রিপোর্টটি সফলভাবে ${result.recipient} ঠিকানায় পাঠানো হয়েছে! (${(result.format || 'pdf').toUpperCase()} ফরম্যাট)`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
