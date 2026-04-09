import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStory,
  createArtwork,
  getContent,
  getHomeFeed,
  searchContent,
  updateContent,
  getTrending,
  getPopularCreators,
  getRecommendedTags,
  getTrendingTags,
  getTagDirectory,
  toggleLike,
  toggleBookmark,
  deleteContent
} from '../../controllers/ContentController.js';

import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';
import User from '../../models/User.js';

/* ================= FIX QUAN TRỌNG ================= */
function createQueryMock(resolveValue) {
  const query = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(resolveValue),
  };

  query.then = (res) => Promise.resolve(resolveValue).then(res);
  query.catch = (err) => Promise.resolve(resolveValue).catch(err);

  return query;
}
/* ================================================= */

vi.mock('../../utils/hashtags.js', () => ({
  parseTagsInput: vi.fn().mockReturnValue({ tags: ['tag1'] }),
  normalizeTagsForQuery: vi.fn((tags) => Array.isArray(tags) ? tags : []),
  buildTagSearchConditions: vi.fn(() => ({}))
}));

vi.mock('../../utils/search.js', () => ({
  escapeRegex: vi.fn((str) => str),
  normalizeSearchText: vi.fn((str) => str?.toLowerCase() || ''),
  tokenizeSearchText: vi.fn((str) => str ? [str] : [])
}));

vi.mock('../../models/Follow.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      distinct: vi.fn().mockResolvedValue([])
    })
  }
}));

vi.mock('../../utils/savedContent.js', () => ({
  removeContentFromAllSavedCollections: vi.fn()
}));

/* ================= STORY ================= */
vi.mock('../../models/Story.js', () => {
  class MockStory {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
      this.populate = vi.fn().mockResolvedValue(this);
    }
  }

  MockStory.findById = vi.fn(() =>
    createQueryMock({
      _id: 'contentId',
      title: 'Story',
      status: 'approved',
      author: 'userId',
      views: 0,
      likes: 0,
      bookmarks: [],
      save: vi.fn().mockResolvedValue(),
      populate: vi.fn().mockResolvedValue()
    })
  );

  MockStory.find = vi.fn(() => createQueryMock([]));
  MockStory.aggregate = vi.fn().mockResolvedValue([]);
  MockStory.findByIdAndUpdate = vi.fn().mockResolvedValue({});
  MockStory.findByIdAndDelete = vi.fn().mockResolvedValue({});

  return { __esModule: true, default: MockStory };
});

/* ================= ARTWORK ================= */
vi.mock('../../models/Artwork.js', () => {
  class MockArtwork {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    }
  }

  MockArtwork.findById = vi.fn(() =>
    createQueryMock({ _id: 'artworkId', title: 'Artwork' })
  );

  MockArtwork.find = vi.fn(() => createQueryMock([]));
  MockArtwork.aggregate = vi.fn().mockResolvedValue([]);

  return { __esModule: true, default: MockArtwork };
});

/* ================= USER ================= */
vi.mock('../../models/User.js', () => {
  const user = {
    _id: 'userId',
    likes: [],
    bookmarks: [],
    favoriteTags: ['tag1'],
    save: vi.fn().mockResolvedValue()
  };

  return {
    default: {
      findById: vi.fn(() => createQueryMock(user)),
      find: vi.fn(() => createQueryMock([user])),
      aggregate: vi.fn().mockResolvedValue([]),
      findByIdAndUpdate: vi.fn().mockResolvedValue(user)
    }
  };
});

/* ================= OTHER ================= */
vi.mock('../../models/Notification.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn(() => createQueryMock([]))
  }
}));

vi.mock('../../models/Comment.js', () => ({
  __esModule: true,
  default: {
    aggregate: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../services/cacheStore.js', () => ({
  CACHE_NAMESPACES: {
    CONTENT_DISCOVERY: 'discovery',
    CREATOR_SEARCH: 'search',
    PUBLIC_PROFILE: 'profile'
  },
  getOrSetNamespacedCache: vi.fn(async ({ loader }) => loader()),
  invalidateCacheNamespaces: vi.fn()
}));

vi.mock('../../websocket/WebSocketManager.js', () => ({
  __esModule: true,
  default: {
    sendNotification: vi.fn()
  }
}));

/* ================= TEST ================= */
describe('ContentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: 'userId' }
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    vi.clearAllMocks();
  });

  it('createStory', async () => {
    req.body = { title: 'A', content: 'long long long content here...' };

    await createStory(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('createArtwork', async () => {
  req.body = {
    title: 'Test Artwork',
    description: 'Description',
    content: 'This is a long enough content for validation in controller',
    tags: ['tag1'],
    status: 'draft',
    images: ['image1.jpg'] // ✅ FIX QUAN TRỌNG
  };

  req.files = []; // (optional nhưng nên có)

  await createArtwork(req, res);

  expect(res.status).toHaveBeenCalledWith(201);
});

  it('getHomeFeed', async () => {
    await getHomeFeed(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('searchContent', async () => {
    req.query.q = 'test';

    await searchContent(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTrending', async () => {
    await getTrending(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getRecommendedTags', async () => {
    await getRecommendedTags(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTrendingTags', async () => {
    await getTrendingTags(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTagDirectory', async () => {
    await getTagDirectory(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deleteContent', async () => {
    req.params = { id: 'contentId' };

    await deleteContent(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});