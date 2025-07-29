import React from 'react';
import { QualityTrend } from '../../services/analytics.service';

interface QualityTrendChartProps {
  qualityTrend: QualityTrend[];
  className?: string;
}

export const QualityTrendChart: React.FC<QualityTrendChartProps> = ({
  qualityTrend,
  className = '',
}) => {
  if (qualityTrend.length === 0) {
    return (
      <div className={`flex items-center justify-center h-48 text-gray-500 ${className}`}>
        No quality trend data available
      </div>
    );
  }

  const maxScore = 100;
  const minScore = 0;
  const chartHeight = 200;
  const chartWidth = 400;

  // Group by phase for different lines
  const phaseData = qualityTrend.reduce((acc, item) => {
    if (!acc[item.phase]) {
      acc[item.phase] = [];
    }
    acc[item.phase].push(item);
    return acc;
  }, {} as Record<string, QualityTrend[]>);

  // Sort each phase data by date
  Object.keys(phaseData).forEach(phase => {
    phaseData[phase].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  const getPhaseColor = (phase: string) => {
    const colors = {
      REQUIREMENTS: '#3B82F6', // blue
      DESIGN: '#10B981', // green
      TASKS: '#F59E0B', // yellow
      IMPLEMENTATION: '#8B5CF6', // purple
    };
    return colors[phase as keyof typeof colors] || '#6B7280';
  };

  const createPath = (data: QualityTrend[]) => {
    if (data.length === 0) return '';

    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * chartWidth;
      const y = chartHeight - ((item.score - minScore) / (maxScore - minScore)) * chartHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getLatestScore = (phase: string) => {
    const _data = phaseData[phase];
    return data.length > 0 ? data[data.length - 1].score : 0;
  };

  return (
    <div className={className}>
      <div className="relative">
        {/* Chart */}
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="border border-gray-200 rounded"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((score) => (
            <g key={score}>
              <line
                x1="0"
                y1={chartHeight - ((score - minScore) / (maxScore - minScore)) * chartHeight}
                x2={chartWidth}
                y2={chartHeight - ((score - minScore) / (maxScore - minScore)) * chartHeight}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <text
                x="-5"
                y={chartHeight - ((score - minScore) / (maxScore - minScore)) * chartHeight + 4}
                fontSize="10"
                fill="#6B7280"
                textAnchor="end"
              >
                {score}
              </text>
            </g>
          ))}

          {/* Phase lines */}
          {Object.entries(phaseData).map(([phase, data]) => (
            <g key={phase}>
              <path
                d={createPath(data)}
                fill="none"
                stroke={getPhaseColor(phase)}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {data.map((item, index) => (
                <circle
                  key={index}
                  cx={(index / (data.length - 1)) * chartWidth}
                  cy={chartHeight - ((item.score - minScore) / (maxScore - minScore)) * chartHeight}
                  r="3"
                  fill={getPhaseColor(phase)}
                />
              ))}
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4">
          {Object.keys(phaseData).map((phase) => (
            <div key={phase} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getPhaseColor(phase) }}
              />
              <span className="text-sm text-gray-700 capitalize">
                {phase.toLowerCase()}
              </span>
              <span className="text-sm text-gray-500">
                ({getLatestScore(phase).toFixed(1)})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Latest Average:</span>
            <span className="ml-2 font-medium">
              {Object.values(phaseData)
                .map(data => data.length > 0 ? data[data.length - 1].score : 0)
                .reduce((sum, score) => sum + score, 0) / Object.keys(phaseData).length || 0}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Data Points:</span>
            <span className="ml-2 font-medium">{qualityTrend.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};