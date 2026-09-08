import React, { useState, useEffect } from 'react';
import { recordsApi } from '../services/recordsApi';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatMonthYearHeader, formatDateDisplay, formatTimeDisplay } from '../utils/dateUtils';
import { formatSL } from '../utils/formatters';
import { exportMonthlyReportToExcel } from '../services/excelService';
import { CardSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import {
  FileSpreadsheet,
  PlusCircle,
  Camera,
  Download,
  Calendar,
  Users,
  Activity,
  ArrowUpRight,
  Clock,
  TrendingUp,
  FileText,
  Share2,
} from 'lucide-react';

export const Dashboard = ({ onNavigate, onOpenScanner, onOpenShare }) => {
  const toast = useToast();
  const { isPaused } = useAuth();
  const { settings, selectedMonth, selectedYear } = useSettings();

  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const res = await recordsApi.getDashboardStats(selectedMonth, selectedYear);
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedMonth, selectedYear]);

  const handleQuickExcelExport = async () => {
    try {
      setIsExporting(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        limit: 500,
      });

      if (!res.data || res.data.length === 0) {
        toast.warning('No records available for the selected month to export');
        return;
      }

      exportMonthlyReportToExcel({
        records: res.data,
        month: selectedMonth,
        year: selectedYear,
        hospitalName: settings.hospitalName,
        location: settings.location,
      });

      toast.success('Excel report downloaded successfully');
    } catch (err) {
      toast.error('Failed to export Excel report: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-xs font-semibold text-brand-300 mb-3">
            <Activity className="w-3.5 h-3.5" />
            Active Clinical Session
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
            Over Duty & Patient Record System
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Manage daily departmental patient logs, scan physical records with OCR, and generate professional monthly administrative reports.
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isPaused}
              onClick={() => {
                if (isPaused) {
                  toast.warning('আপনার অ্যাকাউন্টটি স্থগিত (Paused) থাকায় নতুন রেকর্ড এন্ট্রি করা যাবে না।');
                  return;
                }
                onNavigate('add-record');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-40"
              title={isPaused ? 'অ্যাকাউন্ট স্থগিত রয়েছে' : undefined}
            >
              <PlusCircle className="w-4 h-4" />
              Add Record
            </button>

            <button
              type="button"
              disabled={isPaused}
              onClick={() => {
                if (isPaused) {
                  toast.warning('আপনার অ্যাকাউন্টটি স্থগিত (Paused) থাকায় স্ক্যান করা যাবে না।');
                  return;
                }
                onOpenScanner();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all active:scale-95 disabled:opacity-40"
              title={isPaused ? 'অ্যাকাউন্ট স্থগিত রয়েছে' : undefined}
            >
              <Camera className="w-4 h-4 text-sky-400" />
              Scan with Camera
            </button>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all active:scale-95"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              Monthly Report
            </button>

            <button
              type="button"
              onClick={() => (onOpenShare ? onOpenShare() : onNavigate('reports'))}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 text-amber-300" />
              Share / Email (মেইল)
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-brand-500/10 to-transparent pointer-events-none"></div>
      </div>

      {/* Summary Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Selected Month Total */}
        {isLoading ? (
          <CardSkeleton />
        ) : (
          <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex flex-col justify-between hover:border-brand-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Selected Month
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats?.totalSelectedMonth ?? 0}
              </span>
              <p className="mt-1 text-[11px] text-brand-700 font-medium">
                {formatMonthYearHeader(selectedMonth, selectedYear)}
              </p>
            </div>
          </div>
        )}

        {/* Card 2: Today's Records */}
        {isLoading ? (
          <CardSkeleton />
        ) : (
          <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Today's Records
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats?.totalToday ?? 0}
              </span>
              <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                Logged in the last 24 hours
              </p>
            </div>
          </div>
        )}

        {/* Card 3: Unique Patients This Month */}
        {isLoading ? (
          <CardSkeleton />
        ) : (
          <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Unique Patients
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats?.uniquePatientsMonth ?? 0}
              </span>
              <p className="mt-1 text-[11px] text-purple-700 font-medium">
                Distinct IDs in current period
              </p>
            </div>
          </div>
        )}

        {/* Card 4: Total All-Time Records */}
        {isLoading ? (
          <CardSkeleton />
        ) : (
          <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-subtle flex flex-col justify-between hover:border-slate-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total All-Time
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats?.totalAllTime ?? 0}
              </span>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                Cumulative database archive
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Monthly Activity Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Recent Over Duty Activity
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest patient entries for {formatMonthYearHeader(selectedMonth, selectedYear)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isExporting || (stats?.totalSelectedMonth || 0) === 0}
              onClick={handleQuickExcelExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Download Excel
            </button>

            <button
              type="button"
              onClick={() => onNavigate('records')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 py-1.5 px-2"
            >
              View All Records
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Records List */}
        {!stats?.recentRecords || stats.recentRecords.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No records found"
              description={`There are no over duty records logged for ${formatMonthYearHeader(
                selectedMonth,
                selectedYear
              )}.`}
              actionText="Add First Record"
              onAction={() => onNavigate('add-record')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="py-3 px-4 w-14 text-center">SL</th>
                  <th className="py-3 px-4 w-28">Patient ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 w-24">Time</th>
                  <th className="py-3 px-4">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.recentRecords.map((rec, index) => (
                  <tr key={rec._id || index} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 text-center text-xs font-semibold text-slate-400">
                      {formatSL(rec.sl || index + 1)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-brand-700">
                      <span className="bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {String(rec.patientId || '')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{rec.patientName}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{formatDateDisplay(rec.date)}</td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-700">{formatTimeDisplay(rec.time)}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 max-w-xs truncate">{rec.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
