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
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
