import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { sanitizeAndExtractPatientId } from '../../services/ocrService';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Hash,
  FileText,
  ArrowRight,
} from 'lucide-react';

export const OCRReviewModal = ({
  isOpen,
  onClose,
  ocrData,
  onApply,
}) => {
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    date: '',
    time: '',
    remark: '',
  });

  useEffect(() => {
    if (ocrData?.fields) {
      setFormData({
        patientId: ocrData.fields.patientId || '',
        patientName: ocrData.fields.patientName || '',
        date: ocrData.fields.date || '',
        time: ocrData.fields.time || '',
        remark: ocrData.fields.remark || '',
      });
    }
  }, [ocrData]);

  if (!isOpen || !ocrData) return null;

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'patientId') {
      if (value.includes('-') || value.replace(/\D/g, '').length >= 10) {
        value = sanitizeAndExtractPatientId(value);
      } else {
        value = value.replace(/\D/g, '');
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply(formData);
    onClose();
  };

  const getConfidenceBadge = (confidence) => {
    switch (confidence) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> High Confidence
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Medium Confidence
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Low Confidence - Verify
          </span>
        );
    }
  };

  const hasLowConfidence = Object.values(ocrData.confidence || {}).some(
    (c) => c === 'Low' || (typeof c === 'number' && c < 60)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Review Extracted Record Data</span>
          {ocrData.engine && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              {ocrData.engine}
            </span>
          )}
        </div>
      }
      subtitle="Verify and correct the extracted information before populating your record"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Low Confidence or Verification Warning */}
        {hasLowConfidence && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification Recommended</p>
              <p className="mt-0.5 text-amber-700">
                Some fields had lower OCR recognition certainty. Please double-check the Patient ID and Name below.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Patient ID */}
          <div className="space-y-1.5 sm:col-span-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-brand-600" />
                Patient ID (Numbers Only)
              </label>
              {getConfidenceBadge(ocrData.confidence?.patientId)}
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="patientId"
              value={formData.patientId}
              onChange={handleChange}
              placeholder="e.g. 001234 or 250474"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus-ring"
              required
            />
          </div>

          {/* Patient Name */}
          <div className="space-y-1.5 sm:col-span-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-600" />
                Patient Name
              </label>
              {getConfidenceBadge(ocrData.confidence?.patientName)}
            </div>
            <input
              type="text"
              name="patientName"
              value={formData.patientName}
              onChange={handleChange}
              placeholder="Patient full name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring"
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5 sm:col-span-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Date
              </label>
              {getConfidenceBadge(ocrData.confidence?.date)}
            </div>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring"
              required
            />
          </div>

          {/* Time */}
          <div className="space-y-1.5 sm:col-span-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                Time
              </label>
              {getConfidenceBadge(ocrData.confidence?.time)}
            </div>
            <input
              type="text"
              name="time"
              value={formData.time}
              onChange={handleChange}
              placeholder="e.g. 14:30 or 02:30 PM"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring"
              required
            />
          </div>

          {/* Remark */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Remark / Clinical Duty Note
            </label>
            <input
              type="text"
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              placeholder="e.g. Emergency over-duty observation, Ward 4"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-ring"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Discard
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Apply to Record Form
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  );
};
