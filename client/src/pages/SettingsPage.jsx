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
} from 'lucide-react';

export const SettingsPage = () => {
  const toast = useToast();
  const { settings, updateSettings, isLoadingSettings } = useSettings();
  const { isAdmin, role } = useAuth();

  const [activeTab, setActiveTab] = useState('general');

  // General settings state
  const [formData, setFormData] = useState({
    hospitalName: '',
    location: '',
    reportTitle: '',
    checkDuplicates: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // User management state (Admin only)
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

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
      await authApi.updateUser(userId, { role: newRole });
      toast.success('User role updated');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user role: ' + err.message);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await authApi.updateUser(userId, { status: nextStatus });
      toast.success(`User account ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user status: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-brand-600" />
          Application Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure hospital branding, report headers, and administrative access controls
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'general'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Hospital & Report Branding
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management
          </button>
        )}
      </div>

      {/* Tab 1: General Hospital Settings */}
      {activeTab === 'general' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-subtle">
          <form onSubmit={handleGeneralSubmit} className="space-y-5">
            {/* Hospital Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-600" />
                Hospital / Organization Name
              </label>
              <input
                type="text"
                value={formData.hospitalName}
                onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                placeholder="e.g. GENERAL HOSPITAL & MEDICAL CENTER"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring font-medium uppercase"
                required
              />
              <p className="text-[11px] text-slate-400">
                This appears as the main top title across all dashboards, Excel reports, and printouts.
              </p>
            </div>

            {/* Department / Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-600" />
                Department / Facility Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. DEPARTMENT OF OVER DUTY SERVICES, LEVEL 3"
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
                    Shows an intelligent non-blocking warning if a patient ID already has an entry on the same date.
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

      {/* Tab 2: User Management (Admin Only) */}
      {isAdmin && activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Registered Staff & Administrators</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control permissions, roles, and account access
            </p>
          </div>

          {isLoadingUsers ? (
            <div className="p-8 text-center text-slate-400">Loading user accounts...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">{u.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                          className="py-1 px-2 text-xs rounded border border-slate-300 bg-white font-medium text-slate-700 capitalize"
                        >
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u._id, u.status)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            u.status === 'active'
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
