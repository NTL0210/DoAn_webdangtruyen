import AccountAppeal from '../models/AccountAppeal.js';
import Artwork from '../models/Artwork.js';
import Comment from '../models/Comment.js';
import ModerationAuditLog from '../models/ModerationAuditLog.js';
import ModerationCase from '../models/ModerationCase.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import Story from '../models/Story.js';
import User from '../models/User.js';
import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { validateEnvironment } from '../config/env.js';
import { buildContentSearchFields, buildSearchNameFields } from '../utils/search.js';
import { sanitizeInlineText, sanitizeUserText } from '../utils/textSanitizer.js';

const BATCH_SIZE = 200;
const STORY_TEXT_MAX_COMBINING_MARKS = 4;
const isDryRun = process.argv.includes('--dry-run');

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function assignIfChanged(update, field, nextValue, currentValue) {
  const currentNormalized = currentValue ?? '';
  const nextNormalized = nextValue ?? '';

  if (Array.isArray(nextNormalized) && Array.isArray(currentNormalized)) {
    if (!arraysEqual(currentNormalized, nextNormalized)) {
      update[field] = nextNormalized;
    }
    return;
  }

  if (currentNormalized !== nextNormalized) {
    update[field] = nextNormalized;
  }
}

function sanitizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => sanitizeInlineText(tag))
    .filter(Boolean);
}

function buildUserUpdate(user) {
  const update = {};
  const username = sanitizeInlineText(user.username);
  const email = sanitizeInlineText(user.email).toLowerCase();
  const bio = sanitizeUserText(user.bio, { preserveLineBreaks: true });
  const membershipTitle = sanitizeInlineText(user.membershipTitle);
  const membershipDescription = sanitizeUserText(user.membershipDescription, { preserveLineBreaks: true });
  const membershipBenefits = Array.isArray(user.membershipBenefits)
    ? user.membershipBenefits.map((item) => sanitizeInlineText(item)).filter(Boolean)
    : [];
  const favoriteTags = sanitizeTagList(user.favoriteTags);
  const permanentBanReason = sanitizeUserText(user.permanentBanReason, { preserveLineBreaks: true });
  const postingRestrictionReason = sanitizeUserText(user.postingRestrictionReason, { preserveLineBreaks: true });
  const pendingLoginNoticeTitle = sanitizeInlineText(user.pendingLoginNoticeTitle);
  const pendingLoginNoticeMessage = sanitizeUserText(user.pendingLoginNoticeMessage, { preserveLineBreaks: true });
  const searchFields = buildSearchNameFields(username);

  assignIfChanged(update, 'username', username, user.username);
  assignIfChanged(update, 'email', email, user.email);
  assignIfChanged(update, 'bio', bio, user.bio);
  assignIfChanged(update, 'membershipTitle', membershipTitle, user.membershipTitle);
  assignIfChanged(update, 'membershipDescription', membershipDescription, user.membershipDescription);
  assignIfChanged(update, 'membershipBenefits', membershipBenefits, user.membershipBenefits || []);
  assignIfChanged(update, 'favoriteTags', favoriteTags, user.favoriteTags || []);
  assignIfChanged(update, 'permanentBanReason', permanentBanReason, user.permanentBanReason);
  assignIfChanged(update, 'postingRestrictionReason', postingRestrictionReason, user.postingRestrictionReason);
  assignIfChanged(update, 'pendingLoginNoticeTitle', pendingLoginNoticeTitle, user.pendingLoginNoticeTitle);
  assignIfChanged(update, 'pendingLoginNoticeMessage', pendingLoginNoticeMessage, user.pendingLoginNoticeMessage);
  assignIfChanged(update, 'searchName', searchFields.searchName, user.searchName);
  assignIfChanged(update, 'searchTokens', searchFields.searchTokens, user.searchTokens || []);

  return update;
}

function buildStoryUpdate(story) {
  const update = {};
  const title = sanitizeInlineText(story.title);
  const description = sanitizeUserText(story.description, {
    preserveLineBreaks: true,
    maxCombiningMarksPerCharacter: STORY_TEXT_MAX_COMBINING_MARKS
  });
  const content = sanitizeUserText(story.content, {
    preserveLineBreaks: true,
    maxCombiningMarksPerCharacter: STORY_TEXT_MAX_COMBINING_MARKS
  });
  const tags = sanitizeTagList(story.tags);
  const searchFields = buildContentSearchFields(title, description);

  assignIfChanged(update, 'title', title, story.title);
  assignIfChanged(update, 'description', description, story.description);
  assignIfChanged(update, 'content', content, story.content);
  assignIfChanged(update, 'tags', tags, story.tags || []);
  assignIfChanged(update, 'searchTitle', searchFields.searchTitle, story.searchTitle);
  assignIfChanged(update, 'searchDescription', searchFields.searchDescription, story.searchDescription);
  assignIfChanged(update, 'searchTokens', searchFields.searchTokens, story.searchTokens || []);

  return update;
}

function buildArtworkUpdate(artwork) {
  const update = {};
  const title = sanitizeInlineText(artwork.title);
  const description = sanitizeUserText(artwork.description, { preserveLineBreaks: true });
  const tags = sanitizeTagList(artwork.tags);
  const searchFields = buildContentSearchFields(title, description);

  assignIfChanged(update, 'title', title, artwork.title);
  assignIfChanged(update, 'description', description, artwork.description);
  assignIfChanged(update, 'tags', tags, artwork.tags || []);
  assignIfChanged(update, 'searchTitle', searchFields.searchTitle, artwork.searchTitle);
  assignIfChanged(update, 'searchDescription', searchFields.searchDescription, artwork.searchDescription);
  assignIfChanged(update, 'searchTokens', searchFields.searchTokens, artwork.searchTokens || []);

  return update;
}

