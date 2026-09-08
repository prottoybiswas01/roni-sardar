import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { dispatchEmail } from '../services/backupService.js';

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'fallback_secret_hospital_overduty_2026',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// @desc    Register a new user (New users default to pending status awaiting Super Admin approval)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim().toLowerCase() : trimmedEmail.split('@')[0];

    const [emailExists, userExists] = await Promise.all([
      User.findOne({ email: trimmedEmail }),
      User.findOne({ username: cleanUsername }),
    ]);

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
      });
    }

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'This username is already taken. Please choose a different username.',
      });
    }

    // New user registration starts with 'pending' status & auto email backup enabled
    const user = await User.create({
      name: name.trim(),
      username: cleanUsername,
      email: trimmedEmail,
      backupEmail: trimmedEmail,
      autoEmailBackup: true,
      password,
      role: 'staff',
      status: 'pending',
    });

    // Send Registration Confirmation Email to User via Resend
    try {
      const hospitalName = 'Ad-din Akij Medical College Hospital';
      const regHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
          <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 20px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 18px; font-weight: bold;">🏥 ${hospitalName}</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">OverDuty Pro Clinical Records</p>
            </div>
            <div style="padding: 24px;">
              <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">স্বাগতম ${user.name}!</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #475569;">
                আপনার রেজিস্ট্রেশন সফলভাবে সম্পন্ন হয়েছে। আপনার অ্যাকাউন্টটি বর্তমানে <strong>পেন্ডিং (Pending)</strong> অবস্থায় রয়েছে।
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px;">
                <p style="margin: 4px 0;"><strong>Staff Name:</strong> ${user.name}</p>
                <p style="margin: 4px 0;"><strong>Username:</strong> ${user.username}</p>
                <p style="margin: 4px 0;"><strong>Registered Email:</strong> ${user.email}</p>
                <p style="margin: 4px 0;"><strong>Account Status:</strong> <span style="color: #d97706; font-weight: bold;">⏳ Awaiting Admin Approval</span></p>
              </div>
              <p style="font-size: 13px; line-height: 1.6; color: #475569;">
                সুপার এডমিন আপনার অ্যাকাউন্টটি অনুমোদন (Approve) করার সাথে সাথে আপনি স্বয়ংক্রিয়ভাবে আরেকটি ইমেইল পাবেন এবং সিস্টেমে লগইন করতে পারবেন।
              </p>
            </div>
            <div style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              OverDuty Pro System &copy; ${new Date().getFullYear()} ${hospitalName}
            </div>
          </div>
        </body>
        </html>
      `;

      dispatchEmail({
        to: trimmedEmail,
        subject: `🏥 Registration Received — OverDuty Pro (${user.name})`,
        html: regHtml,
      }).catch((e) => console.error('[Auth Email] Failed to send registration email:', e.message));
    } catch (mailErr) {
      console.error('[Auth Email Error]:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Account registered successfully! A confirmation email has been sent. Your account is pending Super Admin approval.',
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        backupEmail: user.backupEmail,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username/email and password',
      });
    }

    // Support username 'admin', email addresses, and legacy admin logins
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        ...(identifier === 'admin'
          ? [{ email: 'admin@hospital.com' }, { email: 'admin@hospital.local' }]
          : []),
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password credentials',
      });
    }

    // Check if account is still pending Super Admin approval
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending Super Admin approval. Please contact the administrator to activate your account.',
      });
    }

    // Check if account is deactivated
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact the Super Administrator.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password credentials',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        backupEmail: user.backupEmail,
        autoEmailBackup: user.autoEmailBackup,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users (Super Admin & Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin/SuperAdmin
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status or role (Super Admin & Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin/SuperAdmin
export const updateUser = async (req, res, next) => {
  try {
    const { role, status, name, password } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Protect primary super admin from losing superadmin role or being deactivated
    if (user.username === 'admin' || user.email === 'admin@hospital.com') {
      if (status === 'inactive' || status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'The main Super Administrator account cannot be deactivated',
        });
      }
    }

    const wasPending = user.status !== 'active';
    if (role) user.role = role;
    if (status) user.status = status;
    if (name) user.name = name;
    if (password && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();

    // If user was newly approved/activated, send beautiful notification email via Resend
    if (status === 'active' && wasPending) {
      try {
        const hospitalName = 'Ad-din Akij Medical College Hospital';
        const approvedHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
            <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
              <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 20px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0; font-size: 18px; font-weight: bold;">🏥 ${hospitalName}</h1>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Account Approved ✅</p>
              </div>
              <div style="padding: 24px;">
                <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">অভিনন্দন ${user.name}!</h2>
                <p style="font-size: 13px; line-height: 1.6; color: #475569;">
                  আপনার ওভার ডিউটি অ্যাকাউন্টটি সুপার এডমিন কর্তৃক <strong>অনুমোদিত (Approved)</strong> হয়েছে। আপনি এখন আপনার অ্যাকাউন্ট ব্যবহার করে সিস্টেমে প্রবেশ করতে পারবেন।
                </p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px;">
                  <p style="margin: 4px 0;"><strong>Staff Name:</strong> ${user.name}</p>
                  <p style="margin: 4px 0;"><strong>Username:</strong> ${user.username}</p>
                  <p style="margin: 4px 0;"><strong>Email Address:</strong> ${user.email}</p>
                  <p style="margin: 4px 0;"><strong>Account Role:</strong> ${user.role.toUpperCase()}</p>
                  <p style="margin: 4px 0;"><strong>Account Status:</strong> <span style="color: #059669; font-weight: bold;">Active ✅</span></p>
                </div>
                <div style="text-align: center; margin: 24px 0 10px;">
                  <a href="https://roni.kodl.uk" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: bold; font-size: 13px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">সিস্টেমে লগইন করুন (Login Now)</a>
                </div>
              </div>
              <div style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                OverDuty Pro System &copy; ${new Date().getFullYear()} ${hospitalName}
              </div>
            </div>
          </body>
          </html>
        `;

        dispatchEmail({
          to: user.email,
          subject: `✅ Account Approved — Welcome to OverDuty Pro (${user.name})`,
          html: approvedHtml,
        }).catch((e) => console.error('[Auth Approval Email Error]:', e.message));
      } catch (mailErr) {
        console.error('[Auth Approval Email Error]:', mailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's backup email
// @route   PUT /api/auth/backup-email
// @access  Private
export const updateMyBackupEmail = async (req, res, next) => {
  try {
    const { backupEmail } = req.body;
    if (!backupEmail) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.backupEmail = backupEmail.trim().toLowerCase();
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Backup email saved successfully',
      data: { backupEmail: user.backupEmail },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account (Super Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/SuperAdmin
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.username === 'admin' || user.email === 'admin@hospital.com' || user.role === 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Super Administrator accounts cannot be deleted',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed or update default Super Administrator: admin / admin123
// @route   POST /api/auth/seed-admin
// @access  Public
export const seedInitialAdmin = async () => {
  try {
    let admin = await User.findOne({
      $or: [
        { username: 'admin' },
        { email: 'admin@hospital.com' },
        { email: 'admin@hospital.local' },
      ],
    }).select('+password');

    if (!admin) {
      await User.create({
        name: 'Super Administrator',
        username: 'admin',
        email: 'admin@hospital.com',
        password: 'admin123',
        role: 'superadmin',
        status: 'active',
      });
      console.log('[Auth] Default Super Administrator initialized: admin / admin123 (superadmin)');
    } else {
      // Ensure superadmin role, active status, and admin123 password
      admin.role = 'superadmin';
      admin.status = 'active';
      admin.username = 'admin';
      const isMatch = await admin.matchPassword('admin123');
      if (!isMatch) {
        admin.password = 'admin123';
      }
      await admin.save();
      console.log('[Auth] Super Administrator synchronized: admin / admin123 (role: superadmin, status: active)');
    }

    // Ensure system settings exist and default to Resend provider
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({
        emailProvider: 'resend',
        senderEmail: 'backup@roni.kodl.uk',
        senderName: 'OverDuty Hospital Backup',
        resendApiKey: process.env.RESEND_API_KEY || '',
      });
      await settings.save();
      console.log('[Settings] Default hospital settings initialized.');
    } else if (process.env.RESEND_API_KEY && !settings.resendApiKey) {
      settings.resendApiKey = process.env.RESEND_API_KEY;
      settings.emailProvider = 'resend';
      await settings.save();
      console.log('[Settings] Resend API key synchronized.');
    }
  } catch (err) {
    console.error('[Auth] Error checking initial admin seed:', err.message);
  }
};
