import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './context_auth_context';
import { registerServiceWorker, showNativeNotification } from '../services/service_web_push';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollInterval = useRef(null);
  const seenIds = useRef(new Set());
  const isInitialLoad = useRef(true);

  // Register service worker and auto-prompt for push notification permission on mount
  useEffect(() => {
    registerServiceWorker();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log(' Push notification permission auto-granted!');
          showNativeNotification({
            title: "St. John de Britto's Church ",
            body: "Real-time browser notifications auto-enabled! You will receive instant parish updates.",
            url: "/dashboard"
          });
        }
      }).catch(() => {});
    }
  }, []);

  const triggerNativePush = (notif) => {
    let title = "St. John de Britto's Church ";
    let body = notif.message || notif.title;
    let url = notif.actionUrl || '/dashboard';

    const cat = notif.category || notif.type;
    if (cat === 'events' || cat === 'event') {
      title = " St. John de Britto's Church — New Event";
      url = '/events';
    } else if (cat === 'announcements' || cat === 'announcement') {
      title = " Church Announcement";
      url = '/announcements';
    } else if (cat === 'donations' || cat === 'donation') {
      title = " Donation Campaign";
      url = '/donate';
    } else if (cat === 'prayer' || cat === 'prayers') {
      title = " Community Prayer Request";
      url = '/prayers';
    } else if (cat === 'permission') {
      title = " Permission Request Alert";
      url = '/dashboard';
    } else if (cat === 'system' || notif.title?.includes('Security')) {
      title = " Security Alert";
      url = '/dashboard/notifications';
    }

    showNativeNotification({
      title,
      body: `${notif.title}\n${body}`,
      url,
      tag: `notif-${notif._id}`
    });
  };

  const fetchUserNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      const list = res.data.notifications || [];
      setNotifications(list);
      const count = list.filter(n => !n.isRead).length;
      setUnreadCount(count);

      // Check for newly arrived unread notifications
      list.forEach(n => {
        if (!seenIds.current.has(n._id)) {
          seenIds.current.add(n._id);
          // If not initial page load and unread, pop up browser push notification!
          if (!isInitialLoad.current && !n.isRead) {
            triggerNativePush(n);
          }
        }
      });
    } catch { /* silent */ }
  }, []);

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications/admin');
      const list = res.data.notifications || [];
      setAdminNotifications(list);
      const count = list.filter(n => !n.isRead).length;
      setAdminUnreadCount(count);

      // Check for newly arrived unread admin notifications
      list.forEach(n => {
        if (!seenIds.current.has(n._id)) {
          seenIds.current.add(n._id);
          if (!isInitialLoad.current && !n.isRead) {
            triggerNativePush(n);
          }
        }
      });
    } catch { /* silent */ }
  }, []);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      await fetchUserNotifications();
      if (isAdmin) await fetchAdminNotifications();
    } finally {
      setLoading(false);
      if (isInitialLoad.current) isInitialLoad.current = false;
    }
  }, [isAuthenticated, isAdmin, fetchUserNotifications, fetchAdminNotifications]);

  // Initial load + 20-second polling interval for real-time notifications
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setAdminNotifications([]);
      setUnreadCount(0);
      setAdminUnreadCount(0);
      seenIds.current.clear();
      isInitialLoad.current = true;
      if (pollInterval.current) clearInterval(pollInterval.current);
      return;
    }

    refetch();
    pollInterval.current = setInterval(refetch, 20000);
    return () => clearInterval(pollInterval.current);
  }, [isAuthenticated, refetch]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setAdminNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setAdminUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const markAllAdminRead = async () => {
    try {
      await api.put('/notifications/admin/read-all');
      setAdminNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setAdminUnreadCount(0);
    } catch { /* silent */ }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      const notif = notifications.find(n => n._id === id) || adminNotifications.find(n => n._id === id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      setAdminNotifications(prev => prev.filter(n => n._id !== id));
      if (notif && !notif.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch { /* silent */ }
  };

  const deleteAll = async () => {
    try {
      await api.delete('/notifications/delete-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const deleteAllAdmin = async () => {
    try {
      await api.delete('/notifications/admin/clear-all');
      setAdminNotifications([]);
      setAdminUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      adminNotifications,
      unreadCount,
      adminUnreadCount,
      loading,
      markRead,
      markAllRead,
      markAllAdminRead,
      deleteNotification,
      deleteAll,
      deleteAllAdmin,
      refetch,
      triggerNativePush
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
