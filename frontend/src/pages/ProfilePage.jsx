import { Bookmark, Crown, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCurrentUser, getToken, setCurrentUser, subscribeToCurrentUserChange, updateCurrentUserCollection } from '../services/authService';
import { invalidateContentMutationCaches, invalidateCreatorPresentationCaches } from '../services/appDataInvalidation';
import { emitCreatorPresentationRefresh } from '../services/creatorPresentationEvents';
import { PremiumPromptBanner } from '../components/common/PremiumPromptBanner';
import { fetchJsonWithCache, FRONTEND_CACHE_NAMESPACES, getFrontendCacheScope, invalidateFrontendCache } from '../services/frontendCache';
import { getRoutePrefetchProps } from '../services/routePrefetch';
import { getContentImageAssets, getDisplayImageUrl } from '../utils/contentMedia';
import { formatCount, formatRelative } from '../utils/helpers';
import { validateSingleImageBeforeUpload } from '../utils/fileValidation';
import { formatTag, normalizeTagList } from '../utils/hashtags';
import { toSafeInitial, toSafeInlineText, toSafeText } from '../utils/safeText';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ProfilePage() {
  const { id } = useParams();
  const currentUser = getCurrentUser();
  const resolvedUserId = id || currentUser?.id || currentUser?._id;
  const isOwnProfile = !id || id === (currentUser?.id || currentUser?._id);

  const [profile, setProfile] = useState(null);
  const [content, setContent] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);
  const [twoFactorFeedback, setTwoFactorFeedback] = useState('');
  const [followers, setFollowers] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [history, setHistory] = useState([]);
  const [membershipOffer, setMembershipOffer] = useState({ isAvailable: false, isEnabled: false, price: 0, durationDays: 30 });
  const [viewerMembership, setViewerMembership] = useState({ isSubscribed: false, expiresAt: null, subscriptionId: null });
  const [viewerCanAccessPremium, setViewerCanAccessPremium] = useState(false);
  const [contentVisibilityFilter, setContentVisibilityFilter] = useState('all');
  const [relationView, setRelationView] = useState('');
  const [authUser, setAuthUser] = useState(() => getCurrentUser());
  const [pendingInteractionKey, setPendingInteractionKey] = useState('');
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    bio: '',
    twoFactorEnabled: false,
    subscriptionEnabled: true,
    subscriptionPrice: '0',
    membershipTitle: 'Artist Membership',
    membershipDescription: '',
    membershipBenefitsText: ''
  });
  const likedIds = Array.isArray(authUser?.likes) ? authUser.likes.map((value) => String(value)) : [];
  const bookmarkedIds = Array.isArray(authUser?.bookmarks) ? authUser.bookmarks.map((value) => String(value)) : [];
  const profileCacheScope = getFrontendCacheScope(authUser?.id || authUser?._id);
  const premiumExpiresAt = profile?.premiumExpiresAt ? new Date(profile.premiumExpiresAt) : null;
  const membershipExpiresAt = viewerMembership?.expiresAt ? new Date(viewerMembership.expiresAt) : null;
  const isPremiumActive = profile?.creatorPlan === 'premium_artist'
    && profile?.premiumStatus === 'active'
    && premiumExpiresAt
    && premiumExpiresAt > new Date();

  const syncProfileState = (updatedUser, previousForm = null) => {
    setProfile(updatedUser);
    setProfileForm((prev) => {
      const base = previousForm || prev;
      return {
        ...base,
        username: updatedUser.username ?? base.username,
        email: updatedUser.email ?? base.email,
        bio: updatedUser.bio ?? base.bio,
        twoFactorEnabled: updatedUser.twoFactorEnabled === true,
        subscriptionEnabled: updatedUser.subscriptionEnabled ?? base.subscriptionEnabled,
        subscriptionPrice: String(updatedUser.subscriptionPrice ?? base.subscriptionPrice),
        membershipTitle: updatedUser.membershipTitle || base.membershipTitle,
        membershipDescription: updatedUser.membershipDescription || base.membershipDescription,
        membershipBenefitsText: Array.isArray(updatedUser.membershipBenefits)
          ? updatedUser.membershipBenefits.join('\n')
          : base.membershipBenefitsText
      };
    });
    setCurrentUser({
      ...(getCurrentUser() || {}),
      ...updatedUser,
      id: updatedUser._id || getCurrentUser()?.id
    });
    emitCreatorPresentationRefresh(updatedUser);
    invalidateCreatorPresentationCaches();
  };

  useEffect(() => subscribeToCurrentUserChange(setAuthUser), []);

  useEffect(() => {
    if (!resolvedUserId) {
      setError('User ID not found. Please logout and login again.');
      setLoading(false);
      return;
    }

    fetchProfile();
    if (isOwnProfile) {
      fetchReadingHistory();
    }
    fetchFollowingPreview();
  }, [resolvedUserId, isOwnProfile]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const headers = token
        ? {
            Authorization: `Bearer ${token}`
          }
        : undefined;
      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.PROFILE,
        key: `profile:${encodeURIComponent(String(resolvedUserId))}:own:${isOwnProfile ? '1' : '0'}`,
        url: `${API_URL}/api/users/${resolvedUserId}`,
        ttlMs: 45 * 1000,
        scope: profileCacheScope,
        options: headers ? { headers } : undefined
      });

      if (!data.success) {
        setProfile(null);
        setContent([]);
        setStats({ followerCount: 0, followingCount: 0 });
        setFollowingList([]);
        setError(data.error?.message || 'User not found');
        return;
      }

      setProfile(data.data.user);
      if (isOwnProfile) {
        setCurrentUser({
          ...(getCurrentUser() || {}),
          ...data.data.user
        });
      }
      setContent(data.data.content || []);
      setIsFollowing(data.data.isFollowing || false);
      setMembershipOffer(data.data.membershipOffer || { isAvailable: false, isEnabled: false, price: 0, durationDays: 30 });
      setViewerMembership(data.data.viewerMembership || { isSubscribed: false, expiresAt: null, subscriptionId: null });
      setViewerCanAccessPremium(data.data.viewerCanAccessPremium === true);
      setStats({
        followerCount: data.data.followerCount || 0,
        followingCount: data.data.followingCount || 0
      });
      setProfileForm({
        username: data.data.user.username || '',
        email: data.data.user.email || '',
        bio: data.data.user.bio || '',
        twoFactorEnabled: data.data.user.twoFactorEnabled === true,
        subscriptionEnabled: data.data.user.subscriptionEnabled ?? true,
        subscriptionPrice: String(data.data.user.subscriptionPrice ?? 0),
        membershipTitle: data.data.user.membershipTitle || 'Artist Membership',
        membershipDescription: data.data.user.membershipDescription || '',
        membershipBenefitsText: Array.isArray(data.data.user.membershipBenefits)
          ? data.data.user.membershipBenefits.join('\n')
          : ''
      });
      setError('');
    } catch (err) {
      setProfile(null);
      setContent([]);
      setError(`Failed to load profile: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchReadingHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/me/history`, {
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load reading history:', err);
    }
  };

  const fetchFollowingPreview = async () => {
    try {
      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.PROFILE,
        key: `following-preview:${encodeURIComponent(String(resolvedUserId))}`,
        url: `${API_URL}/api/users/${resolvedUserId}/following`,
        ttlMs: 45 * 1000,
        scope: 'shared'
      });

      if (data.success) {
        setFollowingList(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load following preview:', err);
    }
  };

  const fetchRelationList = async (type) => {
    try {
      const data = await fetchJsonWithCache({
        namespace: FRONTEND_CACHE_NAMESPACES.PROFILE,
        key: `${type}:${encodeURIComponent(String(resolvedUserId))}`,
        url: `${API_URL}/api/users/${resolvedUserId}/${type}`,
        ttlMs: 45 * 1000,
        scope: 'shared'
      });

      if (!data.success) return;

      if (type === 'followers') {
        setFollowers(data.data || []);
      } else {
        setFollowingList(data.data || []);
      }

      setRelationView(type);
    } catch (err) {
      console.error(`Failed to load ${type}:`, err);
    }
  };

  const handleFollow = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${resolvedUserId}/follow`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setIsFollowing(true);
        setStats((prev) => ({ ...prev, followerCount: prev.followerCount + 1 }));
        invalidateFrontendCache([
          FRONTEND_CACHE_NAMESPACES.PROFILE,
          FRONTEND_CACHE_NAMESPACES.CREATOR_SEARCH
        ]);
      }
    } catch (err) {
      console.error('Failed to follow user:', err);
    }
  };

  const handleUnfollow = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${resolvedUserId}/follow`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setIsFollowing(false);
        setStats((prev) => ({ ...prev, followerCount: Math.max(0, prev.followerCount - 1) }));
        invalidateFrontendCache([
          FRONTEND_CACHE_NAMESPACES.PROFILE,
          FRONTEND_CACHE_NAMESPACES.CREATOR_SEARCH
        ]);
      }
    } catch (err) {
      console.error('Failed to unfollow user:', err);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = await validateSingleImageBeforeUpload(file, {
      maxSizeBytes: 5 * 1024 * 1024,
      fieldLabel: 'avatar'
    });

    if (!validation.valid) {
      setError(validation.error);
      event.target.value = '';
      return;
    }

    setUploadingAvatar(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_URL}/api/users/avatar`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to upload avatar');
        return;
      }

      syncProfileState(data.data);
    } catch (err) {
      setError('An error occurred while uploading avatar');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setTwoFactorFeedback('');

    try {
      const payload = {
        username: profileForm.username,
        email: profileForm.email,
        bio: profileForm.bio,
        twoFactorEnabled: profileForm.twoFactorEnabled
      };

      if (profile?.creatorPlan === 'premium_artist') {
        payload.subscriptionEnabled = profileForm.subscriptionEnabled;
        payload.subscriptionPrice = Number.parseInt(profileForm.subscriptionPrice || '0', 10) || 0;
        payload.membershipTitle = profileForm.membershipTitle;
        payload.membershipDescription = profileForm.membershipDescription;
        payload.membershipBenefits = profileForm.membershipBenefitsText;
      }

      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to update profile');
        return;
      }

      syncProfileState(data.data);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTwoFactorToggle = async () => {
    if (savingTwoFactor || savingProfile) {
      return;
    }

    const previousValue = profileForm.twoFactorEnabled;
    const nextValue = !previousValue;

    setProfileForm((prev) => ({
      ...prev,
      twoFactorEnabled: nextValue
    }));
    setSavingTwoFactor(true);
    setTwoFactorFeedback(nextValue ? 'Enabling two-step verification...' : 'Disabling two-step verification...');
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          twoFactorEnabled: nextValue
        })
      });

      const data = await response.json();

      if (!data.success) {
        setProfileForm((prev) => ({
          ...prev,
          twoFactorEnabled: previousValue
        }));
        setError(data.error?.message || 'Failed to update security setting');
        setTwoFactorFeedback('');
        return;
      }

      syncProfileState(data.data, {
        ...profileForm,
        twoFactorEnabled: nextValue
      });
      setTwoFactorFeedback(nextValue ? 'Two-step verification was enabled and saved.' : 'Two-step verification was disabled and saved.');
    } catch (err) {
      setProfileForm((prev) => ({
        ...prev,
        twoFactorEnabled: previousValue
      }));
      setError('Failed to update security setting');
      setTwoFactorFeedback('');
    } finally {
      setSavingTwoFactor(false);
    }
  };

  const handleContentInteraction = async (contentId, action) => {
    if (!getToken()) {
      alert('Please login to like or bookmark posts.');
      return;
    }

    const interactionKey = `${action}:${contentId}`;
    if (pendingInteractionKey) {
      return;
    }

    const currentLikes = Array.isArray(authUser?.likes) ? authUser.likes.map((value) => String(value)) : [];
    const currentBookmarks = Array.isArray(authUser?.bookmarks) ? authUser.bookmarks.map((value) => String(value)) : [];
    const nextActive = action === 'like'
      ? !currentLikes.includes(String(contentId))
      : !currentBookmarks.includes(String(contentId));

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

      setContent((prev) => prev.map((item) => (String(item._id) === String(contentId) ? data.data : item)));
      invalidateContentMutationCaches();
      updateCurrentUserCollection(action === 'like' ? 'likes' : 'bookmarks', contentId, nextActive);
    } catch (err) {
      alert(`Failed to update ${action}`);
    } finally {
      setPendingInteractionKey('');
    }
  };

  if (loading) {
    return (
      <div className="panel flex min-h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-brand" />
          <p className="text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="detail-empty-state">
        <div className="text-lg font-semibold text-white">Cannot load profile</div>
        <p className="max-w-md text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  const relationData = relationView === 'followers' ? followers : followingList;
  const publicContent = content.filter((item) => item.isPremium !== true);
  const premiumContent = content.filter((item) => item.isPremium === true);
  const shouldShowPremiumFilter = isOwnProfile || viewerCanAccessPremium || premiumContent.length > 0;
  const safeProfileUsername = toSafeInlineText(profile?.username, 'Unknown');
  const safeProfileEmail = toSafeInlineText(profile?.email, '');
  const safeProfileBio = toSafeText(profile?.bio, { fallback: '' });
  const filteredContent = content.filter((item) => {
    if (contentVisibilityFilter === 'public') {
      return item.isPremium !== true;
    }

    if (contentVisibilityFilter === 'premium') {
      return item.isPremium === true;
    }

    return true;
  });

  return (
    <div className="detail-shell max-w-7xl">
      <div className="detail-hero">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-1 items-start gap-6">
            <div className="relative">
              {profile?.avatar ? (
                <img
                  src={`${API_URL}${profile.avatar}`}
                  alt={safeProfileUsername}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-4xl font-semibold text-white">
                  {toSafeInitial(profile?.username)}
                </div>
              )}

              {isOwnProfile ? (
                <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-light">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                  {uploadingAvatar ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </label>
              ) : null}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <p className="detail-eyebrow">Profile detail</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="detail-title">{safeProfileUsername}</h1>
                  {isPremiumActive ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                      <Crown className="h-3.5 w-3.5" />
                      Premium Artist
                    </span>
                  ) : null}
                </div>
                <p className="text-slate-400">{safeProfileEmail}</p>
              </div>

              {safeProfileBio ? <p className="max-w-2xl text-sm leading-6 text-slate-300">{safeProfileBio}</p> : null}

              <div className="flex flex-wrap gap-3 text-sm">
                <button type="button" onClick={() => fetchRelationList('followers')} className="detail-inline-button">
                  {stats.followerCount} followers
                </button>
                <button type="button" onClick={() => fetchRelationList('following')} className="detail-inline-button">
                  {stats.followingCount} following
                </button>
                <span className="detail-count-pill px-4 py-2">
                  {content.length} posts
                </span>
                {profile?.role === 'admin' ? (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-sm text-rose-300">
                    Admin
                  </span>
                ) : null}
              </div>

              {!isOwnProfile && isPremiumActive ? (
                <div className="mt-4 rounded-[1.4rem] border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-slate-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Artist membership</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {membershipOffer?.description || 'Join this artist to unlock only their members-only posts. Premium posts from other artists still require separate memberships.'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-end">
                      <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                        {membershipOffer?.title || 'Artist Membership'}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                        {new Intl.NumberFormat('vi-VN').format(membershipOffer?.price || 0)}₫ / {membershipOffer?.durationDays || 30} days
                      </div>
                      {viewerMembership?.isSubscribed ? (
                        <Link
                          to={`/membership/${resolvedUserId}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/18"
                        >
                          Active member until {membershipExpiresAt?.toLocaleDateString()}
                        </Link>
                      ) : membershipOffer?.isAvailable ? (
                        <Link
                          to={`/membership/${resolvedUserId}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/20 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/28"
                        >
                          Join membership
                        </Link>
                      ) : (
                        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
                          Membership is not purchasable right now.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {!isOwnProfile ? (
            isFollowing ? (
              <button
                type="button"
                onClick={handleUnfollow}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              >
                Unfollow
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFollow}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-light"
              >
                Follow
              </button>
            )
          ) : null}
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}

        {isOwnProfile && isPremiumActive ? (
          <div className="mt-6 rounded-[1.75rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/12 via-slate-950 to-slate-950 p-5 shadow-[0_20px_50px_rgba(16,185,129,0.12)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  <Crown className="h-3.5 w-3.5" />
                  Premium active
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">Your premium creator account is live.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  You can now publish public posts or members-only posts from both Story and Artwork editors.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active until</div>
                <div className="mt-1 font-semibold text-white">{premiumExpiresAt?.toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        ) : null}

        {isOwnProfile && !isPremiumActive && (
          <div className="mt-6">
            <PremiumPromptBanner variant="profile" />
          </div>
        )}
      </div>

      {isOwnProfile ? (
        <>
          <section className="detail-card p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="detail-eyebrow">Account security</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Two-step verification</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Turn on OTP verification for login. After entering the correct password, the system will open a confirmation popup and send a 6-digit code to your email.
                </p>
              </div>

              <div className="flex w-full max-w-[22rem] flex-col gap-3 lg:items-end">
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  profileForm.twoFactorEnabled
                    ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}>
                  {profileForm.twoFactorEnabled ? 'OTP required on login' : 'Password-only login'}
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:justify-end">
                  <button
                    type="button"
                    onClick={handleTwoFactorToggle}
                    disabled={savingTwoFactor || savingProfile}
                    className={`inline-flex min-w-[10.5rem] items-center justify-center rounded-2xl border px-5 py-2.5 text-sm font-medium transition ${
                      profileForm.twoFactorEnabled
                        ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/18'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {savingTwoFactor
                      ? profileForm.twoFactorEnabled
                        ? 'Saving enabled state...'
                        : 'Saving disabled state...'
                      : profileForm.twoFactorEnabled
                        ? 'Disable 2FA'
                        : 'Enable 2FA'}
                  </button>
                  <div className="inline-flex min-w-[10.5rem] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
                    Auto-saves instantly
                  </div>
                </div>
                {twoFactorFeedback ? (
                  <p className="w-full text-sm text-cyan-200 lg:text-right">
                    {twoFactorFeedback}
                  </p>
                ) : (
                  <p className="w-full text-sm text-slate-400 lg:text-right">
                    Changes here are saved immediately. You do not need to press Save All Changes.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Delivery email</div>
                <div className="mt-2 font-medium text-white">{profileForm.email || 'Add an email to use email OTP login verification.'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Visibility</div>
                <div className="mt-2 text-slate-300">The login popup hides your email and only shows the last 3 characters before the domain.</div>
              </div>
            </div>
          </section>

          <form id="profile-settings-form" onSubmit={handleProfileSubmit} className="detail-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Edit Profile</h2>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Username</label>
              <input
                type="text"
                value={profileForm.username}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, username: event.target.value }))}
                className="input-base"
                maxLength={50}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                className="input-base"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">Bio</label>
              <textarea
                value={profileForm.bio}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
                className="input-base resize-none"
                rows={4}
                maxLength={300}
                placeholder="Tell people about yourself..."
              />
            </div>

            {profile?.creatorPlan === 'premium_artist' ? (
              <div className="lg:col-span-2 rounded-[1.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Membership settings</div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      Control whether users can buy access to your members-only posts, set the monthly price, and customize how your plan is presented.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProfileForm((prev) => ({
                      ...prev,
                      subscriptionEnabled: !prev.subscriptionEnabled
                    }))}
                    className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                      profileForm.subscriptionEnabled
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/18'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {profileForm.subscriptionEnabled ? 'Membership open' : 'Membership paused'}
                  </button>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Monthly price (VND)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={profileForm.subscriptionPrice}
                      onChange={(event) => setProfileForm((prev) => ({
                        ...prev,
                        subscriptionPrice: event.target.value
                      }))}
                      className="input-base"
                      placeholder="99000"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Plan title</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={profileForm.membershipTitle}
                      onChange={(event) => setProfileForm((prev) => ({
                        ...prev,
                        membershipTitle: event.target.value
                      }))}
                      className="input-base"
                      placeholder="Artist Membership"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-300">Plan description</label>
                    <textarea
                      value={profileForm.membershipDescription}
                      onChange={(event) => setProfileForm((prev) => ({
                        ...prev,
                        membershipDescription: event.target.value
                      }))}
                      className="input-base resize-none"
                      rows={3}
                      maxLength={500}
                      placeholder="Tell followers what this membership unlocks and why it is worth joining."
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-300">Benefits list</label>
                    <textarea
                      value={profileForm.membershipBenefitsText}
                      onChange={(event) => setProfileForm((prev) => ({
                        ...prev,
                        membershipBenefitsText: event.target.value
                      }))}
                      className="input-base resize-none"
                      rows={4}
                      placeholder={"Premium stories\nPremium artworks\nBehind-the-scenes posts"}
                    />
                    <p className="mt-2 text-xs text-slate-400">One benefit per line, up to 8 lines.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Preview</div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                      {toSafeInlineText(profileForm.membershipTitle, 'Artist Membership')}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {new Intl.NumberFormat('vi-VN').format(Number(profileForm.subscriptionPrice || 0))}₫ / 30 days
                    </div>
                    <p className="mt-2 leading-6 text-slate-300">
                      {toSafeText(profileForm.membershipDescription, { fallback: 'Describe what users unlock when they join your membership.' })}
                    </p>
                    {(profileForm.membershipBenefitsText || '').trim() ? (
                      <div className="mt-3 space-y-2">
                        {profileForm.membershipBenefitsText.split(/\r?\n/).filter(Boolean).slice(0, 4).map((benefit) => (
                          <div key={benefit} className="text-xs text-slate-400">• {toSafeText(benefit)}</div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 leading-6 text-slate-400">
                      Users who buy this membership can unlock only your premium stories and artworks. Other artists remain separately locked.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-300">
                    Membership settings are saved together with your profile changes.
                  </p>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/20 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/28 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingProfile ? 'Saving membership...' : 'Save Membership Settings'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          </form>
        </>
      ) : null}

      <section className="detail-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="detail-eyebrow">Creator network</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Following creators</h2>
          </div>
          {followingList.length > 0 ? (
            <button type="button" onClick={() => fetchRelationList('following')} className="detail-inline-button px-4 py-2 text-xs">
              View all
            </button>
          ) : null}
        </div>

        {followingList.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {followingList.slice(0, 6).map((creator) => (
              <Link key={creator._id} to={`/profile/${creator._id}`} className="panel-soft flex items-center gap-3 p-4 transition hover:border-slate-500">
                {creator.avatar ? (
                  <img src={`${API_URL}${creator.avatar}`} alt={toSafeInlineText(creator.username, 'Unknown')} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-lg font-semibold text-white">
                    {toSafeInitial(creator.username)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{toSafeInlineText(creator.username, 'Unknown')}</p>
                  <p className="truncate text-sm text-slate-400">{toSafeText(creator.bio, { fallback: 'No bio yet' })}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">This profile is not following any creators yet.</p>
        )}
      </section>

      {relationView ? (
        <section className="detail-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">{relationView === 'followers' ? 'Followers' : 'Following'}</h2>
            <button type="button" onClick={() => setRelationView('')} className="detail-inline-button px-3 py-2 text-xs">
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {relationData.length > 0 ? relationData.map((user) => (
              <Link key={user._id} to={`/profile/${user._id}`} className="panel-soft flex items-center gap-3 p-4 transition hover:border-slate-500">
                {user.avatar ? (
                  <img src={`${API_URL}${user.avatar}`} alt={toSafeInlineText(user.username, 'Unknown')} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-lg font-semibold text-white">
                    {toSafeInitial(user.username)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{toSafeInlineText(user.username, 'Unknown')}</p>
                  <p className="text-sm text-slate-400">{toSafeText(user.bio, { fallback: 'No bio yet' })}</p>
                </div>
              </Link>
            )) : <p className="text-sm text-slate-400">No users to show.</p>}
          </div>
        </section>
      ) : null}

      {isOwnProfile ? (
        <section className="detail-card p-6">
          <h2 className="text-xl font-semibold text-white">Reading History</h2>
          {history.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {history.slice(0, 9).map((item) => {
                const isStory = item.contentType === 'Story' || item.content !== undefined;
                const detailPath = isStory ? `/story/${item._id}` : `/artwork/${item._id}`;
                return (
                  <Link
                    key={`${item._id}-${item.readAt}`}
                    to={detailPath}
                    {...getRoutePrefetchProps(detailPath)}
                    className="panel-soft p-4 transition hover:border-slate-500"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">
                        {isStory ? 'story' : 'artwork'}
                      </span>
                      <span className="text-xs text-slate-500">{formatRelative(item.readAt)}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.description || 'No description'}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No reading history yet.</p>
          )}
        </section>
      ) : null}

      <div>
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="detail-eyebrow">Published archive</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Content ({filteredContent.length})</h2>
            <p className="mt-2 text-sm text-slate-400">
              {isOwnProfile
                ? 'Filter your archive by public and members-only posts.'
                : viewerCanAccessPremium
                  ? 'Your membership unlocks this artist’s premium posts here on their profile.'
                  : 'Browse this artist’s public posts here. Join membership to unlock their premium posts.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setContentVisibilityFilter('all')}
              className={`feed-filter-chip ${contentVisibilityFilter === 'all' ? 'feed-filter-chip-active' : ''}`}
            >
              All ({content.length})
            </button>
            <button
              type="button"
              onClick={() => setContentVisibilityFilter('public')}
              className={`feed-filter-chip ${contentVisibilityFilter === 'public' ? 'feed-filter-chip-active' : ''}`}
            >
              Public ({publicContent.length})
            </button>
            {shouldShowPremiumFilter ? (
              <button
                type="button"
                onClick={() => setContentVisibilityFilter('premium')}
                className={`feed-filter-chip ${contentVisibilityFilter === 'premium' ? 'feed-filter-chip-active' : ''}`}
              >
                Premium ({premiumContent.length})
              </button>
            ) : null}
          </div>
        </div>

        {filteredContent.length === 0 ? (
          <div className="detail-empty-state">
            <div className="text-lg font-semibold text-white">No content in this filter</div>
            <p className="max-w-md text-sm text-slate-400">
              {contentVisibilityFilter === 'premium'
                ? 'No members-only posts are available in this profile view yet.'
                : contentVisibilityFilter === 'public'
                  ? 'No public posts are available in this profile view yet.'
                  : 'No published content available.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {filteredContent.map((item) => {
              const isStory = item.content !== undefined;
              const detailPath = isStory ? `/story/${item._id}` : `/artwork/${item._id}`;
              const displayTags = normalizeTagList(item.tags || []).slice(0, 3);
              const itemId = String(item._id);
              const isLiked = likedIds.includes(itemId);
              const isBookmarked = bookmarkedIds.includes(itemId);

              return (
                <article key={item._id} className="panel overflow-hidden" {...getRoutePrefetchProps(detailPath)}>
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">
                        {isStory ? 'story' : 'artwork'}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs uppercase ${
                        item.isPremium === true
                          ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                          : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                      }`}>
                        {item.isPremium === true ? 'premium' : 'public'}
                      </span>
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">
                        {item.status || 'approved'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{item.views || 0} views</span>
                  </div>

                  {!isStory && getContentImageAssets(item)[0] ? (
                    <div className="flex h-48 items-center justify-center bg-slate-950">
                      <img
                        src={getDisplayImageUrl(getContentImageAssets(item)[0], { preferPreview: true })}
                        alt={item.title}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-4 p-5">
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <p className="line-clamp-3 text-slate-400">{item.description || 'No description'}</p>

                    {displayTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {displayTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            {formatTag(tag)}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => handleContentInteraction(itemId, 'like')}
                        disabled={pendingInteractionKey === `like:${itemId}`}
                        className={`interaction-pill ${isLiked ? 'interaction-pill-like-active' : ''}`}
                      >
                        <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                        {formatCount(item.likes || 0)}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContentInteraction(itemId, 'bookmark')}
                        disabled={pendingInteractionKey === `bookmark:${itemId}`}
                        className={`interaction-pill ${isBookmarked ? 'interaction-pill-bookmark-active' : ''}`}
                      >
                        <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
                        {formatCount(item.bookmarks || 0)}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        to={detailPath}
                        {...getRoutePrefetchProps(detailPath)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-brand-light transition hover:text-brand"
                      >
                        {isStory ? 'Read story' : 'View artwork'} →
                      </Link>
                      {isOwnProfile ? (
                        <Link
                          to={isStory ? `/story/${item._id}/edit` : `/artwork/${item._id}/edit`}
                          {...getRoutePrefetchProps(isStory ? `/story/${item._id}/edit` : `/artwork/${item._id}/edit`)}
                          className="text-sm text-slate-300 transition hover:text-white"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
