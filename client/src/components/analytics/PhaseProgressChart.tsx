// @ts-nocheck
import React from 'react';
import { PhaseMetrics } from '../../services/analytics.service';

interface PhaseProgressChartProps {
  phaseMetrics: PhaseMetrics[];
  className?: string;
}

export const PhaseProgressChart: React.FC<PhaseProgressChartProps> = ({
  phaseMetrics,
  className = '',
}) => {
  const maxTime = Math.max(...phaseMetrics.map(p => p.averageTimeSpent));

  const getPhaseColor = (phase: string) => {
    const colors = {
      REQUIREMENTS: 'bg-blue-500',
      DESIGN: 'bg-green-500',
      TASKS: 'bg-yellow-500',
      IMPLEMENTATION: 'bg-purple-500',
    };
    return colors[phase as keyof typeof colors] || 'bg-gray-500';
  };

  const getCompletionColor = (rate: number) => {
    if (rate === 100) return 'text-green-600';
    if (rate > 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        {phaseMetrics.map((phase) => (
          <div key={phase.phase} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getPhaseColor(phase.phase)}`} />
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {phase.phase.toLowerCase()}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{formatTime(phase.averageTimeSpent)}</span>
                <span className={getCompletionColor(phase.completionRate)}>
                  {phase.completionRate.toFixed(0)}%
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getPhaseColor(phase.phase)}`}
                style={{ width: `${phase.completionRate}%` }}
              />
            </div>
            
            {/* Time bar (relative to max time) */}
            <div className="w-full bg-gray-100 rounded-full h-1">
              <div
                className="h-1 rounded-full bg-gray-400"
                style={{ width: `${(phase.averageTimeSpent / maxTime) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>Time spent (relative)</span>
        </div>
      </div>
    </div>
  );
};