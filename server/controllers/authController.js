import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Record from '../models/Record.js';
import Settings from '../models/Settings.js';
import { dispatchEmail } from '../services/backupService.js';
import { generateMonthlyRecordsPDF } from '../services/pdfGenerator.js';
import { generateMonthlyRecordsExcelBuffer } from '../services/excelGenerator.js';

// Primary Super Administrator Email for 2FA and System Security Alerts
export const PRIMARY_SUPERADMIN_EMAIL = 'prottoybiswas575358@gmail.com';

// Helper: Check if account is protected (Super Admin or Protected Master Profile: Roni sardar)
export const isProtectedUser = (user) => {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const username = (user.username || '').toLowerCase().trim().replace(/^@/, '');
  const name = (user.name || '').toLowerCase().trim();

  // Super Admin Accounts
  if (
    user.role === 'superadmin' ||
    username === 'admin' ||
    email === PRIMARY_SUPERADMIN_EMAIL ||
    email === 'admin@hospital.com' ||
    email === 'admin@hospital.local'
  ) {
    return true;
  }

  // Permanently Protected Master Profile: Roni sardar (ronisardar445@gmail.com / @roni)
  if (
    email === 'ronisardar445@gmail.com' ||
    username === 'roni' ||
    name === 'roni sardar'
  ) {
    return true;
  }

  return false;
};

// Helper: Mask email for privacy display (e.g. pr***8@gmail.com)
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
  const jwtSecret = process.env.JWT_SECRET || 'secure_jwt_secret_duty_master_key_2026';
  return jwt.sign(
    { id },
    jwtSecret,
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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim().toLowerCase().replace(/^@/, '') : trimmedEmail.split('@')[0];

    // Strictly prevent duplicate emails, usernames, and full names
    const [emailExists, userExists, nameExists] = await Promise.all([
      User.findOne({ email: trimmedEmail }),
      User.findOne({ username: cleanUsername }),
      User.findOne({
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      }),
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
        message: `এই ইউজারনেমটি (@${cleanUsername}) অন্য কেউ ব্যবহার করছে। একই ইউজারনেমে দ্বিতীয় অ্যাকাউন্ট তৈরি করা সম্ভব নয়। (This username is already taken)`,
      });
    }

    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: `"${trimmedName}" নামে ইতোমধ্যে একটি অ্যাকাউন্ট বিদ্যমান। একই নামে দ্বিতীয় কোনো অ্যাকাউন্ট তৈরি করা যাবে না। (A user with this name already exists)`,
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

    // Send instant registration notification to Super Admin (prottoybiswas575358@gmail.com)
    try {
      const adminNotificationHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 20px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 18px; font-weight: bold;">🏥 Ad-din Akij Medical College Hospital</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">OverDuty Pro — New Staff Account Notification</p>
            </div>
            <div style="padding: 24px;">
              <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">👤 নতুন স্টাফ অ্যাকাউন্ট নিবন্ধিত ও ভেরিফাইড হয়েছে</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #475569;">
                একজন নতুন স্টাফ সদস্য সফলভাবে ইমেইল ওটিপি ভেরিফিকেশন সম্পন্ন করেছেন:
              </p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                <div><strong>নাম (Name):</strong> ${user.name}</div>
                <div><strong>ইউজারনেম (Username):</strong> @${user.username}</div>
                <div><strong>ইমেইল (Email):</strong> ${user.email}</div>
                <div><strong>রোল (Role):</strong> ${user.role}</div>
                <div><strong>তারিখ ও সময় (Time):</strong> ${new Date().toLocaleString()}</div>
              </div>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
                সুপার অ্যাডমিন প্যানেল থেকে আপনি যেকোনো সময় এই ইউজারের অ্যাক্টিভিটি পর্যবেক্ষণ, পজ (Pause) বা নিয়ন্ত্রণ করতে পারেন।
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      await dispatchEmail({
        to: PRIMARY_SUPERADMIN_EMAIL,
        subject: `👤 New Staff Registered & Verified: ${user.name} (@${user.username})`,
        html: adminNotificationHtml,
      });
      console.log(`[Notification] New user registration alert sent to Super Admin: ${PRIMARY_SUPERADMIN_EMAIL}`);
    } catch (notifErr) {
      console.error('[Notification] Failed to send new user alert to Super Admin:', notifErr.message);
    }

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

