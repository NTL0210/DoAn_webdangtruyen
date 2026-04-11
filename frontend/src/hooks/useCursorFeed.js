import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchJsonWithCache,
  FRONTEND_CACHE_NAMESPACES,
  invalidateFrontendCache,
  subscribeToFrontendCacheInvalidation
} from '../services/frontendCache';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function appendQueryParams(searchParams, params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });
}

export function useCursorFeed({
  enabled = true,
  params = {},
  limit = 10,
  namespace = FRONTEND_CACHE_NAMESPACES.HOME_FEED,
  endpoint = '/api/content/feed',
  scope = 'shared',
  requestOptions,
  ttlMs = 30 * 1000,
  rootMargin = '900px 0px',
  refreshIntervalMs = 45000
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreNode, setLoadMoreNode] = useState(null);
  const requestIdRef = useRef(0);
  const lastSoftReloadAtRef = useRef(0);

  const loadMoreRef = useCallback((node) => {
    setLoadMoreNode(node);
  }, []);

  const baseQueryString = useMemo(() => {
    const searchParams = new URLSearchParams();
    appendQueryParams(searchParams, params);
    searchParams.set('limit', String(limit));
    return searchParams.toString();
  }, [limit, params]);

  const fetchPage = useCallback(async ({ cursor = null, append = false, forceFresh = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
    }

    try {
      const searchParams = new URLSearchParams(baseQueryString);
      if (cursor) {
        searchParams.set('cursor', cursor);
      }

      const cacheBustKey = forceFresh ? `&refresh=${Date.now()}` : '';

      const data = await fetchJsonWithCache({
        namespace,
        key: `${baseQueryString}&cursor=${encodeURIComponent(cursor || 'first')}${cacheBustKey}`,
        url: `${API_URL}${endpoint}?${searchParams.toString()}`,
        ttlMs,
        scope,
        options: requestOptions
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (!data.success) {
        setError(data.error?.message || 'Failed to load feed');
        return;
      }

      setItems((prev) => (append ? [...prev, ...(data.data || [])] : (data.data || [])));
      setNextCursor(data.pageInfo?.nextCursor || null);
      setHasMore(Boolean(data.pageInfo?.hasMore));
      setError('');
    } catch (loadError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(loadError.message || 'Failed to load feed');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [baseQueryString, endpoint, namespace, requestOptions, scope, ttlMs]);

  const reloadFeed = useCallback(({ forceFresh = false, preserveItems = true } = {}) => {
    if (!enabled) {
      return;
    }

    if (!preserveItems) {
      setItems([]);
    }

    setNextCursor(null);
    setHasMore(true);
    fetchPage({ append: false, cursor: null, forceFresh });
  }, [enabled, fetchPage]);

  const softReload = useCallback((forceFresh = false) => {
    const now = Date.now();

    if (loading || isLoadingMore) {
      return;
    }

    if (now - lastSoftReloadAtRef.current < 3000) {
      return;
    }

    lastSoftReloadAtRef.current = now;
    reloadFeed({ forceFresh, preserveItems: true });
  }, [isLoadingMore, loading, reloadFeed]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    fetchPage({ append: false, cursor: null });
  }, [baseQueryString, enabled, fetchPage]);

  useEffect(() => {
    if (!enabled || loading || isLoadingMore || !hasMore || !nextCursor) {
      return undefined;
    }

    const node = loadMoreNode;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fetchPage({ append: true, cursor: nextCursor });
        }
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [enabled, hasMore, isLoadingMore, loading, nextCursor, rootMargin, baseQueryString, loadMoreNode, fetchPage]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return subscribeToFrontendCacheInvalidation((namespaces) => {
      if (namespaces.includes(namespace)) {
        softReload(false);
      }
    });
  }, [enabled, namespace, softReload]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleWindowRefresh = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      softReload(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWindowRefresh();
      }
    };

    window.addEventListener('focus', handleWindowRefresh);
    window.addEventListener('online', handleWindowRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowRefresh);
      window.removeEventListener('online', handleWindowRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, softReload]);

  useEffect(() => {
    if (!enabled || !refreshIntervalMs) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        softReload(true);
      }
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [enabled, refreshIntervalMs, softReload]);

  return {
    items,
    loading,
    error,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    reload: () => reloadFeed({ forceFresh: true, preserveItems: false })
  };
}