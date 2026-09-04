import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/authApi';
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
} from 'lucide-react';

export const SettingsPage = () => {
  const toast = useToast();
  const { settings, updateSettings, isLoadingSettings } = useSettings();
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('general');

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
    </div>
  );
};
