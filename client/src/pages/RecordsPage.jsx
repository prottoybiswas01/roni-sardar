import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../services/recordsApi';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import { useToast } from '../context/ToastContext';
import { RecordTable } from '../components/records/RecordTable';
import { SearchFilterBar } from '../components/records/SearchFilterBar';
import { RecordForm } from '../components/records/RecordForm';
import { Modal } from '../components/common/Modal';
import { DeleteRecordModal } from '../components/records/DeleteRecordModal';
import { exportMonthlyReportToExcel } from '../services/excelService';
import { exportMonthlyReportToPDF } from '../services/pdfService';
import { PlusCircle, Camera, Download, FileSpreadsheet, FileType, Share2 } from 'lucide-react';
import { ShareReportModal } from '../components/reports/ShareReportModal';

export const RecordsPage = ({ onOpenScanner, onOpenAddPage }) => {
  const toast = useToast();
  const { isSuperAdmin, isPaused } = useAuth();
  const { settings, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useSettings();

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('me');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [userList, setUserList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load user list for super admin filtering
  useEffect(() => {
    if (isSuperAdmin) {
      authApi.getUsers().then((res) => {
        if (res.success && res.data) {
          setUserList(res.data);
        }
      }).catch((err) => console.error('Error fetching users for filter:', err));
    }
  }, [isSuperAdmin]);

  // Modals state
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fetchRecords = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        search: searchTerm,
        date: filterDate,
        ...(isSuperAdmin && selectedUserId ? { userId: selectedUserId } : {}),
        page,
        limit: 50,
      });

      if (res.success) {
        setRecords(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch records:', err);
      toast.error('Unable to fetch records from database: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, searchTerm, filterDate, selectedUserId, isSuperAdmin]);

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);


  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setSelectedUserId('me');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return;
    try {
      setIsDeleting(true);
      await recordsApi.deleteRecord(deletingRecord._id);
      toast.success('Record deleted successfully');
      setDeletingRecord(null);
      fetchRecords(pagination.page);
    } catch (err) {
      toast.error(err.message || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditingRecord(null);
    fetchRecords(pagination.page);
  };

  const handleExcelExport = async () => {
    try {
      setIsExportingExcel(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        limit: 1000,
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
      toast.error('Export failed: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePdfExport = async () => {
    try {
      setIsExportingPdf(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        limit: 1000,
      });

      if (!res.data || res.data.length === 0) {
        toast.warning('No records available for the selected month to export');
        return;
      }

      exportMonthlyReportToPDF({
        records: res.data,
        month: selectedMonth,
        year: selectedYear,
        hospitalName: settings.hospitalName,
        location: settings.location,
      });

      toast.success('PDF document downloaded successfully');
    } catch (err) {
      toast.error('PDF export failed: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-brand-600" />
            Over Duty / Patient Records
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Search, filter, edit, and organize daily patient logs for the selected period
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            title={isPaused ? 'অ্যাকাউন্ট স্থগিত রয়েছে' : undefined}
          >
            <Camera className="w-4 h-4 text-sky-600" />
            Scan
          </button>

          <button
            type="button"
            disabled={isExportingExcel || records.length === 0}
            onClick={handleExcelExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            title="Download formatted Excel (.xlsx) file"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Excel
          </button>

          <button
            type="button"
            disabled={isExportingPdf || records.length === 0}
            onClick={handlePdfExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            title="Download formatted PDF document"
          >
            <FileType className="w-4 h-4 text-rose-600" />
            PDF
          </button>

          <button
            type="button"
            disabled={records.length === 0}
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40"
            title="ইমেইলে রিপোর্ট পাঠান (দোকানদার / প্রিন্ট / বসের ঠিকানায়)"
          >
            <Share2 className="w-4 h-4" />
            Share / Email
          </button>

          <button
            type="button"
            disabled={isPaused}
            onClick={() => {
              if (isPaused) {
                toast.warning('আপনার অ্যাকাউন্টটি স্থগিত (Paused) থাকায় নতুন ডাটা এন্ট্রি করা যাবে না।');
                return;
              }
              onOpenAddPage();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-40"
            title={isPaused ? 'অ্যাকাউন্ট স্থগিত রয়েছে' : undefined}
          >
            <PlusCircle className="w-4 h-4" />
            Add Record
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        filterDate={filterDate}
        onDateChange={setFilterDate}
        onClearFilters={handleClearFilters}
        isSuperAdmin={isSuperAdmin}
        users={userList}
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
      />

      {/* Main Records Table */}
      <RecordTable
        records={records}
        isLoading={isLoading}
        onEdit={(rec) => setEditingRecord(rec)}
        onDelete={(rec) => setDeletingRecord(rec)}
        pagination={pagination}
        onPageChange={(page) => fetchRecords(page)}
        onAddNew={onOpenAddPage}
      />

      {/* Edit Record Modal */}
      {editingRecord && (
        <Modal
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Record — SL #${editingRecord.sl || ''}`}
          subtitle={`Patient ID: ${editingRecord.patientId}`}
          maxWidth="max-w-3xl"
        >
          <RecordForm
            initialData={editingRecord}
            isModal={true}
            onCancel={() => setEditingRecord(null)}
            onSuccess={handleEditSuccess}
          />
        </Modal>
      )}

      {/* Delete Record Confirmation Modal */}
      <DeleteRecordModal
        isOpen={Boolean(deletingRecord)}
        record={deletingRecord}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />

      {/* Share / Email Report Modal */}
      <ShareReportModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
      />
    </div>
  );
};
