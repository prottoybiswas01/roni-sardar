import React from 'react';
import { MONTHS } from '../../utils/dateUtils';
import { Building2 } from 'lucide-react';

export const ReportHeader = ({
  hospitalName = 'Ad-din Akij Medical College Hospital',
  location = 'Boyra, Khulna',
  month,
  year,
  records = [],
}) => {
  const monthObj = MONTHS.find((m) => m.value === Number(month));
  const monthName = monthObj ? monthObj.name.toUpperCase() : 'ALL';
  const monthYearString =
    month === 'all' || !month
      ? `YEAR: ${year}`
      : `MONTH: ${monthName} ${year}`;

  const uniquePatients = new Set(
    records.map((r) => String(r.patientId || '').trim()).filter(Boolean)
  ).size;

  const totalAmount = records.reduce((sum, r) => {
    const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
    return sum + val;
  }, 0);

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-subtle text-center space-y-1.5 print-card">
      {/* 1. Hospital Name */}
      <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight uppercase">
        {(hospitalName || 'AD-DIN AKIJ MEDICAL COLLEGE HOSPITAL').toUpperCase()}
      </h2>

      {/* 2. One Call Subtitle */}
      <div className="text-sm font-medium text-slate-700">
        One Call
      </div>

      {/* 3. Month & Year Banner */}
      <div className="text-sm font-bold text-slate-900 tracking-wide">
        {monthYearString}
      </div>

      {/* 4. Divider & Summary Line */}
      <div className="pt-2 border-t border-slate-300 print:border-black">
        <div className="text-xs font-bold text-slate-800">
          Total Records: {records.length} &nbsp;|&nbsp; Unique Patients: {uniquePatients} &nbsp;|&nbsp; Total Remark / Amount: Tk. {totalAmount.toLocaleString()}
        </div>
      </div>
    </div>
  );
};
