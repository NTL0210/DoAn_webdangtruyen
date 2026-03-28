require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/user.model');
const Post = require('../models/post.model');
const Comment = require('../models/comment.model');
const Bookmark = require('../models/bookmark.model');
const Follow = require('../models/follow.model');
const Notification = require('../models/notification.model');
const ReadingHistory = require('../models/readingHistory.model');
const Report = require('../models/report.model');
const Tag = require('../models/tag.model');

const DEMO_PASSWORD = '123456';
const DEMO_PREFIX = 'demo_seed_';
const DEMO_TITLE_PREFIX = '[DEMO-SEED]';
const DEMO_TITLE_PREFIX_REGEX = new RegExp(
  `^${DEMO_TITLE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
);

const DEMO_USERS = [
  {
    username: `${DEMO_PREFIX}user_a`,
    email: 'demo_seed_user_a@example.com',
    displayName: 'Demo Seed User A',
    role: 'user',
  },
  {
    username: `${DEMO_PREFIX}user_b`,
    email: 'demo_seed_user_b@example.com',
    displayName: 'Demo Seed User B',
    role: 'user',
  },
  {
    username: `${DEMO_PREFIX}moderator`,
    email: 'demo_seed_moderator@example.com',
    displayName: 'Demo Seed Moderator',
    role: 'moderator',
  },
  {
    username: `${DEMO_PREFIX}admin`,
    email: 'demo_seed_admin@example.com',
    displayName: 'Demo Seed Admin',
    role: 'admin',
  },
];

const DEMO_TAGS = ['fantasy', 'action', 'romance', 'slice-of-life', 'fanart'];

const connect = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in .env');
  }
  await mongoose.connect(process.env.MONGODB_URI);
};

const upsertUser = async (payload) => {
  let user = await User.findOne({ email: payload.email }).select('+password');

  if (!user) {
    user = new User({
      username: payload.username,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      password: DEMO_PASSWORD,
    });
  } else {
    user.username = payload.username;
    user.displayName = payload.displayName;
    user.role = payload.role;
    user.password = DEMO_PASSWORD;
  }

  await user.save();
  return user;
};

const cleanupOldDemoData = async () => {
  const demoUsers = await User.find({
    $or: [
      { username: { $regex: `^${DEMO_PREFIX}` } },
      { email: { $regex: '^demo_seed_' } },
    ],
  }).select('_id username');
  const demoUserIds = demoUsers.map((u) => u._id);

  const demoPosts = await Post.find({
    $or: [
      { title: DEMO_TITLE_PREFIX_REGEX },
      { author: { $in: demoUserIds } },
    ],
  }).select('_id');
  const demoPostIds = demoPosts.map((p) => p._id);

  await Comment.deleteMany({
    $or: [{ author: { $in: demoUserIds } }, { post: { $in: demoPostIds } }],
  });
  await Bookmark.deleteMany({
    $or: [{ user: { $in: demoUserIds } }, { post: { $in: demoPostIds } }],
  });
  await Follow.deleteMany({
    $or: [{ follower: { $in: demoUserIds } }, { following: { $in: demoUserIds } }],
  });
  await Notification.deleteMany({
    $or: [
      { recipient: { $in: demoUserIds } },
      { sender: { $in: demoUserIds } },
      { post: { $in: demoPostIds } },
    ],
  });
  await ReadingHistory.deleteMany({
    $or: [{ user: { $in: demoUserIds } }, { post: { $in: demoPostIds } }],
  });
  await Report.deleteMany({
    $or: [{ reporter: { $in: demoUserIds } }, { post: { $in: demoPostIds } }],
  });
  await Post.deleteMany({ _id: { $in: demoPostIds } });
};

const seedTags = async () => {
  for (const name of DEMO_TAGS) {
    const existing = await Tag.findOne({ name });
    if (existing) {
      existing.usageCount = 0;
      await existing.save();
      continue;
    }
    await Tag.create({ name, description: `Seed tag: ${name}`, usageCount: 0 });
  }
};

const seedPosts = async (users) => {
  const now = new Date();

  const posts = await Post.insertMany([
    {
      author: users.userA._id,
      type: 'story',
      title: `${DEMO_TITLE_PREFIX} Approved Story`,
      summary: 'Approved post for public feed test.',
      content: 'Approved story content.',
      tags: ['fantasy', 'action'],
      images: [],
      status: 'approved',
      publishedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      viewsCount: 12,
      commentsCount: 0,
      bookmarksCount: 0,
      isDeleted: false,
    },
    {
      author: users.userA._id,
      type: 'story',
      title: `${DEMO_TITLE_PREFIX} Pending Story`,
      summary: 'Pending post for moderation test.',
      content: 'Pending story content.',
      tags: ['slice-of-life'],
      images: [],
      status: 'pending',
      publishedAt: null,
      isDeleted: false,
    },
    {
      author: users.userA._id,
      type: 'artwork',
      title: `${DEMO_TITLE_PREFIX} Draft Artwork`,
      summary: 'Draft post for owner-only access test.',
      content: 'Draft artwork content.',
      tags: ['fanart'],
      images: [],
      status: 'draft',
      publishedAt: null,
      isDeleted: false,
    },
    {
      author: users.userB._id,
      type: 'story',
      title: `${DEMO_TITLE_PREFIX} Rejected Story`,
      summary: 'Rejected post for resubmit test.',
      content: 'Rejected story content.',
      tags: ['romance'],
      images: [],
      status: 'rejected',
      publishedAt: null,
      isDeleted: false,
    },
  ]);

  return {
    approved: posts[0],
    pending: posts[1],
    draft: posts[2],
    rejected: posts[3],
  };
};

const seedRelations = async (users, posts) => {
  const comment = await Comment.create({
    post: posts.approved._id,
    author: users.userB._id,
    content: 'Demo seed comment from user B.',
  });

  await Bookmark.create({
    user: users.userB._id,
    post: posts.approved._id,
  });

  await Follow.create({
    follower: users.userB._id,
    following: users.userA._id,
  });

  await Notification.create({
    recipient: users.userA._id,
    sender: users.userB._id,
    type: 'comment',
    post: posts.approved._id,
    comment: comment._id,
    message: 'Demo seed notification from comment.',
  });

  await ReadingHistory.create({
    user: users.userB._id,
    post: posts.approved._id,
    lastReadAt: new Date(),
  });

  await Report.create({
    reporter: users.userB._id,
    post: posts.approved._id,
    reason: 'Spam content',
    details: 'Seed report for moderation testing.',
    status: 'pending',
  });
};

const syncCounters = async (users, posts) => {
  const commentCount = await Comment.countDocuments({
    post: posts.approved._id,
    isDeleted: false,
  });
  const bookmarkCount = await Bookmark.countDocuments({ post: posts.approved._id });
  const followersCount = await Follow.countDocuments({ following: users.userA._id });
  const followingCount = await Follow.countDocuments({ follower: users.userB._id });

  await Post.updateOne(
    { _id: posts.approved._id },
    { $set: { commentsCount: commentCount, bookmarksCount: bookmarkCount } }
  );
  await User.updateOne(
    { _id: users.userA._id },
    { $set: { followersCount } }
  );
  await User.updateOne(
    { _id: users.userB._id },
    { $set: { followingCount } }
  );

  // Update usageCount only from demo posts for predictable seed data
  const demoPosts = await Post.find({ title: DEMO_TITLE_PREFIX_REGEX, isDeleted: false })
    .select('tags');
  const tagMap = {};
  demoPosts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    });
  });
  for (const tag of DEMO_TAGS) {
    await Tag.updateOne({ name: tag }, { $set: { usageCount: tagMap[tag] || 0 } });
  }
};

const run = async () => {
  await connect();

  await seedTags();
  const userMap = {};
  for (const demoUser of DEMO_USERS) {
    const user = await upsertUser(demoUser);
    if (demoUser.username.endsWith('user_a')) userMap.userA = user;
    if (demoUser.username.endsWith('user_b')) userMap.userB = user;
    if (demoUser.username.endsWith('moderator')) userMap.moderator = user;
    if (demoUser.username.endsWith('admin')) userMap.admin = user;
  }

  await cleanupOldDemoData();
  const posts = await seedPosts(userMap);
  await seedRelations(userMap, posts);
  await syncCounters(userMap, posts);

  console.log('=== DEMO USERS ===');
  DEMO_USERS.forEach((u) => {
    console.log(`${u.role}: ${u.email} | password: ${DEMO_PASSWORD}`);
  });

  console.log('\n=== DEMO POSTS ===');
  console.log(`approved: ${posts.approved._id}`);
  console.log(`pending: ${posts.pending._id}`);
  console.log(`draft: ${posts.draft._id}`);
  console.log(`rejected: ${posts.rejected._id}`);

  console.log('\nSeed completed successfully.');
};

run()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
