import React, { useState, useEffect } from 'react';
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { CollaborationUser } from '../../hooks/useCollaboration';
import { UserAvatar } from './CollaborationIndicator';
import { cn } from '../../utils/cn';

export interface Notification {
  id: string;
  type: 'review_request' | 'review_completed' | 'comment_added' | 'document_updated' | 'mention';
  title: string;
  message: string;
  actor: CollaborationUser;
  documentId?: string;
  documentTitle?: string;
  createdAt: Date;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface NotificationSystemProps {
  notifications: Notification[];
  currentUser: CollaborationUser;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onNavigate?: (url: string) => void;
  className?: string;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onNavigate,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'review_request':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-blue-500" />;
      case 'review_completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'comment_added':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-yellow-500" />;
      case 'document_updated':
        return <ClockIcon className="h-5 w-5 text-purple-500" />;
      case 'mention':
        return <UserIcon className="h-5 w-5 text-orange-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.actionUrl && onNavigate) {
      onNavigate(notification.actionUrl);
    }
    
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread ({unreadCount})</option>
                </select>
                
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter === 'unread' 
                      ? 'All caught up!' 
                      : 'You\'ll see notifications here when there\'s activity.'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                      onDelete={() => onDeleteNotification(notification.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {filteredNotifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    // Navigate to full notifications page
                    if (onNavigate) {
                      onNavigate('/notifications');
                    }
                    setIsOpen(false);
                  }}
                  className="w-full text-sm text-blue-600 hover:text-blue-800"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  onDelete,
}) => {
  const [showActions, setShowActions] = useState(false);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'review_request':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-blue-500" />;
      case 'review_completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'comment_added':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-yellow-500" />;
      case 'document_updated':
        return <ClockIcon className="h-5 w-5 text-purple-500" />;
      case 'mention':
        return <UserIcon className="h-5 w-5 text-orange-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  return (
    <div
      className={cn(
        'relative p-4 hover:bg-gray-50 cursor-pointer transition-colors',
        !notification.read && 'bg-blue-50'
      )}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {notification.title}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {notification.message}
              </p>
              
              {notification.documentTitle && (
                <p className="mt-1 text-xs text-gray-500">
                  Document: {notification.documentTitle}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {formatTimeAgo(notification.createdAt)}
              </span>
              
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          </div>

          {/* Actor */}
          <div className="mt-2 flex items-center space-x-2">
            <UserAvatar user={notification.actor} size="sm" showTooltip={false} />
            <span className="text-xs text-gray-500">
              {notification.actor.name}
            </span>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Delete notification"
            >
              <XCircleIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = (currentUser: CollaborationUser) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Mock notifications - in real app, this would come from API/WebSocket
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'review_request',
        title: 'Review Request',
        message: 'You have been requested to review the Requirements Document',
        actor: {
          id: 'user2',
          name: 'Alice Johnson',
          email: 'alice@example.com',
          color: '#FF6B6B',
          joinedAt: new Date(),
          lastActivity: new Date(),
        },
        documentId: 'doc1',
        documentTitle: 'Requirements Document',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        read: false,
        actionUrl: '/documents/doc1/review',
      },
      {
        id: '2',
        type: 'comment_added',
        title: 'New Comment',
        message: 'Added a comment on your design document',
        actor: {
          id: 'user3',
          name: 'Bob Smith',
          email: 'bob@example.com',
          color: '#4ECDC4',
          joinedAt: new Date(),
          lastActivity: new Date(),
        },
        documentId: 'doc2',
        documentTitle: 'Design Document',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        read: true,
        actionUrl: '/documents/doc2#comment-123',
      },
      {
        id: '3',
        type: 'review_completed',
        title: 'Review Completed',
        message: 'Your review request has been completed with approval',
        actor: {
          id: 'user4',
          name: 'Carol Davis',
          email: 'carol@example.com',
          color: '#45B7D1',
          joinedAt: new Date(),
          lastActivity: new Date(),
        },
        documentId: 'doc3',
        documentTitle: 'Task List',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        read: false,
        actionUrl: '/documents/doc3/review',
      },
    ];

    setNotifications(mockNotifications);
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random()}`,
      createdAt: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
  };

  return {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
  };
};

// Notification types for different events
export const createReviewRequestNotification = (
  requester: CollaborationUser,
  documentId: string,
  documentTitle: string
): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
  type: 'review_request',
  title: 'Review Request',
  message: `${requester.name} requested your review`,
  actor: requester,
  documentId,
  documentTitle,
  actionUrl: `/documents/${documentId}/review`,
});

export const createReviewCompletedNotification = (
  reviewer: CollaborationUser,
  documentId: string,
  documentTitle: string,
  decision: 'approved' | 'rejected' | 'changes_requested'
): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
  type: 'review_completed',
  title: 'Review Completed',
  message: `${reviewer.name} ${decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'requested changes to'} your document`,
  actor: reviewer,
  documentId,
  documentTitle,
  actionUrl: `/documents/${documentId}/review`,
  metadata: { decision },
});

export const createCommentNotification = (
  commenter: CollaborationUser,
  documentId: string,
  documentTitle: string,
  commentId: string
): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
  type: 'comment_added',
  title: 'New Comment',
  message: `${commenter.name} added a comment`,
  actor: commenter,
  documentId,
  documentTitle,
  actionUrl: `/documents/${documentId}#comment-${commentId}`,
});

export const createDocumentUpdateNotification = (
  updater: CollaborationUser,
  documentId: string,
  documentTitle: string
): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
  type: 'document_updated',
  title: 'Document Updated',
  message: `${updater.name} made changes to the document`,
  actor: updater,
  documentId,
  documentTitle,
  actionUrl: `/documents/${documentId}`,
});

export const createMentionNotification = (
  mentioner: CollaborationUser,
  documentId: string,
  documentTitle: string,
  commentId?: string
): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
  type: 'mention',
  title: 'You were mentioned',
  message: `${mentioner.name} mentioned you in ${commentId ? 'a comment' : 'the document'}`,
  actor: mentioner,
  documentId,
  documentTitle,
  actionUrl: commentId ? `/documents/${documentId}#comment-${commentId}` : `/documents/${documentId}`,
});