import express from 'express';
import {
  register,
  login,
  getMe,
  getUsers,
  updateUser,
  deleteUser,
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('admin', 'superadmin'), getUsers);
router.put('/users/:id', protect, authorize('admin', 'superadmin'), updateUser);
router.delete('/users/:id', protect, authorize('admin', 'superadmin'), deleteUser);

export default router;
