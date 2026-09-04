import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 5000),
    warning: (msg, dur) => addToast(msg, 'warning', dur || 4500),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Fixed Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          let bgClass = 'bg-slate-900 text-white border-slate-800';
          let icon = <Info className="w-5 h-5 text-sky-400 shrink-0" />;

          if (t.type === 'success') {
            bgClass = 'bg-emerald-900/95 text-emerald-50 border-emerald-700/60 shadow-emerald-950/20';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
          } else if (t.type === 'error') {
            bgClass = 'bg-rose-900/95 text-rose-50 border-rose-700/60 shadow-rose-950/20';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
          } else if (t.type === 'warning') {
            bgClass = 'bg-amber-900/95 text-amber-50 border-amber-700/60 shadow-amber-950/20';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${bgClass}`}
            >
              {icon}
              <div className="flex-1 text-sm font-medium leading-5 pt-0.5">{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-white/70 hover:text-white p-0.5 rounded transition-colors focus:outline-none"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
