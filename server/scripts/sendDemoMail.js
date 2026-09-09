import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { sendUserBackupEmail, executeEmailBackup } from '../services/backupService.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const targetRecipient = process.argv[2] || 'prottoybiswas575358@gmail.com';

console.log('====================================================');
console.log('📧 OverDuty Pro - Live Demo Backup Email Dispatcher');
console.log('====================================================');
console.log(`🎯 Recipient: ${targetRecipient}`);

async function sendDemo() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in server/.env');
    }

    console.log('1️⃣ Connecting to Database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Database connected.');

    // Find Roni user or first user
    let user = await User.findOne({ username: 'roni' });
    if (!user) {
      user = await User.findOne({ role: { $in: ['staff', 'superadmin', 'admin'] } });
    }

    if (!user) {
      console.log('⚠️ No specific user found, dispatching Master System Backup...');
      const result = await executeEmailBackup(targetRecipient);
      console.log('🎉 Master Backup Email sent successfully!', result);
    } else {
      console.log(`2️⃣ Generating statement for staff: ${user.name} (${user.username})...`);
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      console.log('3️⃣ Generating PDF & Excel attachments and sending email via Resend...');
      const result = await sendUserBackupEmail(
        user._id,
        targetRecipient,
        currentMonth,
        currentYear,
        false
      );

      console.log('====================================================');
      console.log(`🎉 Demo Email sent successfully to: ${result.recipient}`);
      console.log(`📊 Month: ${result.monthLabel}`);
      console.log(`📋 Total Entries: ${result.recordCount}`);
      console.log(`💰 Total Amount: Tk. ${result.totalAmount}`);
      console.log('📎 Attachments: 1 PDF Statement + 1 Formatted Excel (.xlsx)');
      console.log('🔗 Backup Links: Included Level 3 Standby Portal link');
      console.log('====================================================');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sending demo email:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

sendDemo();
