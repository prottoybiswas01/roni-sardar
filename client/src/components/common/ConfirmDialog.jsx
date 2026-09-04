import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed? This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md" showClose={!isLoading}>
      <div className="flex flex-col items-center text-center">
        <div
          className={`mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          {isDestructive ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
        </div>
        <div className="mt-3 text-center sm:mt-4">
          <h3 className="text-base font-semibold leading-6 text-slate-900">{title}</h3>
          <div className="mt-2">
            <p className="text-sm text-slate-500">{message}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:w-auto transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onConfirm}
          className={`inline-flex w-full justify-center items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm sm:w-auto transition-colors disabled:opacity-50 ${
            isDestructive
              ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
              : 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500'
          }`}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};
