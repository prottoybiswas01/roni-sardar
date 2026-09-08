import express from 'express';
import {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getBinRecords,
  restoreRecord,
  permanentDeleteRecord,
  emptyBin,
  checkDuplicate,
  getDashboardStats,
  getNextSl,
} from '../controllers/recordController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All record operations require authentication

// Recycle Bin Routes (Must be declared before `/:id` to avoid route collision)
router.get('/bin', getBinRecords);
router.delete('/bin/empty', authorize('superadmin'), emptyBin);
router.put('/bin/:id/restore', restoreRecord);
router.delete('/bin/:id/permanent', authorize('superadmin'), permanentDeleteRecord);

// Active Records & Utility Routes
router.get('/dashboard-stats', getDashboardStats);
router.get('/check-duplicate', checkDuplicate);
router.get('/next-sl', getNextSl);
router.get('/:id', getRecordById);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

export default router;

