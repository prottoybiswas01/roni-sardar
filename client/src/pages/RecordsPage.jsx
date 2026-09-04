import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../services/recordsApi';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { RecordTable } from '../components/records/RecordTable';
import { SearchFilterBar } from '../components/records/SearchFilterBar';
import { RecordForm } from '../components/records/RecordForm';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { exportMonthlyReportToExcel } from '../services/excelService';
import { PlusCircle, Camera, Download, FileSpreadsheet } from 'lucide-react';

export const RecordsPage = ({ onOpenScanner, onOpenAddPage }) => {
  const toast = useToast();
  const { settings, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useSettings();

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchRecords = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      const res = await recordsApi.getRecords({
        month: selectedMonth,
        year: selectedYear,
        search: searchTerm,
        date: filterDate,
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
  }, [selectedMonth, selectedYear, searchTerm, filterDate, toast]);

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
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
      setIsExporting(true);
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
      setIsExporting(false);
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
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 text-xs font-semibold shadow-subtle transition-colors"
          >
            <Camera className="w-4 h-4 text-sky-600" />
            Scan with Camera
          </button>

          <button
            type="button"
            disabled={isExporting || records.length === 0}
            onClick={handleExcelExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download Excel
          </button>

          <button
            type="button"
            onClick={onOpenAddPage}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95"
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

      {/* Delete Record Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingRecord)}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Record"
        message={`Are you sure you want to delete the record for Patient ID "${deletingRecord?.patientId}" (${deletingRecord?.patientName})? This action cannot be undone.`}
        confirmText="Delete Record"
        isLoading={isDeleting}
      />
    </div>
  );
};
