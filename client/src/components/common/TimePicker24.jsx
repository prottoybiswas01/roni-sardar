import React, { useState, useRef, useEffect } from 'react';
import { Clock, Check, X, Sparkles } from 'lucide-react';
import { formatHospitalTime, formatHospitalTimeReport, getCurrentHospitalTime } from '../../utils/dateUtils';

// 24 Hours: '00' to '23'
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

// 60 Minutes: '00' to '59'
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Quick minute interval presets
const QUICK_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

// Common hospital shift presets
const SHIFT_PRESETS = [
  { label: 'Morning Shift', time: '08:00' },
  { label: 'Noon/Midday', time: '12:00' },
  { label: 'Evening Shift', time: '14:00' },
  { label: 'Night Shift', time: '20:00' },
  { label: 'Late Night', time: '23:00' },
];

/**
 * TimePicker24 - Pure 24-Hour International Time Picker
 * Displays 24 Hours (00 - 23) and Minutes (00 - 59) side-by-side.
 * Completely eliminates native browser AM/PM controls.
 */
export default function TimePicker24({
  value = '',
  onChange,
  error = null,
  disabled = false,
  className = '',
  id = 'time-picker-24',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isTypingMode, setIsTypingMode] = useState(false);
  const popoverRef = useRef(null);

  // Normalize current value to [HH, MM]
  const parsedTime = formatHospitalTime(value) || '';
  let [currHour = '12', currMin = '00'] = parsedTime.split(':');
  if (!HOURS_24.includes(currHour)) currHour = '12';
  if (!MINUTES.includes(currMin)) currMin = '00';

  // Synchronize custom input text
  useEffect(() => {
    setCustomInput(parsedTime || value || '');
  }, [value, parsedTime]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Hour change
  const handleHourChange = (newHour) => {
    const updated = `${newHour}:${currMin}`;
    onChange?.(updated);
  };

  // Handle Minute change
  const handleMinuteChange = (newMin) => {
    const updated = `${currHour}:${newMin}`;
    onChange?.(updated);
  };

  // Handle setting exact current time
  const handleSetNow = () => {
    const nowTime = getCurrentHospitalTime();
    onChange?.(nowTime);
  };

  // Commit text input
  const handleCustomInputBlur = () => {
    if (!customInput.trim()) return;
    const formatted = formatHospitalTime(customInput);
    if (formatted) {
      onChange?.(formatted);
      setCustomInput(formatted);
    }
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <div className="flex items-center gap-1.5">
        {/* Hour (00 - 23) Dropdown */}
        <div className="flex-1 relative">
          <select
            id={`${id}-hour`}
            aria-label="Hour (00-23)"
            value={currHour}
            disabled={disabled}
            onChange={(e) => handleHourChange(e.target.value)}
            className={`w-full rounded-lg border font-mono px-2 py-2 text-sm font-semibold text-slate-800 bg-white focus-ring cursor-pointer transition-colors ${
              error ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300 hover:border-slate-400'
            } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
            title="Select 24-Hour (00 to 23)"
          >
            {HOURS_24.map((h) => (
              <option key={h} value={h}>
                {h} hrs
              </option>
            ))}
          </select>
        </div>

        {/* Colon separator */}
        <span className="font-mono font-bold text-slate-500 text-base select-none px-0.5">
          :
        </span>

        {/* Minute (00 - 59) Dropdown */}
        <div className="flex-1 relative">
          <select
            id={`${id}-minute`}
            aria-label="Minute (00-59)"
            value={currMin}
            disabled={disabled}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className={`w-full rounded-lg border font-mono px-2 py-2 text-sm font-semibold text-slate-800 bg-white focus-ring cursor-pointer transition-colors ${
              error ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300 hover:border-slate-400'
            } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
            title="Select Minute (00 to 59)"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>

        {/* Clock Grid Popover Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition-all ${
            isOpen
              ? 'border-brand-600 bg-brand-50 text-brand-600 shadow-sm ring-2 ring-brand-500/20'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
          title="Open 24-Hour Clock Grid"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Floating 24-Hour International Time Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-xl bg-white border border-slate-200 shadow-xl p-3.5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header with 24-Hour Display & Now button */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                24-Hour Time & Hospital Format
              </div>
              <div className="font-mono text-lg font-extrabold text-brand-600 tracking-tight flex items-baseline gap-2">
                <span>{currHour}:{currMin}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {formatHospitalTimeReport(`${currHour}:${currMin}`)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSetNow}
                className="text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded-md transition-colors"
                title="Snap to Current Hospital Time"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 24-Hour Grid (00 to 23) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Hour (00 - 23)
              </span>
              <span className="text-[10px] text-slate-400">Military / 24h</span>
            </div>
            <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1">
              {HOURS_24.map((h) => {
                const isSelected = h === currHour;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourChange(h)}
                    className={`py-1 rounded text-xs font-mono font-semibold transition-colors ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minute Selector (Quick chips + dropdown) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Minute (00 - 59)
              </span>
              <span className="text-[10px] text-slate-400">Exact Minute</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {QUICK_MINUTES.map((m) => {
                const isSelected = m === currMin;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteChange(m)}
                    className={`py-1 rounded text-xs font-mono font-semibold transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    :{m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Shift Presets */}
          <div className="border-t border-slate-100 pt-2">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Hospital Duty Shifts
            </div>
            <div className="flex flex-wrap gap-1">
              {SHIFT_PRESETS.map((preset) => (
                <button
                  key={preset.time}
                  type="button"
                  onClick={() => onChange?.(preset.time)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-slate-200 text-slate-600 transition-colors"
                >
                  {preset.label} ({preset.time})
                </button>
              ))}
            </div>
          </div>

          {/* Footer - Done button */}
          <div className="border-t border-slate-100 pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
