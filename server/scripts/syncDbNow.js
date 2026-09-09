import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const primaryUri = process.env.MONGODB_URI;
const secondaryUri = process.env.MONGODB_SECONDARY_URI;

console.log('====================================================');
console.log('🔄 OverDuty Pro - Instant Dual-DB Mirroring Sync Tool');
console.log('====================================================');

if (!primaryUri || !secondaryUri) {
  console.error('❌ Error: Both MONGODB_URI and MONGODB_SECONDARY_URI must be defined in server/.env');
  process.exit(1);
}

async function runSync() {
  try {
    console.log('1️⃣ Connecting to Primary MongoDB...');
    const primaryConn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`✅ Primary MongoDB Connected: host=${primaryConn.connection.host}, db=${primaryConn.connection.name}`);

    console.log('2️⃣ Connecting to Secondary MongoDB...');
    const secondaryConn = mongoose.createConnection(secondaryUri, {
      serverSelectionTimeoutMS: 15000,
      dbName: 'over_duty_db',
    });
    await secondaryConn.asPromise();
    console.log(`✅ Secondary MongoDB Connected: host=${secondaryConn.host}, db=${secondaryConn.name}`);

    console.log('3️⃣ Reading all Collections from Primary MongoDB...');
    const primaryDb = primaryConn.connection.db;
    const secondaryDb = secondaryConn.db;

    const collections = ['records', 'users', 'settings'];

    for (const collName of collections) {
      const primaryColl = primaryDb.collection(collName);
      const secondaryColl = secondaryDb.collection(collName);

      const docs = await primaryColl.find().toArray();
      console.log(`📦 Found ${docs.length} items in collection "${collName}" on Primary.`);

      if (docs.length > 0) {
        const ops = docs.map((doc) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
          },
        }));

        const result = await secondaryColl.bulkWrite(ops, { ordered: false });
        console.log(`   └─ ✅ Successfully synced "${collName}" to Secondary! (Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount})`);
      } else {
        console.log(`   └─ ℹ️ No documents in "${collName}" to sync.`);
      }
    }

    console.log('====================================================');
    console.log('🎉 ALL DATA SUCCESSFULLY MIRRORED TO SECONDARY MONGODB!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during dual-database synchronization:', err.message);
    process.exit(1);
  }
}

runSync();
