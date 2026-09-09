import express from 'express';
import {
  register,
  verifyEmailOtp,
  resendEmailOtp,
  login,
  verifyAdminLoginOtp,
  resendAdminLoginOtp,
  forgotPassword,
  verifyResetPassword,
  getMe,
  getUsers,
  updateUser,
  deleteUser,
  sendDeleteUserOtp,
  verifyAndDeleteUser,
  updateMyBackupEmail,
  getBiometricRegisterOptions,
  verifyBiometricRegistration,
  getBiometricLoginOptions,
  verifyBiometricLogin,
  getBiometricDevices,
  deleteBiometricDevice,
  toggleAdmin2FA,
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public Authentication & OTP Verification Routes
router.post('/register', register);
router.post('/verify-email-otp', verifyEmailOtp);
router.post('/resend-email-otp', resendEmailOtp);
router.post('/login', login);
router.post('/verify-admin-otp', verifyAdminLoginOtp);
router.post('/resend-admin-otp', resendAdminLoginOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-password', verifyResetPassword);
router.post('/resend-forgot-password-otp', forgotPassword);

// Public Biometric 1-Touch Login Routes
router.post('/biometrics/login-options', getBiometricLoginOptions);
router.post('/biometrics/verify-login', verifyBiometricLogin);

// Private User Routes
router.get('/me', protect, getMe);
router.put('/backup-email', protect, updateMyBackupEmail);

// Private Biometric Device Registration & Management Routes
router.post('/biometrics/register-options', protect, getBiometricRegisterOptions);
router.post('/biometrics/verify-registration', protect, verifyBiometricRegistration);
router.get('/biometrics/devices', protect, getBiometricDevices);
router.delete('/biometrics/:credentialId', protect, deleteBiometricDevice);
router.put('/toggle-admin-2fa', protect, authorize('admin', 'superadmin'), toggleAdmin2FA);

// Super Admin / Admin User Management Routes
router.get('/users', protect, authorize('admin', 'superadmin'), getUsers);
router.put('/users/:id', protect, authorize('admin', 'superadmin'), updateUser);
router.delete('/users/:id', protect, authorize('superadmin'), deleteUser);

// Super Admin OTP-Protected User Deletion Routes
router.post('/users/:id/send-delete-otp', protect, authorize('superadmin'), sendDeleteUserOtp);
router.post('/users/:id/verify-delete', protect, authorize('superadmin'), verifyAndDeleteUser);

export default router;