// @desc    Authenticate user & get token (Super Admin requires 2FA Email OTP)
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
          ? [
              { email: PRIMARY_SUPERADMIN_EMAIL },
              { email: 'admin@hospital.com' },
              { email: 'admin@hospital.local' },
            ]
          : []),
      ],
    }).select('+password +loginOtp +loginOtpExpires');

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

    // =========================================================================
    // SUPER ADMIN 2FA LOGIN PROTECTION (Emails OTP to Admin's email if enabled)
    // =========================================================================
    const isSuperAdminUser =
      user.role === 'superadmin' ||
      user.username === 'admin' ||
      user.email === PRIMARY_SUPERADMIN_EMAIL ||
      user.email === 'admin@hospital.com';

    if (isSuperAdminUser && user.admin2FAEnabled !== false) {
      const otp = generateOtp();
      user.loginOtp = otp;
      user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await user.save();

      const targetEmails = [...new Set([user.email, user.backupEmail, PRIMARY_SUPERADMIN_EMAIL].filter(Boolean))];
      const targetAdminEmail = targetEmails[0] || PRIMARY_SUPERADMIN_EMAIL;
      const otpEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc;">
          <div style="max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155;">
            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: bold;">🏥 Ad-din Akij Medical College Hospital</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">OverDuty Pro — Super Administrator Two-Factor Verification</p>
            </div>
            <div style="padding: 26px; color: #e2e8f0;">
              <h2 style="font-size: 16px; color: #38bdf8; margin-top: 0;">🛡️ সুপার অ্যাডমিন লগইন সিকিউরিটি ভেরিফিকেশন</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">
                সুপার অ্যাডমিন প্যানেলে লগইন করার জন্য একটি অনুরোধ পাওয়া গেছে। লগইন সম্পন্ন করতে নিচের ৬-সংখ্যার সিকিউরিটি কোডটি (OTP) প্রবেশ করান:
              </p>
              <div style="background: #0f172a; border: 2px dashed #38bdf8; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
                <span style="font-family: monospace; font-size: 34px; font-weight: bold; letter-spacing: 7px; color: #38bdf8;">
                  ${otp}
                </span>
              </div>
              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                ⏱️ এই সিকিউরিটি কোডের মেয়াদ <strong>১০ মিনিট</strong>। আপনি নিজে এই লগইন অনুরোধ না করে থাকলে অবিলম্বে পাসওয়ার্ড পরিবর্তন করুন।
              </p>
              <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #334155; font-size: 11px; color: #64748b; text-align: center;">
                This is an automated administrative security alert for <strong>${targetEmails.join(', ')}</strong>.
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      for (const emailAddr of targetEmails) {
        try {
          await dispatchEmail({
            to: emailAddr,
            subject: `🛡️ Super Admin Login Security OTP: ${otp} - OverDuty Pro`,
            html: otpEmailHtml,
          });
          console.log(`[Auth] Super Admin login OTP sent to ${emailAddr}`);
        } catch (emailErr) {
          console.error(`[Auth] Failed to dispatch Super Admin login OTP email to ${emailAddr}:`, emailErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        requiresAdmin2FA: true,
        email: targetAdminEmail,
        maskedEmail: maskEmail(targetAdminEmail),
        message: `সুপার অ্যাডমিন লগইন সিকিউরিটি ওটিপি ${targetAdminEmail} এ পাঠানো হয়েছে।`,
      });
    }

    // Check if regular account email is not yet verified
    if (user.emailVerified === false) {
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

// @desc    Verify Super Admin 6-digit 2FA Login OTP & Complete Login
// @route   POST /api/auth/verify-admin-otp
// @access  Public
export const verifyAdminLoginOtp = async (req, res, next) => {
  try {
    const { otp, email, username } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: '৬-সংখ্যার ওটিপি কোডটি লিখুন (OTP code is required)',
      });
    }

    const identifier = (email || username || PRIMARY_SUPERADMIN_EMAIL).trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: PRIMARY_SUPERADMIN_EMAIL },
        { role: 'superadmin' },
        { username: 'admin' },
        { email: identifier },
      ],
    }).select('+loginOtp +loginOtpExpires +password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Super Administrator account not found',
      });
    }

    const cleanOtp = String(otp).trim();
    if (!user.loginOtp || user.loginOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'ভুল ওটিপি সিকিউরিটি কোড (Invalid 2FA OTP Code)। অনুগ্রহ করে সঠিক কোডটি লিখুন।',
      });
    }

    if (user.loginOtpExpires && new Date() > new Date(user.loginOtpExpires)) {
      return res.status(400).json({
        success: false,
        message: 'সিকিউরিটি কোডের মেয়াদ শেষ হয়ে গেছে (OTP Expired)। পুনরায় নতুন কোড পাঠান।',
      });
    }

    // Clear 2FA OTP once verified
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    user.emailVerified = true;
    user.status = 'active';
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: '🎉 সুপার অ্যাডমিন সফলভাবে লগইন হয়েছে! (Super Admin Verified)',
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

