import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { biometricService } from '../services/biometricService';
import {
  Activity,
  Lock,
  Mail,
  User,
  Loader2,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Crown,
  HelpCircle,
  Eye,
  EyeOff,
  Fingerprint,
  Sparkles,
} from 'lucide-react';

export const LoginPage = () => {
  const {
    login,
    loginWithSession,
    register,
    verifyEmailOtp,
    resendEmailOtp,
    verifyAdminOtp,
    resendAdminOtp,
    forgotPassword,
    verifyResetPassword,
    resendForgotPasswordOtp,
  } = useAuth();
  const toast = useToast();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isAdmin2FAMode, setIsAdmin2FAMode] = useState(false);
  const [isVerificationSuccess, setIsVerificationSuccess] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  // Forgot Password State
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Enter Email, 2 = Enter OTP + New Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [isForgotResending, setIsForgotResending] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Handle Form Submission (Login or Register)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Please enter both username/email and password');
      return;
    }

    if (isRegisterMode && (!formData.name || !formData.username)) {
      toast.error('Please enter your full name, username, email, and password');
      return;
    }

    try {
      setIsLoading(true);
      if (isRegisterMode) {
        const res = await register({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });

        if (res.requiresVerification) {
          toast.success(res.message || 'Verification code sent to your email!');
          setVerificationEmail(formData.email.trim().toLowerCase());
          setMaskedEmail(res.maskedEmail || formData.email);
          setOtpCode('');
          setIsVerifyingOtp(true);
        } else {
          toast.success('Registration successful!');
          setIsRegisterMode(false);
        }
      } else {
        const res = await login(formData.email, formData.password);
        if (res && res.requiresAdmin2FA) {
          toast.success(res.message || 'Super Admin 2FA code sent to your email!');
          setVerificationEmail(res.email || 'prottoybiswas575358@gmail.com');
          setMaskedEmail(res.maskedEmail || 'prottoybiswas575358@gmail.com');
          setOtpCode('');
          setIsAdmin2FAMode(true);
          return;
        }
        toast.success('Welcome back! Logged in successfully.');
      }
    } catch (err) {
      if (
        err.requiresVerification ||
        err.message?.includes('ভেরিফাই') ||
        err.message?.includes('verify') ||
        err.message?.includes('OTP')
      ) {
        toast.warning(err.message || 'অনুগ্রহ করে ইমেইলে পাওয়া ৬-সংখ্যার OTP কোডটি লিখুন।');
        setVerificationEmail(err.email || formData.email.trim().toLowerCase());
        setMaskedEmail(err.maskedEmail || err.email || formData.email);
        setOtpCode('');
        setIsVerifyingOtp(true);
      } else {
        toast.error(err.message || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Super Admin 2FA Verification Submit
  const handleAdmin2FASubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('অনুগ্রহ করে ৬-সংখ্যার সিকিউরিটি OTP কোডটি লিখুন (Enter 6-digit code)');
      return;
    }

    try {
      setIsLoading(true);
      await verifyAdminOtp(otpCode.trim(), verificationEmail);
      setIsVerificationSuccess(true);
      toast.success('👑 সুপার অ্যাডমিন প্যানেলে স্বাগতম! (Super Admin Verified)');
    } catch (err) {
      toast.error(err.message || 'ভুল বা মেয়াদোত্তীর্ণ সিকিউরিটি কোড। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend Super Admin 2FA OTP
  const handleResendAdmin2FA = async () => {
    try {
      setIsResending(true);
      const res = await resendAdminOtp(verificationEmail);
      toast.success(res?.message || 'নতুন সিকিউরিটি কোড পাঠানো হয়েছে!');
    } catch (err) {
      toast.error(err.message || 'কোড পাঠাতে ব্যর্থ হয়েছে।');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Staff Registration OTP Verification Submit
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('অনুগ্রহ করে ৬-সংখ্যার OTP কোডটি লিখুন (Enter 6-digit OTP code)');
      return;
    }

    try {
      setIsLoading(true);
      await verifyEmailOtp(verificationEmail, otpCode.trim());
      setIsVerificationSuccess(true);
      toast.success('🎉 অ্যাকাউন্ট সফলভাবে ভেরিফাই ও সক্রিয় হয়েছে! স্বাগতম!');
    } catch (err) {
      toast.error(err.message || 'ভেরিফিকেশন ব্যর্থ হয়েছে। কোডটি সঠিক কিনা যাচাই করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend Staff OTP
  const handleResendOtp = async () => {
    if (!verificationEmail) return;
    try {
      setIsResending(true);
      const res = await resendEmailOtp(verificationEmail);
      toast.success(res?.message || 'নতুন ভেরিফিকেশন কোড পাঠানো হয়েছে!');
    } catch (err) {
      toast.error(err.message || 'কোড পুনরায় পাঠানো সম্ভব হয়নি।');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Step 1: Request Password Reset OTP
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল বা ইউজারনেম লিখুন');
      return;
    }

    try {
      setIsForgotLoading(true);
      const res = await forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotMaskedEmail(res.maskedEmail || forgotEmail);
      setForgotOtp('');
      setForgotStep(2);
      toast.success(res.message || 'পাসওয়ার্ড রিসেট ওটিপি কোড আপনার ইমেইলে পাঠানো হয়েছে!');
    } catch (err) {
      toast.error(err.message || 'পাসওয়ার্ড রিসেট কোড পাঠাতে ব্যর্থ হয়েছে।');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Handle Step 2: Verify OTP and Set New Password
  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.trim().length < 6) {
      toast.error('অনুগ্রহ করে ইমেইলে পাওয়া ৬-সংখ্যার ওটিপি কোডটি লিখুন');
      return;
    }
    if (!newPassword || newPassword.trim().length < 6) {
      toast.error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Minimum 6 characters required)');
      return;
    }
    if (newPassword.trim() !== confirmNewPassword.trim()) {
      toast.error('নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না (Passwords do not match)');
      return;
    }

    try {
      setIsForgotLoading(true);
      const res = await verifyResetPassword(forgotEmail.trim().toLowerCase(), forgotOtp.trim(), newPassword.trim());
      toast.success(res.message || 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!');
      // Switch back to login mode with prefilled email
      setIsForgotPasswordMode(false);
      setForgotStep(1);
      setFormData((prev) => ({ ...prev, email: forgotEmail, password: '' }));
      setForgotOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      toast.error(err.message || 'পাসওয়ার্ড রিসেট করতে ব্যর্থ হয়েছে। কোডটি পুনরায় যাচাই করুন।');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Handle Resend Forgot Password OTP
  const handleResendForgotOtp = async () => {
    if (!forgotEmail.trim()) return;
    try {
      setIsForgotResending(true);
      const res = await resendForgotPasswordOtp(forgotEmail.trim().toLowerCase());
      toast.success(res?.message || 'নতুন পাসওয়ার্ড রিসেট কোড পাঠানো হয়েছে!');
    } catch (err) {
      toast.error(err.message || 'কোড পুনরায় পাঠানো সম্ভব হয়নি।');
    } finally {
      setIsForgotResending(false);
    }
  };

  // Handle 1-Touch Biometric Login (Mobile Fingerprint / Face ID)
  const handleBiometricLogin = async () => {
    if (!biometricService.isMobileDevice()) {
      toast.info('📱 ফিঙ্গারপ্রিন্ট লগইন শুধুমাত্র মোবাইল ফোনের জন্য প্রযোজ্য। আপনার মোবাইল থেকে লিংকে ঢুকে ফিঙ্গারপ্রিন্ট ব্যবহার করুন।');
      return;
    }
    try {
      setIsBiometricLoading(true);
      const res = await biometricService.loginWithBiometrics();
      if (res.success && res.data) {
        loginWithSession(res.data);
        toast.success(res.message || '🎉 বায়োমেট্রিক দিয়ে সফলভাবে প্রবেশ করেছেন!');
      }
    } catch (err) {
      toast.error(err.message || 'বায়োমেট্রিক যাচাই ব্যর্থ হয়েছে। পাসওয়ার্ড দিয়ে প্রবেশ করুন।');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background aesthetic medical glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Logo & Name */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-xl shadow-brand-500/30 mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            OverDuty Pro
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Ad-din Akij Medical College Hospital — Clinical Records
          </p>
        </div>

        {/* Card Container */}
        <div className="mt-8 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8">
          {/* SUCCESS SCREEN: Verification Success Animation */}
          {isVerificationSuccess ? (
            <div className="space-y-4 py-6 text-center animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-400 shadow-xl shadow-emerald-500/30 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white">🎉 ভেরিফিকেশন সফল হয়েছে!</h3>
              <p className="text-xs text-emerald-300 leading-relaxed">
                আপনার অ্যাকাউন্ট সক্রিয় হয়েছে এবং সিস্টেমে প্রবেশ করা হচ্ছে...
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            </div>
          ) : isAdmin2FAMode ? (
            /* SCREEN 1: Super Admin 2FA Verification Screen */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30 shadow-lg shadow-amber-500/10">
                  <Crown className="w-7 h-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-[11px] font-bold text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" /> Super Admin 2FA Security
                </div>
                <h3 className="text-lg font-bold text-white">সুপার অ্যাডমিন ওটিপি ভেরিফিকেশন</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  অ্যাডমিন প্যানেলে লগইন করতে আপনার অফিসিয়াল ইমেইল <br />
                  <strong className="text-amber-300 font-mono text-sm">{maskedEmail || verificationEmail || 'prottoybiswas575358@gmail.com'}</strong>
                  <br />এ পাঠানো ৬-সংখ্যার সিকিউরিটি ওটিপি কোডটি লিখুন।
                </p>
              </div>

              <form onSubmit={handleAdmin2FASubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>৬-সংখ্যার অ্যাডমিন ওটিপি (6-Digit OTP)</span>
                    <span className="text-[11px] text-amber-400/90 font-normal">⏱️ মেয়াদ ১০ মিনিট</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full text-center tracking-[12px] text-2xl font-mono font-extrabold rounded-xl border border-amber-500/50 bg-slate-900/90 px-3.5 py-3 text-amber-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-600/30 hover:from-amber-500 hover:to-yellow-400 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <KeyRound className="w-4 h-4 text-slate-950" />
                  )}
                  ভেরিফাই ও প্রবেশ করুন (Verify & Access Admin)
                </button>
              </form>

              {/* Resend & Back Buttons */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendAdmin2FA}
                  disabled={isResending}
                  className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  {isResending ? 'Sending...' : 'পুনরায় কোড পাঠান (Resend Code)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAdmin2FAMode(false);
                    setOtpCode('');
                  }}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-300 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  পিছনে যান (Back)
                </button>
              </div>
            </div>
          ) : isVerifyingOtp ? (
            /* SCREEN 2: Staff Registration OTP Verification Screen */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto border border-sky-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">ইমেইল ভেরিফিকেশন (OTP)</h3>
                <p className="text-xs text-slate-300">
                  আপনার ইমেইল <strong className="text-sky-300 font-mono">{maskedEmail || verificationEmail}</strong> এ একটি ৬-সংখ্যার কোড পাঠানো হয়েছে।
                </p>
              </div>

              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>৬-সংখ্যার ওটিপি কোড (OTP Code)</span>
                    <span className="text-[11px] text-slate-400 font-normal">⏱️ মেয়াদ ১৫ মিনিট</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full text-center tracking-[12px] text-2xl font-mono font-extrabold rounded-xl border border-sky-500/50 bg-slate-900/90 px-3.5 py-3 text-sky-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-inner"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-400 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  ভেরিফাই ও প্রবেশ করুন (Verify & Activate)
                </button>
              </form>

              {/* Resend & Back Buttons */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  {isResending ? 'Sending...' : 'পুনরায় কোড পাঠান (Resend Code)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyingOtp(false);
                    setOtpCode('');
                  }}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-300 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  পিছনে যান (Back)
                </button>
              </div>
            </div>
          ) : isForgotPasswordMode ? (
            /* SCREEN 4: Forgot Password Flow with Email OTP Verification */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">পাসওয়ার্ড রিসেট (Forgot Password)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {forgotStep === 1
                    ? 'আপনার অ্যাকাউন্টের নিবন্ধিত ইমেইল বা ইউজারনেম লিখুন। আপনার ইমেইলে একটি ৬-সংখ্যার ওটিপি কোড পাঠানো হবে।'
                    : (
                      <span>
                        ইমেইল <strong className="text-amber-300 font-mono">{forgotMaskedEmail || forgotEmail}</strong> এ পাঠানো ৬-সংখ্যার কোড এবং নতুন পাসওয়ার্ড প্রদান করুন।
                      </span>
                    )}
                </p>
              </div>

              {forgotStep === 1 ? (
                /* Step 1: Input Email / Username */
                <form onSubmit={handleForgotRequestOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      Registered Email or Username
                    </label>
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com or username"
                      className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      autoFocus
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isForgotLoading || !forgotEmail.trim()}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-600/20 hover:from-amber-500 hover:to-amber-400 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isForgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <KeyRound className="w-4 h-4 text-slate-950" />
                    )}
                    পাসওয়ার্ড রিসেট কোড পাঠান (Send Reset Code)
                  </button>
                </form>
              ) : (
                /* Step 2: Input OTP + New Password */
                <form onSubmit={handleForgotResetPassword} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>৬-সংখ্যার সিকিউরিটি কোড (OTP Code)</span>
                      <span className="text-[11px] text-amber-400 font-normal">⏱️ মেয়াদ ১৫ মিনিট</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full text-center tracking-[10px] text-xl font-mono font-extrabold rounded-xl border border-amber-500/50 bg-slate-900/90 px-3 py-2.5 text-amber-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        New Password (নতুন পাসওয়ার্ড)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="মিনিমাম ৬ অক্ষর (Minimum 6 characters)"
                      className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      Confirm New Password (পুনরায় লিখুন)
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="পাসওয়ার্ডটি আবার লিখুন"
                      className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      minLength={6}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isForgotLoading || forgotOtp.length < 6 || newPassword.length < 6}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:from-amber-500 hover:to-emerald-500 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                  >
                    {isForgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    পাসওয়ার্ড পরিবর্তন ও সংরক্ষণ করুন (Save New Password)
                  </button>
                </form>
              )}

              {/* Resend & Back Buttons */}
              <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                {forgotStep === 2 ? (
                  <button
                    type="button"
                    onClick={handleResendForgotOtp}
                    disabled={isForgotResending}
                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isForgotResending ? 'animate-spin' : ''}`} />
                    {isForgotResending ? 'Sending...' : 'পুনরায় কোড পাঠান (Resend Code)'}
                  </button>
                ) : (
                  <div></div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordMode(false);
                    setForgotStep(1);
                    setForgotOtp('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-300 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  লগইন পেজে ফিরুন (Back to Login)
                </button>
              </div>
            </div>
          ) : (
            /* SCREEN 3: Login or Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1-TOUCH BIOMETRIC LOGIN BUTTON (Top Highlight) */}
              {!isRegisterMode && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleBiometricLogin}
                    disabled={isBiometricLoading || isLoading}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-700/30 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-600/40 transition-all active:scale-[0.98] cursor-pointer group border border-emerald-400/30"
                  >
                    {isBiometricLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <Fingerprint className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
                    )}
                    <span>👆 ফিঙ্গারপ্রিন্ট / বায়োমেট্রিকে ১-ক্লিক লগইন</span>
                  </button>

                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700/80"></div>
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase">
                      <span className="bg-slate-800 px-3 text-slate-400 font-semibold tracking-wider">
                        অথবা পাসওয়ার্ড দিয়ে
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Name Field (Only in Register Mode) */}
              {isRegisterMode && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-400" />
                    Full Name (আপনার পূর্ণ নাম)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr. Md. Abdullah"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    required={isRegisterMode}
                  />
                </div>
              )}

              {/* Username Field (Only in Register Mode) */}
              {isRegisterMode && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-400" />
                    Username (ইউজারনেম)
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. abdullah_staff"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    required={isRegisterMode}
                  />
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-400" />
                  {isRegisterMode
                    ? 'Working Staff Email (সচল ইমেইল — ওটিপি পাঠানো হবে)'
                    : 'Username or Staff Email'}
                </label>
                <input
                  type={isRegisterMode ? 'email' : 'text'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={isRegisterMode ? 'e.g. staff@gmail.com' : 'Enter username or email'}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-brand-400" />
                    Password (পাসওয়ার্ড)
                  </label>
                  {!isRegisterMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPasswordMode(true);
                        setForgotStep(1);
                        setForgotEmail(formData.email || '');
                      }}
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
                    >
                      পাসওয়ার্ড ভুলে গেছেন? (Forgot?)
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 hover:from-brand-500 hover:to-sky-400 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {isRegisterMode ? 'রেজিস্ট্রেশন করুন ও কোড পান' : 'Sign In to System'}
              </button>

              {/* Switch Mode Toggle */}
              <div className="mt-4 pt-4 border-t border-slate-700/60 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setFormData({ name: '', username: '', email: '', password: '' });
                  }}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  {isRegisterMode
                    ? 'Already have credentials? Sign in'
                    : 'Need to register a new account? Click here'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
