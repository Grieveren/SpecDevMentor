import React from 'react';
import { cn } from '../../utils/cn';

export interface ScoreIndicatorProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ScoreIndicator: React.FC<ScoreIndicatorProps> = ({
  score,
  size = 'md',
  showLabel = true,
  className,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-green-500 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Poor';
    return 'Critical';
  };

  const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1';
      case 'lg':
        return 'text-base px-4 py-2';
      default:
        return 'text-sm px-3 py-1.5';
    }
  };

  const normalizedScore = Math.max(0, Math.min(100, score));

  return (
    <div className={cn('inline-flex items-center space-x-2', className)}>
      {/* Circular Progress Indicator */}
      <div className="relative">
        <svg
          className={cn(
            'transform -rotate-90',
            size === 'sm' && 'w-6 h-6',
            size === 'md' && 'w-8 h-8',
            size === 'lg' && 'w-10 h-10'
          )}
          viewBox="0 0 36 36"
        >
          {/* Background circle */}
          <path
            className="text-gray-200"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Progress circle */}
          <path
            className={getScoreColor(normalizedScore).split(' ')[0]}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${normalizedScore}, 100`}
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        
        {/* Score text in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            'font-semibold',
            getScoreColor(normalizedScore).split(' ')[0],
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}>
            {Math.round(normalizedScore)}
          </span>
        </div>
      </div>

      {/* Score badge and label */}
      {showLabel && (
        <div className="flex items-center space-x-1">
          <span className={cn(
            'inline-flex items-center rounded-full font-medium',
            getScoreColor(normalizedScore),
            getSizeClasses(size)
          )}>
            {Math.round(normalizedScore)}%
          </span>
          
          <span className={cn(
            'text-gray-600',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}>
            {getScoreLabel(normalizedScore)}
          </span>
        </div>
      )}
    </div>
  );
};