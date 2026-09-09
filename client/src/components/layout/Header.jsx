import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { formatMonthYearHeader } from '../../utils/dateUtils';
import {
  Menu,
  Building2,
  LogOut,
  User,
  Shield,
  ChevronDown,
  Database,
  Trash2,
  Settings as SettingsIcon,
  Mail,
} from 'lucide-react';

export const Header = ({ onToggleSidebar, onNavigate }) => {
  const { user, role, logout } = useAuth();
  const { settings, selectedMonth, selectedYear } = useSettings();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (roleName) => {
    switch (roleName) {
      case 'superadmin':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'manager':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleDropdownNavigate = (tabId) => {
    setUserDropdownOpen(false);
    if (onNavigate) {
      onNavigate(tabId);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-subtle no-print">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section: Hamburger (mobile) + Dynamic Hospital info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600 shrink-0 hidden sm:block" />
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {settings.hospitalName || 'GENERAL HOSPITAL & MEDICAL CENTER'}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                <span className="truncate hidden sm:inline">{settings.location}</span>
                <span className="hidden sm:inline">•</span>
                <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
                  {formatMonthYearHeader(selectedMonth, selectedYear)}
                </span>
              </div>
            </div>
          </div>

          {/* Right section: User profile */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* User Profile Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-expanded={userDropdownOpen}
              >
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.name || 'Medical Staff'}
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">{role}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
              </button>

              {/* User Dropdown */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-dropdown border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Staff Member'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    {user?.backupEmail && user?.backupEmail !== user?.email && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> Backup: {user.backupEmail}
                      </p>
                    )}
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border capitalize ${getRoleBadge(
                          role
                        )}`}
                      >
                        <Shield className="w-2.5 h-2.5 mr-1" />
                        {role}
                      </span>
                    </div>
                  </div>

                  <div className="px-1 py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleDropdownNavigate('backup')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-brand-600 rounded-lg transition-colors"
                    >
                      <Database className="w-4 h-4 text-brand-600" />
                      Backup & Recovery (AUTO)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDropdownNavigate('settings')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-brand-600 rounded-lg transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                      Hospital Settings
                    </button>
                  </div>

                  <div className="px-1 py-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
