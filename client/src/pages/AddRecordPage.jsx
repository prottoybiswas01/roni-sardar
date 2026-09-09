import React from 'react';
import { RecordForm } from '../components/records/RecordForm';
import { PlusCircle, Camera, ArrowLeft, ShieldAlert } from 'lucide-react';

export const AddRecordPage = ({ onOpenScanner, onRecordSaved, onCancel }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Records
          </button>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <PlusCircle className="w-6 h-6 text-brand-600" />
            New Over Duty Record Entry
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Fill the details manually or scan physical patient cards/wristbands with OCR
          </p>
        </div>

        {/* OCR Action - Hidden on desktop, visible on mobile */}
        <button
          type="button"
          onClick={onOpenScanner}
          className="md:hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold shadow-subtle transition-all self-start sm:self-auto"
        >
          <Camera className="w-4 h-4 text-sky-600" />
          Scan Document with Camera
        </button>
      </div>

      {/* Main Entry Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-subtle">
        <RecordForm
          onSuccess={onRecordSaved}
          onOpenScanner={onOpenScanner}
        />
      </div>

      {/* Clinical Guidance Box */}
      <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-600 text-xs flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">Administrative Data Guidance</p>
          <p>
            Patient IDs are preserved as text to ensure leading zeroes (e.g., <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">001234</code>) are never dropped. Serial numbers are automatically ordered by month.
          </p>
        </div>
      </div>
    </div>
  );
};
