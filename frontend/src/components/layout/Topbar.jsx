import { Bell, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ThemeToggler } from '../ThemeToggler';
import { getCurrentUser, getToken, subscribeToCurrentUserChange } from '../../services/authService';
import { subscribeToNotificationChanges, subscribeToNotificationSocketState } from '../../services/notificationService';
import { getRoutePrefetchProps } from '../../services/routePrefetch';
import { toSafeInitial, toSafeInlineText } from '../../utils/safeText';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const titles = {
  '/': 'Home Feed',
  '/home': 'Home Feed',
  '/login': 'Login',
  '/register': 'Register',
  '/profile': 'My Profile',
  '/create-story': 'Create Story',
  '/create-artwork': 'Create Artwork',
  '/stories': 'Stories',
  '/artworks': 'Artworks',
  '/memberships': 'Membership Feed',
  '/search': 'Search',
  '/notifications': 'Notifications',
  '/admin': 'Admin Review',
};

export function Topbar() {
  const location = useLocation();
  const [user, setUser] = useState(() => getCurrentUser());
  const [unreadCount, setUnreadCount] = useState(0);
  const safeUsername = toSafeInlineText(user?.username, 'Unknown');

  const fetchNotificationSummary = async () => {
    if (!getToken()) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/notifications/summary`, {
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUnreadCount(Number(data.data?.unreadCount) || 0);
      }
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  useEffect(() => subscribeToCurrentUserChange(setUser), []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    fetchNotificationSummary();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const handleRefresh = () => {
      fetchNotificationSummary();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    const unsubscribeSocketState = subscribeToNotificationSocketState((payload) => {
      if (payload?.type === 'open') {
        handleRefresh();
      }
    });

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeSocketState();
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    return subscribeToNotificationChanges((payload) => {
      if (payload?.type === 'created') {
        setUnreadCount((prev) => prev + 1);
      }

      if (payload?.type === 'updated' && payload.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      if (payload?.type === 'deleted' && !payload.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });
  }, []);
  
  const title = location.pathname.startsWith('/story/')
    ? (location.pathname.endsWith('/edit') ? 'Edit Story' : 'Story Detail')
    : location.pathname.startsWith('/artwork/')
      ? (location.pathname.endsWith('/edit') ? 'Edit Artwork' : 'Artwork Detail')
      : location.pathname.startsWith('/membership/')
        ? 'Artist Membership'
      : titles[location.pathname] || 'The Index';

  return (
    <header className="panel mb-6 flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-brand-light">The Index</p>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
      </div>

      <div className="hidden flex-1 items-center justify-center lg:flex">
        <Link to="/search" {...getRoutePrefetchProps('/search')} className="surface-search flex w-full max-w-md items-center gap-3 px-4 py-3">
          <Search size={16} />
          <span className="text-sm">Search creators, original stories, and art...</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <Link to="/notifications" className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 text-slate-300 transition hover:bg-slate-800">
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        <ThemeToggler />
        {user ? (
          <Link to="/profile" {...getRoutePrefetchProps('/profile')} className="flex items-center gap-3 rounded-2xl border border-slate-700 px-3 py-2">
            {user.avatar ? (
              <img 
                src={`${API_URL}${user.avatar}`} 
                alt={safeUsername}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="user-avatar-fallback h-9 w-9 text-sm">
                {toSafeInitial(user?.username)}
              </div>
            )}
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-white">{safeUsername}</p>
              <p className="text-xs text-slate-400">@{safeUsername}</p>
            </div>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
