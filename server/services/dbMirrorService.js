import mongoose from 'mongoose';
import Record from '../models/Record.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';

let secondaryConnection = null;
let isSyncing = false;

/**
 * Initialize Secondary / Backup MongoDB Cluster Connection
 * Supports a completely independent MongoDB Atlas account/cluster
 */
export const initSecondaryDB = async () => {
  const secondaryUri = process.env.MONGODB_SECONDARY_URI || process.env.MONGODB_BACKUP_URI;

  if (!secondaryUri) {
    console.log('[Dual-DB Engine] Secondary MongoDB URI (MONGODB_SECONDARY_URI) is not configured. Single database mode active.');
    return null;
  }

  try {
    secondaryConnection = mongoose.createConnection(secondaryUri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
      minPoolSize: 1,
      dbName: 'over_duty_db',
      retryWrites: true,
    });

    await secondaryConnection.asPromise();
    console.log(`[Dual-DB Engine] 🛡️ Secondary MongoDB connection established and open: host=${secondaryConnection.host}, db=${secondaryConnection.name}`);

    // Trigger initial replication immediately
    syncAllToSecondary().catch((e) => console.error('[Dual-DB Engine] Initial sync error:', e.message));

    // Automated periodic background self-healing sync (runs every 3 minutes)
    setInterval(() => {
      syncAllToSecondary().catch((e) => console.error('[Dual-DB Engine] Periodic sync error:', e.message));
    }, 3 * 60 * 1000);

    secondaryConnection.on('error', (err) => {
      console.error('[Dual-DB Engine] Secondary MongoDB connection error:', err.message);
    });

    secondaryConnection.on('disconnected', () => {
      console.warn('[Dual-DB Engine] Secondary MongoDB disconnected.');
    });

    return secondaryConnection;
  } catch (err) {
    console.error('[Dual-DB Engine] Failed to initialize secondary MongoDB connection:', err.message);
    return null;
  }
};

/**
 * Get Secondary Database Connection
 */
export const getSecondaryConnection = () => secondaryConnection;

/**
 * Mirror a Single Record to Secondary MongoDB (Create / Update / Delete)
 */
export const mirrorRecordToSecondary = async (recordDoc, action = 'save') => {
  if (!secondaryConnection || secondaryConnection.readyState !== 1) return;

  try {
    const SecondaryRecord = secondaryConnection.collection('records');

    if (action === 'delete') {
      await SecondaryRecord.deleteOne({ _id: recordDoc._id });
      console.log(`[Dual-DB Mirror] Record ${recordDoc._id} (Patient: ${recordDoc.patientId}) deleted from Secondary DB.`);
    } else {
      // Upsert into Secondary cluster
      const rawData = typeof recordDoc.toObject === 'function' ? recordDoc.toObject() : recordDoc;
      await SecondaryRecord.replaceOne(
        { _id: rawData._id },
        rawData,
        { upsert: true }
      );
      console.log(`[Dual-DB Mirror] Record ${rawData._id} (Patient: ${rawData.patientId}) synced to Secondary DB.`);
    }
  } catch (err) {
    console.error('[Dual-DB Mirror Error] Failed to mirror record to secondary database:', err.message);
  }
};

/**
 * Mirror a Single User Account to Secondary MongoDB (Create / Update / Delete)
 */
export const mirrorUserToSecondary = async (userDoc, action = 'save') => {
  if (!secondaryConnection || secondaryConnection.readyState !== 1) return;

  try {
    const SecondaryUser = secondaryConnection.collection('users');

    if (action === 'delete') {
      await SecondaryUser.deleteOne({ _id: userDoc._id });
      console.log(`[Dual-DB Mirror] User ${userDoc.email} deleted from Secondary DB.`);
    } else {
      const rawData = typeof userDoc.toObject === 'function' ? userDoc.toObject() : userDoc;
      await SecondaryUser.replaceOne(
        { _id: rawData._id },
        rawData,
        { upsert: true }
      );
      console.log(`[Dual-DB Mirror] User ${rawData.email} synced to Secondary DB.`);
    }
  } catch (err) {
    console.error('[Dual-DB Mirror Error] Failed to mirror user to secondary database:', err.message);
  }
};

/**
 * Mirror System Settings to Secondary MongoDB
 */
export const mirrorSettingsToSecondary = async (settingsDoc) => {
  if (!secondaryConnection || secondaryConnection.readyState !== 1) return;

  try {
    const SecondarySettings = secondaryConnection.collection('settings');
    const rawData = typeof settingsDoc.toObject === 'function' ? settingsDoc.toObject() : settingsDoc;
    await SecondarySettings.replaceOne(
      { _id: rawData._id },
      rawData,
      { upsert: true }
    );
    console.log('[Dual-DB Mirror] System settings synced to Secondary DB.');
  } catch (err) {
    console.error('[Dual-DB Mirror Error] Failed to mirror settings to secondary database:', err.message);
  }
};

/**
 * Full Database Synchronization (Reconciles all Primary collections to Secondary Cluster)
 */
export const syncAllToSecondary = async () => {
  if (!secondaryConnection || secondaryConnection.readyState !== 1 || isSyncing) return;

  isSyncing = true;
  console.log('[Dual-DB Engine] 🔄 Running full database synchronization to Secondary MongoDB...');

  try {
    const [allRecords, allUsers, settings] = await Promise.all([
      Record.find().lean(),
      User.find().select('+password').lean(),
      Settings.findOne().lean(),
    ]);

    const SecondaryRecord = secondaryConnection.collection('records');
    const SecondaryUser = secondaryConnection.collection('users');
    const SecondarySettings = secondaryConnection.collection('settings');

    // Bulk sync Records
    if (allRecords.length > 0) {
      const recordOps = allRecords.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await SecondaryRecord.bulkWrite(recordOps, { ordered: false });
    }

    // Bulk sync Users
    if (allUsers.length > 0) {
      const userOps = allUsers.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await SecondaryUser.bulkWrite(userOps, { ordered: false });
    }

    // Sync Settings
    if (settings) {
      await SecondarySettings.replaceOne({ _id: settings._id }, settings, { upsert: true });
    }

    console.log(`[Dual-DB Engine] ✅ Full synchronization completed: ${allRecords.length} records, ${allUsers.length} users mirrored.`);
  } catch (err) {
    console.error('[Dual-DB Engine] Full synchronization error:', err.message);
  } finally {
    isSyncing = false;
  }
};
