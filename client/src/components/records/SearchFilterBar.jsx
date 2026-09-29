import React, { useState, useEffect } from 'react';
import { Search, X, Calendar, Filter, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { MonthYearPicker } from '../layout/MonthYearPicker';

export const SearchFilterBar = ({
  searchTerm,
  onSearchChange,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  filterDate,
  onDateChange,
  verificationFilter = 'all',
  onVerificationFilterChange,
  onClearFilters,
  isSuperAdmin = false,
  users = [],
  selectedUserId = 'all',
  onUserChange,
  monthlyCounts = null,
}) => {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Debounced search to prevent querying API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  const hasActiveFilters = Boolean(
    localSearch || filterDate || (isSuperAdmin && selectedUserId !== 'me') || (verificationFilter && verificationFilter !== 'all')
  );

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-subtle flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 no-print">
      {/* Search Input Box */}
      <div className="relative flex-1 min-w-[240px]">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="পেশেন্ট আইডি, নাম অথবা রিমার্ক দিয়ে সার্চ করুন..."
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus-ring"
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => setLocalSearch('')}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Controls Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Verification Status Filter Pills */}
        <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100/90 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onVerificationFilterChange && onVerificationFilterChange('all')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              verificationFilter === 'all'
                ? 'bg-white text-slate-800 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="সবগুলো রেকর্ড দেখুন"
          >
            সকল
          </button>
          <button
            type="button"
            onClick={() => onVerificationFilterChange && onVerificationFilterChange('verified')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
              verificationFilter === 'verified'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
            title="শুধুমাত্র সবুজ কনফার্মড রেকর্ডগুলো দেখুন"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>কনফার্মড</span>
          </button>
          <button
            type="button"
            onClick={() => onVerificationFilterChange && onVerificationFilterChange('unverified')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
              verificationFilter === 'unverified'
                ? 'bg-rose-600 text-white shadow-sm font-bold'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
            title="যেগুলো এখনো সবুজ কনফার্ম করা হয়নি (ভুল এন্ট্রি খুঁজে ডিলিট করার জন্য)"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>বাকি / অযাচাই</span>
          </button>
        </div>

        {/* Super Admin: User Selector */}
        {isSuperAdmin && users.length > 0 && (
          <div className="relative">
            <select
              value={selectedUserId}
              onChange={(e) => onUserChange && onUserChange(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus-ring"
              title="Filter records by user account"
            >
              <option value="me">👤 My Records Only (Private)</option>
              <option value="all">🌐 All Users' Records (Combined)</option>
              <optgroup label="Staff Accounts">
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} (@{u.username || u.email})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}

        {/* Month & Year Selectors */}
        <MonthYearPicker
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChangeMonth={onMonthChange}
          onChangeYear={onYearChange}
          monthlyCounts={monthlyCounts}
        />

        {/* Specific Date Filter */}
        <div className="relative">
          <input
            type="date"
            value={filterDate || ''}
            onChange={(e) => onDateChange(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 focus-ring"
            title="নির্দিষ্ট তারিখ দিয়ে ফিল্টার"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
