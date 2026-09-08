import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, PauseCircle } from 'lucide-react';

export const Layout = ({ activeTab, setActiveTab, onOpenShare, children }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isPaused, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onOpenShare={onOpenShare}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Header onToggleSidebar={() => setIsMobileOpen(true)} onNavigate={setActiveTab} />

        {/* Account Paused / Suspended Alert Banner */}
        {isPaused && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 shadow-sm border-b border-amber-600 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold animate-pulse">
            <PauseCircle className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              ⚠️ আপনার অ্যাকাউন্টটি সুপার অ্যাডমিন কর্তৃক স্থগিত (Paused) করা হয়েছে। আপনি বর্তমানে নতুন ডাটা এন্ট্রি করতে পারবেন না।
            </span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
