import React from 'react';
import { FileQuestion, Plus } from 'lucide-react';

export const EmptyState = ({
  title = 'No records found',
  description = 'There are no records for the selected month and year.',
  icon: Icon = FileQuestion,
  actionText = 'Add Record',
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
        <Icon className="h-7 w-7 stroke-[1.75]" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-sm">{description}</p>
      {onAction && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            {actionText}
          </button>
        </div>
      )}
    </div>
  );
};
