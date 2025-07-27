import React from 'react';
import { CollaborationUser } from '../../hooks/useCollaboration';
import { cn } from '../../utils/cn';

interface CollaborationIndicatorProps {
  collaborators: CollaborationUser[];
  currentUser?: CollaborationUser;
  maxVisible?: number;
  className?: string;
}

export const CollaborationIndicator: React.FC<CollaborationIndicatorProps> = ({
  collaborators,
  currentUser,
  maxVisible = 3,
  className,
}) => {
  // Filter out current user from collaborators list
  const otherUsers = collaborators.filter(user => user.id !== currentUser?.id);
  const visibleUsers = otherUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, otherUsers.length - maxVisible);

  if (otherUsers.length === 0) {
    return (
      <div className={cn('flex items-center space-x-2 text-sm text-gray-500', className)}>
        <div className="w-2 h-2 rounded-full bg-gray-300" />
        <span>Working alone</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      <div className="flex items-center space-x-1">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm text-gray-600">
          {otherUsers.length === 1 
            ? '1 person editing' 
            : `${otherUsers.length} people editing`
          }
        </span>
      </div>

      <div className="flex -space-x-2">
        {visibleUsers.map(user => (
          <UserAvatar key={user.id} user={user} />
        ))}

        {hiddenCount > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-medium text-white shadow-sm">
            +{hiddenCount}
          </div>
        )}
      </div>
    </div>
  );
};

interface UserAvatarProps {
  user: CollaborationUser;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  showTooltip = true,
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  const avatar = (
    <div
      className={cn(
        'rounded-full border-2 border-white flex items-center justify-center font-medium text-white shadow-sm',
        sizeClasses[size]
      )}
      style={{ backgroundColor: user.color }}
    >
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        user.name.charAt(0).toUpperCase()
      )}
    </div>
  );

  if (!showTooltip) {
    return avatar;
  }

  return (
    <div className="relative group">
      {avatar}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {user.name}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
};

interface CollaborationStatusProps {
  isConnected: boolean;
  isJoining: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  isConnected,
  isJoining,
  error,
  onRetry,
  className,
}) => {
  if (error) {
    return (
      <div className={cn('flex items-center space-x-2 text-sm text-red-600', className)}>
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span>Connection failed</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className={cn('flex items-center space-x-2 text-sm text-yellow-600', className)}>
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span>Joining collaboration...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={cn('flex items-center space-x-2 text-sm text-gray-500', className)}>
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span>Offline</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-2 text-sm text-green-600', className)}>
      <div className="w-2 h-2 rounded-full bg-green-500" />
      <span>Connected</span>
    </div>
  );
};