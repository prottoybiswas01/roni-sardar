import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../services/recordsApi';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { exportMonthlyReportToExcel } from '../services/excelService';
import { ReportHeader } from '../components/reports/ReportHeader';
import { MonthYearPicker } from '../components/layout/MonthYearPicker';
import { formatDateDisplay, formatTimeDisplay } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';
import { TableSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';

export const MonthlyReportPage = ({ onAddNew }) => {
  const toast = useToast();
  const { settings, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useSettings();

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        limit: 1000,
        sortBy: 'sl',
        sortOrder: 'asc',
      });

      if (res.success) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error('Failed to load monthly report:', err);
      toast.error('Unable to load report data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, toast]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleDownloadExcel = () => {
    if (!records || records.length === 0) {
      toast.warning('There are no records to export for this period.');
      return;
    }

    try {
      setIsExporting(true);
      exportMonthlyReportToExcel({
        records,
        month: selectedMonth,
        year: selectedYear,
        hospitalName: settings.hospitalName,
        location: settings.location,
      });
      toast.success('Excel report generated successfully');
    } catch (err) {
      toast.error('Failed to generate Excel file: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar (Controls hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-brand-600" />
            Monthly Administrative Report
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official monthly Over Duty / Patient records breakdown for archiving and payroll
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month & Year Selectors */}
          <MonthYearPicker
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChangeMonth={setSelectedMonth}
            onChangeYear={setSelectedYear}
          />

          <button
            type="button"
            disabled={isExporting || records.length === 0}
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download Excel
          </button>

          <button
            type="button"
            disabled={records.length === 0}
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            Print Report
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="space-y-4 print-card">
        {/* Organization & Month Header */}
        <ReportHeader
          hospitalName={settings.hospitalName}
          location={settings.location}
          reportTitle={settings.reportTitle}
          month={selectedMonth}
          year={selectedYear}
          recordCount={records.length}
        />

        {/* Report Records Table */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-subtle">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : records.length === 0 ? (
          <div className="no-print">
            <EmptyState
              title="No records found"
              description="There are no records logged for this selected month and year."
              onAction={onAddNew}
              actionText="Add Record"
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden print-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider print:bg-slate-200 print:text-black">
                    <th scope="col" className="py-3 px-4 w-14 text-center border-b border-slate-800 print:border-black">
                      SL
                    </th>
                    <th scope="col" className="py-3 px-4 w-32 border-b border-slate-800 print:border-black">
                      ID
                    </th>
                    <th scope="col" className="py-3 px-4 min-w-[200px] border-b border-slate-800 print:border-black">
                      Patient
                    </th>
                    <th scope="col" className="py-3 px-4 w-32 border-b border-slate-800 print:border-black">
                      Date
                    </th>
                    <th scope="col" className="py-3 px-4 w-28 border-b border-slate-800 print:border-black">
                      TIME
                    </th>
                    <th scope="col" className="py-3 px-4 min-w-[220px] border-b border-slate-800 print:border-black">
                      Remark
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {records.map((rec, index) => {
                    const slNum = rec.sl || index + 1;
                    return (
                      <tr
                        key={rec._id || index}
                        className="hover:bg-slate-50/60 print:hover:bg-transparent"
                      >
                        {/* SL */}
                        <td className="py-2.5 px-4 text-center font-medium text-slate-500 print:text-black">
                          {formatSL(slNum)}
                        </td>

                        {/* ID - Strictly Text string preserving leading zeroes */}
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 print:text-black">
                          {String(rec.patientId || '')}
                        </td>

                        {/* Patient Name */}
                        <td className="py-2.5 px-4 font-semibold text-slate-800 print:text-black">
                          {rec.patientName}
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-4 text-slate-700 print:text-black">
                          {formatDateDisplay(rec.date)}
                        </td>

                        {/* Time */}
                        <td className="py-2.5 px-4 text-slate-700 font-medium print:text-black">
                          {formatTimeDisplay(rec.time)}
                        </td>

                        {/* Remark */}
                        <td className="py-2.5 px-4 text-slate-600 print:text-black">
                          {rec.remark || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
