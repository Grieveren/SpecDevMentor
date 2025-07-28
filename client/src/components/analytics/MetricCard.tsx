import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  className?: string;
}

const colorClasses = {
  blue: {
    icon: 'text-blue-600 bg-blue-100',
    trend: 'text-blue-600',
  },
  green: {
    icon: 'text-green-600 bg-green-100',
    trend: 'text-green-600',
  },
  purple: {
    icon: 'text-purple-600 bg-purple-100',
    trend: 'text-purple-600',
  },
  orange: {
    icon: 'text-orange-600 bg-orange-100',
    trend: 'text-orange-600',
  },
  red: {
    icon: 'text-red-600 bg-red-100',
    trend: 'text-red-600',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  className = '',
}) => {
  const colors = colorClasses[color];

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center">
        <div className={`p-2 rounded-md ${colors.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {trend && (
              <div className={`ml-2 flex items-center text-sm ${colors.trend}`}>
                {trend === 'up' ? (
                  <ArrowUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4" />
                )}
                {trendValue && <span className="ml-1">{trendValue}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};