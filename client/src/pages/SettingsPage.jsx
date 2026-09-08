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
import { formatDateDotShort, formatHospitalTime } from '../utils/dateUtils';
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
} from 'lucide-react';

export const SettingsPage = ({ initialTab = 'general' }) => {
  const toast = useToast();
  const { settings, updateSettings, isLoadingSettings, selectedMonth, selectedYear } = useSettings();
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();

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

  // Backup & Recovery state
  const [backupStatus, setBackupStatus] = useState(null);
  const [isLoadingBackupStatus, setIsLoadingBackupStatus] = useState(false);
  const [backupFormData, setBackupFormData] = useState({
    backupEmail: '',
    autoEmailBackup: true,
    emailProvider: 'resend',
    resendApiKey: '',
    senderEmail: 'onboarding@resend.dev',
    senderName: 'OverDuty Hospital Backup',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpUser: '',
    smtpPass: '',
    smtpSecure: true,
  });
  const [isSavingBackupSettings, setIsSavingBackupSettings] = useState(false);
  const [isSendingBackupEmail, setIsSendingBackupEmail] = useState(false);
  const [isSendingMyBackup, setIsSendingMyBackup] = useState(false);
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [isExportingFullJson, setIsExportingFullJson] = useState(false);
  const [restoreFileJson, setRestoreFileJson] = useState(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [isRestoringDb, setIsRestoringDb] = useState(false);

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

  // Fetch backup status and configuration
  const fetchBackupStatus = useCallback(async () => {
    try {
      setIsLoadingBackupStatus(true);
      const res = await backupApi.getBackupStatus();
      if (res.success && res.data) {
        setBackupStatus(res.data);
        setBackupFormData({
          backupEmail: res.data.backupEmail || 'admin@hospital.com',
          autoEmailBackup: res.data.autoEmailBackup ?? true,
          emailProvider: res.data.emailProvider || 'resend',
          resendApiKey: '',
          senderEmail: res.data.senderEmail || 'onboarding@resend.dev',
          senderName: res.data.senderName || 'OverDuty Hospital Backup',
          smtpHost: res.data.smtpHost || 'smtp.gmail.com',
          smtpPort: res.data.smtpPort || 465,
          smtpUser: res.data.smtpUser || '',
          smtpPass: '',
          smtpSecure: res.data.smtpSecure ?? true,
        });
      }
    } catch (err) {
      console.error('Failed to load backup status:', err);
    } finally {
      setIsLoadingBackupStatus(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchBackupStatus();
    }
  }, [activeTab, fetchBackupStatus]);

  const handleSaveBackupSettings = async (e) => {
    e.preventDefault();
    try {
      setIsSavingBackupSettings(true);
      await updateSettings(backupFormData);
      toast.success('Email gateway & backup settings saved successfully');
      fetchBackupStatus();
    } catch (err) {
      toast.error('Failed to save backup settings: ' + err.message);
    } finally {
      setIsSavingBackupSettings(false);
    }
  };

  // Send Personal Records Backup to Current User's Email
  const handleTriggerMyBackupNow = async () => {
    try {
      setIsSendingMyBackup(true);
      const res = await backupApi.triggerEmailBackup({ forSelfOnly: true });
      toast.success(res.message || 'Your personal backup has been emailed to you!');
      fetchBackupStatus();
    } catch (err) {
      toast.error('Personal backup delivery failed: ' + err.message);
    } finally {
      setIsSendingMyBackup(false);
    }
  };

  // Master system backup trigger (Admin)
  const handleTriggerMasterBackupEmailNow = async () => {
    try {
      setIsSendingBackupEmail(true);
      const res = await backupApi.triggerEmailBackup({ forSelfOnly: false });
      toast.success(res.message || 'Master database backup successfully dispatched!');
      fetchBackupStatus();
    } catch (err) {
      toast.error('Master backup email dispatch failed: ' + err.message);
    } finally {
      setIsSendingBackupEmail(false);
    }
  };

  const handleTestGateway = async () => {
    const testRecipient = backupFormData.backupEmail || currentUser?.email;
    if (!testRecipient) {
      toast.warning('Please enter a recipient email to test the connection');
      return;
    }
    try {
      setIsTestingGateway(true);
      const res = await backupApi.testEmailSettings({
        emailProvider: backupFormData.emailProvider,
        resendApiKey: backupFormData.resendApiKey,
        senderEmail: backupFormData.senderEmail,
        senderName: backupFormData.senderName,
        host: backupFormData.smtpHost,
        port: Number(backupFormData.smtpPort),
        user: backupFormData.smtpUser,
        pass: backupFormData.smtpPass,
        secure: backupFormData.smtpSecure,
        to: testRecipient,
      });
      toast.success(res.message);
    } catch (err) {
      toast.error('Email Gateway Test Failed: ' + err.message);
    } finally {
      setIsTestingGateway(false);
    }
  };

  const handleDownloadFullBackup = async () => {
    try {
      setIsExportingFullJson(true);
      await backupApi.downloadFullBackup();
      toast.success('Complete database snapshot downloaded successfully');
      fetchBackupStatus();
    } catch (err) {
      toast.error('Download backup failed: ' + err.message);
    } finally {
      setIsExportingFullJson(false);
    }
  };

  const handleFileSelectForRestore = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.data || !Array.isArray(parsed.data.records)) {
          toast.error('Invalid backup file structure. File must be an OverDuty Pro backup JSON.');
          setRestoreFileJson(null);
          return;
        }
        setRestoreFileJson(parsed);
        toast.info(`Backup file loaded: ${parsed.counts?.totalRecords || parsed.data.records.length} records found.`);
      } catch (err) {
        toast.error('Failed to parse JSON backup file: ' + err.message);
        setRestoreFileJson(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFileJson) return;
    if (!window.confirm(`Are you sure you want to restore ${restoreFileJson.counts?.totalRecords || restoreFileJson.data.records.length} records into the database? Existing identical records will not be overwritten.`)) {
      return;
    }

    try {
      setIsRestoringDb(true);
      const res = await backupApi.restoreBackup(restoreFileJson);
      toast.success(res.message);
      setRestoreFileJson(null);
      setRestoreFileName('');
      fetchBackupStatus();
      fetchUsers();
    } catch (err) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setIsRestoringDb(false);
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

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"?`)) {
      return;
    }
    try {
      setActionLoadingId(userId);
      await authApi.deleteUser(userId);
      toast.success(`User "${userName}" deleted successfully`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user: ' + err.message);
    } finally {
      setActionLoadingId(null);
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

        {isAdmin && (
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
                            ) : u.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <UserX className="w-3 h-3 text-rose-600" /> Inactive / Blocked
                              </span>
                            )}
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
                                View Profile
                              </button>

                              {/* Reset Password Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordResetUser(u);
                                  setNewPasswordValue('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold shadow-subtle transition-all active:scale-95"
                                title="Set a new password for this user"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                Reset Pass
                              </button>

                              {/* One-click Approve & Activate button for Pending Users */}
                              {u.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleApproveUser(u._id, u.name)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                                  title="Approve registration and activate account"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                              )}

                              {/* Toggle Activate / Deactivate */}
                              {!isMainAdmin && u.status !== 'pending' && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleToggleUserStatus(u._id, u.status)}
                                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                    u.status === 'active'
                                      ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                                      : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                                  }`}
                                >
                                  {u.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                              )}

                              {/* Delete Action */}
                              {!isMainAdmin && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleDeleteUser(u._id, u.name)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete user permanently"
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

      {/* Tab 3: Database Backup & Recovery (All Authenticated Users) */}
      {activeTab === 'backup' && (
        <div className="space-y-6 max-w-4xl">
          {/* Section 1: User's Personal Daily Email Backup (Visible to EVERYONE) */}
          <div className="bg-gradient-to-br from-white to-sky-50/60 rounded-2xl border border-sky-200/80 shadow-subtle p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100 pb-5 mb-5">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-100 text-brand-700 inline-block mb-1.5">
                  Personal Record Protection
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-brand-600" />
                  My Automated Daily Email Backup
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                  Every night at 12:00 AM (Midnight), all clinical records and over duty logs entered by you are automatically compiled into an Excel spreadsheet and sent directly to your email.
                </p>
              </div>

              <button
                type="button"
                disabled={isSendingMyBackup}
                onClick={handleTriggerMyBackupNow}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
              >
                {isSendingMyBackup ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send My Backup to My Email Now
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recipient Email</p>
                <p className="text-sm font-bold text-slate-900 mt-1 truncate">{currentUser?.email || 'N/A'}</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">✓ Registered with account</p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Delivery Schedule</p>
                <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-600" /> Every Night 00:00 AM
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Automated background job</p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attached Formats</p>
                <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel (.CSV) + JSON
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Opens in Excel & Google Sheets</p>
              </div>
            </div>
          </div>

          {/* Admin Tools: Overview, Gateway, JSON Master Backup, and Disaster Recovery */}
          {isAdmin && (
            <>
              {/* Section 2: Global Stats & Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Master Total Records</p>
                    <h4 className="text-2xl font-extrabold text-slate-900 mt-1">{backupStatus?.totalRecords ?? 0}</h4>
                    <p className="text-[10px] text-slate-400">Across {backupStatus?.totalUsers ?? 0} staff accounts</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Local Snapshots</p>
                    <h4 className="text-2xl font-extrabold text-slate-900 mt-1">{backupStatus?.localSnapshots?.length ?? 0}</h4>
                    <p className="text-[10px] text-brand-600 font-medium">Saved on server disk</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Server className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Midnight Auto-Backup</p>
                    <h4 className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Active (00:00 AM)
                    </h4>
                    <p className="text-[10px] text-slate-400">Runs for all active staff</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Section 3: 1-Click Master Database Snapshot (.JSON) */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Download className="w-5 h-5 text-brand-400" />
                    1-Click Full System Master Backup (.JSON)
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl">
                    Download an offline snapshot of ALL patient records, registered staff accounts, and hospital settings. Keep this file safe for full disaster recovery.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isExportingFullJson}
                  onClick={handleDownloadFullBackup}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
                >
                  {isExportingFullJson ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileJson className="w-4 h-4" />
                  )}
                  Download Full DB (.JSON)
                </button>
              </div>

              {/* Section 4: Central Email Gateway Configuration (System Sender) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle p-6 sm:p-8">
                <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Server className="w-5 h-5 text-brand-600" />
                      Central Email Gateway (System Sender)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure your global email sender once. All automated midnight backups to staff will be sent through this gateway.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSendingBackupEmail}
                      onClick={handleTriggerMasterBackupEmailNow}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-50 text-brand-800 border border-brand-200 hover:bg-brand-100 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                      title="Dispatch master backup to Admin email now"
                    >
                      {isSendingBackupEmail ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-brand-600" />
                      )}
                      Dispatch Master Backup Now
                    </button>
                  </div>
                </div>

                {/* Last Backup Event */}
                {backupStatus?.lastBackupAt && (
                  <div className={`p-3.5 rounded-xl border mb-6 text-xs flex items-start gap-2.5 ${
                    backupStatus.lastBackupStatus === 'success'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : backupStatus.lastBackupStatus === 'error'
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    {backupStatus.lastBackupStatus === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : backupStatus.lastBackupStatus === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold">Last Gateway Event: </span>
                      <span>{new Date(backupStatus.lastBackupAt).toLocaleString()} — {backupStatus.lastBackupMessage}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveBackupSettings} className="space-y-5">
                  {/* Provider Choice: Resend API vs Custom Domain / SMTP */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Select Email Gateway Method:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        onClick={() => setBackupFormData({ ...backupFormData, emailProvider: 'resend' })}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-start gap-3 transition-all ${
                          backupFormData.emailProvider === 'resend'
                            ? 'border-brand-600 bg-brand-50/40 text-brand-950 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="emailProvider"
                          value="resend"
                          checked={backupFormData.emailProvider === 'resend'}
                          onChange={() => setBackupFormData({ ...backupFormData, emailProvider: 'resend' })}
                          className="mt-0.5 text-brand-600"
                        />
                        <div>
                          <p className="text-xs font-bold flex items-center gap-1.5">
                            ⚡ Resend API <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px]">Recommended</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Zero hassle, instant 100% inbox delivery. Free 3,000 emails/month. Just paste your Resend API key.
                          </p>
                        </div>
                      </label>

                      <label
                        onClick={() => setBackupFormData({ ...backupFormData, emailProvider: 'smtp' })}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-start gap-3 transition-all ${
                          backupFormData.emailProvider === 'smtp'
                            ? 'border-brand-600 bg-brand-50/40 text-brand-950 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="emailProvider"
                          value="smtp"
                          checked={backupFormData.emailProvider === 'smtp'}
                          onChange={() => setBackupFormData({ ...backupFormData, emailProvider: 'smtp' })}
                          className="mt-0.5 text-brand-600"
                        />
                        <div>
                          <p className="text-xs font-bold">🌐 Domain / cPanel / Gmail SMTP</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Use your own hosting webmail, domain mail server, or Gmail SMTP credentials.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Resend API Fields */}
                  {backupFormData.emailProvider === 'resend' ? (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in fade-in">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                          <span>Resend API Key (starts with <code>re_...</code>)</span>
                          <a
                            href="https://resend.com/api-keys"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-brand-600 hover:underline font-bold"
                          >
                            Get Free Resend Key &rarr;
                          </a>
                        </label>
                        <input
                          type="password"
                          value={backupFormData.resendApiKey}
                          onChange={(e) => setBackupFormData({ ...backupFormData, resendApiKey: e.target.value })}
                          placeholder={backupStatus?.resendApiKey ? '•••••••••••••••• (Configured)' : 're_1234567890abcdef...'}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">Sender Email (From)</label>
                          <input
                            type="text"
                            value={backupFormData.senderEmail}
                            onChange={(e) => setBackupFormData({ ...backupFormData, senderEmail: e.target.value })}
                            placeholder="onboarding@resend.dev or backup@yourdomain.com"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-mono text-xs"
                          />
                          <p className="text-[10px] text-slate-400">Use onboarding@resend.dev or your verified domain.</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">Sender Display Name</label>
                          <input
                            type="text"
                            value={backupFormData.senderName}
                            onChange={(e) => setBackupFormData({ ...backupFormData, senderName: e.target.value })}
                            placeholder="OverDuty Hospital Backup"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SMTP Configuration Fields */
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">SMTP Host / Mail Server</label>
                          <input
                            type="text"
                            value={backupFormData.smtpHost}
                            onChange={(e) => setBackupFormData({ ...backupFormData, smtpHost: e.target.value })}
                            placeholder="e.g. mail.yourdomain.com or smtp.gmail.com"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">SMTP Port</label>
                          <input
                            type="number"
                            value={backupFormData.smtpPort}
                            onChange={(e) => setBackupFormData({ ...backupFormData, smtpPort: Number(e.target.value) })}
                            placeholder="465"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-mono text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">SMTP Username / Email</label>
                          <input
                            type="text"
                            value={backupFormData.smtpUser}
                            onChange={(e) => setBackupFormData({ ...backupFormData, smtpUser: e.target.value })}
                            placeholder="e.g. backup@yourdomain.com"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">SMTP Password</label>
                          <input
                            type="password"
                            value={backupFormData.smtpPass}
                            onChange={(e) => setBackupFormData({ ...backupFormData, smtpPass: e.target.value })}
                            placeholder={backupStatus?.hasSmtpPass ? '•••••••••••• (Configured)' : 'Enter email / SMTP password'}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Super Admin Master Backup Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      Super Admin Master Backup Recipient
                    </label>
                    <input
                      type="email"
                      value={backupFormData.backupEmail}
                      onChange={(e) => setBackupFormData({ ...backupFormData, backupEmail: e.target.value })}
                      placeholder="e.g. admin@hospital.com"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium"
                    />
                    <p className="text-[11px] text-slate-400">
                      Receives the master JSON snapshot and all-staff combined spreadsheet every night.
                    </p>
                  </div>

                  {/* Toggles & Save Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupFormData.autoEmailBackup}
                        onChange={(e) => setBackupFormData({ ...backupFormData, autoEmailBackup: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Enable Automated Midnight Dispatch (00:00 AM)
                      </span>
                    </label>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isTestingGateway}
                        onClick={handleTestGateway}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isTestingGateway ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        Test Gateway
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingBackupSettings}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isSavingBackupSettings ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save Gateway Settings
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Section 5: Disaster Recovery / Restore Database from JSON */}
              <div className="bg-white rounded-2xl border border-rose-200/80 shadow-subtle p-6 sm:p-8">
                <div className="border-b border-rose-100 pb-4 mb-5">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-rose-600" />
                    Disaster Recovery / Restore Database from Backup File
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    If the database ever crashes, is wiped, or account records need to be recovered, upload a previously exported <code>.json</code> backup file to safely restore all patient records and user accounts.
                  </p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div className="border-2 border-dashed border-slate-300 hover:border-brand-400 rounded-xl p-6 text-center bg-slate-50/60 transition-colors">
                    <input
                      type="file"
                      id="backupFileInput"
                      accept=".json"
                      onChange={handleFileSelectForRestore}
                      className="hidden"
                    />
                    <label
                      htmlFor="backupFileInput"
                      className="cursor-pointer flex flex-col items-center justify-center gap-2"
                    >
                      <FileJson className="w-8 h-8 text-slate-400" />
                      <span className="text-xs font-bold text-brand-700 hover:text-brand-800">
                        {restoreFileName ? restoreFileName : 'Click to select Backup JSON file from your computer'}
                      </span>
                      <span className="text-[10px] text-slate-400">Accepts hospital-overduty-backup-*.json</span>
                    </label>
                  </div>

                  {restoreFileJson && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center justify-between font-bold text-emerald-900">
                        <span>✅ Valid Backup File Verified</span>
                        <span>Date: {restoreFileJson.timestamp ? new Date(restoreFileJson.timestamp).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <p className="text-emerald-800">
                        Contains <strong>{restoreFileJson.counts?.totalRecords || restoreFileJson.data?.records?.length || 0} patient records</strong> and <strong>{restoreFileJson.counts?.totalUsers || restoreFileJson.data?.users?.length || 0} user accounts</strong>.
                      </p>

                      <button
                        type="button"
                        disabled={isRestoringDb}
                        onClick={handleExecuteRestore}
                        className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isRestoringDb ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        Restore Database Now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 6: Local Server Disk Snapshots */}
              {backupStatus?.localSnapshots?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-600" />
                        Local Server Disk Snapshots Archive
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Snapshots automatically saved on the server's local file storage
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-4">Filename</th>
                          <th className="py-2.5 px-4">Created Date</th>
                          <th className="py-2.5 px-4 text-right">File Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        {backupStatus.localSnapshots.map((snap) => (
                          <tr key={snap.filename} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-brand-700">{snap.filename}</td>
                            <td className="py-2.5 px-4 font-sans">{new Date(snap.createdAt).toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-right font-sans">{(snap.sizeBytes / 1024).toFixed(1)} KB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
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
    </div>
  );
};
