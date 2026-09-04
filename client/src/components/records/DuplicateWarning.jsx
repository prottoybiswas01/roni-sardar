import React from 'react';
import { AlertTriangle, UserCheck } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils';

export const DuplicateWarning = ({ duplicateInfo, onDismiss }) => {
  if (!duplicateInfo?.isDuplicate) return null;

  const rec = duplicateInfo.duplicateRecord;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-amber-900">
          <p className="font-semibold text-sm text-amber-950">
            Possible Duplicate Record Warning
          </p>
          <p className="mt-1">
            A record already exists for Patient ID <strong className="font-mono bg-amber-200/60 px-1 py-0.5 rounded">{rec?.patientId}</strong> ({rec?.patientName}) on <strong className="underline">{formatDateDisplay(rec?.date)}</strong> at {rec?.time}.
          </p>
          <p className="mt-1 text-amber-700">
            You can still proceed if this is an additional over-duty entry for the same patient.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-amber-700 hover:text-amber-900 text-xs font-semibold px-2 py-1 rounded bg-amber-200/50 hover:bg-amber-200"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
};
