import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

import { uploadsDir } from '../config/paths.js';

sharp.concurrency(1);
sharp.cache({
  memory: 32,
  files: 0,
  items: 64
});

const PREVIEW_MAX_DIMENSION = 1080;
const ULTRA_HD_WIDTH = 3840;
const ULTRA_HD_HEIGHT = 2160;
const UPLOADS_ROUTE_PREFIX = '/uploads/';

function getUploadsPublicUrl(filename) {
  return `${UPLOADS_ROUTE_PREFIX}${filename}`;
}

function getAbsoluteUploadPathFromUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(UPLOADS_ROUTE_PREFIX)) {
    return null;
  }

  return path.join(uploadsDir, path.basename(url.slice(UPLOADS_ROUTE_PREFIX.length)));
}

export function createLegacyImageAsset(url) {
  const normalizedUrl = String(url || '').trim();

  return {
    originalUrl: normalizedUrl,
    previewUrl: normalizedUrl,
    width: 0,
    height: 0,
    previewWidth: 0,
    previewHeight: 0,
    isUltraHd: false,
    qualityLabel: ''
  };
}

export function normalizeImageAssets(imageAssets = [], fallbackImages = []) {
  if (Array.isArray(imageAssets) && imageAssets.length) {
    return imageAssets
      .map((asset) => {
        if (!asset || typeof asset !== 'object') {
          return null;
        }

        const originalUrl = String(asset.originalUrl || asset.url || '').trim();
        if (!originalUrl) {
          return null;
        }

        const previewUrl = String(asset.previewUrl || originalUrl).trim() || originalUrl;
        const width = Number(asset.width) || 0;
        const height = Number(asset.height) || 0;
        const previewWidth = Number(asset.previewWidth) || width;
        const previewHeight = Number(asset.previewHeight) || height;
        const isUltraHd = asset.isUltraHd === true || width >= ULTRA_HD_WIDTH || height >= ULTRA_HD_HEIGHT;

        return {
          originalUrl,
          previewUrl,
          width,
          height,
          previewWidth,
          previewHeight,
          isUltraHd,
          qualityLabel: isUltraHd ? '4K' : (asset.qualityLabel || (width || height ? 'HD' : ''))
        };
      })
      .filter(Boolean);
  }

  return (Array.isArray(fallbackImages) ? fallbackImages : [])
    .map((url) => createLegacyImageAsset(url))
    .filter((asset) => asset.originalUrl);
}

export function buildMediaSummary(imageAssets = []) {
  const normalizedAssets = normalizeImageAssets(imageAssets);
  const highestWidth = normalizedAssets.reduce((maxValue, asset) => Math.max(maxValue, Number(asset.width) || 0), 0);
  const highestHeight = normalizedAssets.reduce((maxValue, asset) => Math.max(maxValue, Number(asset.height) || 0), 0);

  return {
    imageCount: normalizedAssets.length,
    hasUltraHd: normalizedAssets.some((asset) => asset.isUltraHd),
    highestWidth,
    highestHeight,
    previewMaxDimension: PREVIEW_MAX_DIMENSION
  };
}

export async function enrichUploadedImageFile(file) {
  const metadata = await sharp(file.path, {
    animated: file.mimetype === 'image/gif'
  }).metadata();

  const width = Number(metadata.width) || 0;
  const height = Number(metadata.height) || 0;
  const isUltraHd = width >= ULTRA_HD_WIDTH || height >= ULTRA_HD_HEIGHT;
  const qualityLabel = isUltraHd ? '4K' : (width || height ? 'HD' : '');
  let previewFilename = null;
  let previewPath = null;
  let previewUrl = getUploadsPublicUrl(file.filename);
  let previewWidth = width;
  let previewHeight = height;

  if (file.mimetype !== 'image/gif' && Math.max(width, height) > PREVIEW_MAX_DIMENSION) {
    previewFilename = `${path.parse(file.filename).name}-preview.webp`;
    previewPath = path.join(uploadsDir, previewFilename);

    const previewResult = await sharp(file.path)
      .rotate()
      .resize({
        width: PREVIEW_MAX_DIMENSION,
        height: PREVIEW_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(previewPath);

    previewUrl = getUploadsPublicUrl(previewFilename);
    previewWidth = Number(previewResult.width) || previewWidth;
    previewHeight = Number(previewResult.height) || previewHeight;
  }

  return {
    ...file,
    previewFilename,
    previewPath,
    imageAsset: {
      originalUrl: getUploadsPublicUrl(file.filename),
      previewUrl,
      width,
      height,
      previewWidth,
      previewHeight,
      isUltraHd,
      qualityLabel
    }
  };
}

export async function deleteImageAssetFiles(imageAssets = []) {
  const absolutePaths = [...new Set(normalizeImageAssets(imageAssets)
    .flatMap((asset) => [asset.originalUrl, asset.previewUrl])
    .map((url) => getAbsoluteUploadPathFromUrl(url))
    .filter(Boolean))];

  await Promise.all(absolutePaths.map(async (absolutePath) => {
    try {
      await fs.unlink(absolutePath);
    } catch {
      // Ignore cleanup failures for missing or already-deleted files.
    }
  }));
}

export function resolveUploadPathFromUrl(url) {
  return getAbsoluteUploadPathFromUrl(url);
}

export async function createImageAssetFromStoredUrl(url) {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl) {
    return null;
  }

  const absolutePath = getAbsoluteUploadPathFromUrl(normalizedUrl);

  if (!absolutePath) {
    return createLegacyImageAsset(normalizedUrl);
  }

  const widthMetadata = await sharp(absolutePath).metadata();
  const width = Number(widthMetadata.width) || 0;
  const height = Number(widthMetadata.height) || 0;
  const isUltraHd = width >= ULTRA_HD_WIDTH || height >= ULTRA_HD_HEIGHT;
  const qualityLabel = isUltraHd ? '4K' : (width || height ? 'HD' : '');
  let previewUrl = normalizedUrl;
  let previewWidth = width;
  let previewHeight = height;

  if (Math.max(width, height) > PREVIEW_MAX_DIMENSION && widthMetadata.format !== 'gif') {
    const baseFilename = path.parse(path.basename(absolutePath)).name;
    const previewFilename = `${baseFilename}-preview.webp`;
    const previewPath = path.join(uploadsDir, previewFilename);

    try {
      await fs.access(previewPath);
      const previewMetadata = await sharp(previewPath).metadata();
      previewUrl = getUploadsPublicUrl(previewFilename);
      previewWidth = Number(previewMetadata.width) || previewWidth;
      previewHeight = Number(previewMetadata.height) || previewHeight;
    } catch {
      const previewResult = await sharp(absolutePath)
        .rotate()
        .resize({
          width: PREVIEW_MAX_DIMENSION,
          height: PREVIEW_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(previewPath);

      previewUrl = getUploadsPublicUrl(previewFilename);
      previewWidth = Number(previewResult.width) || previewWidth;
      previewHeight = Number(previewResult.height) || previewHeight;
    }
  }

  return {
    originalUrl: normalizedUrl,
    previewUrl,
    width,
    height,
    previewWidth,
    previewHeight,
    isUltraHd,
    qualityLabel
  };
}