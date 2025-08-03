// @ts-nocheck
import { CalendarIcon } from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import { TimeRange } from '../../services/analytics.service';

interface TimeRangeSelectorProps {
  value?: TimeRange;
  onChange: (timeRange: TimeRange | undefined) => void;
  className?: string;
  children?: React.ReactNode;
}

const presetRanges = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 6 months', value: 180 },
  { label: 'Last year', value: 365 },
];

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePresetSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    onChange({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setIsOpen(false);
  };

  const handleCustomRange = () => {
    if (customStart && customEnd) {
      onChange({
        start: new Date(customStart).toISOString(),
        end: new Date(customEnd).toISOString(),
      });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange(undefined);
    setCustomStart('');
    setCustomEnd('');
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (!value) return 'All time';

    const start = new Date(value.start);
    const end = new Date(value.end);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const preset = presetRanges.find(p => p.value === diffDays);
    if (preset) return preset.label;

    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <CalendarIcon className="h-4 w-4 mr-2" />
        {getDisplayText()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Select Time Range</h3>

            {/* Preset ranges */}
            <div className="space-y-2 mb-4">
              {presetRanges.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Custom Range</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={handleClear}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
                <button
                  onClick={handleCustomRange}
                  disabled={!customStart || !customEnd}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
};
