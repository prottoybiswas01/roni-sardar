import React, { useState, useEffect } from 'react';
import { recordsApi } from '../../services/recordsApi';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { formatDateForInput } from '../../utils/dateUtils';
import { DuplicateWarning } from './DuplicateWarning';
import {
  Save,
  RotateCcw,
  Camera,
  Calendar,
  Clock,
  User,
  Hash,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const RecordForm = ({
  initialData = null,
  onSuccess,
  onOpenScanner,
  isModal = false,
  onCancel,
}) => {
  const toast = useToast();
  const { settings } = useSettings();

  const getInitialState = () => {
    if (initialData) {
      return {
        sl: initialData.sl || '',
        patientId: String(initialData.patientId || ''),
        patientName: initialData.patientName || '',
        date: formatDateForInput(initialData.date),
        time: initialData.time || '',
        remark: initialData.remark || '',
      };
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');

    return {
      sl: '',
      patientId: '',
      patientName: '',
      date: formatDateForInput(now),
      time: `${hours}:${mins}`,
      remark: '',
    };
  };

  const [formData, setFormData] = useState(getInitialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData(getInitialState());
    }
  }, [initialData]);

  // Debounced duplicate check when patientId or date changes
  useEffect(() => {
    if (!settings.checkDuplicates || !formData.patientId.trim() || !formData.date) {
      setDuplicateInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await recordsApi.checkDuplicate(
          formData.patientId,
          formData.date,
          initialData?._id
        );
        if (res.isDuplicate) {
          setDuplicateInfo(res);
        } else {
          setDuplicateInfo(null);
        }
      } catch (err) {
        // duplicate check fails silently without blocking user
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.patientId, formData.date, settings.checkDuplicates, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleReset = () => {
    setFormData(getInitialState());
    setDuplicateInfo(null);
    setErrors({});
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.patientId.trim()) {
      newErrors.patientId = 'Patient ID is required (must be text)';
    }
    if (!formData.patientName.trim()) {
      newErrors.patientName = 'Patient Name is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.time.trim()) {
      newErrors.time = 'Time is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        patientId: String(formData.patientId).trim(),
        patientName: formData.patientName.trim(),
        date: formData.date,
        time: formData.time.trim(),
        remark: formData.remark.trim(),
        ...(formData.sl ? { sl: Number(formData.sl) } : {}),
      };

      let res;
      if (initialData?._id) {
        res = await recordsApi.updateRecord(initialData._id, payload);
        toast.success('Record updated successfully');
      } else {
        res = await recordsApi.createRecord(payload);
        toast.success('Record saved successfully');
        handleReset();
      }

      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      console.error('Error saving record:', err);
      toast.error(err.message || 'Unable to save record. Please check your data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Duplicate Alert Banner */}
      <DuplicateWarning
        duplicateInfo={duplicateInfo}
        onDismiss={() => setDuplicateInfo(null)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* SL (Serial Number) - Optional manual override */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            SL (Serial Number)
          </label>
          <input
            type="number"
            name="sl"
            value={formData.sl}
            onChange={handleChange}
            placeholder="Auto-generated if blank"
            className="w-full rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-ring"
          />
          <p className="text-[10px] text-slate-400">Leave blank for automatic sequential monthly numbering</p>
        </div>

        {/* Patient ID - Strictly Text string preserving leading zeroes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-brand-600" />
              Patient ID <span className="text-rose-500">*</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">Preserves leading zeros</span>
          </label>
          <input
            type="text"
            name="patientId"
            value={formData.patientId}
            onChange={handleChange}
            placeholder="e.g. 001234 or 0250474"
            className={`w-full rounded-lg border font-mono px-3 py-2 text-sm text-slate-900 focus-ring ${
              errors.patientId ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'
            }`}
          />
          {errors.patientId && (
            <p className="text-[11px] text-rose-600 font-medium">{errors.patientId}</p>
          )}
        </div>

        {/* Patient Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-brand-600" />
            Patient Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="patientName"
            value={formData.patientName}
            onChange={handleChange}
            placeholder="Enter patient full name"
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus-ring ${
              errors.patientName ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'
            }`}
          />
          {errors.patientName && (
            <p className="text-[11px] text-rose-600 font-medium">{errors.patientName}</p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus-ring ${
              errors.date ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'
            }`}
          />
          {errors.date && (
            <p className="text-[11px] text-rose-600 font-medium">{errors.date}</p>
          )}
        </div>

        {/* Time */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            Time <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="time"
            value={formData.time}
            onChange={handleChange}
            placeholder="e.g. 14:30 or 02:30 PM"
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus-ring ${
              errors.time ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'
            }`}
          />
          {errors.time && (
            <p className="text-[11px] text-rose-600 font-medium">{errors.time}</p>
          )}
        </div>

        {/* Remark */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Remark / Notes
          </label>
          <input
            type="text"
            name="remark"
            value={formData.remark}
            onChange={handleChange}
            placeholder="Duty notes, ward, department, or procedure"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring"
          />
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
        <div className="flex items-center gap-2">
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 text-xs font-semibold transition-colors focus-ring"
            >
              <Camera className="w-4 h-4 text-sky-600" />
              Scan with Camera
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {isModal && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {initialData?._id ? 'Update Record' : 'Save Record'}
          </button>
        </div>
      </div>
    </form>
  );
};
