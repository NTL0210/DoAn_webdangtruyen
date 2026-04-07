import { Bookmark, Hash, Heart, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HashtagCharts from '../components/HashtagCharts';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getCurrentUser, getToken, subscribeToCurrentUserChange, updateCurrentUserCollection } from '../services/authService';
import { invalidateContentMutationCaches } from '../services/appDataInvalidation';
import { fetchJsonWithCache, FRONTEND_CACHE_NAMESPACES } from '../services/frontendCache';
import { getRoutePrefetchProps } from '../services/routePrefetch';
import { formatCount } from '../utils/helpers';
import { formatTag, normalizeTag, normalizeTagList, parseStrictHashtagInput } from '../utils/hashtags';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TAG_DIRECTORY_LIMIT = 12;
const CREATOR_SEARCH_LIMIT = 12;
const SEARCH_VIEW_ITEMS = [
  { value: 'content', label: 'All Content' },
  { value: 'tags', label: 'Hashtag' },
  { value: 'creators', label: 'Creator' }
];

function TagStatCard({ label, value, hint }) {
  return (
    <div className="detail-subcard px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function SearchChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${active ? 'border-white/10 bg-white text-slate-950 shadow-sm' : 'border-slate-700 bg-slate-900/65 text-slate-300 hover:border-slate-500 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function SearchViewTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative z-10 min-w-0 flex-1 rounded-[18px] px-4 py-3 text-center text-sm font-medium transition-colors duration-300 ${active ? 'text-slate-950' : 'text-slate-300 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function getCreatorAvatarUrl(avatar) {
  if (!avatar) return '';
  return avatar.startsWith('http') ? avatar : `${API_URL}${avatar}`;
}

function formatMatchQualityLabel(value) {
  if (value === 'exact') return 'Closest match';
  if (value === 'strong') return 'Strong match';
  return 'Fuzzy match';
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const viewMode = ['content', 'creators', 'tags'].includes(requestedView) ? requestedView : 'content';
  const initialTagQuery = normalizeTag(searchParams.get('tag') || '');
  const initialCreatorQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState('');
  const [tags, setTags] = useState('');
  const [results, setResults] = useState([]);
  const [authUser, setAuthUser] = useState(() => getCurrentUser());
  const [pendingInteractionKey, setPendingInteractionKey] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [contentError, setContentError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [creatorQuery, setCreatorQuery] = useState(initialCreatorQuery);
  const [creatorResults, setCreatorResults] = useState([]);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorError, setCreatorError] = useState('');
  const [creatorSearched, setCreatorSearched] = useState(false);
  const [creatorPagination, setCreatorPagination] = useState({
    page: 1,
    limit: CREATOR_SEARCH_LIMIT,
    totalItems: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false
  });

  const [tagQuery, setTagQuery] = useState(initialTagQuery);
  const [tagDirectory, setTagDirectory] = useState([]);
  const [tagSummary, setTagSummary] = useState({
    totalTags: 0,
    totalTagAssignments: 0,
    totalCreatorsUsingTags: 0
  });
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState('');
  const [tagPagination, setTagPagination] = useState({
    page: 1,
    limit: TAG_DIRECTORY_LIMIT,
    totalItems: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false
  });
  const likedIds = Array.isArray(authUser?.likes) ? authUser.likes.map((value) => String(value)) : [];
  const bookmarkedIds = Array.isArray(authUser?.bookmarks) ? authUser.bookmarks.map((value) => String(value)) : [];

  async function loadTagDirectory(nextPage = 1, nextQuery = tagQuery) {
    setTagLoading(true);
    setTagError('');

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(TAG_DIRECTORY_LIMIT)
      });

      if (nextQuery) {
        params.set('q', nextQuery);
      }

      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.TAG_DIRECTORY,
        key: `page=${nextPage}&q=${encodeURIComponent(nextQuery || '')}`,
        url: `${API_URL}/api/content/tags?${params}`,
        ttlMs: 90 * 1000
      });

      if (!data.success) {
        setTagError(data.error?.message || 'Failed to load hashtag directory');
        return;
      }

      setTagDirectory(data.data || []);
      setTagSummary(data.summary || {
        totalTags: 0,
        totalTagAssignments: 0,
        totalCreatorsUsingTags: 0
      });
      setTagPagination(data.pagination || {
        page: nextPage,
        limit: TAG_DIRECTORY_LIMIT,
        totalItems: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    } catch (error) {
      console.error('Tag directory error:', error);
      setTagError('Failed to load hashtag directory');
    } finally {
      setTagLoading(false);
    }
  }

  async function loadCreators(nextPage = 1, nextQuery = creatorQuery) {
    setCreatorLoading(true);
    setCreatorError('');
    setCreatorSearched(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(CREATOR_SEARCH_LIMIT)
      });

      if (nextQuery.trim()) {
        params.set('query', nextQuery.trim());
      }

      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.CREATOR_SEARCH,
        key: `page=${nextPage}&query=${encodeURIComponent(nextQuery.trim())}`,
        url: `${API_URL}/api/users/search?${params}`,
        ttlMs: 60 * 1000
      });

      if (!data.success) {
        setCreatorError(data.error?.message || 'Failed to load creators');
        return;
      }

      setCreatorResults(data.data || []);
      setCreatorPagination(data.pagination || {
        page: nextPage,
        limit: CREATOR_SEARCH_LIMIT,
        totalItems: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    } catch (error) {
      console.error('Creator search error:', error);
      setCreatorError('Failed to load creators');
    } finally {
      setCreatorLoading(false);
    }
  }

  useEffect(() => {
    loadTagDirectory(1, initialTagQuery);
    if (viewMode === 'creators') {
      loadCreators(1, initialCreatorQuery);
    }
  }, []);

  useEffect(() => subscribeToCurrentUserChange(setAuthUser), []);

  useEffect(() => {
    const incomingTagQuery = normalizeTag(searchParams.get('tag') || '');
    const incomingCreatorQuery = searchParams.get('q') || '';

    if (incomingTagQuery !== tagQuery) {
      setTagQuery(incomingTagQuery);
      loadTagDirectory(1, incomingTagQuery);
    }

    if (viewMode === 'creators' && incomingCreatorQuery !== creatorQuery) {
      setCreatorQuery(incomingCreatorQuery);
      loadCreators(1, incomingCreatorQuery);
    }
  }, [searchParams, viewMode]);

  async function runContentSearch(nextPage = 1) {
    setContentLoading(true);
    setSearched(true);
    setContentError('');

    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);

      if (tags) {
        const parsedTags = parseStrictHashtagInput(tags);
        if (parsedTags.error) {
          setContentError(parsedTags.error);
          setContentLoading(false);
          return;
        }

        parsedTags.tags.forEach((tag) => params.append('tags', tag));
      }

      params.append('page', String(nextPage));

      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.CONTENT_SEARCH,
        key: `page=${nextPage}&q=${encodeURIComponent(query)}&tags=${encodeURIComponent(tags)}`,
        url: `${API_URL}/api/content/search?${params}`,
        ttlMs: 45 * 1000
      });

      if (data.success) {
        setResults(data.data || []);
        setPage(nextPage);
        setHasMore((data.data?.length || 0) >= (data.pagination?.limit || 50));
      } else {
        setContentError(data.error?.message || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      setContentError('Search failed');
    } finally {
      setContentLoading(false);
    }
  }

  async function handleContentInteraction(contentId, action) {
    if (!getToken()) {
      alert('Please login to like or bookmark posts.');
      return;
    }

    const interactionKey = `${action}:${contentId}`;
    if (pendingInteractionKey) {
      return;
    }

    const likeIds = Array.isArray(authUser?.likes) ? authUser.likes.map((value) => String(value)) : [];
    const bookmarkIds = Array.isArray(authUser?.bookmarks) ? authUser.bookmarks.map((value) => String(value)) : [];
    const nextActive = action === 'like'
      ? !likeIds.includes(String(contentId))
      : !bookmarkIds.includes(String(contentId));

    setPendingInteractionKey(interactionKey);

    try {
      const response = await fetch(`${API_URL}/api/content/${contentId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.error?.message || `Failed to update ${action}`);
        return;
      }

      setResults((prev) => prev.map((item) => (String(item._id) === String(contentId) ? data.data : item)));
      invalidateContentMutationCaches();
      updateCurrentUserCollection(action === 'like' ? 'likes' : 'bookmarks', contentId, nextActive);
    } catch (error) {
      alert(`Failed to update ${action}`);
    } finally {
      setPendingInteractionKey('');
    }
  }

  const handleContentSearch = async (event) => {
    event.preventDefault();
    await runContentSearch(1);
  };

  const handleCreatorSearch = async (event) => {
    event.preventDefault();

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', 'creators');
    if (creatorQuery.trim()) {
      nextParams.set('q', creatorQuery.trim());
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams);
    await loadCreators(1, creatorQuery);
  };

  const handleTagSearch = async (event) => {
    event.preventDefault();

    const normalized = normalizeTag(tagQuery);
    setTagQuery(normalized);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', 'tags');
    if (normalized) {
      nextParams.set('tag', normalized);
    } else {
      nextParams.delete('tag');
    }
    nextParams.delete('q');
    setSearchParams(nextParams);
    await loadTagDirectory(1, normalized);
  };

  const switchView = (nextView) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', nextView);
    if (nextView !== 'tags') {
      nextParams.delete('tag');
    }
    setSearchParams(nextParams);
    if (nextView === 'creators') {
      loadCreators(1, creatorQuery);
    }
  };

  const activeViewMeta =
    viewMode === 'content'
      ? {
          label: 'Content search',
          description: 'Find stories and artworks by title, description, or hashtags.',
          metric: searched ? `${results.length} results on page ${page}` : 'Ready for a new lookup'
        }
      : viewMode === 'creators'
        ? {
            label: 'Creator search',
            description: 'Look up creators with accent-insensitive fuzzy matching.',
            metric: creatorSearched
              ? `${creatorPagination.totalItems || creatorResults.length} creators matched`
              : 'Search creators by name'
          }
        : {
            label: 'Tag explorer',
            description: 'Browse hashtag usage and creator reach in one place.',
            metric: `${tagPagination.totalItems || tagDirectory.length || 0} tags in directory`
          };
  const currentTagPostVolume = tagDirectory.reduce((total, tag) => total + (tag.contentCount || 0), 0);
  const currentTagCreatorReach = tagDirectory.reduce((total, tag) => total + (tag.creatorCount || 0), 0);
  const strongestTag = tagDirectory.reduce((best, tag) => {
    if (!best || (tag.contentCount || 0) > (best.contentCount || 0)) {
      return tag;
    }
    return best;
  }, null);
  const freshestTag = tagDirectory.reduce((best, tag) => {
    if (!best || new Date(tag.latestUsedAt).getTime() > new Date(best.latestUsedAt).getTime()) {
      return tag;
    }
    return best;
  }, null);
  const topTagsByPosts = useMemo(
    () => [...tagDirectory].sort((left, right) => (right.contentCount || 0) - (left.contentCount || 0)).slice(0, 8),
    [tagDirectory]
  );
  const tagPostChartPoints = useMemo(
    () => topTagsByPosts.map((tag) => ({ primary: formatTag(tag.name), secondary: tag.contentCount || 0 })),
    [topTagsByPosts]
  );
  const activeViewIndex = Math.max(SEARCH_VIEW_ITEMS.findIndex((item) => item.value === viewMode), 0);

  return (
    <div className="space-y-6">
      <section className="detail-card p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="detail-eyebrow">Discovery tools</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Search</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">{activeViewMeta.description}</p>
            </div>

            <div className="w-full max-w-2xl">
              <div className="relative overflow-hidden rounded-[24px] border border-slate-700 bg-slate-950/70 p-1 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-[18px] bg-white/12 blur-xl transition-transform duration-300 ease-out"
                  style={{
                    width: `calc((100% - 0.5rem) / ${SEARCH_VIEW_ITEMS.length})`,
                    transform: `translateX(${activeViewIndex * 100}%)`
                  }}
                />
                <div
                  aria-hidden="true"
                  className="absolute bottom-1 left-1 top-1 rounded-[18px] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(226,232,240,0.92))] shadow-[0_14px_30px_rgba(15,23,42,0.26)] transition-transform duration-300 ease-out"
                  style={{
                    width: `calc((100% - 0.5rem) / ${SEARCH_VIEW_ITEMS.length})`,
                    transform: `translateX(${activeViewIndex * 100}%)`
                  }}
                />
                <div className="relative flex items-center">
                  {SEARCH_VIEW_ITEMS.map((item) => (
                    <SearchViewTab
                      key={item.value}
                      active={viewMode === item.value}
                      onClick={() => switchView(item.value)}
                    >
                      {item.label}
                    </SearchViewTab>
                  ))}
                </div>
              </div>
              <p className="mt-3 px-1 text-sm text-slate-500">{activeViewMeta.metric}</p>
            </div>
          </div>
        </div>
      </section>

      {viewMode === 'content' ? (
        <>
          <section className="detail-card p-5">
            <form onSubmit={handleContentSearch} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
                <label className="surface-search flex items-center gap-3 px-4 py-3">
                  <Search size={16} />
                  <input
                    className="w-full bg-transparent text-sm text-white outline-none"
                    placeholder="Search by title or description"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="surface-search flex items-center gap-3 px-4 py-3">
                  <Hash size={16} />
                  <input
                    className="w-full bg-transparent text-sm text-white outline-none"
                    placeholder="digitalart anime or #digitalart #anime"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={contentLoading} className="editor-action-primary px-6 py-3">
                  {contentLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              <p className="text-sm text-slate-400">Hashtags accept both plain words and #prefixed tags. Duplicate tags collapse automatically.</p>
              <p className="text-sm text-slate-500">Keyword search also matches Vietnamese titles without accents, for example chao ngay moi.</p>
            </form>
          </section>

          {contentError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {contentError}
            </div>
          ) : null}

          {contentLoading ? (
            <div className="panel flex min-h-72 items-center justify-center">
              <LoadingSpinner label="Searching content..." />
            </div>
          ) : searched ? (
            results.length ? (
              <div className="space-y-6">
                <div className="detail-card flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-slate-400">Found {results.length} results on page {page}.</p>
                  {(query || tags) && (
                    <p className="text-sm text-slate-500">{query ? `Keyword: ${query}` : 'Browsing by tags'}{query && tags ? ' · ' : ''}{tags ? `Tags: ${tags}` : ''}</p>
                  )}
                </div>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {results.map((item) => (
                    <article
                      key={item._id}
                      className="detail-card p-4"
                      {...getRoutePrefetchProps(item.content !== undefined ? `/story/${item._id}` : `/artwork/${item._id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.content !== undefined ? 'Story' : 'Artwork'}</p>
                          <h3 className="mt-2 text-lg font-semibold text-white sm:text-xl">{item.title}</h3>
                        </div>
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{item.views || 0} views</span>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{item.description || 'No description available.'}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {normalizeTagList(item.tags || []).slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full border border-brand-light/25 bg-brand-light/10 px-3 py-1 text-xs text-brand-light">
                            {formatTag(tag)}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => handleContentInteraction(item._id, 'like')}
                          disabled={pendingInteractionKey === `like:${item._id}`}
                          className={`interaction-pill ${likedIds.includes(String(item._id)) ? 'interaction-pill-like-active' : ''}`}
                        >
                          <Heart size={15} fill={likedIds.includes(String(item._id)) ? 'currentColor' : 'none'} />
                          {formatCount(item.likes || 0)}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleContentInteraction(item._id, 'bookmark')}
                          disabled={pendingInteractionKey === `bookmark:${item._id}`}
                          className={`interaction-pill ${bookmarkedIds.includes(String(item._id)) ? 'interaction-pill-bookmark-active' : ''}`}
                        >
                          <Bookmark size={15} fill={bookmarkedIds.includes(String(item._id)) ? 'currentColor' : 'none'} />
                          {formatCount(item.bookmarks || 0)}
                        </button>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-400">
                        <span>@{item.author?.username || 'unknown'}</span>
                        <Link
                          to={item.content !== undefined ? `/story/${item._id}` : `/artwork/${item._id}`}
                          {...getRoutePrefetchProps(item.content !== undefined ? `/story/${item._id}` : `/artwork/${item._id}`)}
                          className="text-brand-light transition hover:text-white"
                        >
                          Open →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={contentLoading || page === 1}
                    onClick={() => runContentSearch(Math.max(1, page - 1))}
                    className="detail-inline-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400">Page {page}</span>
                  <button
                    type="button"
                    disabled={contentLoading || !hasMore}
                    onClick={() => runContentSearch(page + 1)}
                    className="detail-inline-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState title="No matching results" description="Try changing the keywords or tag combination." />
            )
          ) : (
            <div className="detail-empty-state">
              <div className="text-lg font-semibold text-white">Start with a keyword or hashtags</div>
              <p className="max-w-md text-sm text-slate-400">Search by title, description, or a group of hashtags to find matching content.</p>
            </div>
          )}
        </>
      ) : viewMode === 'creators' ? (
        <>
          <section className="detail-card p-5">
            <form onSubmit={handleCreatorSearch} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="surface-search flex items-center gap-3 px-4 py-3">
                  <Users size={16} />
                  <input
                    className="w-full bg-transparent text-sm text-white outline-none"
                    placeholder="Search creator name, for example hachi yasuo"
                    value={creatorQuery}
                    onChange={(event) => setCreatorQuery(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={creatorLoading} className="editor-action-primary px-6 py-3">
                  {creatorLoading ? 'Searching...' : 'Search Creators'}
                </button>
              </div>

              <p className="text-sm text-slate-400">Creator search is accent-insensitive and fuzzy-ranked, so close spellings can still surface the right profile.</p>
            </form>
          </section>

          {creatorError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {creatorError}
            </div>
          ) : null}

          {creatorLoading ? (
            <div className="panel flex min-h-72 items-center justify-center">
              <LoadingSpinner label="Searching creators..." />
            </div>
          ) : creatorSearched ? (
            creatorResults.length ? (
              <div className="space-y-6">
                <div className="detail-card p-4">
                  <p className="text-sm text-slate-400">
                    Showing {creatorResults.length} creators on page {creatorPagination.page}. Ranking blends match quality, popularity, verified status, and your activity.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {creatorResults.map((creator) => (
                    <article key={creator._id} className="detail-card p-4">
                      <div className="flex items-start gap-4">
                        {creator.avatar ? (
                          <img src={getCreatorAvatarUrl(creator.avatar)} alt={creator.username} className="h-14 w-14 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-lg font-semibold text-white">
                            {creator.username?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white sm:text-xl">{creator.username}</h3>
                            {creator.isVerified ? (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                                Verified
                              </span>
                            ) : null}
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                              {formatMatchQualityLabel(creator.matchQuality)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-400">{creator.bio || 'No bio yet.'}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{creator.approvedContentCount} published posts</span>
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{creator.followerCount} followers</span>
                        {creator.isFollowedByCurrentUser ? (
                          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand-light">Following</span>
                        ) : null}
                        {creator.hasBeenViewedByCurrentUser ? (
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">Seen before</span>
                        ) : null}
                      </div>

                      <div className="mt-5 flex items-center justify-end">
                        <Link to={`/profile/${creator._id}`} className="text-sm font-medium text-brand-light transition hover:text-white">
                          Open Profile →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={creatorLoading || !creatorPagination.hasPreviousPage}
                    onClick={() => loadCreators(creatorPagination.page - 1, creatorQuery)}
                    className="detail-inline-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400">
                    Page {creatorPagination.page} of {creatorPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={creatorLoading || !creatorPagination.hasNextPage}
                    onClick={() => loadCreators(creatorPagination.page + 1, creatorQuery)}
                    className="detail-inline-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState title="No creators matched" description="Try another spelling. The search already tolerates missing accents and small typos." />
            )
          ) : (
            <div className="detail-empty-state">
              <div className="text-lg font-semibold text-white">Search for a creator</div>
              <p className="max-w-md text-sm text-slate-400">Type a creator name to get exact, strong, or fuzzy matches ranked by quality and popularity.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <section className="detail-card p-5">
            <form onSubmit={handleTagSearch} className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <label className="surface-search flex flex-1 items-center gap-3 px-4 py-3">
                <Hash size={16} />
                <input
                  className="w-full bg-transparent text-sm text-white outline-none"
                  placeholder="Search hashtag name, for example newday or #newday"
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                />
              </label>
              <button type="submit" disabled={tagLoading} className="editor-action-primary px-6 py-3">
                {tagLoading ? 'Searching...' : 'Search Tags'}
              </button>
            </form>
          </section>

          {tagError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {tagError}
            </div>
          ) : null}

          {tagLoading ? (
            <div className="panel flex min-h-72 items-center justify-center">
              <LoadingSpinner label="Loading hashtag directory..." />
            </div>
          ) : tagDirectory.length ? (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <TagStatCard label="Tags on this page" value={tagDirectory.length} hint="Current slice of the hashtag directory." />
                <TagStatCard label="Post volume" value={currentTagPostVolume} hint="Approved posts covered by the visible tags." />
                <TagStatCard label="Creator reach" value={currentTagCreatorReach} hint="Combined creator usage across visible tags." />
                <TagStatCard
                  label="Strongest tag"
                  value={strongestTag ? formatTag(strongestTag.name) : '-'}
                  hint={strongestTag ? `${strongestTag.contentCount} posts · ${strongestTag.creatorCount} creators` : 'No tag data loaded.'}
                />
              </div>

              <HashtagCharts postData={tagPostChartPoints} />

              <section className="detail-card overflow-hidden p-0">
                <div className="border-b border-slate-800 bg-slate-950/55 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hashtag dashboard</p>
                      <p className="mt-1 text-sm text-slate-400">A compact numeric view for the “View all” hashtag page.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-slate-700 bg-slate-950/45 px-3 py-1.5">Page {tagPagination.page} of {tagPagination.totalPages}</span>
                      {freshestTag ? (
                        <span className="rounded-full border border-slate-700 bg-slate-950/45 px-3 py-1.5">Freshest: {formatTag(freshestTag.name)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="hidden grid-cols-[minmax(0,1.5fr)_110px_110px_170px_auto] gap-3 border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500 md:grid">
                  <span>Hashtag</span>
                  <span>Posts</span>
                  <span>Creators</span>
                  <span>Last used</span>
                  <span className="text-right">Action</span>
                </div>

                <div>
                  {tagDirectory.map((tag, index) => (
                    <div
                      key={tag.name}
                      className={`grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.5fr)_110px_110px_170px_auto] md:items-center ${
                        index === 0 ? '' : 'border-t border-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-lg font-semibold text-white">{formatTag(tag.name)}</p>
                        <p className="mt-1 text-sm text-slate-400">Hashtag used across approved content.</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 md:hidden">Posts</p>
                        <p className="text-sm font-medium text-white">{tag.contentCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 md:hidden">Creators</p>
                        <p className="text-sm font-medium text-white">{tag.creatorCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 md:hidden">Last used</p>
                        <p className="text-sm text-slate-300">{new Date(tag.latestUsedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex md:justify-end">
                        <Link to={`/home?tag=${encodeURIComponent(tag.name)}`} className="detail-inline-button px-4 py-2 text-sm">
                          Open feed
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={tagLoading || !tagPagination.hasPreviousPage}
                  onClick={() => loadTagDirectory(tagPagination.page - 1, tagQuery)}
                  className="detail-inline-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {tagPagination.page} of {tagPagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={tagLoading || !tagPagination.hasNextPage}
                  onClick={() => loadTagDirectory(tagPagination.page + 1, tagQuery)}
                  className="detail-inline-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <EmptyState title="No hashtags found" description="Try another hashtag keyword or clear the filter to browse everything." />
          )}
        </>
      )}
    </div>
  );
}