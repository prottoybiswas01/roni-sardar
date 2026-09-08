import mongoose from 'mongoose';
import { initSecondaryDB } from '../services/dbMirrorService.js';

export const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const secondaryUri = process.env.MONGODB_SECONDARY_URI || process.env.MONGODB_BACKUP_URI;

  if (!primaryUri && !secondaryUri) {
    console.warn('[MongoDB Warning] Neither MONGODB_URI nor MONGODB_SECONDARY_URI is set. Database operations will be unavailable.');
    return null;
  }

  // 1. Try Primary MongoDB Connection
  if (primaryUri) {
    try {
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`[MongoDB] Primary connected: host=${conn.connection.host}, database=${conn.connection.name}`);

      // Initialize Secondary Mirror Connection in background if provided
      if (secondaryUri) {
        initSecondaryDB().catch((e) => console.error('[Dual-DB] Secondary init error:', e.message));
      }

      return conn;
    } catch (primaryError) {
      console.error(`[MongoDB] Primary connection failed (${primaryError.message}). Checking secondary failover...`);
    }
  }

  // 2. Automatic Failover to Secondary MongoDB Cluster if Primary fails
  if (secondaryUri) {
    try {
      console.log('[MongoDB Failover] 🚨 Attempting automatic failover to Secondary MongoDB Cluster...');
      const fallbackConn = await mongoose.connect(secondaryUri, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`[MongoDB Failover] 🛡️ Successfully connected to Secondary MongoDB (host=${fallbackConn.connection.host}, database=${fallbackConn.connection.name})`);
      return fallbackConn;
    } catch (fallbackError) {
      console.error(`[MongoDB Failover] Secondary connection also failed: ${fallbackError.message}`);
    }
  }

  return null;
};
