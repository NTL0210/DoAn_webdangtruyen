import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCurrentUser, getToken, subscribeToCurrentUserChange } from '../../services/authService';
import { subscribeToCreatorPresentationRefresh } from '../../services/creatorPresentationEvents';
import { fetchJsonWithCache, FRONTEND_CACHE_NAMESPACES, subscribeToFrontendCacheInvalidation } from '../../services/frontendCache';
import { getRoutePrefetchProps } from '../../services/routePrefetch';
import { normalizeTag } from '../../utils/hashtags';
import { fetchFavoriteTags, fetchRecommendedTags, toggleFavoriteTag } from '../../services/tagPreferenceService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function RightPanel() {
  const [tags, setTags] = useState([]);
  const [creators, setCreators] = useState([]);
  const [favoriteTags, setFavoriteTags] = useState([]);
  const [recommendedTags, setRecommendedTags] = useState([]);
  const [favoriteTagBusy, setFavoriteTagBusy] = useState('');
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const location = useLocation();
  const activeTag = normalizeTag(new URLSearchParams(location.search).get('tag'));

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  };

  useEffect(() => {
    fetchTrendingTags();
    fetchPopularCreators();
    loadPersonalizedTags();

    const unsubscribeCacheInvalidation = subscribeToFrontendCacheInvalidation((namespaces) => {
      if (namespaces.includes(FRONTEND_CACHE_NAMESPACES.TAG_DIRECTORY)) {
        fetchTrendingTags();
      }

      if (namespaces.includes(FRONTEND_CACHE_NAMESPACES.TRENDING)) {
        fetchPopularCreators({ forceFresh: true });
      }

      if (
        namespaces.includes(FRONTEND_CACHE_NAMESPACES.USER_PREFERENCES) ||
        namespaces.includes(FRONTEND_CACHE_NAMESPACES.TAG_RECOMMENDATIONS)
      ) {
        loadPersonalizedTags({ forceFresh: true });
      }
    });

    const unsubscribeCreatorPresentation = subscribeToCreatorPresentationRefresh((user) => {
      const userId = String(user?._id || user?.id || '');

      if (userId) {
        setCreators((prev) => prev.map((creator) => (
          String(creator.id) === userId
            ? {
                ...creator,
                username: user.username || creator.username,
                avatar: user.avatar || null
              }
            : creator
        )));
      }

      fetchPopularCreators({ forceFresh: true });
    });

    return () => {
      unsubscribeCacheInvalidation();
      unsubscribeCreatorPresentation();
    };
  }, []);

  useEffect(() => subscribeToCurrentUserChange(setCurrentUser), []);

  useEffect(() => {
    loadPersonalizedTags({ forceFresh: true });
  }, [currentUser?._id, currentUser?.id]);

  const fetchTrendingTags = async () => {
    try {
      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.TAG_DIRECTORY,
        key: 'right-rail:trending-tags:limit=6',
        url: `${API_URL}/api/content/tags/trending?limit=6`,
        ttlMs: 90 * 1000
      });
      
      if (data.success) {
        setTags(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  };

  const fetchPopularCreators = async ({ forceFresh = false } = {}) => {
    try {
      const data = forceFresh
        ? await (async () => {
            const response = await fetch(`${API_URL}/api/content/creators/popular?limit=10`);
            return response.json();
          })()
        : await fetchJsonWithCache({
            namespace: FRONTEND_CACHE_NAMESPACES.TRENDING,
            key: 'right-rail:popular-creators:limit=10',
            url: `${API_URL}/api/content/creators/popular?limit=10`,
            ttlMs: 120 * 1000
          });
      
      if (data.success) {
        setCreators(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch creators:', err);
    }
  };

  const loadPersonalizedTags = async ({ forceFresh = false } = {}) => {
    if (!getToken()) {
      setFavoriteTags([]);
      setRecommendedTags([]);
      return;
    }

    try {
      const [favoriteData, recommendedData] = await Promise.all([
        fetchFavoriteTags({ forceFresh }),
        fetchRecommendedTags({ forceFresh })
      ]);

      if (favoriteData.success) {
        setFavoriteTags(favoriteData.data || []);
      }

      if (recommendedData.success) {
        setRecommendedTags(recommendedData.data || []);
      }
    } catch (error) {
      console.error('Failed to load personalized tags:', error);
    }
  };

  const handleFavoriteToggle = async (tag) => {
    if (!getToken() || favoriteTagBusy) {
      return;
    }

    const normalizedTag = normalizeTag(tag);
    const isFavorite = favoriteTags.includes(normalizedTag);

    setFavoriteTagBusy(normalizedTag);

    try {
      const result = await toggleFavoriteTag(normalizedTag, isFavorite);

      if (!result.success) {
        alert(result.error?.message || 'Failed to update favorite hashtag');
        return;
      }

      setFavoriteTags(result.data || []);
      const recommendationData = await fetchRecommendedTags({ forceFresh: true });
      if (recommendationData.success) {
        setRecommendedTags(recommendationData.data || []);
      }
    } finally {
      setFavoriteTagBusy('');
    }
  };

  const renderTagRow = (tag, { allowFavorite = true } = {}) => {
    const normalizedTag = normalizeTag(tag.name || tag);
    const isFavorite = favoriteTags.includes(normalizedTag);

    return (
      <div key={normalizedTag} className="right-rail-tag-row">
        <Link
          to={`/home?tag=${encodeURIComponent(normalizedTag)}`}
          className={`right-rail-tag flex-1 ${activeTag === normalizedTag ? 'border-brand bg-brand/20 text-brand-light' : ''}`}
        >
          #{normalizedTag}
        </Link>
        {allowFavorite && getToken() ? (
          <button
            type="button"
            disabled={favoriteTagBusy === normalizedTag}
            onClick={() => handleFavoriteToggle(normalizedTag)}
            className={`right-rail-tag-action ${isFavorite ? 'right-rail-tag-action-active' : ''}`}
            aria-label={isFavorite ? `Remove #${normalizedTag} from favorites` : `Save #${normalizedTag} to favorites`}
          >
            <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="right-rail sidebar-scroll xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
      {getToken() ? (
        <section className="right-rail-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="right-rail-title">Favorite Tags</h2>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Personal</span>
          </div>
          <div className="mt-3 space-y-2">
            {favoriteTags.length > 0 ? (
              favoriteTags.map((tag) => renderTagRow(tag))
            ) : (
              <p className="text-sm text-slate-400">Save hashtags you care about to start building recommendations.</p>
            )}
          </div>
        </section>
      ) : null}

      {getToken() ? (
        <section className="right-rail-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="right-rail-title">Recommended Tags</h2>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">For you</span>
          </div>
          <div className="mt-3 space-y-2">
            {recommendedTags.length > 0 ? (
              recommendedTags.map((tag) => renderTagRow(tag))
            ) : (
              <p className="text-sm text-slate-400">Favorite a few hashtags first, then recommendations will appear here.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="right-rail-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="right-rail-title">Trending Tags</h2>
          <Link to="/search?view=tags" {...getRoutePrefetchProps('/search')} className="text-xs uppercase tracking-[0.18em] text-brand-light transition hover:text-white">
            View all
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {tags.length > 0 ? (
            tags.map((tag) => renderTagRow(tag))
          ) : (
            <p className="text-sm text-slate-400">No trending tags yet</p>
          )}
        </div>
      </section>

      <section className="right-rail-card">
        <h2 className="right-rail-title">Popular Creators</h2>
        <div className="mt-3 space-y-2.5 2xl:space-y-4">
          {creators.length > 0 ? (
            creators.map((creator) => {
              const matchesCurrentUser = String(creator.id) === String(currentUser?._id || currentUser?.id || '');
              const displayUsername = matchesCurrentUser ? (currentUser?.username || creator.username) : creator.username;
              const displayAvatar = matchesCurrentUser ? (currentUser?.avatar || null) : creator.avatar;

              return (
              <Link
                key={creator.id}
                to={`/profile/${creator.id}`}
                {...getRoutePrefetchProps('/profile')}
                className="right-rail-creator"
              >
                {displayAvatar ? (
                  <img
                    src={getImageUrl(displayAvatar)}
                    alt={displayUsername}
                    className="h-10 w-10 rounded-full object-cover 2xl:h-12 2xl:w-12"
                  />
                ) : (
                  <div className="user-avatar-fallback h-10 w-10 text-base 2xl:h-12 2xl:w-12 2xl:text-lg">
                    {displayUsername?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white transition hover:text-brand-light">{displayUsername}</p>
                  <p className="truncate text-xs text-slate-400">{creator.totalLikes} total likes</p>
                </div>
              </Link>
            );
            })
          ) : (
            <p className="text-sm text-slate-400">No creators yet</p>
          )}
        </div>
      </section>
    </aside>
  );
}
