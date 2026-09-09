import express from 'express';
import {
  getBackupStatus,
  exportBackup,
  restoreBackup,
  triggerEmailBackup,
  testEmailSettings,
  shareReport,
  syncSecondaryDatabase,
  runMidnightBackupNow,
} from '../controllers/backupController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Allow all authenticated staff to trigger their email backup or share report via email
router.post('/email-now', triggerEmailBackup);
router.post('/share-report', shareReport);

// Admin-only operations:
router.use(authorize('superadmin', 'admin'));
router.get('/status', getBackupStatus);
router.get('/export', exportBackup);
router.post('/restore', restoreBackup);
router.post('/test-email', testEmailSettings);
router.post('/sync-secondary', syncSecondaryDatabase);
router.post('/run-midnight-now', runMidnightBackupNow);

export default router;
