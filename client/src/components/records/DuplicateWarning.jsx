import React from 'react';
import { AlertCircle, Ban } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils';

export const DuplicateWarning = ({ duplicateInfo, onDismiss }) => {
  if (!duplicateInfo?.isDuplicate) return null;

  const rec = duplicateInfo.duplicateRecord;

  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50/95 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-3">
        <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-rose-900">
          <p className="font-bold text-sm text-rose-950 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            ডুপ্লিকেট পেশেন্ট আইডি সনাক্ত হয়েছে (Duplicate ID Blocked)
          </p>
          <p className="mt-1 leading-relaxed">
            পেশেন্ট আইডি <strong className="font-mono bg-rose-200/80 text-rose-950 px-1.5 py-0.5 rounded font-bold">{rec?.patientId}</strong> ({rec?.patientName}) দিয়ে এই মাসে ইতিমধ্যে <strong className="underline font-semibold">SL: {rec?.sl}</strong> নম্বরে একটি রেকর্ড এন্ট্রি রয়েছে (<span className="text-rose-800">{formatDateDisplay(rec?.date)}</span>, {rec?.time})।
          </p>
          <p className="mt-1.5 font-semibold text-rose-800">
            ⚠️ একই মাসে একই পেশেন্ট আইডি একাধিকবার এন্ট্রি করা অনুমোদিত নয়। অনুগ্রহ করে সঠিক আইডিটি যাচাই করুন।
          </p>
        </div>
      </div>
    </div>
  );
};

