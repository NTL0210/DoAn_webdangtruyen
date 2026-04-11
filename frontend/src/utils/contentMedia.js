const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function toAbsoluteMediaUrl(url) {
  if (!url) {
    return '';
  }

  if (url.startsWith('http') || url.startsWith('data:image')) {
    return url;
  }

  return `${API_URL}${url}`;
}

function normalizeAsset(asset) {
  if (!asset) {
    return null;
  }

  if (typeof asset === 'string') {
    const normalizedUrl = asset.trim();

    if (!normalizedUrl) {
      return null;
    }

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

  const originalUrl = String(asset.originalUrl || asset.url || '').trim();

  if (!originalUrl) {
    return null;
  }

  return {
    originalUrl,
    previewUrl: String(asset.previewUrl || originalUrl).trim() || originalUrl,
    width: Number(asset.width) || 0,
    height: Number(asset.height) || 0,
    previewWidth: Number(asset.previewWidth) || 0,
    previewHeight: Number(asset.previewHeight) || 0,
    isUltraHd: asset.isUltraHd === true,
    qualityLabel: String(asset.qualityLabel || '').trim()
  };
}

export function getContentImageAssets(content) {
  if (Array.isArray(content?.imageAssets) && content.imageAssets.length) {
    return content.imageAssets.map(normalizeAsset).filter(Boolean);
  }

  return (Array.isArray(content?.images) ? content.images : []).map(normalizeAsset).filter(Boolean);
}

export function getDisplayImageUrl(asset, { preferPreview = false } = {}) {
  const normalizedAsset = normalizeAsset(asset);

  if (!normalizedAsset) {
    return '';
  }

  const selectedUrl = preferPreview
    ? (normalizedAsset.previewUrl || normalizedAsset.originalUrl)
    : (normalizedAsset.originalUrl || normalizedAsset.previewUrl);

  return toAbsoluteMediaUrl(selectedUrl);
}

export function getContentQualityBadge(content) {
  const hasStructuredMedia = Boolean(content?.mediaSummary) || (Array.isArray(content?.imageAssets) && content.imageAssets.length > 0);

  if (!hasStructuredMedia) {
    return null;
  }

  const assets = getContentImageAssets(content);

  if (!assets.length) {
    return null;
  }

  const hasUltraHd = content?.mediaSummary?.hasUltraHd === true || assets.some((asset) => asset.isUltraHd);

  return hasUltraHd
    ? { label: '4K source', tone: 'ultra' }
    : { label: 'HD source', tone: 'standard' };
}