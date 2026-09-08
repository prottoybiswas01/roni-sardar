import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { dispatchEmail } from '../services/backupService.js';

// Helper: Mask email for privacy display (e.g. ro***@gmail.com)
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user.substring(0, 2)}***${user.substring(user.length - 1)}@${domain}`;
};

// Helper: Generate 6-digit OTP string
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

// @desc    Register a new user & dispatch 6-digit Email Verification OTP
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

    // Strictly prevent duplicate emails and usernames
    const [emailExists, userExists] = await Promise.all([
      User.findOne({ email: trimmedEmail }),
      User.findOne({ username: cleanUsername }),
    ]);

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'এই ইমেইল দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট তৈরি করা আছে। অনুগ্রহ করে অন্য ইমেইল ব্যবহার করুন অথবা লগইন করুন। (A user with this email address already exists)',
      });
    }

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'এই ইউজারনেমটি অন্য কেউ ব্যবহার করছে। অনুগ্রহ করে অন্য ইউজারনেম নির্বাচন করুন। (This username is already taken)',
      });
    }

    // Generate 6-digit verification OTP (Valid for 15 minutes)
    const verificationOtp = generateOtp();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // New user starts in pending status until OTP verification confirms real working email
    const user = await User.create({
      name: name.trim(),
      username: cleanUsername,
      email: trimmedEmail,
      backupEmail: trimmedEmail,
      autoEmailBackup: true,
      password,
      role: 'staff',
      status: 'pending',
      emailVerified: false,
      emailVerificationOtp: verificationOtp,
      emailVerificationExpires: otpExpiry,
    });

    // Send 6-digit OTP Verification Email to User via Resend / SMTP
    try {
      const hospitalName = 'Ad-din Akij Medical College Hospital';
      const otpEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 19px; font-weight: bold;">🏥 ${hospitalName}</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">OverDuty Pro Clinical Records — Email Verification</p>
            </div>
            <div style="padding: 24px;">
              <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">হ্যালো ${user.name},</h2>
              <p style="font-size: 13.5px; line-height: 1.6; color: #475569;">
                আপনার ওভার ডিউটি অ্যাকাউন্টটি সক্রিয় করতে এবং ইমেইল ঠিকানাটি নিশ্চিত করতে নিচের <strong>৬-সংখ্যার ভেরিফিকেশন কোড (OTP)</strong> ব্যবহার করুন:
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
                <span style="font-size: 11px; font-weight: bold; color: #0369a1; text-transform: uppercase; letter-spacing: 1px;">আপনার ভেরিফিকেশন কোড (OTP)</span>
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; margin-top: 6px; font-family: monospace;">
                  ${verificationOtp}
                </div>
                <p style="font-size: 11px; color: #64748b; margin: 6px 0 0 0;">⏱️ এই কোডটি আগামী ১৫ মিনিট পর্যন্ত কার্যকর থাকবে।</p>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12.5px; color: #475569; margin-bottom: 16px;">
                <p style="margin: 2px 0;"><strong>Staff Name:</strong> ${user.name}</p>
                <p style="margin: 2px 0;"><strong>Username:</strong> ${user.username}</p>
                <p style="margin: 2px 0;"><strong>Email Address:</strong> ${user.email}</p>
              </div>

              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                আপনি যদি এই রেজিস্ট্রেশন না করে থাকেন, তবে এই ইমেইলটি উপেক্ষা করতে পারেন।
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
        subject: `🔐 [OTP: ${verificationOtp}] OverDuty Pro ইমেইল ভেরিফিকেশন কোড — ${user.name}`,
        html: otpEmailHtml,
      }).catch((e) => console.error('[Auth Email] Failed to send registration OTP email:', e.message));
    } catch (mailErr) {
      console.error('[Auth Email Error]:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      requiresVerification: true,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      message: `আপনার ইমেইলে (${maskEmail(user.email)}) একটি ৬-সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে। কোডটি বসিয়ে অ্যাকাউন্ট সক্রিয় করুন।`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify 6-digit Email OTP & Automatically Activate Account
// @route   POST /api/auth/verify-email-otp
// @access  Public
export const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP code are required',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const user = await User.findOne({ email: trimmedEmail })
      .select('+emailVerificationOtp +emailVerificationExpires +password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    // Check if OTP matches and is within 15 minutes
    if (!user.emailVerificationOtp || user.emailVerificationOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'ভুল ভেরিফিকেশন কোড (Invalid OTP Code)। অনুগ্রহ করে সঠিক কোডটি লিখুন।',
      });
    }

    if (user.emailVerificationExpires && new Date() > new Date(user.emailVerificationExpires)) {
      return res.status(400).json({
        success: false,
        message: 'ভেরিফিকেশন কোডের মেয়াদ শেষ হয়ে গেছে (OTP Expired)। পুনরায় নতুন কোড পাঠান।',
      });
    }

    // OTP verified successfully: Activate account immediately!
    user.emailVerified = true;
    user.status = 'active';
    user.emailVerificationOtp = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: '🎉 ইমেইল সফলভাবে ভেরিফাই ও অ্যাকাউন্ট সক্রিয় হয়েছে! (Account Verified & Activated)',
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        backupEmail: user.backupEmail,
        role: user.role,
        status: user.status,
        autoEmailBackup: user.autoEmailBackup,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend 6-digit Email Verification OTP
// @route   POST /api/auth/resend-email-otp
// @access  Public
export const resendEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to resend verification code',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account registered with this email address',
      });
    }

    if (user.emailVerified && user.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'এই ইমেইলটি ইতোমধ্যে ভেরিফাই ও সক্রিয় করা আছে। অনুগ্রহ করে সরাসরি লগইন করুন।',
      });
    }

    const newOtp = generateOtp();
    user.emailVerificationOtp = newOtp;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const hospitalName = 'Ad-din Akij Medical College Hospital';
    const otpEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0; font-size: 19px; font-weight: bold;">🏥 ${hospitalName}</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">নতুন ভেরিফিকেশন কোড (Resent OTP)</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">হ্যালো ${user.name},</h2>
            <p style="font-size: 13.5px; line-height: 1.6; color: #475569;">
              আপনার অনুরোধ অনুযায়ী নতুন <strong>৬-সংখ্যার ভেরিফিকেশন কোড (OTP)</strong> নিচে দেওয়া হলো:
            </p>
            
            <div style="background-color: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
              <span style="font-size: 11px; font-weight: bold; color: #0369a1; text-transform: uppercase; letter-spacing: 1px;">নতুন ভেরিফিকেশন কোড (OTP)</span>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; margin-top: 6px; font-family: monospace;">
                ${newOtp}
              </div>
              <p style="font-size: 11px; color: #64748b; margin: 6px 0 0 0;">⏱️ এই কোডটি আগামী ১৫ মিনিট কার্যকর থাকবে।</p>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
            OverDuty Pro System &copy; ${new Date().getFullYear()} ${hospitalName}
          </div>
        </div>
      </body>
      </html>
    `;

    await dispatchEmail({
      to: trimmedEmail,
      subject: `🔐 [নতুন কোড: ${newOtp}] OverDuty Pro ইমেইল ভেরিফিকেশন`,
      html: otpEmailHtml,
    });

    res.status(200).json({
      success: true,
      maskedEmail: maskEmail(user.email),
      message: `নতুন ভেরিফিকেশন কোডটি আপনার ইমেইলে (${maskEmail(user.email)}) পাঠানো হয়েছে।`,
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
        message: 'ভুল ইউজারনেম/ইমেইল অথবা পাসওয়ার্ড (Invalid credentials)',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'ভুল পাসওয়ার্ড (Invalid password)',
      });
    }

    // Check if account email is not yet verified
    if (user.emailVerified === false && user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        maskedEmail: maskEmail(user.email),
        message: 'আপনার ইমেইলটি এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ইমেইলে পাওয়া OTP কোড দিয়ে ভেরিফাই করুন।',
      });
    }

    // Check if account is deactivated
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'অ্যাকাউন্টটি নিষ্ক্রিয় করা আছে। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন। (Account is deactivated)',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
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

