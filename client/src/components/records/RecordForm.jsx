import React, { useState, useEffect } from 'react';
import { recordsApi } from '../../services/recordsApi';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { formatDateForInput, getCurrentHospitalTime, formatHospitalTime } from '../../utils/dateUtils';
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
        time: formatHospitalTime(initialData.time) || '',
        remark: initialData.remark || '100',
      };
    }

    const now = new Date();

    return {
      sl: '',
      patientId: '',
      patientName: '',
      date: formatDateForInput(now),
      time: getCurrentHospitalTime(),
      remark: '100',
    };
  };

  const [formData, setFormData] = useState(getInitialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [errors, setErrors] = useState({});
  const [autoSlNumber, setAutoSlNumber] = useState(null);
  const [isAutoSlLoading, setIsAutoSlLoading] = useState(false);

  // Automatically fetch next sequential SL when form loads or date changes for new records
  const fetchNextSequentialSl = async (targetDate) => {
    if (initialData) return;
    try {
      setIsAutoSlLoading(true);
      const res = await recordsApi.getNextSl({ date: targetDate || formData.date });
      if (res.success && res.nextSl) {
        setAutoSlNumber(res.nextSl);
        setFormData((prev) => {
          // If sl is empty or matches previous auto-number, update it with new nextSl
          if (!prev.sl || prev.sl === autoSlNumber || prev._isAutoSl) {
            return { ...prev, sl: res.nextSl, _isAutoSl: true };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to fetch next SL:', err);
    } finally {
      setIsAutoSlLoading(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setFormData(getInitialState());
    } else {
      fetchNextSequentialSl(formData.date);
    }
  }, [initialData]);

  // When date changes on a new record, refresh the auto SL sequence
  useEffect(() => {
    if (!initialData && formData.date) {
      fetchNextSequentialSl(formData.date);
    }
  }, [formData.date, initialData]);

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'sl' ? { _isAutoSl: false } : {}),
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleReset = () => {
    const fresh = getInitialState();
    setFormData(fresh);
    setDuplicateInfo(null);
    setErrors({});
    if (!initialData) {
      fetchNextSequentialSl(fresh.date);
    }
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
        toast.success(`Record #${res.data?.sl || ''} saved successfully`);
        
        // Prepare next record with automatic +1 incremented serial number and clean input
        const savedSl = res.data?.sl || Number(formData.sl) || 1;
        const nextSequentialSl = savedSl + 1;
        setAutoSlNumber(nextSequentialSl);

        setFormData({
          sl: nextSequentialSl,
          patientId: '',
          patientName: '',
          date: formData.date, // keep same date for rapid batch entries
          time: getCurrentHospitalTime(),
          remark: '100',
          _isAutoSl: true,
        });
        setDuplicateInfo(null);
        setErrors({});
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
        {/* SL (Serial Number) - Automatic sequential numbering / Locked in Edit Mode */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-brand-600" />
              SL (Serial Number)
            </label>
            {initialData ? (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Fixed (Locked)
              </span>
            ) : autoSlNumber ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                Auto #{autoSlNumber}
              </span>
            ) : null}
          </div>
          <div className="relative">
            <input
              type="number"
              name="sl"
              value={formData.sl}
              onChange={handleChange}
              disabled={Boolean(initialData)}
              readOnly={Boolean(initialData)}
              placeholder={isAutoSlLoading ? 'Calculating SL...' : (autoSlNumber ? `Auto #${autoSlNumber}` : 'Auto-generated')}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold focus-ring ${
                initialData
                  ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                  : 'border-slate-300 bg-slate-50/90 text-slate-800'
              }`}
            />
            {!initialData && autoSlNumber && Number(formData.sl) !== Number(autoSlNumber) && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, sl: autoSlNumber, _isAutoSl: true }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-brand-50 hover:bg-brand-100 text-brand-700 font-medium px-2 py-0.5 rounded border border-brand-200 transition-colors"
                title="Reset to next sequential monthly SL"
              >
                Reset to Auto #{autoSlNumber}
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            {initialData
              ? 'Serial number cannot be modified in edit mode'
              : formData._isAutoSl !== false && autoSlNumber
              ? '✨ Next monthly sequential number auto-assigned'
              : 'Sequential monthly number (auto-increments on save)'}
          </p>
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
            placeholder="e.g. 001234 or 250474"
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
            placeholder="e.g. B/O TONNI or ISLAM"
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 uppercase focus-ring ${
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

        {/* Time with Clock Picker & AM/PM Controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              Time (12-Hour) <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, time: getCurrentHospitalTime() }));
                }}
                className="text-[10px] text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-1.5 py-0.5 rounded font-medium transition-colors"
                title="Set current 12-hour time"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => {
                    const cur = prev.time || '';
                    if (cur.includes('PM')) return { ...prev, time: cur.replace('PM', 'AM') };
                    if (cur.includes('AM')) return { ...prev, time: cur.replace('AM', 'PM') };
                    return { ...prev, time: cur + 'AM' };
                  });
                }}
                className="text-[10px] text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                title="Toggle AM / PM"
              >
                AM/PM
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              name="time"
              value={formData.time}
              onChange={handleChange}
              placeholder="e.g. 07.30PM or 12.35AM"
              className={`w-full rounded-lg border font-mono px-3 py-2 text-sm text-slate-900 focus-ring ${
                errors.time ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300'
              }`}
            />
            {/* Clock wheel trigger */}
            <div className="relative" title="Pick from Clock">
              <input
                type="time"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [hStr, mStr] = e.target.value.split(':');
                  let hNum = parseInt(hStr, 10);
                  const period = hNum >= 12 ? 'PM' : 'AM';
                  hNum = hNum % 12 || 12;
                  const formatted = `${String(hNum).padStart(2, '0')}.${mStr}${period}`;
                  setFormData((prev) => ({ ...prev, time: formatted }));
                }}
                className="w-9 h-9 p-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs"
              />
            </div>
          </div>
          {errors.time && (
            <p className="text-[11px] text-rose-600 font-medium">{errors.time}</p>
          )}
        </div>

        {/* Remark / Ranking - Fixed to 100 & Non-editable */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Remark
            </label>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Fixed (100)
            </span>
          </div>
          <input
            type="text"
            name="remark"
            value="100"
            readOnly
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm font-bold text-slate-700 cursor-not-allowed shadow-inner"
          />
          <p className="text-[10px] text-slate-500">Fixed hospital standard rating (100)</p>
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
