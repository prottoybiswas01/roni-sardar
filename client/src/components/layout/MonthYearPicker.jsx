import React from 'react';
import { MONTHS, getAvailableYears } from '../../utils/dateUtils';
import { Calendar, ChevronDown } from 'lucide-react';

export const MonthYearPicker = ({
  selectedMonth,
  selectedYear,
  onChangeMonth,
  onChangeYear,
  className = '',
  compact = false,
  monthlyCounts = null,
}) => {
  const years = getAvailableYears(3, 8);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Month Selector */}
      <div className="relative inline-flex items-center">
        <select
          value={selectedMonth}
          onChange={(e) => onChangeMonth(Number(e.target.value))}
          className={`appearance-none bg-white border border-slate-300 rounded-lg text-slate-800 font-medium hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors shadow-subtle ${
            compact ? 'py-1.5 pl-3 pr-8 text-xs' : 'py-2 pl-3.5 pr-8 text-sm'
          }`}
          aria-label="Select Month"
        >
          {MONTHS.map((m) => {
            const count = monthlyCounts ? (monthlyCounts[m.value] ?? 0) : null;
            const label = count !== null ? `${m.name} (${count})` : m.name;
            return (
              <option key={m.value} value={m.value}>
                {label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-slate-400" />
      </div>

      {/* Year Selector */}
      <div className="relative inline-flex items-center">
        <select
          value={selectedYear}
          onChange={(e) => onChangeYear(Number(e.target.value))}
          className={`appearance-none bg-white border border-slate-300 rounded-lg text-slate-800 font-medium hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors shadow-subtle ${
            compact ? 'py-1.5 pl-3 pr-8 text-xs' : 'py-2 pl-3.5 pr-8 text-sm'
          }`}
          aria-label="Select Year"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
  );
};
