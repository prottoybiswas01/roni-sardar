import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { backupApi } from '../../services/backupApi';
import { authApi } from '../../services/authApi';
import {
  Share2,
  Mail,
  User,
  Calendar,
  FileType,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Send,
  X,
  ArrowLeft,
  FileCheck,
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

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  
  const [periodType, setPeriodType] = useState('specific'); // 'specific' | 'current' | 'all'
  const [month, setMonth] = useState(initialMonth || globalMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState(initialYear || globalYear || new Date().getFullYear());
  
  const [format, setFormat] = useState('pdf'); // 'pdf' | 'excel' | 'both'
  const [customNote, setCustomNote] = useState('');
  
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

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSending) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Dialog Card (stops backdrop click propagation) */}
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Sticky Header */}
        <div className="shrink-0 bg-slate-800/90 px-5 py-3.5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors flex items-center gap-1 text-xs font-semibold"
              title="পিছনে যান (Back)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">পিছনে যান</span>
            </button>
            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-sky-400" />
                রিপোর্ট শেয়ার করুন (Share Report)
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
            title="বন্ধ করুন (Close)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        {sendSuccess ? (
          <div className="flex-1 overflow-y-auto p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white">ইমেইল সফলভাবে পাঠানো হয়েছে!</h4>
              <p className="text-xs text-slate-300">
                প্রাপক <strong className="text-emerald-400">{sendSuccess.recipient}</strong> ঠিকানায় ফাইলসহ রিপোর্ট পৌঁছে গেছে।
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-300 text-left space-y-1.5">
              <div className="flex justify-between border-b border-slate-700/60 pb-1">
                <span className="text-slate-400">সময়কাল:</span>
                <span className="font-semibold text-white">{sendSuccess.monthLabel}</span>
              </div>
              <div className="flex justify-between border-b border-slate-700/60 pb-1">
                <span className="text-slate-400">ফরম্যাট:</span>
                <span className="font-semibold text-sky-300 uppercase">{sendSuccess.format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">মোট রেকর্ড:</span>
                <span className="font-semibold text-emerald-300">{sendSuccess.totalEntries} টি (Tk. {Number(sendSuccess.totalAmount || 0).toLocaleString()})</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSendSuccess(null);
                  setRecipientEmail('');
                }}
                className="px-4 py-2 text-xs font-semibold text-sky-300 bg-slate-800 hover:bg-slate-700 border border-sky-500/30 rounded-xl transition-all"
              >
                আরেকটি পাঠান
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition-all"
              >
                সম্পন্ন (Done / Close)
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {/* Super Admin Target Staff Selector */}
            {isSuperAdmin && userList.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  কার রেকর্ড শেয়ার করবেন? (Staff Account)
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">👤 আমার নিজস্ব রেকর্ড ({user?.name})</option>
                  <optgroup label="অন্যান্য স্টাফ/ডাক্তার">
                    {userList.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} (@{u.username || u.email})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Recipient Email & Name */}
            <div className="space-y-3">
              <div className="space-y-1">
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  প্রাপকের নাম (Recipient Name - Optional)
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

            {/* Time Period Selector */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                রিপোর্টের সময়কাল (Select Period)
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodType('specific')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    periodType === 'specific'
                      ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 নির্দিষ্ট মাস
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('current')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    periodType === 'current'
                      ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ চলতি মাস
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType('all')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    periodType === 'all'
                      ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🌐 সকল রেকর্ড
                </button>
              </div>

              {periodType === 'specific' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1 animate-in fade-in duration-150">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">মাস</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">সাল</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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

            {/* File Format Selection */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300">
                ফাইল ফরম্যাট (File Format)
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('pdf')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    format === 'pdf'
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500 shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <FileType className="w-3.5 h-3.5 text-rose-400" />
                  <span>PDF (A4 প্রিন্ট)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('excel')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    format === 'excel'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500 shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('both')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    format === 'both'
                      ? 'bg-sky-950/80 border-sky-500 text-sky-300 ring-1 ring-sky-500 shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>উভয় (PDF+Excel)</span>
                </button>
              </div>
            </div>

            {/* Custom Message (Optional) */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>বার্তা / নোট (Message - Optional)</span>
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                placeholder="প্রাপকের উদ্দেশ্যে কোনো বার্তা থাকলে লিখতে পারেন (ঐচ্ছিক)..."
                className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Sticky Action Buttons */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                পিছনে যান / বন্ধ করুন (Back)
              </button>

              <button
                type="submit"
                disabled={isSending || !recipientEmail}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-sky-600/30 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    পাঠানো হচ্ছে...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    মেইলে পাঠিয়ে দিন (Send Email)
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
