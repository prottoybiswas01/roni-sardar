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
} from 'lucide-react';

export const LoginPage = () => {
  const { login, register } = useAuth();
  const toast = useToast();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Please enter both username/email and password');
      return;
    }

    if (isRegisterMode && !formData.name) {
      toast.error('Please enter your full name');
      return;
    }

    try {
      setIsLoading(true);
      if (isRegisterMode) {
        await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        toast.success('Registration successful. Welcome to OverDuty Pro!');
      } else {
        await login(formData.email, formData.password);
        toast.success('Welcome back! Logged in successfully.');
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
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
            Hospital Patient & Over Duty Administrative System
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field (Only in Register Mode) */}
            {isRegisterMode && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand-400" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dr. / Staff Member Name"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  required={isRegisterMode}
                />
              </div>
            )}

            {/* Username / Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-400" />
                Username or Staff Email
              </label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter username or email"
                className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-brand-400" />
                Password
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
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 hover:from-brand-500 hover:to-sky-400 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {isRegisterMode ? 'Create Account' : 'Sign In to System'}
            </button>
          </form>

          {/* Switch Mode Toggle */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setFormData({ name: '', email: '', password: '' });
              }}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              {isRegisterMode
                ? 'Already have credentials? Sign in'
                : 'Need to register a new account? Click here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
