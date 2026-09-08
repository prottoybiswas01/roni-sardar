import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../services/recordsApi';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import { useToast } from '../context/ToastContext';
import { exportMonthlyReportToExcel } from '../services/excelService';
import { exportMonthlyReportToPDF, printMonthlyReportPDF } from '../services/pdfService';
import { ReportHeader } from '../components/reports/ReportHeader';
import { MonthYearPicker } from '../components/layout/MonthYearPicker';
import { formatDateDotShort, formatHospitalTime } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';
import { TableSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  FileSpreadsheet,
  FileType,
} from 'lucide-react';

export const MonthlyReportPage = ({ onAddNew }) => {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { settings, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useSettings();

  const [records, setRecords] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('me');
  const [userList, setUserList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      authApi.getUsers().then((res) => {
        if (res.success && res.data) {
          setUserList(res.data);
        }
      }).catch((err) => console.error('Error fetching users:', err));
    }
  }, [isSuperAdmin]);

  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        ...(isSuperAdmin && selectedUserId ? { userId: selectedUserId } : {}),
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
  }, [selectedMonth, selectedYear, selectedUserId, isSuperAdmin]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleDownloadExcel = () => {
    if (!records || records.length === 0) {
      toast.warning('There are no records to export for this period.');
      return;
    }

    try {
      setIsExportingExcel(true);
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
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!records || records.length === 0) {
      toast.warning('There are no records to export for this period.');
      return;
    }

    try {
      setIsExportingPdf(true);
      exportMonthlyReportToPDF({
        records,
        month: selectedMonth,
        year: selectedYear,
        hospitalName: settings.hospitalName,
        location: settings.location,
      });
      toast.success('PDF document downloaded successfully');
    } catch (err) {
      toast.error('Failed to generate PDF file: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!records || records.length === 0) {
      toast.warning('There are no records to print for this period.');
      return;
    }
    printMonthlyReportPDF({
      records,
      month: selectedMonth,
      year: selectedYear,
      hospitalName: settings.hospitalName,
    });
  };

  const totalAmount = records.reduce((sum, r) => {
    const val = parseFloat(String(r.remark || '0').replace(/[^0-9.-]+/g, '')) || 0;
    return sum + val;
  }, 0);

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
          {/* Super Admin User Filter */}
          {isSuperAdmin && userList.length > 0 && (
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus-ring"
                title="Filter report by user account"
              >
                <option value="me">👤 My Records Only (Private)</option>
                <option value="all">🌐 All Accounts (Combined Report)</option>
                <optgroup label="Staff Accounts">
                  {userList.map((u) => (
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
            onChangeMonth={setSelectedMonth}
            onChangeYear={setSelectedYear}
          />

          <button
            type="button"
            disabled={isExportingExcel || records.length === 0}
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            title="Download formatted Microsoft Excel (.xlsx) file"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Download Excel
          </button>

          <button
            type="button"
            disabled={isExportingPdf || records.length === 0}
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            title="Download formatted PDF document"
          >
            <FileType className="w-4 h-4 text-rose-600" />
            Download PDF
          </button>

          <button
            type="button"
            disabled={records.length === 0}
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40"
            title="Print official hospital statement (Clean A4 without browser headers)"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            Print
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="space-y-4 print-card">
        {/* Organization & Month Header */}
        <ReportHeader
          hospitalName={settings.hospitalName}
          location={settings.location}
          month={selectedMonth}
          year={selectedYear}
          records={records}
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
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden print-card space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider print:bg-slate-200 print:text-black">
                    <th scope="col" className="py-3 px-4 w-14 text-center border-b border-slate-800 print:border-black">
                      SL
                    </th>
                    <th scope="col" className="py-3 px-4 w-32 border-b border-slate-800 print:border-black">
                      Patient ID
                    </th>
                    <th scope="col" className="py-3 px-4 min-w-[200px] border-b border-slate-800 print:border-black">
                      Patient Name
                    </th>
                    <th scope="col" className="py-3 px-4 w-32 border-b border-slate-800 print:border-black">
                      Date
                    </th>
                    <th scope="col" className="py-3 px-4 w-28 border-b border-slate-800 print:border-black">
                      TIME
                    </th>
                    <th scope="col" className="py-3 px-4 min-w-[160px] text-right border-b border-slate-800 print:border-black">
                      Remark (Tk)
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
                        <td className="py-2 px-4 text-center font-medium text-slate-500 print:text-black">
                          {formatSL(slNum)}
                        </td>

                        {/* ID */}
                        <td className="py-2 px-4 font-mono font-bold text-slate-900 print:text-black">
                          {String(rec.patientId || '')}
                        </td>

                        {/* Patient Name */}
                        <td className="py-2 px-4 font-semibold text-slate-800 uppercase print:text-black">
                          {rec.patientName}
                        </td>

                        {/* Date */}
                        <td className="py-2 px-4 text-slate-700 font-medium print:text-black">
                          {formatDateDotShort(rec.date)}
                        </td>

                        {/* Time */}
                        <td className="py-2 px-4 text-slate-700 font-mono font-medium print:text-black">
                          {formatHospitalTime(rec.time)}
                        </td>

                        {/* Remark */}
                        <td className="py-2 px-4 font-bold text-right text-slate-800 print:text-black">
                          {rec.remark || '100'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-xs border-t-2 border-slate-800 print:bg-slate-100 print:border-black">
                    <td colSpan={5} className="py-3 px-4 uppercase text-slate-900 print:text-black">
                      TOTAL ENTRIES: {records.length}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 print:text-black font-mono">
                      Tk. {totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Signature Blocks */}
            <div className="p-6 pt-12 flex items-center justify-between border-t border-slate-100 print:border-black">
              {/* Left Signature */}
              <div className="text-center space-y-1">
                <div className="w-48 border-t-2 border-slate-800 print:border-black mx-auto"></div>
                <div className="text-sm font-bold text-slate-900">Roni Sarder</div>
                <div className="text-xs text-slate-600">Medical Technology</div>
              </div>

              {/* Right Signature */}
              <div className="text-center space-y-1">
                <div className="w-48 border-t-2 border-slate-800 print:border-black mx-auto"></div>
                <div className="text-sm font-bold text-slate-900">Mizanur Rahman</div>
                <div className="text-xs text-slate-600">Incharge</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
