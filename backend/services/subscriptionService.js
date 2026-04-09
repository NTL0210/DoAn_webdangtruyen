import ArtistSubscription from '../models/ArtistSubscription.js';

export function canPublishSubscriberOnlyContent(user) {
  return Boolean(
    user &&
    user.creatorPlan === 'premium_artist' &&
    user.premiumStatus === 'active' &&
    user.subscriptionEnabled === true &&
    typeof user.subscriptionPrice === 'number' &&
    user.subscriptionPrice >= 0
  );
}

export async function getActiveArtistSubscription(subscriberId, artistId) {
  if (!subscriberId || !artistId) {
    return null;
  }

  return ArtistSubscription.findOne({
    subscriber: subscriberId,
    artist: artistId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).lean();
}

export async function hasActiveArtistSubscription(subscriberId, artistId) {
  const subscription = await getActiveArtistSubscription(subscriberId, artistId);
  return Boolean(subscription);
}

export async function canAccessPremiumContent({ viewerUserId, viewerRole, artistId }) {
  if (viewerRole === 'admin') {
    return true;
  }

  if (!artistId) {
    return false;
  }

  if (viewerUserId && String(viewerUserId) === String(artistId)) {
    return true;
  }

  return hasActiveArtistSubscription(viewerUserId, artistId);
}
