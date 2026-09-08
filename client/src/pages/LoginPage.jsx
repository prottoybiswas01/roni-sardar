import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
} from 'lucide-react';

export const LoginPage = () => {
  const { login, register, verifyEmailOtp, resendEmailOtp } = useAuth();
  const toast = useToast();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

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
          setIsVerifyingOtp(true);
        } else {
          toast.success('Registration successful!');
          setIsRegisterMode(false);
        }
      } else {
        await login(formData.email, formData.password);
        toast.success('Welcome back! Logged in successfully.');
      }
    } catch (err) {
      // Check if backend returned that email needs verification
      if (err.requiresVerification && err.email) {
        toast.warning(err.message || 'Please verify your email with OTP code');
        setVerificationEmail(err.email);
        setMaskedEmail(err.maskedEmail || err.email);
        setIsVerifyingOtp(true);
      } else {
        toast.error(err.message || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP Verification Submit
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('অনুগ্রহ করে ৬-সংখ্যার OTP কোডটি লিখুন (Enter 6-digit OTP code)');
      return;
    }

    try {
      setIsLoading(true);
      await verifyEmailOtp(verificationEmail, otpCode.trim());
      toast.success('🎉 অ্যাকাউন্ট সফলভাবে ভেরিফাই ও সক্রিয় হয়েছে! স্বাগতম!');
    } catch (err) {
      toast.error(err.message || 'ভেরিফিকেশন ব্যর্থ হয়েছে। কোডটি সঠিক কিনা যাচাই করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP
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
          {/* SCREEN 1: OTP Verification Screen */}
          {isVerifyingOtp ? (
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
          ) : (
            /* SCREEN 2: Login or Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-brand-400" />
                  Password (পাসওয়ার্ড)
                </label>
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
              <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
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

