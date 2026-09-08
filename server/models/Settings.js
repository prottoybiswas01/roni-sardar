import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    hospitalName: {
      type: String,
      default: 'Ad-din Akij Medical College Hospital',
      trim: true,
    },
    location: {
      type: String,
      default: 'Boyra, Khulna',
      trim: true,
    },
    reportTitle: {
      type: String,
      default: 'OVER DUTY / PATIENT REPORT',
      trim: true,
    },
    checkDuplicates: {
      type: Boolean,
      default: true,
    },
    defaultMonth: {
      type: Number,
      default: () => new Date().getMonth() + 1,
    },
    defaultYear: {
      type: Number,
      default: () => new Date().getFullYear(),
    },
    // Automated & Manual Backup Settings
    backupEmail: {
      type: String,
      default: 'admin@hospital.com',
      trim: true,
    },
    autoEmailBackup: {
      type: Boolean,
      default: true,
    },
    smtpHost: {
      type: String,
      default: 'smtp.gmail.com',
      trim: true,
    },
    smtpPort: {
      type: Number,
      default: 465,
    },
    smtpUser: {
      type: String,
      default: '',
      trim: true,
    },
    smtpPass: {
      type: String,
      default: '',
    },
    smtpSecure: {
      type: Boolean,
      default: true,
    },
    lastBackupAt: {
      type: Date,
      default: null,
    },
    lastBackupStatus: {
      type: String,
      enum: ['idle', 'success', 'error'],
      default: 'idle',
    },
    lastBackupMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
