import express from 'express';
import {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  checkDuplicate,
  getDashboardStats,
  getNextSl,
} from '../controllers/recordController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All record operations require authentication

router.get('/', getRecords);
router.get('/dashboard-stats', getDashboardStats);
router.get('/check-duplicate', checkDuplicate);
router.get('/next-sl', getNextSl);
router.get('/:id', getRecordById);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', authorize('admin', 'manager'), deleteRecord);

export default router;
