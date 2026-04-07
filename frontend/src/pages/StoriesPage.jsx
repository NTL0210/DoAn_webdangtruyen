import { useEffect, useMemo, useState } from 'react';
import { FeedComposer, FeedTabs } from '../components/FeedScaffold';
import { ContentCard } from '../components/ContentCard';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useCursorFeed } from '../hooks/useCursorFeed';
import { getCurrentUser, subscribeToCurrentUserChange } from '../services/authService';
const STORIES_PAGE_SIZE = 10;

export default function StoriesPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const feedParams = useMemo(() => ({ sort: 'newest', type: 'story' }), []);
  const {
    items: stories,
    loading,
    error,
    hasMore,
    isLoadingMore,
    loadMoreRef
  } = useCursorFeed({
    params: feedParams,
    limit: STORIES_PAGE_SIZE
  });

  useEffect(() => subscribeToCurrentUserChange(setCurrentUser), []);

  return (
    <div className="feed-shell">
      <div className="feed-column">
        <FeedTabs activeTab="stories" />

        <section className="feed-headline">
          <p className="feed-kicker">Story desk</p>
          <h1 className="feed-title">Stories</h1>
          <p className="feed-subtitle">
            A scrolling desk for approved fiction drops, chapter previews, and short-form writing moments from the community.
          </p>
        </section>

        <FeedComposer
          user={currentUser}
          prompt={currentUser ? 'What scene are you drafting next?' : 'Login to publish your next story'}
          hint="Keep it serialized, keep it sharp, and send readers straight into the detail page from a single feed stream."
          primaryAction={currentUser ? { to: '/create-story', label: 'Create story' } : { to: '/login', label: 'Login' }}
          secondaryAction={currentUser ? { to: '/home', label: 'Mixed feed' } : { to: '/register', label: 'Create account' }}
        />

        {error ? <div className="feed-inline-alert">{error}</div> : null}

        {loading ? (
          <div className="feed-loading">
            <LoadingSpinner label="Loading stories..." />
          </div>
        ) : stories.length === 0 ? (
          <div className="feed-empty">
            <EmptyState title="No stories yet" description="Be the first to write a story!" />
          </div>
        ) : (
          <div className="feed-stream">
            {stories.map((story) => (
              <ContentCard key={story._id} item={story} />
            ))}
            {isLoadingMore ? (
              <div className="border-t border-slate-800 px-4 py-4 text-sm text-slate-500 sm:px-5">Loading more stories...</div>
            ) : null}
            {hasMore ? <div ref={loadMoreRef} className="h-4 w-full" aria-hidden="true" /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
