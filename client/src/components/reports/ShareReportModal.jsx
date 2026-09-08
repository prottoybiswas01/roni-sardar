import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { backupApi } from '../../services/backupApi';
import { authApi } from '../../services/authApi';
import {
  Share2,
  Mail,
  Printer,
  User,
  Building2,
  Calendar,
  FileType,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Send,
  X,
  FileCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

const MONTH_NAMES = [
  'January (জানুয়ারি)',
  'February (ফেব্রুয়ারি)',
  'March (মার্চ)',
  'April (এপ্রিল)',
  'May (মে)',
  'June (জুন)',
  'July (জুলাই)',
  'August (আগস্ট)',
  'September (সেপ্টেম্বর)',
  'October (অক্টোবর)',
  'November (নভেম্বর)',
  'December (ডিসেম্বর)',
];

export const ShareReportModal = ({
  isOpen,
  onClose,
  initialMonth = null,
  initialYear = null,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { settings, selectedMonth: globalMonth, selectedYear: globalYear } = useSettings();
  const toast = useToast();

  const [recipientType, setRecipientType] = useState('shop'); // 'shop' | 'boss' | 'custom'
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  
  const [periodType, setPeriodType] = useState('specific'); // 'specific' | 'current' | 'all'
  const [month, setMonth] = useState(initialMonth || globalMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState(initialYear || globalYear || new Date().getFullYear());
  
  const [format, setFormat] = useState('pdf'); // 'pdf' | 'excel' | 'both'
  const [customNote, setCustomNote] = useState('দয়া করে এই রিপোর্টটি এফোর (A4) সাইজের কাগজে পরিষ্কারভাবে প্রিন্ট করে দিন।');
  
  const [targetUserId, setTargetUserId] = useState('');
  const [userList, setUserList] = useState([]);
  
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(null);

  // Sync initial months when modal opens
  useEffect(() => {
    if (isOpen) {
      setMonth(initialMonth || globalMonth || new Date().getMonth() + 1);
      setYear(initialYear || globalYear || new Date().getFullYear());
      setSendSuccess(null);
    }
  }, [isOpen, initialMonth, initialYear, globalMonth, globalYear]);

  // Fetch user list for SuperAdmin
  useEffect(() => {
    if (isOpen && isSuperAdmin) {
      authApi.getUsers().then((res) => {
        if (res.success && res.data) {
          setUserList(res.data);
        }
      }).catch((err) => console.error('Error fetching users:', err));
    }
  }, [isOpen, isSuperAdmin]);

  // Quick Preset Handlers
  const handlePresetSelect = (type) => {
    setRecipientType(type);
    if (type === 'shop') {
      setRecipientName('কম্পিউটার দোকানদার / প্রিন্টার অপারেটর');
      setFormat('pdf');
      setCustomNote('দয়া করে এই ওভার ডিউটি রিপোর্টটি এফোর (A4) সাইজের কাগজে প্রিন্ট করে দিন।');
    } else if (type === 'boss') {
      setRecipientName('সম্মানিত বিভাগীয় প্রধান / সুপার / প্রশাসন');
      setFormat('both');
      setCustomNote('সম্মানিত স্যার, আমার মাসিক ওভার ডিউটি ও রোগীর রেকর্ড ফাইলটি পর্যালোচনা ও স্বাক্ষরের জন্য পাঠানো হলো।');
    } else {
      setRecipientName('');
      setCustomNote('');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!recipientEmail || !recipientEmail.trim()) {
      toast.error('অনুগ্রহ করে প্রাপকের সঠিক ইমেইল অ্যাড্রেস লিখুন।');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      toast.error('অনুগ্রহ করে একটি সঠিক ও বৈধ ইমেইল অ্যাড্রেস প্রদান করুন।');
      return;
    }

    try {
      setIsSending(true);
      setSendSuccess(null);

      const payload = {
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        month: periodType === 'all' ? 'all' : (periodType === 'current' ? (new Date().getMonth() + 1) : month),
        year: periodType === 'all' ? 'all' : (periodType === 'current' ? (new Date().getFullYear()) : year),
        format,
        customNote: customNote.trim(),
        targetUserId: isSuperAdmin && targetUserId ? targetUserId : null,
      };

      const res = await backupApi.shareReport(payload);

      if (res.success) {
        setSendSuccess(res.data);
        toast.success(res.message || 'রিপোর্টটি সফলভাবে ইমেইলে পাঠানো হয়েছে!');
      } else {
        toast.error(res.message || 'ইমেইল পাঠাতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error('Share report error:', err);
      toast.error(err.message || 'ইমেইল সার্ভারে সংযোগ ব্যর্থ হয়েছে।');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const currentYearNum = new Date().getFullYear();
  const yearOptions = [currentYearNum + 1, currentYearNum, currentYearNum - 1, currentYearNum - 2, currentYearNum - 3];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-inner">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                রিপোর্ট শেয়ার ও প্রিন্ট মেইল (Share via Email)
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  <Sparkles className="w-2.5 h-2.5" /> Instant Delivery
                </span>
              </h3>
              <p className="text-xs text-sky-200/80">
                লগইন ছাড়াই দোকানের প্রিন্টারে বা বসের মেইলে সরাসরি PDF/Excel পাঠিয়ে দিন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {sendSuccess ? (
          <div className="p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xl font-bold text-white">ইমেইল সফলভাবে পাঠানো হয়েছে!</h4>
              <p className="text-sm text-slate-300">
                প্রাপক <strong className="text-emerald-400">{sendSuccess.recipient}</strong> ঠিকানায় সংযুক্ত ফাইলসহ রিপোর্ট পৌঁছে গেছে।
              </p>
            </div>

            <div className="max-w-md mx-auto bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 text-left space-y-2">
              <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                <span className="text-slate-400">রিপোর্টের সময়কাল:</span>
                <span className="font-semibold text-white">{sendSuccess.monthLabel}</span>
              </div>
              <div className="flex justify-between border-b border-slate-700/60 pb-1.5">
                <span className="text-slate-400">ফরম্যাট ও এটাচমেন্ট:</span>
                <span className="font-semibold text-sky-300 uppercase">{sendSuccess.format} ({sendSuccess.attachmentsCount} Files)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">মোট পেশেন্ট রেকর্ড:</span>
                <span className="font-semibold text-emerald-300">{sendSuccess.totalEntries} টি রেকর্ড (Tk. {Number(sendSuccess.totalAmount || 0).toLocaleString()})</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSendSuccess(null);
                  setRecipientEmail('');
                }}
                className="px-4 py-2.5 text-xs font-semibold text-sky-300 bg-slate-800 hover:bg-slate-700 border border-sky-500/30 rounded-xl transition-all"
              >
                আরেকটি ইমেইল পাঠান (Send Another)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition-all"
              >
                সম্পন্ন (Done)
              </button>
            </div>
          </div>
        ) : (
          /* Main Input Form */
          <form onSubmit={handleSend} className="p-6 space-y-5">
            
            {/* Super Admin Staff Target Selector */}
            {isSuperAdmin && userList.length > 0 && (
              <div className="bg-slate-800/60 border border-indigo-500/30 rounded-xl p-3 space-y-1">
                <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  কার রেকর্ড শেয়ার করবেন? (Select Staff Record - Admin Only)
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">👤 আমার নিজস্ব রেকর্ড (My Own Records - {user?.name})</option>
                  <optgroup label="হাসপাতালের অন্যান্য স্টাফ/ডাক্তার">
                    {userList.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} (@{u.username || u.email})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                কাকে পাঠাতে চান? (Quick Category Select)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('shop')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    recipientType === 'shop'
                      ? 'bg-sky-950/70 border-sky-500 text-sky-300 shadow-md ring-1 ring-sky-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Printer className="w-4 h-4 mb-1 text-sky-400" />
                  <span>🏪 প্রিন্ট দোকান</span>
                  <span className="text-[10px] text-slate-400 font-normal">A4 PDF কপি</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('boss')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    recipientType === 'boss'
                      ? 'bg-indigo-950/70 border-indigo-500 text-indigo-300 shadow-md ring-1 ring-indigo-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-4 h-4 mb-1 text-indigo-400" />
                  <span>👨‍⚕️ বস / প্রশাসন</span>
                  <span className="text-[10px] text-slate-400 font-normal">PDF + Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('custom')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    recipientType === 'custom'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-4 h-4 mb-1 text-emerald-400" />
                  <span>✉️ কাস্টম ইমেইল</span>
                  <span className="text-[10px] text-slate-400 font-normal">যে কোনো ব্যক্তি</span>
                </button>
              </div>
            </div>

            {/* Recipient Email & Name Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  প্রাপকের ইমেইল এড্রেস (Recipient Email) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. shop@gmail.com বা boss@hospital.com"
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  প্রাপকের নাম / পরিচয় (Recipient Name - Optional)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. রূপালী কম্পিউটার / Dr. Kabir Sir"
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Report Time Period Selection */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                কোন সময়কালের রিপোর্ট পাঠাবেন? (Select Period)
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodType('specific')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    periodType === 'specific'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 নির্দিষ্ট মাস ও বছর
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('current')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    periodType === 'current'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ চলতি মাস (Current)
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('all')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    periodType === 'all'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🌐 সকল রেকর্ড (All-Time)
                </button>
              </div>

              {periodType === 'specific' && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">মাস (Month)</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">সাল (Year)</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Format Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>ফাইল ফরম্যাট নির্বাচন করুন (File Format)</span>
                <span className="text-[11px] text-slate-400 font-normal">📎 সরাসরি ইমেইলে সংযুক্ত হবে</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('pdf')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    format === 'pdf'
                      ? 'bg-rose-950/70 border-rose-500 text-rose-300 ring-1 ring-rose-500 shadow-md'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <FileType className="w-4 h-4 text-rose-400" />
                  <span>PDF (A4 প্রিন্ট)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('excel')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    format === 'excel'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500 shadow-md'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('both')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    format === 'both'
                      ? 'bg-sky-950/70 border-sky-500 text-sky-300 ring-1 ring-sky-500 shadow-md'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <FileCheck className="w-4 h-4 text-sky-400" />
                  <span>উভয় (PDF + Excel)</span>
                </button>
              </div>
            </div>

            {/* Custom Note Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>প্রেরকের বিশেষ বার্তা / প্রিন্ট নোট (Custom Note)</span>
                <span className="text-[11px] text-slate-400 font-normal">দোকানদার/বসের পড়ার জন্য</span>
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                placeholder="দোকানদারের উদ্দেশ্যে বা বসের উদ্দেশ্যে কোনো বিশেষ বার্তা থাকলে লিখুন..."
                className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                বাতিল (Cancel)
              </button>

              <button
                type="submit"
                disabled={isSending || !recipientEmail}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-sky-600/30 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ইমেইলে পাঠানো হচ্ছে...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    মেইলে পাঠিয়ে দিন (Send to Email)
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
