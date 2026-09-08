import React from 'react';
import { Modal } from '../common/Modal';
import { formatDateDotShort, formatHospitalTime } from '../../utils/dateUtils';
import { formatSL } from '../../utils/formatters';
import {
  AlertTriangle,
  Trash2,
  Loader2,
  User,
  Calendar,
  Clock,
  DollarSign,
  Hash,
  ShieldAlert,
} from 'lucide-react';

export const DeleteRecordModal = ({
  isOpen,
  record,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  if (!record) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      showClose={!isLoading}
    >
      <div className="space-y-4">
        {/* Warning Icon & Title Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-sm">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              রেকর্ড মুছে ফেলার অনুমতি (Confirm Delete)
            </h3>
            <p className="text-xs text-slate-500">
              আপনি কি নিশ্চিতভাবে এই রোগীর রেকর্ডটি মুছে ফেলতে চান?
            </p>
          </div>
        </div>

        {/* Detailed Patient Record Card */}
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">SL:</span>
              <span className="text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                #{formatSL(record.sl || 1)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Patient ID:</span>
              <span className="font-mono text-xs font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-300">
                {String(record.patientId || '')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            {/* Patient Name */}
            <div className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-rose-100/60">
              <User className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="text-slate-500">রোগীর নাম:</span>
              <span className="font-bold text-slate-900 truncate">
                {record.patientName || 'PATIENT'}
              </span>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-rose-100/60">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-semibold text-slate-800">
                  {formatDateDotShort(record.date)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-rose-100/60">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono font-semibold text-slate-800">
                  {formatHospitalTime(record.time)}
                </span>
              </div>
            </div>

            {/* Remark / Amount */}
            <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-rose-100/60">
              <span className="text-slate-500 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Remark (ফি/টাকা):
              </span>
              <span className="font-bold text-emerald-700 font-mono">
                Tk. {record.remark || '100'}
              </span>
            </div>
          </div>
        </div>

        {/* Warning Note */}
        <p className="text-[11.5px] text-rose-600 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <span>
            <strong>সতর্কতা:</strong> কনফার্ম বাটনে চাপ দিলে রেকর্ডটি ডেটাবেস ও সকল এক্সেল/পিডিএফ হিসাব থেকে স্থায়ীভাবে মুছে যাবে।
          </span>
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="inline-flex w-full justify-center items-center rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:w-auto transition-colors disabled:opacity-50"
          >
            না, বাতিল করুন (Cancel)
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                মুছে ফেলা হচ্ছে...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                হ্যাঁ, মুছে ফেলুন (Confirm Delete)
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