function buildSimpleTextUpdate(document, fieldOptions) {
  const update = {};

  for (const [field, options] of Object.entries(fieldOptions)) {
    const nextValue = options.inline
      ? sanitizeInlineText(document[field])
      : sanitizeUserText(document[field], { preserveLineBreaks: options.preserveLineBreaks !== false });

    assignIfChanged(update, field, nextValue, document[field]);
  }

  return update;
}

async function processCollection({ Model, label, select, buildUpdate }) {
  let scanned = 0;
  let changed = 0;
  let updated = 0;
  let lastId = null;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const documents = await Model.find(query)
      .select(select)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!documents.length) {
      break;
    }

    scanned += documents.length;
    lastId = documents[documents.length - 1]._id;

    const operations = [];

    for (const document of documents) {
      const update = buildUpdate(document);

      if (!Object.keys(update).length) {
        continue;
      }

      changed += 1;
      operations.push({
        updateOne: {
          filter: { _id: document._id },
          update: { $set: update }
        }
      });
    }

    if (!isDryRun && operations.length) {
      const result = await Model.bulkWrite(operations, { ordered: false });
      updated += result.modifiedCount || 0;
    }

    console.log(`[sanitize-text] ${label}: scanned ${scanned}, changed ${changed}${isDryRun ? '' : `, updated ${updated}`}`);
  }

  return { scanned, changed, updated };
}

async function run() {
  validateEnvironment({ requireDatabase: true });
  await connectToDatabase();

  console.log(`[sanitize-text] Connected to MongoDB${isDryRun ? ' (dry run)' : ''}.`);

  const summaries = [];

  summaries.push(await processCollection({
    Model: User,
    label: 'users',
    select: 'username email bio membershipTitle membershipDescription membershipBenefits favoriteTags permanentBanReason postingRestrictionReason pendingLoginNoticeTitle pendingLoginNoticeMessage searchName searchTokens',
    buildUpdate: buildUserUpdate
  }));

  summaries.push(await processCollection({
    Model: Story,
    label: 'stories',
    select: 'title description content tags searchTitle searchDescription searchTokens',
    buildUpdate: buildStoryUpdate
  }));

  summaries.push(await processCollection({
    Model: Artwork,
    label: 'artworks',
    select: 'title description tags searchTitle searchDescription searchTokens',
    buildUpdate: buildArtworkUpdate
  }));

  summaries.push(await processCollection({
    Model: Comment,
    label: 'comments',
    select: 'text',
    buildUpdate: (document) => buildSimpleTextUpdate(document, { text: { preserveLineBreaks: true } })
  }));

  summaries.push(await processCollection({
    Model: Notification,
    label: 'notifications',
    select: 'message commentPreview contentTitle',
    buildUpdate: (document) => buildSimpleTextUpdate(document, {
      message: { preserveLineBreaks: true },
      commentPreview: { preserveLineBreaks: true },
      contentTitle: { inline: true }
    })
  }));

  summaries.push(await processCollection({
    Model: Report,
    label: 'reports',
    select: 'reason',
    buildUpdate: (document) => buildSimpleTextUpdate(document, { reason: { preserveLineBreaks: true } })
  }));

  summaries.push(await processCollection({
    Model: AccountAppeal,
    label: 'account appeals',
    select: 'banReason appealReason evidence reviewReason',
    buildUpdate: (document) => buildSimpleTextUpdate(document, {
      banReason: { preserveLineBreaks: true },
      appealReason: { preserveLineBreaks: true },
      evidence: { preserveLineBreaks: true },
      reviewReason: { preserveLineBreaks: true }
    })
  }));

  summaries.push(await processCollection({
    Model: ModerationCase,
    label: 'moderation cases',
    select: 'workflowNote',
    buildUpdate: (document) => buildSimpleTextUpdate(document, { workflowNote: { preserveLineBreaks: true } })
  }));

  summaries.push(await processCollection({
    Model: ModerationAuditLog,
    label: 'moderation audit logs',
    select: 'actorUsernameSnapshot targetUsernameSnapshot targetUserStatus reason',
    buildUpdate: (document) => buildSimpleTextUpdate(document, {
      actorUsernameSnapshot: { inline: true },
      targetUsernameSnapshot: { inline: true },
      targetUserStatus: { inline: true },
      reason: { preserveLineBreaks: true }
    })
  }));

  const totals = summaries.reduce((accumulator, item) => ({
    scanned: accumulator.scanned + item.scanned,
    changed: accumulator.changed + item.changed,
    updated: accumulator.updated + item.updated
  }), { scanned: 0, changed: 0, updated: 0 });

  console.log('[sanitize-text] Backfill complete.');
  console.log(`[sanitize-text] Total scanned: ${totals.scanned}`);
  console.log(`[sanitize-text] Total changed: ${totals.changed}`);

  if (!isDryRun) {
    console.log(`[sanitize-text] Total updated: ${totals.updated}`);
  }
}

run()
  .catch((error) => {
    console.error('[sanitize-text] Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectFromDatabase();
    } catch {
      // Ignore disconnect errors during shutdown.
    }
  });