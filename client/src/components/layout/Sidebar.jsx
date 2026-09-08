import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  PlusCircle,
  FileSpreadsheet,
  FileText,
  Settings,
  Users,
  Database,
  Trash2,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export const Sidebar = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed,
  setIsCollapsed,
}) => {
  const { role, isAdmin } = useAuth();

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'add-record',
      label: 'Add Record',
      icon: PlusCircle,
      badge: 'OCR',
    },
    {
      id: 'records',
      label: 'Records',
      icon: FileSpreadsheet,
    },
    {
      id: 'reports',
      label: 'Monthly Reports',
      icon: FileText,
    },
    {
      id: 'backup',
      label: 'Backup & Recovery',
      icon: Database,
      badge: 'AUTO',
    },
    {
      id: 'recycle-bin',
      label: 'Recycle Bin (বিন)',
      icon: Trash2,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
    ...(isAdmin
      ? [
          {
            id: 'users',
            label: 'User Management',
            icon: Users,
          },
        ]
      : []),
  ];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-slate-900 text-slate-100 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 no-print ${
          /* Mobile Drawer */
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${
          /* Desktop Width */
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm tracking-tight text-white leading-tight">
                  OverDuty Pro
                </span>
                <span className="text-[11px] text-slate-400 font-medium truncate">
                  Clinical Records
                </span>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          {isMobileOpen && (
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                } ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'gap-3'}`}
                title={isCollapsed && !isMobileOpen ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {(!isCollapsed || isMobileOpen) && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {(!isCollapsed || isMobileOpen) && item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Status Footer */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="p-3 m-3 rounded-xl bg-slate-800/60 border border-slate-800 text-xs text-slate-400 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-300">System Status</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-slate-400">Database Connected</p>
          </div>
        )}
      </aside>
    </>
  );
};
