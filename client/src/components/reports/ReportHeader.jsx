import React from 'react';
import { formatMonthYearHeader } from '../../utils/dateUtils';
import { Building2, MapPin, Calendar } from 'lucide-react';

export const ReportHeader = ({
  hospitalName = 'GENERAL HOSPITAL & MEDICAL CENTER',
  location = 'DEPARTMENT OF OVER DUTY SERVICES',
  reportTitle = 'OVER DUTY / PATIENT REPORT',
  month,
  year,
  recordCount = 0,
}) => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200/80 shadow-subtle text-center space-y-3 print-card">
      {/* Hospital Name */}
      <div className="flex items-center justify-center gap-2">
        <Building2 className="w-5 h-5 text-brand-600 print:hidden" />
        <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide text-slate-900">
          {hospitalName}
        </h2>
      </div>

      {/* Location */}
      <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-600 font-medium">
        <MapPin className="w-3.5 h-3.5 text-slate-400 print:hidden" />
        <span>{location}</span>
      </div>

      {/* Month & Year Banner */}
      <div className="pt-2 border-t border-slate-100 print:border-slate-800">
        <div className="inline-block bg-slate-900 text-white font-mono text-xs sm:text-sm font-bold tracking-wider px-4 py-1.5 rounded-lg shadow-sm print:bg-transparent print:text-black print:p-0 print:border-b print:border-black">
          {formatMonthYearHeader(month, year)}
        </div>
      </div>

      {/* Report metadata in web view */}
      <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 no-print">
        <span>Document: {reportTitle}</span>
        <span>Total Records in Period: <strong className="text-slate-700">{recordCount}</strong></span>
      </div>
    </div>
  );
};
