import React from 'react';
import { formatDateDotShort, formatHospitalTimeReport } from '../../utils/dateUtils';
import { formatSL } from '../../utils/formatters';
import { TableSkeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  Edit3,
  Trash2,
  Calendar,
  Clock,
  User,
  Hash,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
} from 'lucide-react';

export const RecordTable = ({
  records = [],
  isLoading = false,
  onEdit,
  onDelete,
  onToggleVerify,
  pagination = null,
  onPageChange,
  onAddNew,
}) => {
  const { user } = useAuth();

  const isRecordOwner = (record) => {
    if (!user) return false;
    const currentUserId = String(user._id || user.id || '');
    if (!currentUserId) return false;
    if (!record.createdBy) return true;
    const creatorId = typeof record.createdBy === 'object'
      ? String(record.createdBy._id || record.createdBy.id || '')
      : String(record.createdBy);
    return creatorId === currentUserId;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <TableSkeleton rows={6} cols={8} />
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <EmptyState
        title="No records found"
        description="There are no over duty records for the selected filters."
        onAction={onAddNew}
        actionText="Add New Record"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Desktop Table View (Hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th scope="col" className="py-3 px-4 w-16 text-center">
                  SL
                </th>
                <th scope="col" className="py-3 px-4 w-32">
                  ID
                </th>
                <th scope="col" className="py-3 px-4 min-w-[180px]">
                  Patient
                </th>
                <th scope="col" className="py-3 px-4 w-28">
                  Date
                </th>
                <th scope="col" className="py-3 px-4 w-28">
                  TIME
                </th>
                <th scope="col" className="py-3 px-4 min-w-[140px]">
                  Remark
                </th>
                <th scope="col" className="py-3 px-4 w-36 text-center">
                  Re-Check / যাচাই
                </th>
                <th scope="col" className="py-3 px-4 w-24 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {records.map((record, index) => {
                const slNumber = record.sl || index + 1;
                const canModify = isRecordOwner(record);
                const isConfirmed = Boolean(record.isVerified);

                return (
                  <tr
                    key={record._id || index}
                    className={`transition-colors group ${
                      isConfirmed
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500'
                        : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {/* SL */}
                    <td className="py-3 px-4 text-center text-xs font-semibold text-slate-500">
                      {formatSL(slNumber)}
                    </td>

                    {/* Patient ID - Strictly string preserving leading zeros */}
                    <td className="py-3 px-4 font-mono text-xs font-semibold">
                      <span
                        className={`px-2 py-1 rounded border inline-flex items-center gap-1 ${
                          isConfirmed
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-brand-50/80 text-brand-700 border-brand-200/60'
                        }`}
                      >
                        {isConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {String(record.patientId || '')}
                      </span>
                    </td>

                    {/* Patient Name */}
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {record.patientName}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {formatDateDotShort(record.date)}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 text-xs font-mono font-medium text-slate-800">
                      {formatHospitalTimeReport(record.time)}
                    </td>

                    {/* Remark */}
                    <td className="py-3 px-4 text-xs font-bold text-slate-700">
                      {record.remark || '100'}
                    </td>

                    {/* Re-Check / Confirmation Status Button */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {onToggleVerify ? (
                        <button
                          type="button"
                          onClick={() => onToggleVerify(record)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm ${
                            isConfirmed
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-1 ring-emerald-600'
                              : 'border border-slate-300 bg-white hover:bg-emerald-50 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 group/btn'
                          }`}
                          title={
                            isConfirmed
                              ? 'রেকর্ডটি ১০০% কনফার্ম ও সঠিক (সবুজ)। পুনরায় ক্লিক করলে আন-কনফার্ম হবে।'
                              : 'ক্লিক করে এই রেকর্ডটি ১০০% কনফার্ম ও সবুজ চিহ্নিত করুন'
                          }
                        >
                          {isConfirmed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>✓ কনফার্মড</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-emerald-600" />
                              <span>কনফার্ম করুন</span>
                            </>
                          )}
                        </button>
                      ) : isConfirmed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>কনফার্মড</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">অযাচাইকৃত</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {canModify ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(record)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit record"
                            aria-label="Edit record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDelete(record)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="রেকর্ডটি ভুল হলে মুছে ফেলুন (Delete)"
                            aria-label="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="inline-block text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                          title={`Created by: ${record.createdBy?.name || record.createdBy?.username || 'Staff'} (View Only)`}
                        >
                          View only
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Mobile Responsive Card View (Visible on small screens) */}
      <div className="md:hidden space-y-3">
        {records.map((record, index) => {
          const slNumber = record.sl || index + 1;
          const canModify = isRecordOwner(record);
          const isConfirmed = Boolean(record.isVerified);

          return (
            <div
              key={record._id || index}
              className={`p-4 rounded-xl border shadow-subtle space-y-3 transition-colors ${
                isConfirmed
                  ? 'bg-emerald-50/40 border-emerald-300 border-l-4 border-l-emerald-500'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Header: SL, ID, Actions & Verify */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{slNumber}</span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                      isConfirmed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-brand-50 text-brand-700 border-brand-200'
                    }`}
                  >
                    {isConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    {String(record.patientId || '')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {onToggleVerify && (
                    <button
                      type="button"
                      onClick={() => onToggleVerify(record)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        isConfirmed
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-emerald-50'
                      }`}
                      title={isConfirmed ? 'কনফার্মড (সবুজ)' : 'কনফার্ম করুন'}
                    >
                      {isConfirmed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>কনফার্মড</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>কনফার্ম</span>
                        </>
                      )}
                    </button>
                  )}

                  {canModify && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onEdit(record)}
                        className="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100"
                        aria-label="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(record)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Name */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="font-semibold text-sm text-slate-900">{record.patientName}</span>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">{formatDateDotShort(record.date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono font-medium">{formatHospitalTimeReport(record.time)}</span>
                </div>
              </div>

              {/* Remark */}
              <div className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-700 flex items-center justify-between">
                <span className="text-slate-400">Remark:</span>
                <span className="font-bold text-slate-800">{record.remark || '100'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200/80 shadow-subtle text-xs text-slate-600 no-print">
          <div>
            Showing <span className="font-semibold">{records.length}</span> of{' '}
            <span className="font-semibold">{pagination.total}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-medium text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
