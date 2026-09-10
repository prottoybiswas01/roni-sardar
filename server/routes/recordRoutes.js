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
  getMonthlyCounts,
  processOCRImage,
} from '../controllers/recordController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All record operations require authentication

// Active Records & Utility Routes
router.post('/scan-ocr', processOCRImage);
router.get('/dashboard-stats', getDashboardStats);
router.get('/monthly-counts', getMonthlyCounts);
router.get('/check-duplicate', checkDuplicate);
router.get('/next-sl', getNextSl);
router.get('/', getRecords);
router.get('/:id', getRecordById);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

export default router;