// @desc    Update user status, role, or backup preferences (Super Admin & Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin/SuperAdmin
export const updateUser = async (req, res, next) => {
  try {
    const { role, status, name, password, autoEmailBackup, backupEmail } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Protect primary super admin from losing superadmin role or being deactivated
    if (user.username === 'admin' || user.email === 'admin@hospital.com' || user.role === 'superadmin') {
      if (status === 'inactive' || status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'The main Super Administrator account cannot be deactivated',
        });
      }
    }

    if (role) user.role = role;
    if (status) user.status = status;
    if (name) user.name = name;
    if (autoEmailBackup !== undefined) user.autoEmailBackup = Boolean(autoEmailBackup);
    if (backupEmail !== undefined) user.backupEmail = backupEmail ? backupEmail.trim().toLowerCase() : '';
    if (password && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();

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
        autoEmailBackup: user.autoEmailBackup,
        backupEmail: user.backupEmail,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send OTP to User's Email for Super Admin Profile Deletion Verification
// @route   POST /api/auth/users/:id/send-delete-otp
// @access  Private/SuperAdmin
export const sendDeleteUserOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    if (user.username === 'admin' || user.email === 'admin@hospital.com' || user.role === 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Super Administrator accounts cannot be deleted',
      });
    }

    const deleteOtp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.deleteOtp = deleteOtp;
    user.deleteOtpExpires = otpExpiry;
    await user.save();

    const targetRecipient = user.backupEmail || user.email;
    const hospitalName = 'Ad-din Akij Medical College Hospital';

    const deleteEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background-color: #fef2f2; margin: 0; padding: 20px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #fecaca;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 22px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0; font-size: 19px; font-weight: bold;">⚠️ সিকিউরিটি অ্যালার্ট: প্রোফাইল মুছে ফেলার অনুরোধ</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">${hospitalName} — OverDuty Security</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">হ্যালো ${user.name},</h2>
            <p style="font-size: 13.5px; line-height: 1.6; color: #475569;">
              সুপার অ্যাডমিন কর্তৃক আপনার ইউজার প্রোফাইল ও অ্যাকাউন্টটি মুছে ফেলার (Delete Profile) জন্য একটি অনুরোধ করা হয়েছে।
            </p>
            <p style="font-size: 13px; color: #b91c1c; font-weight: bold;">
              যদি আপনি এই ডিলিশন অনুমোদন করতে চান, তবে নিচের ৬-সংখ্যার সিকিউরিটি কোডটি (OTP) প্রদান করুন:
            </p>

            <div style="background-color: #fef2f2; border: 2px dashed #ef4444; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
              <span style="font-size: 11px; font-weight: bold; color: #b91c1c; text-transform: uppercase; letter-spacing: 1px;">প্রোফাইল ডিলিট সিকিউরিটি কোড</span>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #dc2626; margin-top: 6px; font-family: monospace;">
                ${deleteOtp}
              </div>
              <p style="font-size: 11px; color: #64748b; margin: 6px 0 0 0;">⏱️ এই কোডটি আগামী ১০ মিনিট কার্যকর থাকবে।</p>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              ⚠️ <strong>সতর্কতা:</strong> আপনি যদি এই ডিলিট অনুরোধ অনুমোদন না করেন, তবে এই কোডটি কাউকেই দেবেন না। কোড ছাড়া অ্যাকাউন্ট মুছে ফেলা অসম্ভব।
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
            OverDuty Pro System &copy; ${new Date().getFullYear()} ${hospitalName}
          </div>
        </div>
      </body>
      </html>
    `;

    await dispatchEmail({
      to: targetRecipient,
      subject: `🚨 [সিকিউরিটি কোড: ${deleteOtp}] অ্যাকাউন্ট ডিলিট ভেরিফিকেশন — ${user.name}`,
      html: deleteEmailHtml,
    });

    res.status(200).json({
      success: true,
      maskedEmail: maskEmail(targetRecipient),
      message: `ইউজার "${user.name}" এর ইমেইলে (${maskEmail(targetRecipient)}) ৬-সংখ্যার সিকিউরিটি ওটিপি কোড পাঠানো হয়েছে।`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and Permanently Delete User Account (Super Admin only)
// @route   POST /api/auth/users/:id/verify-delete
// @access  Private/SuperAdmin
export const verifyAndDeleteUser = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.params.id).select('+deleteOtp +deleteOtpExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    if (user.username === 'admin' || user.email === 'admin@hospital.com' || user.role === 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Super Administrator accounts cannot be deleted',
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'ইউজারের ইমেইলে পাঠানো ৬-সংখ্যার সিকিউরিটি OTP কোডটি প্রদান করুন।',
      });
    }

    const cleanOtp = String(otp).trim();

    if (!user.deleteOtp || user.deleteOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'ভুল সিকিউরিটি কোড (Invalid OTP Code)। ইউজারের প্রোফাইল মুছে ফেলা সম্ভব হয়নি।',
      });
    }

    if (user.deleteOtpExpires && new Date() > new Date(user.deleteOtpExpires)) {
      return res.status(400).json({
        success: false,
        message: 'সিকিউরিটি কোডের মেয়াদ শেষ হয়ে গেছে (OTP Expired)। পুনরায় কোড পাঠান।',
      });
    }

    // Delete user from database
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `ইউজার "${user.name}" এর অ্যাকাউন্ট ওটিপি ভেরিফিকেশনপূর্বক সফলভাবে মুছে ফেলা হয়েছে।`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Direct Delete user account without OTP fallback for superadmin if needed or backward compatibility
// @route   DELETE /api/auth/users/:id
// @access  Private/SuperAdmin
export const deleteUser = async (req, res, next) => {
  try {
    return res.status(400).json({
      success: false,
      message: 'সিকিউরিটি সুরক্ষার জন্য ইউজারের ইমেইলে OTP পাঠিয়ে ভেরিফাই করে ডিলিট সম্পন্ন করুন। (Please use OTP verification to delete users)',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's backup email and auto backup toggle
// @route   PUT /api/auth/backup-email
// @access  Private
export const updateMyBackupEmail = async (req, res, next) => {
  try {
    const { backupEmail, autoEmailBackup } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (backupEmail !== undefined && backupEmail.trim()) {
      user.backupEmail = backupEmail.trim().toLowerCase();
    }
    if (autoEmailBackup !== undefined) {
      user.autoEmailBackup = Boolean(autoEmailBackup);
    }

    await user.save();
    res.status(200).json({
      success: true,
      message: 'Backup preferences updated successfully',
      data: {
        backupEmail: user.backupEmail,
        autoEmailBackup: user.autoEmailBackup,
      },
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
        emailVerified: true,
      });
      console.log('[Auth] Default Super Administrator initialized: admin / admin123 (superadmin)');
    } else {
      // Ensure superadmin role, active status, and admin123 password
      admin.role = 'superadmin';
      admin.status = 'active';
      admin.username = 'admin';
      admin.emailVerified = true;
      const isMatch = await admin.matchPassword('admin123');
      if (!isMatch) {
        admin.password = 'admin123';
      }
      await admin.save();
      console.log('[Auth] Super Administrator synchronized: admin / admin123 (role: superadmin, status: active, emailVerified: true)');
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
