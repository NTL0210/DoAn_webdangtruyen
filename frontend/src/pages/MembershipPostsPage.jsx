import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FeedComposer, FeedTabs } from '../components/FeedScaffold';
import { EmptyState } from '../components/common/EmptyState';
import { MembershipTeaserCard } from '../components/common/MembershipTeaserCard';
import { VirtualizedFeedList } from '../components/feed/VirtualizedFeedList';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useCursorFeed } from '../hooks/useCursorFeed';
import { getCurrentUser, getToken, subscribeToCurrentUserChange } from '../services/authService';
import { FRONTEND_CACHE_NAMESPACES, getFrontendCacheScope, invalidateFrontendCache } from '../services/frontendCache';

const MEMBERSHIP_PAGE_SIZE = 10;

export default function MembershipPostsPage() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const currentUserId = currentUser?.id || currentUser?._id || '';
  const cacheScope = getFrontendCacheScope(currentUserId || undefined);
  const requestOptions = useMemo(() => (
    getToken()
      ? {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        }
      : undefined
  ), [currentUserId]);

  const feedParams = useMemo(() => ({
    sort: sortBy,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    q: deferredSearch || undefined
  }), [deferredSearch, sortBy, typeFilter]);

  const {
    items,
    loading,
    error,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    reload
  } = useCursorFeed({
    params: feedParams,
    limit: MEMBERSHIP_PAGE_SIZE,
    endpoint: '/api/content/memberships/feed',
    namespace: FRONTEND_CACHE_NAMESPACES.MEMBERSHIP_FEED,
    scope: cacheScope,
    requestOptions
  });

  useEffect(() => subscribeToCurrentUserChange(setCurrentUser), []);

  useEffect(() => {
    if (location.state?.feedTab !== 'memberships' || !location.state?.feedRefreshKey) {
      return;
    }

    invalidateFrontendCache([FRONTEND_CACHE_NAMESPACES.MEMBERSHIP_FEED]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    reload();
  }, [location.state?.feedRefreshKey]);

  const filterChips = [
    { key: 'all', label: 'All premium posts' },
    { key: 'story', label: 'Stories' },
    { key: 'artwork', label: 'Artwork' }
  ];

  return (
    <div className="feed-shell">
      <div className="feed-column">
        <FeedTabs activeTab="memberships" />

        <section className="feed-headline">
          <p className="feed-kicker">Members-only discovery</p>
          <h1 className="feed-title">Membership Feed</h1>
          <p className="feed-subtitle">
            Browse locked premium posts in teaser mode. You get enough context to decide what to unlock, while full covers and full content stay protected until you join that artist.
          </p>
        </section>

        <FeedComposer
          user={currentUser}
          prompt="Browse protected drops without exposing the full premium post."
          hint="Join one artist once to unlock every members-only post from that artist while your membership is active."
          primaryAction={{ to: '/stories', label: 'Public stories' }}
          secondaryAction={{ to: '/artworks', label: 'Public artworks' }}
        />

        <section className="feed-toolbar">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="surface-search flex w-full items-center gap-3 px-4 py-3 lg:max-w-[22rem]">
              <Search size={16} />
              <input
                className="w-full bg-transparent text-sm text-white outline-none light:text-slate-800"
                placeholder="Search premium post titles..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`feed-filter-chip ${sortBy === 'newest' ? 'feed-filter-chip-active' : ''}`}
                onClick={() => setSortBy('newest')}
              >
                Latest
              </button>
              <button
                type="button"
                className={`feed-filter-chip ${sortBy === 'trending' ? 'feed-filter-chip-active' : ''}`}
                onClick={() => setSortBy('trending')}
              >
                Trending
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`feed-filter-chip ${typeFilter === chip.key ? 'feed-filter-chip-active' : ''}`}
                onClick={() => setTypeFilter(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>

        {error ? <div className="feed-inline-alert">{error}</div> : null}

        {loading ? (
          <div className="feed-loading">
            <LoadingSpinner label="Loading membership feed..." />
          </div>
        ) : items.length === 0 ? (
          <div className="feed-empty">
            <EmptyState
              title="No members-only posts found"
              description="When premium artists publish locked content, teaser cards will appear here for discovery."
            />
          </div>
        ) : (
          <VirtualizedFeedList
            items={items}
            renderItem={(item) => <MembershipTeaserCard key={item._id} item={item} />}
            estimateSize={520}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMoreRef={loadMoreRef}
            loadingMoreLabel="Loading more members-only teasers..."
          />
        )}
      </div>
    </div>
  );
}