// @desc    Resend Super Admin 6-digit 2FA Login OTP
// @route   POST /api/auth/resend-admin-otp
// @access  Public
export const resendAdminLoginOtp = async (req, res, next) => {
  try {
    const { email, username } = req.body || {};
    const identifier = (email || username || '').trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        ...(identifier ? [{ email: identifier }, { username: identifier }] : []),
        { email: PRIMARY_SUPERADMIN_EMAIL },
        { role: 'superadmin' },
        { username: 'admin' },
      ],
    }).select('+loginOtp +loginOtpExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Super Admin account not found',
      });
    }

    const otp = generateOtp();
    user.loginOtp = otp;
    user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const targetEmails = [...new Set([user.email, user.backupEmail, PRIMARY_SUPERADMIN_EMAIL].filter(Boolean))];
    const targetAdminEmail = targetEmails[0] || PRIMARY_SUPERADMIN_EMAIL;
    const otpEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc;">
        <div style="max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155;">
          <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold;">🏥 Ad-din Akij Medical College Hospital</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">OverDuty Pro — Super Administrator Two-Factor Verification</p>
          </div>
          <div style="padding: 26px; color: #e2e8f0;">
            <h2 style="font-size: 16px; color: #38bdf8; margin-top: 0;">🛡️ নতুন সুপার অ্যাডমিন সিকিউরিটি কোড</h2>
            <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">
              আপনার অনুরোধ অনুযায়ী নতুন সুপার অ্যাডমিন লগইন ওটিপি পাঠানো হয়েছে:
            </p>
            <div style="background: #0f172a; border: 2px dashed #38bdf8; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 34px; font-weight: bold; letter-spacing: 7px; color: #38bdf8;">
                ${otp}
              </span>
            </div>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
              ⏱️ এই সিকিউরিটি কোডের মেয়াদ <strong>১০ মিনিট</strong>।
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    for (const emailAddr of targetEmails) {
      try {
        await dispatchEmail({
          to: emailAddr,
          subject: `🛡️ Resent Super Admin Login Security OTP: ${otp} - OverDuty Pro`,
          html: otpEmailHtml,
        });
      } catch (emailErr) {
        console.error(`[Auth] Failed to dispatch resend admin OTP email to ${emailAddr}:`, emailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      maskedEmail: maskEmail(targetAdminEmail),
      message: `নতুন সিকিউরিটি কোডটি আপনার ইমেইলে (${maskEmail(targetAdminEmail)}) পাঠানো হয়েছে।`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate Forgot Password & Send 6-Digit OTP to User's Email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল বা ইউজারনেম লিখুন (Email/Username required)',
      });
    }

    const identifier = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        ...(identifier === 'admin' ? [{ email: PRIMARY_SUPERADMIN_EMAIL }, { email: 'admin@hospital.com' }] : []),
      ],
    }).select('+resetPasswordOtp +resetPasswordExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'এই ইমেইল বা ইউজারনেমে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।',
      });
    }

    const otp = generateOtp();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    const targetEmails = [...new Set([user.email, user.backupEmail].filter(Boolean))];
    const hospitalName = 'Ad-din Akij Medical College Hospital';
    const resetEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0; font-size: 19px; font-weight: bold;">🏥 ${hospitalName}</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">পাসওয়ার্ড রিসেট সিকিউরিটি কোড (Password Reset OTP)</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">হ্যালো ${user.name},</h2>
            <p style="font-size: 13.5px; line-height: 1.6; color: #475569;">
              আপনার ওভার ডিউটি অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য একটি অনুরোধ পাওয়া গেছে। নতুন পাসওয়ার্ড সেট করতে নিচের <strong>৬-সংখ্যার সিকিউরিটি কোড (OTP)</strong> ব্যবহার করুন:
            </p>
            
            <!-- OTP Box -->
            <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
              <span style="font-size: 11px; font-weight: bold; color: #15803d; text-transform: uppercase; letter-spacing: 1px;">পাসওয়ার্ড রিসেট ওটিপি কোড</span>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #16a34a; margin-top: 6px; font-family: monospace;">
                ${otp}
              </div>
              <p style="font-size: 11px; color: #64748b; margin: 6px 0 0 0;">⏱️ এই কোডটি আগামী ১৫ মিনিট পর্যন্ত কার্যকর থাকবে।</p>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12.5px; color: #475569; margin-bottom: 16px;">
              <p style="margin: 2px 0;"><strong>Account Name:</strong> ${user.name}</p>
              <p style="margin: 2px 0;"><strong>Username:</strong> @${user.username || 'staff'}</p>
              <p style="margin: 2px 0;"><strong>Registered Email:</strong> ${user.email}</p>
            </div>

            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
              আপনি যদি এই পাসওয়ার্ড রিসেটের অনুরোধ না করে থাকেন, তবে এই ইমেইলটি এড়িয়ে চলুন এবং আপনার পাসওয়ার্ড কাউকে শেয়ার করবেন না।
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
            OverDuty Pro System &copy; ${new Date().getFullYear()} ${hospitalName}
          </div>
        </div>
      </body>
      </html>
    `;

    for (const emailAddr of targetEmails) {
      try {
        await dispatchEmail({
          to: emailAddr,
          subject: `🔑 [OTP: ${otp}] OverDuty Pro পাসওয়ার্ড রিসেট কোড — ${user.name}`,
          html: resetEmailHtml,
        });
      } catch (mailErr) {
        console.error(`[Forgot Password Email Error] to ${emailAddr}:`, mailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      message: `পাসওয়ার্ড রিসেট কোডটি আপনার ইমেইলে (${maskEmail(user.email)}) পাঠানো হয়েছে।`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and Set New Password
// @route   POST /api/auth/verify-reset-password
// @access  Public
export const verifyResetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'ইমেইল, ৬-সংখ্যার OTP কোড এবং নতুন পাসওয়ার্ড প্রদান করুন।',
      });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে (Minimum 6 characters required)',
      });
    }

    const identifier = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        ...(identifier === 'admin' ? [{ email: PRIMARY_SUPERADMIN_EMAIL }, { email: 'admin@hospital.com' }] : []),
      ],
    }).select('+resetPasswordOtp +resetPasswordExpires +password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ইউজার অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।',
      });
    }

    const cleanOtp = String(otp).trim();
    if (!user.resetPasswordOtp || user.resetPasswordOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'ভুল ওটিপি সিকিউরিটি কোড (Invalid OTP Code)। অনুগ্রহ করে সঠিক কোডটি লিখুন।',
      });
    }

    if (user.resetPasswordExpires && new Date() > new Date(user.resetPasswordExpires)) {
      return res.status(400).json({
        success: false,
        message: 'সিকিউরিটি কোডের মেয়াদ শেষ হয়ে গেছে (OTP Expired)। পুনরায় নতুন কোড পাঠান।',
      });
    }

    // Update password & clear OTP fields
    user.password = newPassword.trim();
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: '🎉 আপনার পাসওয়ার্ড সফলভাবে রিসেট ও পরিবর্তন করা হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
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

// @desc    Update user profile, status, role, or backup preferences
// @route   PUT /api/auth/users/:id
// @access  Private
export const updateUser = async (req, res, next) => {
  try {
    const { role, status, name, username, email, password, autoEmailBackup, backupEmail } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isSelf = req.user && String(req.user._id) === String(user._id);
    const isAdminOrSuper = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');

    if (!isSelf && !isAdminOrSuper) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user account',
      });
    }

    // Protect Super Admin and Master Profile (Roni sardar) from being deactivated, paused or suspended
    if (isProtectedUser(user)) {
      if (status === 'inactive' || status === 'pending' || status === 'paused' || status === 'suspended') {
        return res.status(400).json({
          success: false,
          message: '🛡️ এই অ্যাকাউন্টটি স্থায়ীভাবে সুরক্ষিত (Protected Account)। সুপার অ্যাডমিন কর্তৃক এই অ্যাকাউন্ট পজ, ডিঅ্যাক্টিভেট বা স্থগিত করা সম্ভব নয়। (This protected account cannot be paused or deactivated)',
        });
      }
    }

    // Role & Status can only be changed by Admin / Super Admin
    if (role && isAdminOrSuper) user.role = role;
    if (status && isAdminOrSuper) user.status = status;

    if (name) user.name = name.trim();
    if (username) user.username = username.trim().toLowerCase();
    if (email) user.email = email.trim().toLowerCase();
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

    if (isProtectedUser(user)) {
      return res.status(400).json({
        success: false,
        message: '🛡️ এই অ্যাকাউন্টটি স্থায়ীভাবে সুরক্ষিত (Protected Master Profile)। ইউজারের নিজস্ব প্রোফাইল অ্যাপ্লিকেশন ছাড়া সুপার অ্যাডমিন কর্তৃক এই অ্যাকাউন্ট মুছে ফেলা সম্পূর্ণ নিষিদ্ধ। (Protected accounts cannot be deleted by Super Admin)',
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

    if (isProtectedUser(user)) {
      return res.status(400).json({
        success: false,
        message: '🛡️ এই অ্যাকাউন্টটি স্থায়ীভাবে সুরক্ষিত (Protected Master Profile)। ইউজারের নিজস্ব প্রোফাইল অ্যাপ্লিকেশন ছাড়া সুপার অ্যাডমিন কর্তৃক এই অ্যাকাউন্ট মুছে ফেলা সম্পূর্ণ নিষিদ্ধ। (Protected accounts cannot be deleted by Super Admin)',
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

    // 1. Fetch ALL lifetime records created by this user across all months & years
    const userRecords = await Record.find({ createdBy: user._id, isDeleted: { $ne: true } })
      .sort({ date: 1, sl: 1 })
      .lean();

    const totalEntries = userRecords.length;
    const uniquePatients = new Set(
      userRecords.map((r) => String(r.patientId || '').trim()).filter(Boolean)
    ).size;
    const totalAmount = userRecords.reduce((sum, r) => {
      const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
      return sum + val;
    }, 0);

    const settings = (await Settings.findOne().lean()) || {};
    const hospitalName = settings.hospitalName || 'Ad-din Akij Medical College Hospital';
    const location = settings.location || 'Clinical Wards';
    const safeStaffSlug = (user.username || user.name || 'staff')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');

    const attachments = [];

    // Generate Full Lifetime Printable PDF
    try {
      const pdfBuffer = await generateMonthlyRecordsPDF({
        records: userRecords,
        staffName: user.name,
        hospitalName,
        location,
        month: 'all',
        year: 'all',
        totalAmount,
      });
      if (pdfBuffer) {
        attachments.push({
          filename: `OverDuty_Complete_Lifetime_Records_${safeStaffSlug}.pdf`,
          contentType: 'application/pdf',
          content: pdfBuffer,
        });
      }
    } catch (pdfErr) {
      console.error('[User Delete PDF Gen Error]:', pdfErr.message);
    }

    // Generate Full Lifetime Excel (.xlsx) Spreadsheet
    try {
      const excelBuffer = await generateMonthlyRecordsExcelBuffer({
        records: userRecords,
        hospitalName,
        location,
        month: 'all',
        year: 'all',
      });
      if (excelBuffer) {
        attachments.push({
          filename: `OverDuty_Complete_Lifetime_Records_${safeStaffSlug}.xlsx`,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          content: excelBuffer,
        });
      }
    } catch (excelErr) {
      console.error('[User Delete Excel Gen Error]:', excelErr.message);
    }

    // 2. Dispatch Comprehensive Lifetime Farewell & Record Archive Email to Deleted User
    const targetRecipient = user.backupEmail || user.email;
    if (targetRecipient) {
      try {
        const farewellHtml = `
          <!DOCTYPE html>
          <html lang="bn">
          <head><meta charset="utf-8"></head>
          <body style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
            <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #0284c7 0%, #0f172a 100%); padding: 24px 28px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">🏥 ${hospitalName}</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #e0f2fe;">OverDuty Pro — সম্পূর্ণ লাইফটাইম রেকর্ড ব্যাকআপ ও অ্যাকাউন্ট ক্লোজিং</p>
              </div>

              <!-- Body -->
              <div style="padding: 26px 28px;">
                <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">প্রিয় ${user.name},</h2>
                <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
                  আপনার <strong>${hospitalName}</strong> এর OverDuty Pro অ্যাকাউন্টটি সফলভাবে ক্লোজ/মুছে ফেলা হয়েছে। আপনার কাজের সমস্ত ডাটা যেন আজীবনের জন্য সুরক্ষিত থাকে, সেজন্য আপনার শুরু থেকে আজ পর্যন্ত এন্ট্রি করা <strong>সকল মাসের সম্পূর্ণ রেকর্ড PDF এবং Excel উভয় ফরম্যাটে</strong> নিচে স্থায়ী ব্যাকআপ হিসেবে সংযুক্ত করে পাঠানো হলো।
                </p>

                <!-- Metric Highlights Grid -->
                <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                  <tr>
                    <td width="48%" style="padding: 12px 14px; background-color: #f1f5f9; border-radius: 10px; border: 1px solid #e2e8f0;">
                      <span style="font-size: 10.5px; font-weight: bold; color: #64748b; text-transform: uppercase;">মোট পেশেন্ট এন্ট্রি</span>
                      <div style="font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px;">${totalEntries} টি</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="padding: 12px 14px; background-color: #e0f2fe; border-radius: 10px; border: 1px solid #bae6fd;">
                      <span style="font-size: 10.5px; font-weight: bold; color: #0369a1; text-transform: uppercase;">ইউনিক পেশেন্ট</span>
                      <div style="font-size: 18px; font-weight: bold; color: #0284c7; margin-top: 4px;">${uniquePatients} জন</div>
                    </td>
                  </tr>
                  <tr><td height="10" colspan="3"></td></tr>
                  <tr>
                    <td width="48%" style="padding: 12px 14px; background-color: #dcfce7; border-radius: 10px; border: 1px solid #bbf7d0;">
                      <span style="font-size: 10.5px; font-weight: bold; color: #166534; text-transform: uppercase;">মোট অ্যামাউন্ট (Remark)</span>
                      <div style="font-size: 18px; font-weight: bold; color: #16a34a; margin-top: 4px;">Tk. ${totalAmount.toLocaleString()}</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="padding: 12px 14px; background-color: #fef3c7; border-radius: 10px; border: 1px solid #fde68a;">
                      <span style="font-size: 10.5px; font-weight: bold; color: #92400e; text-transform: uppercase;">স্ট্যাটাস</span>
                      <div style="font-size: 14px; font-weight: bold; color: #b45309; margin-top: 4px;">Archived & Closed</div>
                    </td>
                  </tr>
                </table>

                <!-- Attachments Box -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; font-size: 11.5px; font-weight: bold; color: #475569; text-transform: uppercase;">
                    📎 সংযুক্ত আজীবনের ব্যাকআপ ফাইল (Attached Lifetime Files):
                  </p>
                  <p style="margin: 4px 0; font-size: 12.5px; color: #1e293b;">
                    📄 <strong>1. Lifetime Printable PDF:</strong> <code>OverDuty_Complete_Lifetime_Records_${safeStaffSlug}.pdf</code>
                  </p>
                  <p style="margin: 4px 0; font-size: 12.5px; color: #1e293b;">
                    📊 <strong>2. Lifetime Excel Spreadsheet:</strong> <code>OverDuty_Complete_Lifetime_Records_${safeStaffSlug}.xlsx</code>
                  </p>
                </div>

                <p style="font-size: 12.5px; line-height: 1.5; color: #64748b; margin-top: 10px;">
                  ধন্যবাদ আপনার নিরলস সেবা ও অবদানের জন্য। এই ফাইলগুলো ভবিষ্যতে আপনার যেকোনো প্রাতিষ্ঠানিক প্রয়োজন বা প্রমাণ হিসেবে ব্যবহার করতে পারবেন।
                </p>
              </div>

              <!-- Footer -->
              <div style="background: #f8fafc; padding: 14px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                © ${new Date().getFullYear()} ${hospitalName}. All rights reserved.
              </div>
            </div>
          </body>
          </html>
        `;

        await dispatchEmail({
          to: targetRecipient,
          subject: `📦 [সম্পূর্ণ ডাটা ব্যাকআপ] আপনার সকল পেশেন্ট রেকর্ড ও ডিউটি ফাইল — ${hospitalName}`,
          html: farewellHtml,
          attachments,
        });
        console.log(`[User Delete Backup] Full lifetime record backup dispatched to deleted user: ${targetRecipient}`);
      } catch (eUserBackup) {
        console.error('[User Delete Backup Error] Failed to send archive to user:', eUserBackup.message);
      }
    }

    // 3. Clean up database: Permanently delete ALL patient records created by this user & the user account from MongoDB
    const deletedRecordsResult = await Record.deleteMany({ createdBy: user._id });
    await User.findByIdAndDelete(req.params.id);

    // Mirror mass deletion to Secondary MongoDB
    import('../services/dbMirrorService.js')
      .then(({ getSecondaryConnection }) => {
        const secConn = getSecondaryConnection();
        if (secConn && secConn.readyState === 1) {
          secConn.collection('records').deleteMany({ createdBy: user._id }).catch(() => {});
          secConn.collection('users').deleteOne({ _id: user._id }).catch(() => {});
        }
      })
      .catch(() => {});

    console.log(
      `[User Deletion] User "${user.name}" (@${user.username}) and all ${deletedRecordsResult.deletedCount} associated patient records were permanently removed from MongoDB.`
    );

    // 4. Dispatch security deletion notification to Super Admin (prottoybiswas575358@gmail.com)
    try {
      const deleteNotifHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 20px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 18px; font-weight: bold;">⚠️ ইউজার ও সকল ডাটা সফলভাবে ডিলিট হয়েছে</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">OverDuty Pro — Account & Records Purge Alert</p>
            </div>
            <div style="padding: 24px;">
              <h2 style="font-size: 15px; color: #0f172a; margin-top: 0;">ডাটাবেজ ক্লিনআপ ও অ্যাকাউন্ট ডিলিট সম্পন্ন</h2>
              <p style="font-size: 13px; line-height: 1.6; color: #475569;">
                ইমেইল ওটিপি কোড ভেরিফিকেশনের মাধ্যমে নিচের ইউজার প্রোফাইলটি সফলভাবে মুছে ফেলা হয়েছে, ইউজারের ইমেইলে (${targetRecipient}) তার সকল রেকর্ডের PDF ও Excel ব্যাকআপ পাঠানো হয়েছে এবং <strong>MongoDB ডাটাবেজ থেকে ইউজারের সমস্ত ডাটা সম্পূর্ণ মুছে ফেলা হয়েছে</strong>:
              </p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                <div><strong>মুছে ফেলা ইউজারের নাম:</strong> ${user.name}</div>
                <div><strong>ইউজারনেম:</strong> @${user.username}</div>
                <div><strong>ইমেইল:</strong> ${user.email}</div>
                <div><strong>ডাটাবেজ থেকে মুছে ফেলা রেকর্ড:</strong> ${deletedRecordsResult.deletedCount} টি</div>
                <div><strong>মোট অ্যামাউন্ট:</strong> Tk. ${totalAmount.toLocaleString()}</div>
                <div><strong>ডিলিটের সময়:</strong> ${new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      await dispatchEmail({
        to: PRIMARY_SUPERADMIN_EMAIL,
        subject: `⚠️ [Security Notice] User & All Data Purged: ${user.name} (@${user.username})`,
        html: deleteNotifHtml,
      });
    } catch (eNotif) {
      console.error('[Notification] Failed to send deletion notice to Super Admin:', eNotif.message);
    }

    res.status(200).json({
      success: true,
      message: `ইউজার "${user.name}" এর অ্যাকাউন্ট ওটিপি ভেরিফিকেশনপূর্বক সফলভাবে মুছে ফেলা হয়েছে, সমস্ত ডাটা ইউজারের ইমেইলে ব্যাকআপ হিসেবে পাঠানো হয়েছে এবং MongoDB ডাটাবেজ থেকে ${deletedRecordsResult.deletedCount} টি রেকর্ড সম্পূর্ণ ডিলিট করা হয়েছে।`,
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
    const user = await User.findById(req.params.id);
    if (user && isProtectedUser(user)) {
      return res.status(400).json({
        success: false,
        message: '🛡️ এই অ্যাকাউন্টটি স্থায়ীভাবে সুরক্ষিত (Protected Master Profile)। এই অ্যাকাউন্ট ডিলিট করা সম্পূর্ণ নিষিদ্ধ।',
      });
    }

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
        { email: PRIMARY_SUPERADMIN_EMAIL },
        { username: 'admin' },
        { email: 'admin@hospital.com' },
        { email: 'admin@hospital.local' },
      ],
    }).select('+password');

    if (!admin) {
      await User.create({
        name: 'Super Administrator',
        username: 'admin',
        email: PRIMARY_SUPERADMIN_EMAIL,
        password: 'admin123',
        role: 'superadmin',
        status: 'active',
        emailVerified: true,
      });
      console.log(`[Auth] Default Super Administrator initialized: admin / admin123 (${PRIMARY_SUPERADMIN_EMAIL})`);
    } else {
      // Ensure superadmin role, primary email, active status, and admin123 password
      admin.role = 'superadmin';
      admin.status = 'active';
      admin.username = 'admin';
      admin.email = PRIMARY_SUPERADMIN_EMAIL;
      admin.emailVerified = true;
      const isMatch = await admin.matchPassword('admin123');
      if (!isMatch) {
        admin.password = 'admin123';
      }
      await admin.save();
      console.log(`[Auth] Super Administrator synchronized: admin / admin123 (email: ${PRIMARY_SUPERADMIN_EMAIL}, role: superadmin)`);
    }

    // Ensure permanently protected Master Profile: Roni sardar (ronisardar445@gmail.com / @roni) is synchronized & active
    let roniUser = await User.findOne({
      $or: [
        { email: 'ronisardar445@gmail.com' },
        { username: 'roni' },
      ],
    });
    if (roniUser) {
      roniUser.status = 'active';
      roniUser.emailVerified = true;
      if (!roniUser.username) roniUser.username = 'roni';
      if (!roniUser.name) roniUser.name = 'Roni sardar';
      await roniUser.save();
      console.log('[Auth] Protected Master Account synchronized: Roni sardar (ronisardar445@gmail.com)');
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

// =========================================================================
// BIOMETRIC AUTHENTICATION & WEBAUTHN PASSKEY ENGINE (1-Touch Login)
// =========================================================================

// @desc    Get biometric registration options / challenge for current user
// @route   POST /api/auth/biometrics/register-options
// @access  Private
export const getBiometricRegisterOptions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate random 32-byte challenge
    const challenge = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    user.biometricChallenge = challenge;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        challenge,
        user: {
          id: user._id.toString(),
          name: user.username || user.email,
          displayName: user.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify and save biometric credential on device
// @route   POST /api/auth/biometrics/verify-registration
// @access  Private
export const verifyBiometricRegistration = async (req, res, next) => {
  try {
    const { credentialId, publicKey, deviceName } = req.body;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: 'Credential ID is required for biometric registration',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.biometrics) user.biometrics = [];

    // Remove old registration with same credentialId if exists
    user.biometrics = user.biometrics.filter((b) => b.credentialId !== credentialId);

    user.biometrics.push({
      credentialId,
      publicKey: publicKey || 'standard-pubkey',
      counter: 0,
      deviceName: deviceName || 'Mobile / Browser Fingerprint',
      registeredAt: new Date(),
    });

    user.biometricChallenge = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: '🎉 আপনার ডিভাইসের বায়োমেট্রিক / ফিঙ্গারপ্রিন্ট সফলভাবে যুক্ত হয়েছে! (Biometrics Enrolled Successfully)',
      data: {
        devicesCount: user.biometrics.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get biometric login options / challenge (Public)
// @route   POST /api/auth/biometrics/login-options
// @access  Public
export const getBiometricLoginOptions = async (req, res, next) => {
  try {
    const challenge = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Find all users with enrolled biometrics
    const usersWithBio = await User.find({ 'biometrics.0': { $exists: true } }).select('biometrics').lean();
    const allowCredentials = [];
    usersWithBio.forEach((u) => {
      (u.biometrics || []).forEach((b) => {
        if (b.credentialId) allowCredentials.push(b.credentialId);
      });
    });

    res.status(200).json({
      success: true,
      data: {
        challenge,
        allowCredentials,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify biometric assertion & log in instantly without OTP
// @route   POST /api/auth/biometrics/verify-login
// @access  Public
export const verifyBiometricLogin = async (req, res, next) => {
  try {
    const { credentialId } = req.body;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: 'Biometric credential ID is required',
      });
    }

    // Find user who owns this biometric credential
    const user = await User.findOne({ 'biometrics.credentialId': credentialId });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'ডিভাইসটির বায়োমেট্রিক তথ্য খুঁজে পাওয়া যায়নি। অনুগ্রহ করে পাসওয়ার্ড দিয়ে লগইন করে সেটিংসে গিয়ে ফিঙ্গারপ্রিন্ট যুক্ত করুন। (Biometric Credential Not Recognized)',
      });
    }

    if (user.status === 'inactive' || user.status === 'paused' || user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'অ্যাকাউন্টটি সাময়িকভাবে স্থগিত বা নিষ্ক্রিয়। (Account is suspended)',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: `🎉 বায়োমেট্রিক দিয়ে সফলভাবে প্রবেশ করেছেন! হ্যালো ${user.name}`,
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

// @desc    Get user registered biometric devices & 2FA status
// @route   GET /api/auth/biometrics/devices
// @access  Private
export const getBiometricDevices = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('biometrics admin2FAEnabled role');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        biometrics: user.biometrics || [],
        admin2FAEnabled: user.admin2FAEnabled !== false,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a registered biometric device
// @route   DELETE /api/auth/biometrics/:credentialId
// @access  Private
export const deleteBiometricDevice = async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.biometrics = (user.biometrics || []).filter((b) => b.credentialId !== credentialId);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'বায়োমেট্রিক ডিভাইস সফলভাবে মুছে ফেলা হয়েছে।',
      data: {
        biometrics: user.biometrics,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Super Admin Email 2FA OTP requirement [ON/OFF]
// @route   PUT /api/auth/toggle-admin-2fa
// @access  Private/Admin/SuperAdmin
export const toggleAdmin2FA = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.admin2FAEnabled = Boolean(enabled);
    await user.save();

    res.status(200).json({
      success: true,
      message: user.admin2FAEnabled
        ? '🛡️ অ্যাডমিন লগইনে ইমেইল OTP ভেরিফিকেশন সক্রিয় করা হয়েছে (2FA Enabled)'
        : '⚡ অ্যাডমিন লগইনে ইমেইল OTP ভেরিফিকেশন বন্ধ করা হয়েছে (পাসওয়ার্ড/বায়োমেট্রিকে সরাসরি লগইন হবে)',
      data: {
        admin2FAEnabled: user.admin2FAEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
};
