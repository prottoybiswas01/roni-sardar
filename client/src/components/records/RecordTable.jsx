import React from 'react';
import { formatDateDotShort, formatHospitalTime } from '../../utils/dateUtils';
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
} from 'lucide-react';

export const RecordTable = ({
  records = [],
  isLoading = false,
  onEdit,
  onDelete,
  pagination = null,
  onPageChange,
  onAddNew,
}) => {
  const { isManager } = useAuth();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <TableSkeleton rows={6} cols={7} />
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
                <th scope="col" className="py-3 px-4 w-32">
                  Date
                </th>
                <th scope="col" className="py-3 px-4 w-28">
                  TIME
                </th>
                <th scope="col" className="py-3 px-4 min-w-[200px]">
                  Remark
                </th>
                <th scope="col" className="py-3 px-4 w-24 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {records.map((record, index) => {
                const slNumber = record.sl || index + 1;
                return (
                  <tr
                    key={record._id || index}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* SL */}
                    <td className="py-3 px-4 text-center text-xs font-semibold text-slate-500">
                      {formatSL(slNumber)}
                    </td>

                    {/* Patient ID - Strictly string preserving leading zeros */}
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-700">
                      <span className="bg-brand-50/80 px-2 py-1 rounded border border-brand-200/60 inline-block">
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
                      {formatHospitalTime(record.time)}
                    </td>

                    {/* Remark */}
                    <td className="py-3 px-4 text-xs font-bold text-slate-700">
                      {record.remark || '100'}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
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

                        {isManager && (
                          <button
                            type="button"
                            onClick={() => onDelete(record)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete record"
                            aria-label="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
          return (
            <div
              key={record._id || index}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle space-y-3"
            >
              {/* Header: SL, ID, Actions */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{slNumber}</span>
                  <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                    {String(record.patientId || '')}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(record)}
                    className="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100"
                    aria-label="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => onDelete(record)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                  <span className="font-mono font-medium">{formatHospitalTime(record.time)}</span>
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
