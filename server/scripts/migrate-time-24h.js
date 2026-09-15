import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const primaryUri = process.env.MONGODB_URI;
const secondaryUri = process.env.MONGODB_SECONDARY_URI;

if (!primaryUri) {
  console.error('❌ Error: MONGODB_URI is required in server/.env');
  process.exit(1);
}

// Convert any 12-hour or 24-hour time string into clean 24-hour HH:mm
function to24HourTime(timeStr) {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim().toUpperCase();

  // Match e.g. 10.47AM, 01.30PM, 12:17 AM, 05:03:00PM, 14:30, 9.15
  const match = trimmed.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const p = match[3] ? match[3].toUpperCase() : null;

    if (p === 'PM' && h < 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    if (!p && h > 23) h = 23;

    return `${String(h).padStart(2, '0')}:${m}`;
  }

  const parts = trimmed.split(/[:.]/);
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const mins = parts[1].slice(0, 2).padStart(2, '0');
    if (!isNaN(hours)) {
      if (trimmed.includes('PM') && hours < 12) hours += 12;
      if (trimmed.includes('AM') && hours === 12) hours = 0;
      if (hours > 23) hours = 23;
      return `${String(hours).padStart(2, '0')}:${mins}`;
    }
  }

  return trimmed;
}

async function runMigration() {
  console.log('====================================================');
  console.log('🕒 OverDuty Pro - 24-Hour International Time Migration');
  console.log('====================================================\n');

  try {
    // 1. Primary Database
    console.log('1️⃣ Connecting to Primary MongoDB Cluster...');
    const primaryConn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`✅ Connected to Primary MongoDB: ${primaryConn.connection.host}/${primaryConn.connection.name}`);

    const primaryColl = primaryConn.connection.db.collection('records');
    const records = await primaryColl.find({}).toArray();
    console.log(`📦 Found ${records.length} records in Primary Database.\n`);

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const rec of records) {
      const originalTime = rec.time || '';
      const newTime = to24HourTime(originalTime);

      if (originalTime !== newTime) {
        await primaryColl.updateOne(
          { _id: rec._id },
          { $set: { time: newTime } }
        );
        console.log(`   [SL ${rec.sl || '-'}] Patient #${rec.patientId} (${rec.patientName}): "${originalTime}" ➔ "${newTime}"`);
        updatedCount++;
      } else {
        console.log(`   [SL ${rec.sl || '-'}] Patient #${rec.patientId}: "${originalTime}" (Already 24h)`);
        unchangedCount++;
      }
    }

    console.log(`\n✅ Primary Database Migration Complete: ${updatedCount} updated, ${unchangedCount} unchanged.\n`);

    // 2. Secondary Database (Dual-DB Mirror)
    if (secondaryUri) {
      console.log('2️⃣ Connecting to Secondary (Backup) MongoDB Cluster...');
      let cleanSecondaryUri = secondaryUri.trim();
      if (!cleanSecondaryUri.includes('authSource=')) {
        cleanSecondaryUri += (cleanSecondaryUri.includes('?') ? '&' : '?') + 'authSource=admin';
      }

      const secondaryConn = mongoose.createConnection(cleanSecondaryUri, {
        serverSelectionTimeoutMS: 15000,
      });
      await secondaryConn.asPromise();
      console.log(`✅ Connected to Secondary MongoDB: ${secondaryConn.host}/${secondaryConn.name}`);

      const secondaryColl = secondaryConn.db.collection('records');
      const secRecords = await secondaryColl.find({}).toArray();
      console.log(`📦 Found ${secRecords.length} records in Secondary Database.`);

      let secUpdated = 0;
      for (const rec of secRecords) {
        const originalTime = rec.time || '';
        const newTime = to24HourTime(originalTime);

        if (originalTime !== newTime) {
          await secondaryColl.updateOne(
            { _id: rec._id },
            { $set: { time: newTime } }
          );
          secUpdated++;
        }
      }
      console.log(`✅ Secondary Database Migration Complete: ${secUpdated} records updated.\n`);
      await secondaryConn.close();
    }

    console.log('====================================================');
    console.log('🎉 ALL RECORDS IN DATABASE SUCCESSFULLY MIGRATED TO 24-HOUR FORMAT!');
    console.log('====================================================');
    await primaryConn.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
