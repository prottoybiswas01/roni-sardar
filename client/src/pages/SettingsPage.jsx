import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/authApi';
import { recordsApi } from '../services/recordsApi';
import { backupApi } from '../services/backupApi';
import { exportMonthlyReportToExcel } from '../services/excelService';
import { exportMonthlyReportToPDF } from '../services/pdfService';
import { Modal } from '../components/common/Modal';
import { formatDateDotShort, formatHospitalTime, MONTHS, getAvailableYears } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';
import {
  Settings,
  Building2,
  MapPin,
  FileText,
  ShieldCheck,
  Save,
  Users,
  Shield,
  CheckCircle2,
  UserX,
  UserCheck,
  Loader2,
  Trash2,
  Clock,
  Crown,
  AlertCircle,
  Eye,
  Calendar,
  FileSpreadsheet,
  FileType,
  Activity,
  User as UserIcon,
  Database,
  Download,
  Upload,
  Mail,
  KeyRound,
  RefreshCw,
  FileJson,
  Server,
  Send,
  HelpCircle,
  Check,
  Lock,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';

export const SettingsPage = ({ initialTab = 'general' }) => {
  const toast = useToast();
  const { settings, updateSettings, isLoadingSettings, selectedMonth, selectedYear } = useSettings();
  const { isAdmin, isSuperAdmin, user: currentUser, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // General settings state
  const [formData, setFormData] = useState({
    hospitalName: '',
    location: '',
    reportTitle: '',
    checkDuplicates: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // User management state (Admin / Super Admin only)
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Password Reset Modal state
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // User Delete with Email OTP Security state
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deleteOtpValue, setDeleteOtpValue] = useState('');
  const [deleteMaskedEmail, setDeleteMaskedEmail] = useState('');
  const [isSendingDeleteOtp, setIsSendingDeleteOtp] = useState(false);
  const [isVerifyingDelete, setIsVerifyingDelete] = useState(false);

  // Ultra-Simple Email Backup state
  const [userBackupEmail, setUserBackupEmail] = useState('');
  const [userAutoBackupEnabled, setUserAutoBackupEnabled] = useState(true);
  const [isUpdatingToggle, setIsUpdatingToggle] = useState(false);
  const [isEmailLocked, setIsEmailLocked] = useState(false);
  const [backupMonth, setBackupMonth] = useState(selectedMonth || new Date().getMonth() + 1);
  const [backupYear, setBackupYear] = useState(selectedYear || new Date().getFullYear());
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSendingEmailNow, setIsSendingEmailNow] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const emailVal = currentUser.backupEmail || currentUser.email || '';
      setUserBackupEmail(emailVal);
      setUserAutoBackupEnabled(currentUser.autoEmailBackup !== false);
      if (currentUser.backupEmail) {
        setIsEmailLocked(true);
      }
    }
  }, [currentUser]);

  // User Email Backup Handlers
  const handleToggleAutoEmailBackup = async (nextValue) => {
    try {
      setIsUpdatingToggle(true);
      setUserAutoBackupEnabled(nextValue);
      await authApi.updateBackupEmail({
        backupEmail: userBackupEmail.trim(),
        autoEmailBackup: nextValue,
      });
      await refreshUser?.();
      if (nextValue) {
        toast.success('অটোমেটিক ইমেইল ব্যাকআপ চালু করা হয়েছে (রাত ১২টায় মেইল যাবে) ✅');
      } else {
        toast.info('অটোমেটিক ইমেইল ব্যাকআপ বন্ধ করা হয়েছে (রাত ১২টায় আর মেইল যাবে না) ⛔');
      }
    } catch (err) {
      setUserAutoBackupEnabled(!nextValue);
      toast.error('Failed to update setting: ' + err.message);
    } finally {
      setIsUpdatingToggle(false);
    }
  };

  const handleSaveUserBackupEmail = async (e) => {
    e?.preventDefault?.();
    if (!userBackupEmail || !userBackupEmail.includes('@')) {
      toast.warning('Please enter a valid email address');
      return;
    }
    try {
      setIsSavingEmail(true);
      const res = await authApi.updateBackupEmail({
        backupEmail: userBackupEmail.trim(),
        autoEmailBackup: userAutoBackupEnabled,
      });
      toast.success(res.message || 'Backup email address saved successfully!');
      await refreshUser?.();
      if (!isSuperAdmin) {
        setIsEmailLocked(true);
      }
    } catch (err) {
      toast.error('Failed to save email: ' + err.message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSendExcelNow = async () => {
    const targetEmail = userBackupEmail.trim() || currentUser?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      toast.warning('Please save a valid email address first');
      return;
    }
    try {
      setIsSendingEmailNow(true);
      const res = await backupApi.triggerEmailBackup({
        customRecipient: targetEmail,
        forSelfOnly: true,
        month: backupMonth === 'all' ? null : Number(backupMonth),
        year: Number(backupYear),
      });
      toast.success(res.message || `Excel report sent successfully to ${targetEmail}!`);
    } catch (err) {
      toast.error('Failed to send email: ' + err.message);
    } finally {
      setIsSendingEmailNow(false);
    }
  };

  // Inspect User Profile & Records Modal state
  const [inspectingUser, setInspectingUser] = useState(null);
  const [inspectMonth, setInspectMonth] = useState(selectedMonth || new Date().getMonth() + 1);
  const [inspectYear, setInspectYear] = useState(selectedYear || new Date().getFullYear());
  const [inspectRecords, setInspectRecords] = useState([]);
  const [inspectStats, setInspectStats] = useState(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [isExportingUserExcel, setIsExportingUserExcel] = useState(false);
  const [isExportingUserPdf, setIsExportingUserPdf] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        hospitalName: settings.hospitalName || '',
        location: settings.location || '',
        reportTitle: settings.reportTitle || '',
        checkDuplicates: settings.checkDuplicates ?? true,
      });
    }
  }, [settings]);

  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      fetchUsers();
    }
  }, [isAdmin, activeTab]);

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await authApi.getUsers();
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      toast.error('Failed to load user list: ' + err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch inspected user's records & stats
  const fetchInspectedUserData = useCallback(async (userId, month, year) => {
    if (!userId) return;
    try {
      setIsInspectLoading(true);
      const [recordsRes, statsRes] = await Promise.all([
        recordsApi.getRecords({
          userId,
          month,
          year,
          limit: 500,
        }),
        recordsApi.getDashboardStats({
          userId,
          month,
          year,
        }),
      ]);

      if (recordsRes.success && recordsRes.data) {
        setInspectRecords(recordsRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setInspectStats(statsRes.data);
      }
    } catch (err) {
      toast.error('Failed to load staff records: ' + err.message);
    } finally {
      setIsInspectLoading(false);
    }
  }, []);

  const handleOpenInspectModal = (user) => {
    setInspectingUser(user);
    setInspectMonth(selectedMonth || new Date().getMonth() + 1);
    setInspectYear(selectedYear || new Date().getFullYear());
    fetchInspectedUserData(user._id, selectedMonth || new Date().getMonth() + 1, selectedYear || new Date().getFullYear());
  };

  const handleExportInspectedExcel = async () => {
    if (!inspectingUser) return;
    try {
      setIsExportingUserExcel(true);
      await exportMonthlyReportToExcel({
        records: inspectRecords,
        month: inspectMonth,
        year: inspectYear,
        hospitalName: settings?.hospitalName || 'Hospital Over Duty',
        location: `${settings?.location || 'General'} — Staff: ${inspectingUser?.name}`,
        totalAmount: inspectStats?.monthlyTotalRemark || 0,
      });
      toast.success(`Excel spreadsheet exported for ${inspectingUser?.name}`);
    } catch (err) {
      toast.error('Excel export failed: ' + err.message);
    } finally {
      setIsExportingUserExcel(false);
    }
  };

  const handleExportInspectedPdf = async () => {
    if (!inspectingUser) return;
    try {
      setIsExportingUserPdf(true);
      await exportMonthlyReportToPDF({
        records: inspectRecords,
        month: inspectMonth,
        year: inspectYear,
        hospitalName: settings?.hospitalName || 'Hospital Over Duty',
        location: `${settings?.location || 'General'} — Staff: ${inspectingUser?.name}`,
        reportTitle: `${settings?.reportTitle || 'CLINICAL OVER DUTY'} (${inspectingUser?.name})`,
        totalAmount: inspectStats?.monthlyTotalRemark || 0,
      });
      toast.success(`PDF document exported for ${inspectingUser?.name}`);
    } catch (err) {
      toast.error('PDF export failed: ' + err.message);
    } finally {
      setIsExportingUserPdf(false);
    }
  };

  const handleToggleUserAutoBackup = async (userId, currentAutoBackup, userName) => {
    const nextValue = !currentAutoBackup;
    try {
      setActionLoadingId(userId);
      await authApi.updateUser(userId, { autoEmailBackup: nextValue });
      toast.success(`"${userName}" এর জন্য অটো ব্যাকআপ ${nextValue ? 'চালু (ON)' : 'বন্ধ (OFF)'} করা হয়েছে`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update auto backup setting: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordResetUser || !newPasswordValue.trim()) return;
    if (newPasswordValue.trim().length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }

    try {
      setIsResettingPassword(true);
      await authApi.updateUser(passwordResetUser._id, { password: newPasswordValue.trim() });
      toast.success(`Password for "${passwordResetUser.name}" has been reset successfully!`);
      setPasswordResetUser(null);
      setNewPasswordValue('');
    } catch (err) {
      toast.error('Password reset failed: ' + err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      await updateSettings(formData);
      toast.success('Hospital settings updated successfully');
    } catch (err) {
      toast.error('Failed to update settings: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      setActionLoadingId(userId);
      await authApi.updateUser(userId, { role: newRole });
      toast.success(`User role updated to ${newRole.toUpperCase()}`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user role: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveUser = async (userId, userName) => {
    try {
      setActionLoadingId(userId);
      await authApi.updateUser(userId, { status: 'active', role: 'staff' });
      toast.success(`Account for "${userName}" has been Approved & Activated!`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to approve account: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePauseUser = async (userId, userName) => {
    try {
      setActionLoadingId(userId);
      await authApi.updateUser(userId, { status: 'paused' });
      toast.warning(`"${userName}" এর অ্যাকাউন্ট সাময়িকভাবে স্থগিত (Paused) করা হয়েছে। ডাটা এন্ট্রি বন্ধ থাকবে।`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to pause user account: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResumeUser = async (userId, userName) => {
    try {
      setActionLoadingId(userId);
      await authApi.updateUser(userId, { status: 'active' });
      toast.success(`"${userName}" এর অ্যাকাউন্ট পুনরায় সক্রিয় (Active) করা হয়েছে!`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to resume user account: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      setActionLoadingId(userId);
      await authApi.updateUser(userId, { status: nextStatus });
      toast.success(`User account ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Super Admin: Initiate User Profile Deletion (Sends 6-digit OTP to target user's email)
  const handleInitiateDeleteUser = async (userObj) => {
    setDeleteTargetUser(userObj);
    setDeleteOtpValue('');
    try {
      setIsSendingDeleteOtp(true);
      const res = await authApi.sendDeleteUserOtp(userObj._id);
      setDeleteMaskedEmail(res.maskedEmail || userObj.email);
      toast.success(res.message || `Security OTP sent to ${userObj.name}'s email`);
    } catch (err) {
      toast.error('ইমেইলে OTP পাঠাতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  // Super Admin: Resend Deletion OTP
  const handleResendDeleteOtp = async () => {
    if (!deleteTargetUser) return;
    try {
      setIsSendingDeleteOtp(true);
      const res = await authApi.sendDeleteUserOtp(deleteTargetUser._id);
      setDeleteMaskedEmail(res.maskedEmail || deleteTargetUser.email);
      toast.success(res.message || 'নতুন সিকিউরিটি কোড পাঠানো হয়েছে!');
    } catch (err) {
      toast.error('কোড পাঠাতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  // Super Admin: Verify OTP & Permanently Delete User Profile
  const handleConfirmDeleteUserWithOtp = async (e) => {
    e.preventDefault();
    if (!deleteTargetUser || !deleteOtpValue.trim()) {
      toast.error('ইউজারের ইমেইলে পাওয়া ৬-সংখ্যার সিকিউরিটি কোডটি লিখুন।');
      return;
    }

    try {
      setIsVerifyingDelete(true);
      const res = await authApi.verifyAndDeleteUser(deleteTargetUser._id, deleteOtpValue.trim());
      toast.success(res.message || `User "${deleteTargetUser.name}" has been deleted.`);
      setDeleteTargetUser(null);
      setDeleteOtpValue('');
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'ভুল বা মেয়াদোত্তীর্ণ সিকিউরিটি কোড। ডিলিট বাতিল করা হলো।');
    } finally {
      setIsVerifyingDelete(false);
    }
  };

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-brand-600" />
          Hospital Administration & Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure hospital metadata, duplicate rules, and manage staff account approvals
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs sm:text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'general'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          General Hospital Info
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'backup'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Database Backup & Recovery
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'users'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            User & Staff Management
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle p-6 sm:p-8">
          <form onSubmit={handleGeneralSubmit} className="space-y-5 max-w-2xl">
            {/* Hospital Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-600" />
                Hospital Official Name
              </label>
              <input
                type="text"
                value={formData.hospitalName}
                onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                placeholder="e.g. Ad-din Akij Medical College Hospital"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium"
                required
              />
              <p className="text-[11px] text-slate-400">
                Printed on header of all Excel and PDF monthly reports.
              </p>
            </div>

            {/* Hospital Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-600" />
                Hospital Location / Ward Area
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Boyra, Khulna"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium"
                required
              />
              <p className="text-[11px] text-slate-400">
                Displayed directly beneath the hospital title in all official documents.
              </p>
            </div>

            {/* Report Subtitle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-600" />
                Report Document Title
              </label>
              <input
                type="text"
                value={formData.reportTitle}
                onChange={(e) => setFormData({ ...formData, reportTitle: e.target.value })}
                placeholder="e.g. OVER DUTY / PATIENT REPORT"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium uppercase"
                required
              />
            </div>

            {/* Duplicate Check Toggle */}
            <div className="pt-3 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.checkDuplicates}
                  onChange={(e) => setFormData({ ...formData, checkDuplicates: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    Enable Real-time Duplicate Patient Warnings
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Shows an intelligent warning if a patient ID already has an entry on the same date.
                  </p>
                </div>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingSettings || isLoadingSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: User Management (Super Admin / Admin Only) */}
      {isAdmin && activeTab === 'users' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-subtle flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Accounts</p>
                <h4 className="text-xl font-bold text-slate-900 mt-0.5">{users.length}</h4>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-subtle flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 font-medium">Pending Approvals</p>
                <h4 className="text-xl font-bold text-amber-600 mt-0.5">{pendingCount}</h4>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-subtle flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 font-medium">Active Staff / Admins</p>
                <h4 className="text-xl font-bold text-emerald-600 mt-0.5">{activeCount}</h4>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* User Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Super Admin Staff Control & Approval Hub
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review new registrations, approve access, assign roles, or deactivate accounts
                </p>
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                <p className="text-xs">Loading accounts...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No registered users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="py-3 px-4">Name & Username</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role Assignment</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4 text-center">Auto Backup (12 AM)</th>
                      <th className="py-3 px-4 text-right">Super Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isMainAdmin = u.username === 'admin' || u.email === 'admin@hospital.com' || u.role === 'superadmin';
                      const isLoading = actionLoadingId === u._id;

                      return (
                        <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Name & Badge */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              {u.name}
                              {isMainAdmin && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                  <Crown className="w-2.5 h-2.5 text-amber-600" /> Super Admin
                                </span>
                              )}
                            </div>
                            {u.username && (
                              <p className="text-[11px] text-slate-400 font-normal">@{u.username}</p>
                            )}
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{u.email}</td>

                          {/* Role Selector */}
                          <td className="py-3.5 px-4">
                            {isMainAdmin ? (
                              <span className="text-xs font-bold text-slate-700 capitalize">Super Admin</span>
                            ) : (
                              <select
                                value={u.role}
                                disabled={isLoading}
                                onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                                className="py-1 px-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 capitalize focus-ring"
                              >
                                <option value="staff">Staff Member</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Administrator</option>
                              </select>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            {u.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Approval
                              </span>
                            ) : u.status === 'paused' || u.status === 'suspended' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <PauseCircle className="w-3 h-3 text-amber-700" /> Paused (স্থগিত)
                              </span>
                            ) : u.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active (সক্রিয়)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <UserX className="w-3 h-3 text-rose-600" /> Deactivated (নিষ্ক্রিয়)
                              </span>
                            )}
                          </td>

                          {/* Auto Backup Toggle (Super Admin Control) */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleToggleUserAutoBackup(u._id, u.autoEmailBackup !== false, u.name)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-subtle active:scale-95 ${
                                u.autoEmailBackup !== false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                              }`}
                              title="Click to toggle 12:00 AM auto email backup on/off"
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  u.autoEmailBackup !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              {u.autoEmailBackup !== false ? 'ON (রাত ১২টা)' : 'OFF (বন্ধ)'}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Staff Profile & Records */}
                              <button
                                type="button"
                                onClick={() => handleOpenUserProfile(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold shadow-subtle transition-all active:scale-95"
                                title="View this staff member's profile and over duty patient records"
                              >
                                <Eye className="w-3.5 h-3.5 text-sky-600" />
                                Profile
                              </button>

                              {/* Reset Password Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordResetUser(u);
                                  setNewPasswordValue('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold shadow-subtle transition-all active:scale-95"
                                title="Set a new password for this user"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                                Pass
                              </button>

                              {/* One-click Approve & Activate button for Pending Users */}
                              {u.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={isLoading || actionLoadingId === u._id}
                                  onClick={() => handleApproveUser(u._id, u.name)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                                  title="Approve registration and activate account"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                              )}

                              {/* Pause / Resume Button for Super Admin */}
                              {!isMainAdmin && u.status === 'active' && (
                                <button
                                  type="button"
                                  disabled={isLoading || actionLoadingId === u._id}
                                  onClick={() => handlePauseUser(u._id, u.name)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold shadow-subtle transition-all active:scale-95"
                                  title="Pause account (temporarily stop data entry)"
                                >
                                  <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                                  Pause
                                </button>
                              )}

                              {!isMainAdmin && (u.status === 'paused' || u.status === 'suspended') && (
                                <button
                                  type="button"
                                  disabled={isLoading || actionLoadingId === u._id}
                                  onClick={() => handleResumeUser(u._id, u.name)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold shadow-subtle transition-all active:scale-95"
                                  title="Resume account (enable data entry)"
                                >
                                  <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  Resume
                                </button>
                              )}

                              {/* Toggle Activate / Deactivate */}
                              {!isMainAdmin && u.status !== 'pending' && (
                                <button
                                  type="button"
                                  disabled={isLoading || actionLoadingId === u._id}
                                  onClick={() => handleToggleUserStatus(u._id, u.status)}
                                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                    u.status === 'active' || u.status === 'paused'
                                      ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                                      : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                                  }`}
                                  title={u.status === 'active' || u.status === 'paused' ? 'Deactivate account' : 'Activate account'}
                                >
                                  {u.status === 'active' || u.status === 'paused' ? 'Deactivate' : 'Activate'}
                                </button>
                              )}

                              {/* Delete Action (Super Admin with Email OTP Verification) */}
                              {!isMainAdmin && isSuperAdmin && (
                                <button
                                  type="button"
                                  disabled={isLoading || isSendingDeleteOtp}
                                  onClick={() => handleInitiateDeleteUser(u)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                                  title="Delete user profile (Protected by Email OTP)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Automated Email Backup */}
      {activeTab === 'backup' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-brand-50/60 via-white to-sky-50/60">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20 shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Automated Excel Email Backup
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure your email backup settings and midnight automated schedule
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* ON/OFF Midnight Email Delivery Toggle Card */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  userAutoBackupEnabled
                    ? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className={`w-4 h-4 ${userAutoBackupEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                        Daily Midnight Auto Backup (রাত ১২টার ব্যাকআপ)
                      </h4>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          userAutoBackupEnabled
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${userAutoBackupEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {userAutoBackupEnabled ? 'সক্রিয় (Active)' : 'বন্ধ (Disabled)'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {userAutoBackupEnabled ? (
                        <span>
                          প্রতিদিন <strong>রাত ১২:০০ টায় (00:00)</strong> আপনার সম্পূর্ণ ওভার ডিউটি এক্সেল রিপোর্ট স্বয়ংক্রিয়ভাবে আপনার ইমেইলে পাঠিয়ে দেওয়া হবে।
                        </span>
                      ) : (
                        <span>
                          স্বয়ংক্রিয় ব্যাকআপ সার্ভিস বর্তমানে <strong>বন্ধ (OFF)</strong> রাখা হয়েছে। রাত ১২টায় আপনার ঠিকানায় কোনো ইমেইল যাবে না।
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Switch Toggle Button */}
                  <button
                    type="button"
                    disabled={isUpdatingToggle}
                    onClick={() => handleToggleAutoEmailBackup(!userAutoBackupEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-opacity-75 disabled:opacity-50 ${
                      userAutoBackupEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                    title={userAutoBackupEnabled ? 'Click to turn OFF auto backup' : 'Click to turn ON auto backup'}
                  >
                    <span className="sr-only">Toggle Automated Midnight Backup</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        userAutoBackupEnabled ? 'translate-x-7' : 'translate-x-0'
                      } flex items-center justify-center`}
                    >
                      {isUpdatingToggle ? (
                        <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                      ) : userAutoBackupEnabled ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Lock className="w-3 h-3 text-slate-400" />
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Email Address Section */}
              <form onSubmit={handleSaveUserBackupEmail} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    Backup Email Address
                    {isEmailLocked && !isSuperAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Lock className="w-3 h-3 text-slate-500" /> Locked
                      </span>
                    )}
                  </label>

                  {isSuperAdmin && isEmailLocked && (
                    <button
                      type="button"
                      onClick={() => setIsEmailLocked(false)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                    >
                      Admin: Edit Email
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      disabled={isEmailLocked && !isSuperAdmin}
                      value={userBackupEmail}
                      onChange={(e) => setUserBackupEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white placeholder-slate-400 focus-ring disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 transition-all"
                    />
                  </div>

                  {(!isEmailLocked || isSuperAdmin) && (
                    <button
                      type="submit"
                      disabled={isSavingEmail}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSavingEmail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Email
                    </button>
                  )}
                </div>

                {isEmailLocked && !isSuperAdmin ? (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" /> Your email is saved & locked. Contact Super Admin if you need to update it.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Enter the email address where your clinical records and over-duty Excel files should be sent.
                  </p>
                )}
              </form>

              <hr className="border-slate-100" />

              {/* Month & Year Selector + Send Now */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Manual Instant Dispatch (তাৎক্ষণিক রিপোর্ট পাঠান)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">Month</label>
                    <select
                      value={backupMonth}
                      onChange={(e) => setBackupMonth(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus-ring transition-all"
                    >
                      <option value="all">📁 All Months (Entire Year)</option>
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">Year</label>
                    <select
                      value={backupYear}
                      onChange={(e) => setBackupYear(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-white focus-ring transition-all"
                    >
                      {getAvailableYears().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSendingEmailNow || !userBackupEmail}
                  onClick={handleSendExcelNow}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-sky-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSendingEmailNow ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Dispatching PDF & Excel Statement to Email...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <FileType className="w-4 h-4" />
                      Send Monthly Report (PDF + Excel) to My Email
                    </>
                  )}
                </button>
              </div>

              {/* Monthly Closing Schedule Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">
                    🏆 Automated Monthly Closing Service (স্বয়ংক্রিয় মাসিক ক্লোজিং রিপোর্ট)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    প্রতি মাসের শেষ তারিখ (যেমন ২৮/৩০/৩১ তারিখ) রাত ১২টার পর (পরের মাসের ১ তারিখে 00:00), বিগত পুরো মাসের <strong>মোট রোগীর সংখ্যা, মোট টাকা (Remark), ইউনিক রোগী ও গড় আয়ের সম্পূর্ণ হিসাব বিবরণীসহ PDF ও Excel উভয় ফাইল</strong> স্বয়ংক্রিয়ভাবে আপনার ইমেইলে পাঠিয়ে দেওয়া হবে।
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal (Admin / Super Admin Only) */}
      {passwordResetUser && (
        <Modal
          isOpen={Boolean(passwordResetUser)}
          onClose={() => setPasswordResetUser(null)}
          title={`Reset Password: ${passwordResetUser.name}`}
          subtitle={`Username: @${passwordResetUser.username || passwordResetUser.email}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                New Password (Minimum 6 characters) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="e.g. newPass2026!"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-mono"
                required
                minLength={6}
              />
              <p className="text-[11px] text-slate-400">
                Staff member will be able to log in immediately using this new password.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPasswordResetUser(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isResettingPassword || newPasswordValue.trim().length < 6}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isResettingPassword ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
                Save New Password
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Staff Profile & Records Inspection Modal (Super Admin / Admin Only) */}
      {inspectingUser && (
        <Modal
          isOpen={Boolean(inspectingUser)}
          onClose={() => setInspectingUser(null)}
          title={`Staff Profile & Records: ${inspectingUser.name}`}
          subtitle={`Username: @${inspectingUser.username || inspectingUser.email} • Role: ${inspectingUser.role?.toUpperCase()} • Status: ${inspectingUser.status?.toUpperCase()}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5">
            {/* User Profile Overview & Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total All-Time Records
                </span>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {inspectStats?.totalAllTime ?? 0}
                </p>
                <span className="text-[10px] text-slate-400">Total logs by this staff member</span>
              </div>

              <div className="p-3.5 bg-brand-50/60 rounded-xl border border-brand-200">
                <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wider">
                  Selected Month Logs
                </span>
                <p className="text-xl font-bold text-brand-900 mt-1">
                  {inspectRecords.length}
                </p>
                <span className="text-[10px] text-brand-600">Month {inspectMonth}/{inspectYear} entries</span>
              </div>

              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200">
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
                  Unique Patients
                </span>
                <p className="text-xl font-bold text-purple-900 mt-1">
                  {inspectStats?.uniquePatientsMonth ?? 0}
                </p>
                <span className="text-[10px] text-purple-600">Distinct patients treated</span>
              </div>
            </div>

            {/* Filter Toolbar for this staff member's records */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">Filter Period:</span>
                <select
                  value={inspectMonth}
                  onChange={(e) => handleInspectMonthChange(e.target.value)}
                  className="py-1 px-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Month {m}
                    </option>
                  ))}
                </select>

                <select
                  value={inspectYear}
                  onChange={(e) => handleInspectYearChange(e.target.value)}
                  className="py-1 px-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export buttons for this staff member */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingUserExcel || inspectRecords.length === 0}
                  onClick={handleDownloadInspectedUserExcel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
                  title="Export this staff member's monthly Excel report"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Excel
                </button>

                <button
                  type="button"
                  disabled={isExportingUserPdf || inspectRecords.length === 0}
                  onClick={handleDownloadInspectedUserPdf}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-700 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
                  title="Export this staff member's monthly PDF report"
                >
                  <FileType className="w-3.5 h-3.5 text-rose-600" />
                  PDF
                </button>
              </div>
            </div>

            {/* Staff Member's Patient Records Table */}
            {isInspectLoading ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                <p className="text-xs">Loading {inspectingUser.name}'s records...</p>
              </div>
            ) : inspectRecords.length === 0 ? (
              <div className="py-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-medium">No patient records found for {inspectingUser.name} in Month {inspectMonth}/{inspectYear}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3 w-12 text-center">SL</th>
                      <th className="py-2.5 px-3 w-28">Patient ID</th>
                      <th className="py-2.5 px-3">Patient Name</th>
                      <th className="py-2.5 px-3 w-24">Date</th>
                      <th className="py-2.5 px-3 w-20">Time</th>
                      <th className="py-2.5 px-3 w-20">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectRecords.map((rec, index) => (
                      <tr key={rec._id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-semibold">{formatSL(rec.sl || index + 1)}</td>
                        <td className="py-2 px-3 font-mono font-bold text-brand-700">{rec.patientId}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{rec.patientName}</td>
                        <td className="py-2 px-3 text-slate-600">{formatDateDotShort(rec.date)}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{formatHospitalTime(rec.time)}</td>
                        <td className="py-2 px-3 text-slate-700 font-bold">{rec.remark || '100'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Super Admin User Profile Deletion OTP Verification Modal */}
      {deleteTargetUser && (
        <Modal
          isOpen={Boolean(deleteTargetUser)}
          onClose={() => !isVerifyingDelete && setDeleteTargetUser(null)}
          title="Security Verification: Delete User Profile"
          subtitle={`ইউজার "${deleteTargetUser.name}" এর প্রোফাইল ও ডাটা মুছে ফেলা`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmDeleteUserWithOtp} className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                নিরাপত্তা ভেরিফিকেশন ও ওটিপি কোড:
              </div>
              <p>
                ইউজার <strong className="text-rose-950">{deleteTargetUser.name}</strong> (@{deleteTargetUser.username}) এর প্রোফাইল মুছে ফেলার জন্য তার ইমেইলে (<strong className="font-mono text-rose-950">{deleteMaskedEmail || deleteTargetUser.email}</strong>) একটি ৬-সংখ্যার সিকিউরিটি কোড পাঠানো হয়েছে।
              </p>
              <p className="text-rose-800">
                অনাকাঙ্ক্ষিত বা ভুলবশত ডিলিট রোধে ইউজারের থেকে কোডটি সংগ্রহ করে নিচে প্রদান করুন।
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>৬-সংখ্যার সিকিউরিটি ওটিপি (Security OTP Code)</span>
                <span className="text-[11px] text-slate-400 font-normal">⏱️ মেয়াদ ১০ মিনিট</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={deleteOtpValue}
                onChange={(e) => setDeleteOtpValue(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • • • •"
                className="w-full text-center tracking-[12px] text-2xl font-mono font-extrabold rounded-xl border border-rose-300 bg-rose-50/40 px-3.5 py-3 text-rose-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all shadow-inner"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResendDeleteOtp}
                disabled={isSendingDeleteOtp}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSendingDeleteOtp ? 'animate-spin' : ''}`} />
                {isSendingDeleteOtp ? 'Sending...' : 'পুনরায় কোড পাঠান (Resend)'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isVerifyingDelete}
                  onClick={() => setDeleteTargetUser(null)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingDelete || deleteOtpValue.length < 6}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-40"
                >
                  {isVerifyingDelete ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Verify & Delete (মুছুন)
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

