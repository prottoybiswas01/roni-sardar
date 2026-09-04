import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getSettings);
router.put('/', authorize('admin', 'manager'), updateSettings);

export default router;
