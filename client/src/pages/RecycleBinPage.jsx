import React, { useState, useEffect, useCallback } from 'react';
import { recordsApi } from '../services/recordsApi';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/common/Modal';
import { formatDateDisplay } from '../utils/dateUtils';
import {
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  ShieldAlert,
  Calendar,
  User,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Info,
} from 'lucide-react';

export const RecycleBinPage = () => {
  const toast = useToast();
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { selectedMonth, selectedYear } = useSettings();

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(isSuperAdmin ? 'all' : 'me');
  const [userList, setUserList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [restoringRecord, setRestoringRecord] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [permanentDeletingRecord, setPermanentDeletingRecord] = useState(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  const [isEmptyingBin, setIsEmptyingBin] = useState(false);
  const [showEmptyBinModal, setShowEmptyBinModal] = useState(false);

  // Fetch users for Super Admin / Admin filters
  useEffect(() => {
    if (isSuperAdmin || isAdmin) {
      authApi
        .getUsers()
        .then((res) => {
          if (res.success && res.data) {
            setUserList(res.data);
          }
        })
        .catch((err) => console.error('Error fetching users for bin filter:', err));
    }
  }, [isSuperAdmin, isAdmin]);

  const fetchBinRecords = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        const params = {
          search: searchTerm,
          page,
          limit: 50,
        };

        if (isSuperAdmin || isAdmin) {
          if (selectedUserId) {
            params.userId = selectedUserId;
          }
        }

        const res = await recordsApi.getBinRecords(params);
        if (res.success) {
          setRecords(res.data || []);
          setPagination(res.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Failed to load bin records:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, selectedUserId, isSuperAdmin, isAdmin]
  );

  useEffect(() => {
    fetchBinRecords(1);
  }, [fetchBinRecords]);

  // Handle Restore
  const handleConfirmRestore = async () => {
    if (!restoringRecord) return;
    try {
      setIsRestoring(true);
      const res = await recordsApi.restoreRecord(restoringRecord._id);
      if (res.success) {
        toast.success(res.message || 'রেকর্ডটি সফলভাবে রিস্টোর করা হয়েছে!');
        setRestoringRecord(null);
        fetchBinRecords(pagination.page);
      }
    } catch (err) {
      console.error('Restore error:', err);
      toast.error('রিস্টোর ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Permanent Delete (Super Admin only)
  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeletingRecord) return;
    try {
      setIsPermanentDeleting(true);
      const res = await recordsApi.permanentDeleteRecord(permanentDeletingRecord._id);
      if (res.success) {
        toast.success(res.message || 'রেকর্ডটি ডাটাবেজ থেকে চিরতরে মুছে ফেলা হয়েছে!');
        setPermanentDeletingRecord(null);
        fetchBinRecords(pagination.page);
      }
    } catch (err) {
      console.error('Permanent delete error:', err);
      toast.error('মুছে ফেলা সম্ভব হয়নি: ' + err.message);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  // Handle Empty Bin (Super Admin only)
  const handleConfirmEmptyBin = async () => {
    try {
      setIsEmptyingBin(true);
      const res = await recordsApi.emptyBin();
      if (res.success) {
        toast.success(res.message || 'রিসাইকেল বিন সম্পূর্ণ খালি করা হয়েছে!');
        setShowEmptyBinModal(false);
        fetchBinRecords(1);
      }
    } catch (err) {
      console.error('Empty bin error:', err);
      toast.error('বিন খালি করা সম্ভব হয়নি: ' + err.message);
    } finally {
      setIsEmptyingBin(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Recycle Bin (রিসাইকেল বিন / ট্র্যাশ)
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {pagination.total} টি রেকর্ড
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              মুছে ফেলা রেকর্ডসমূহ এখানে সুরক্ষিত থাকে। রিপোর্ট বা এক্সেল ফাইলে এগুলো কখনোই অন্তর্ভুক্ত হয় না।
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchBinRecords(pagination.page)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {isSuperAdmin && records.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEmptyBinModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty Bin (সম্পূর্ণ বিন খালি করুন)
            </button>
          )}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 text-xs text-sky-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-sky-950">
            নিরাপত্তা সতর্কতা ও রিস্টোর সুবিধা:
          </p>
          <p className="text-sky-800 leading-relaxed">
            কোনো ডাটা ভুলবশত ডিলিট হলে চিন্তার কিছু নেই। এখান থেকে <strong className="text-sky-950">"রিস্টোর" (Restore)</strong> বাটনে ক্লিক করে সাথে সাথে মূল তালিকায় ফিরিয়ে নিতে পারবেন। শুধুমাত্র <strong className="text-sky-950">সুপার এডমিন</strong> ডাটাবেজ থেকে চিরতরে মুছে ফেলতে পারেন।
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Patient ID, Name..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
        </div>

        {/* User Scope Filter (Super Admin / Admin only) */}
        {(isSuperAdmin || isAdmin) && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600 shrink-0 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Staff:
            </span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">🌟 All Staff Members (সমস্ত রেকর্ড)</option>
              <option value="me">👤 My Deleted Records Only (আমার রেকর্ড)</option>
              {userList.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Deleted Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">রিসাইকেল বিন লোড হচ্ছে...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
              <Trash2 className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">রিসাইকেল বিন সম্পূর্ণ খালি</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              এই মুহূর্তে কোনো মুছে ফেলা রেকর্ড নেই। মুছে ফেলা সব ডাটা সাময়িকভাবে এখানে এসে জমা হবে।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">SL</th>
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Record Date & Time</th>
                  <th className="py-3 px-4">Remark (Tk.)</th>
                  {(isSuperAdmin || isAdmin) && <th className="py-3 px-4">Created By</th>}
                  <th className="py-3 px-4">Deleted When</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r, idx) => (
                  <tr key={r._id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">
                      {(pagination.page - 1) * pagination.limit + idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {String(r.patientId || '')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {r.patientName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDateDisplay(r.date)}</span>
                        <span className="text-slate-400">•</span>
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{r.time}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-slate-700 bg-slate-100 border border-slate-200/80">
                        {r.remark || '-'}
                      </span>
                    </td>
                    {(isSuperAdmin || isAdmin) && (
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-medium text-slate-800">
                          {r.createdBy?.name || 'Staff'}
                        </span>
                        {r.createdBy?.username && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            @{r.createdBy.username}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      <div className="text-[11px]">
                        {r.deletedAt ? new Date(r.deletedAt).toLocaleString('en-GB') : 'Unknown'}
                      </div>
                      {r.deletedBy?.name && (
                        <div className="text-[10px] text-slate-400">
                          by {r.deletedBy.name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Restore Button (Available to record owner & admins) */}
                        <button
                          type="button"
                          onClick={() => setRestoringRecord(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
                          title="রিস্টোর করে মূল তালিকায় ফেরত নিন"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore (রিস্টোর)</span>
                        </button>

                        {/* Permanent Delete Button (SUPER ADMIN ONLY) */}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setPermanentDeletingRecord(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs"
                            title="ডাটাবেজ থেকে চিরতরে মুছে ফেলুন (Super Admin Only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete (মুছুন)</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchBinRecords(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => fetchBinRecords(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoringRecord && (
        <Modal
          isOpen={Boolean(restoringRecord)}
          onClose={() => !isRestoring && setRestoringRecord(null)}
          title="Restore Patient Record"
          subtitle="এই রেকর্ডটি পুনরায় সক্রিয় তালিকায় ফিরিয়ে আনা হবে"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                নিশ্চিতকরণ:
              </div>
              <p>
                আপনি কি <strong>{restoringRecord.patientName}</strong> (ID:{' '}
                <code>{restoringRecord.patientId}</code>) এর রেকর্ডটি রিস্টোর করতে চান?
              </p>
              <p className="text-emerald-800">
                রিস্টোর করলে এটি নিয়মিত রেকর্ড তালিকায় এবং সংশ্লিষ্ট মাসের রিপোর্টে আবারও প্রদর্শিত হবে।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoringRecord(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              >
                {isRestoring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Confirm Restore (রিস্টোর করুন)
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Permanent Delete Modal (SUPER ADMIN ONLY) */}
      {permanentDeletingRecord && (
        <Modal
          isOpen={Boolean(permanentDeletingRecord)}
          onClose={() => !isPermanentDeleting && setPermanentDeletingRecord(null)}
          title="Permanent Delete Warning"
          subtitle="ডাটাবেজ থেকে চিরতরে মুছে ফেলা"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                সতর্কতা: এই কাজটি আর ফিরিয়ে আনা যাবে না!
              </div>
              <p>
                আপনি <strong>{permanentDeletingRecord.patientName}</strong> (ID:{' '}
                <code>{permanentDeletingRecord.patientId}</code>) এর রেকর্ডটি{' '}
                <strong className="text-rose-700">ডাটাবেজ থেকে চিরতরে মুছে ফেলতে চলেছেন</strong>।
              </p>
              <p className="text-rose-800">
                একবার স্থায়ীভাবে মুছে ফেললে এই ডাটা কোনোভাবেই রিকভার করা সম্ভব হবে না।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPermanentDeletingRecord(null)}
                disabled={isPermanentDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={isPermanentDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
              >
                {isPermanentDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting Permanently...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Permanent Delete (চিরতরে মুছুন)
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Empty Bin Confirmation Modal (SUPER ADMIN ONLY) */}
      {showEmptyBinModal && (
        <Modal
          isOpen={showEmptyBinModal}
          onClose={() => !isEmptyingBin && setShowEmptyBinModal(false)}
          title="Empty Entire Recycle Bin"
          subtitle="সমস্ত ট্র্যাশ ডাটা চিরতরে মুছে ফেলা"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                চরম সতর্কতা:
              </div>
              <p>
                আপনি রিসাইকেল বিনে থাকা <strong>সমস্ত ({pagination.total} টি)</strong> রেকর্ড ডাটাবেজ থেকে চিরতরে মুছে দিতে যাচ্ছেন।
              </p>
              <p className="text-rose-800">
                এই অপারেশনের পর কোনো ডাটাই আর ফেরত পাওয়া যাবে না। আপনি কি নিশ্চিত?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyBinModal(false)}
                disabled={isEmptyingBin}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEmptyBin}
                disabled={isEmptyingBin}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
              >
                {isEmptyingBin ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Emptying Bin...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Empty Bin (হ্যাঁ, খালি করুন)
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
