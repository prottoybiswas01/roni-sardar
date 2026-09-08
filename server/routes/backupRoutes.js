import express from 'express';
import {
  getBackupStatus,
  exportBackup,
  restoreBackup,
  triggerEmailBackup,
  testEmailSettings,
} from '../controllers/backupController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Allow all authenticated staff to trigger their email backup for themselves
router.post('/email-now', triggerEmailBackup);

// Admin-only operations:
router.use(authorize('superadmin', 'admin'));
router.get('/status', getBackupStatus);
router.get('/export', exportBackup);
router.post('/restore', restoreBackup);
router.post('/test-email', testEmailSettings);

export default router;
