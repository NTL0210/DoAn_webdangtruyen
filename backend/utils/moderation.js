export const POSTING_RESTRICTION_DAYS = 3;

export function normalizeModerationReason(reason) {
  return String(reason || '').trim();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getActivePostingRestriction(user) {
  if (!user?.postingRestrictedUntil) {
    return null;
  }

  const restrictedUntil = new Date(user.postingRestrictedUntil);
  if (Number.isNaN(restrictedUntil.getTime()) || restrictedUntil <= new Date()) {
    return null;
  }

  return {
    until: restrictedUntil,
    reason: user.postingRestrictionReason || '',
    source: user.postingRestrictionSource || null
  };
}

export async function clearExpiredPostingRestriction(user) {
  if (!user?.postingRestrictedUntil) {
    return user;
  }

  const restrictedUntil = new Date(user.postingRestrictedUntil);
  if (Number.isNaN(restrictedUntil.getTime()) || restrictedUntil > new Date()) {
    return user;
  }

  user.postingRestrictedUntil = null;
  user.postingRestrictionReason = '';
  user.postingRestrictionSource = null;
  await user.save();
  return user;
}

export async function applyPostingRestriction(user, { reason, source, days = POSTING_RESTRICTION_DAYS }) {
  const nextRestrictionEnd = addDays(new Date(), days);
  const currentRestrictionEnd = user.postingRestrictedUntil ? new Date(user.postingRestrictedUntil) : null;

  user.postingRestrictedUntil = currentRestrictionEnd && currentRestrictionEnd > nextRestrictionEnd
    ? currentRestrictionEnd
    : nextRestrictionEnd;
  user.postingRestrictionReason = normalizeModerationReason(reason);
  user.postingRestrictionSource = source;
  user.lastModeratedAt = new Date();

  await user.save();
  return user;
}

export function serializePostingRestriction(user) {
  const restriction = getActivePostingRestriction(user);

  return {
    isPostingRestricted: Boolean(restriction),
    postingRestrictedUntil: restriction?.until ?? null,
    postingRestrictionReason: restriction?.reason ?? '',
    postingRestrictionSource: restriction?.source ?? null
  };
}