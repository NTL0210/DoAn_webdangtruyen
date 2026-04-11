import Artwork from '../models/Artwork.js';
import Story from '../models/Story.js';
import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { validateEnvironment } from '../config/env.js';
import { buildMediaSummary, createImageAssetFromStoredUrl, normalizeImageAssets } from '../utils/imageVariants.js';

const BATCH_SIZE = 100;
const isDryRun = process.argv.includes('--dry-run');

function arraysEqual(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function buildUpdatedMedia(document) {
  const sourceImages = Array.isArray(document.images) ? document.images : [];
  const existingAssets = normalizeImageAssets(document.imageAssets, sourceImages);
  const resolvedAssets = [];

  for (const image of sourceImages) {
    const matchingAsset = existingAssets.find((asset) => asset.originalUrl === image);

    if (matchingAsset?.previewUrl && matchingAsset.previewUrl !== matchingAsset.originalUrl) {
      resolvedAssets.push(matchingAsset);
      continue;
    }

    const rebuiltAsset = await createImageAssetFromStoredUrl(image);
    if (rebuiltAsset) {
      resolvedAssets.push(rebuiltAsset);
    }
  }

  return {
    imageAssets: resolvedAssets,
    mediaSummary: buildMediaSummary(resolvedAssets)
  };
}

async function processModel(Model, label) {
  let scanned = 0;
  let changed = 0;
  let updated = 0;
  let lastId = null;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const documents = await Model.find(query)
      .select('_id images imageAssets mediaSummary')
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
      if (!Array.isArray(document.images) || !document.images.length) {
        continue;
      }

      const nextMedia = await buildUpdatedMedia(document);
      const currentAssets = normalizeImageAssets(document.imageAssets, document.images);
      const currentSummary = document.mediaSummary || {};

      if (arraysEqual(currentAssets, nextMedia.imageAssets) && JSON.stringify(currentSummary) === JSON.stringify(nextMedia.mediaSummary)) {
        continue;
      }

      changed += 1;
      operations.push({
        updateOne: {
          filter: { _id: document._id },
          update: {
            $set: {
              imageAssets: nextMedia.imageAssets,
              mediaSummary: nextMedia.mediaSummary
            }
          }
        }
      });
    }

    if (!isDryRun && operations.length) {
      const result = await Model.bulkWrite(operations, { ordered: false });
      updated += result.modifiedCount || 0;
    }

    console.log(`[media-preview-backfill] ${label}: scanned ${scanned}, changed ${changed}${isDryRun ? '' : `, updated ${updated}`}`);
  }

  return { scanned, changed, updated };
}

async function run() {
  validateEnvironment({ requireDatabase: true });
  await connectToDatabase();
  console.log(`[media-preview-backfill] Connected to MongoDB${isDryRun ? ' (dry run)' : ''}.`);

  const storyStats = await processModel(Story, 'stories');
  const artworkStats = await processModel(Artwork, 'artworks');

  console.log('[media-preview-backfill] Backfill complete.');
  console.log(`[media-preview-backfill] Stories scanned: ${storyStats.scanned}, changed: ${storyStats.changed}${isDryRun ? '' : `, updated: ${storyStats.updated}`}`);
  console.log(`[media-preview-backfill] Artworks scanned: ${artworkStats.scanned}, changed: ${artworkStats.changed}${isDryRun ? '' : `, updated: ${artworkStats.updated}`}`);
}

run()
  .catch((error) => {
    console.error('[media-preview-backfill] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectFromDatabase();
    } catch {
      // Ignore disconnect errors during shutdown.
    }
  });