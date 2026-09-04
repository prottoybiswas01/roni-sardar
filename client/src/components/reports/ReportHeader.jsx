import React from 'react';
import { formatMonthYearHeader } from '../../utils/dateUtils';
import { Building2, MapPin, Calendar } from 'lucide-react';

export const ReportHeader = ({
  hospitalName = 'Ad-din Akij Medical College Hospital',
  location = 'Boyra, Khulna',
  reportTitle = 'OVER DUTY / PATIENT REPORT',
  month,
  year,
  recordCount = 0,
}) => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200/80 shadow-subtle text-center space-y-2.5 print-card">
      {/* Hospital Name */}
      <div className="flex items-center justify-center gap-2">
        <Building2 className="w-5 h-5 text-brand-600 print:hidden" />
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {hospitalName}
        </h2>
      </div>

      {/* Location */}
      <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-600 font-medium">
        <MapPin className="w-3.5 h-3.5 text-slate-400 print:hidden" />
        <span>{location}</span>
      </div>

      {/* Month & Year Banner */}
      <div className="pt-2">
        <div className="inline-block border-b-2 border-slate-800 text-slate-900 font-bold text-sm sm:text-base tracking-wide px-6 py-1">
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
