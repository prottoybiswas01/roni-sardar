import express from 'express';
import {
  register,
  verifyEmailOtp,
  resendEmailOtp,
  login,
  getMe,
  getUsers,
  updateUser,
  deleteUser,
  sendDeleteUserOtp,
  verifyAndDeleteUser,
  updateMyBackupEmail,
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public Authentication & OTP Verification Routes
router.post('/register', register);
router.post('/verify-email-otp', verifyEmailOtp);
router.post('/resend-email-otp', resendEmailOtp);
router.post('/login', login);

// Private User Routes
router.get('/me', protect, getMe);
router.put('/backup-email', protect, updateMyBackupEmail);

// Super Admin / Admin User Management Routes
router.get('/users', protect, authorize('admin', 'superadmin'), getUsers);
router.put('/users/:id', protect, authorize('admin', 'superadmin'), updateUser);
router.delete('/users/:id', protect, authorize('superadmin'), deleteUser);

// Super Admin OTP-Protected User Deletion Routes
router.post('/users/:id/send-delete-otp', protect, authorize('superadmin'), sendDeleteUserOtp);
router.post('/users/:id/verify-delete', protect, authorize('superadmin'), verifyAndDeleteUser);

export default router;

