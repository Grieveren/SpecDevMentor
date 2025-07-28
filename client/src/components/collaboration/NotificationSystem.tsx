import React, { useState, useEffect } from 'react';
import { BellIcon, XMarkIcon, CheckIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { cn } from '../../utils/cn';
import { notificationService, Notification, NotificationType } from '../../services/notification.service';
import { formatDistanceToNow } from 'date-fns';

interface NotificationSystemProps {
  className?: string;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ className }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await notificationService.getNotifications({ limit: 10 });
      setNotifications(response.notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'WORKFLOW_EVENT':
      case 'PHASE_TRANSITION':
        return '🔄';
      case 'COMMENT_ADDED':
      case 'COMMENT_RESOLVED':
        return '💬';
      case 'REVIEW_REQUESTED':
      case 'REVIEW_COMPLETED':
      case 'AI_REVIEW_READY':
        return '📝';
      case 'PROJECT_INVITATION':
      case 'TEAM_UPDATE':
        return '👥';
      case 'SYSTEM_ALERT':
        return '⚠️';
      case 'REMINDER':
        return '⏰';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'SYSTEM_ALERT':
        return 'text-red-600 bg-red-50';
      case 'AI_REVIEW_READY':
      case 'REVIEW_COMPLETED':
        return 'text-green-600 bg-green-50';
      case 'WORKFLOW_EVENT':
      case 'PHASE_TRANSITION':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Menu as="div" className="relative">
        <Menu.Button className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md">
          {unreadCount > 0 ? (
            <BellSolidIcon className="h-6 w-6" />
          ) : (
            <BellIcon className="h-6 w-6" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Menu.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 z-50 mt-2 w-96 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Notification Settings"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BellIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={loadNotifications}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                >
                  View all notifications
                </button>
              </div>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      {showSettings && (
        <NotificationSettings
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead }) => {
  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }

    // Navigate to the relevant page if actionUrl is provided
    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-colors',
        notification.isRead
          ? 'bg-white border-gray-200 hover:bg-gray-50'
          : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-3">
        <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm', 
          notification.isRead ? 'bg-gray-100' : 'bg-blue-100'
        )}>
          {notification.type && (
            <span>{notification.type === 'WORKFLOW_EVENT' ? '🔄' : 
                   notification.type === 'COMMENT_ADDED' ? '💬' : 
                   notification.type === 'REVIEW_COMPLETED' ? '📝' : '📢'}</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={cn('text-sm font-medium', 
              notification.isRead ? 'text-gray-900' : 'text-blue-900'
            )}>
              {notification.title}
            </p>
            {!notification.isRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
                className="flex-shrink-0 p-1 text-blue-600 hover:text-blue-800"
                title="Mark as read"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <p className={cn('text-sm mt-1', 
            notification.isRead ? 'text-gray-600' : 'text-blue-700'
          )}>
            {notification.message}
          </p>
          
          <p className="text-xs text-gray-500 mt-2">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
};

interface NotificationSettingsProps {
  onClose: () => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    workflowEvents: true,
    commentNotifications: true,
    reviewNotifications: true,
    teamUpdates: true,
    systemAlerts: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await notificationService.getSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await notificationService.updateSettings(settings);
      onClose();
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Notification Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Email Notifications</label>
            <input
              type="checkbox"
              checked={settings.emailEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, emailEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">In-App Notifications</label>
            <input
              type="checkbox"
              checked={settings.inAppEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, inAppEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Notification Types</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Workflow Events</label>
                <input
                  type="checkbox"
                  checked={settings.workflowEvents}
                  onChange={(e) => setSettings(prev => ({ ...prev, workflowEvents: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Comments</label>
                <input
                  type="checkbox"
                  checked={settings.commentNotifications}
                  onChange={(e) => setSettings(prev => ({ ...prev, commentNotifications: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Reviews</label>
                <input
                  type="checkbox"
                  checked={settings.reviewNotifications}
                  onChange={(e) => setSettings(prev => ({ ...prev, reviewNotifications: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Team Updates</label>
                <input
                  type="checkbox"
                  checked={settings.teamUpdates}
                  onChange={(e) => setSettings(prev => ({ ...prev, teamUpdates: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">System Alerts</label>
                <input
                  type="checkbox"
                  checked={settings.systemAlerts}
                  onChange={(e) => setSettings(prev => ({ ...prev, systemAlerts: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};