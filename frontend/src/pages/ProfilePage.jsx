import { Bookmark, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCurrentUser, getToken, setCurrentUser, subscribeToCurrentUserChange, updateCurrentUserCollection } from '../services/authService';
import { invalidateContentMutationCaches, invalidateCreatorPresentationCaches } from '../services/appDataInvalidation';
import { emitCreatorPresentationRefresh } from '../services/creatorPresentationEvents';
import { fetchJsonWithCache, FRONTEND_CACHE_NAMESPACES, getFrontendCacheScope, invalidateFrontendCache } from '../services/frontendCache';
import { createMomoPremiumCheckout, createMomoSubscriptionCheckout } from '../services/paymentService';
import { getRoutePrefetchProps } from '../services/routePrefetch';
import { getSubscriptionInfo, unsubscribeFromArtist, updateSubscriptionSettings } from '../services/subscriptionService';
import { formatCount, formatRelative } from '../utils/helpers';
import { validateSingleImageBeforeUpload } from '../utils/fileValidation';
import { formatTag, normalizeTagList } from '../utils/hashtags';

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
  const [followers, setFollowers] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [history, setHistory] = useState([]);
  const [relationView, setRelationView] = useState('');
  const [authUser, setAuthUser] = useState(() => getCurrentUser());
  const [pendingInteractionKey, setPendingInteractionKey] = useState('');
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionNotice, setSubscriptionNotice] = useState('');
  const [subscriptionAction, setSubscriptionAction] = useState('');
  const [membershipForm, setMembershipForm] = useState({
    subscriptionEnabled: false,
    subscriptionPrice: '0',
    subscriptionAbout: ''
  });
  const [savingMembership, setSavingMembership] = useState(false);
  const [showPremiumPlanModal, setShowPremiumPlanModal] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState('monthly');
  const [premiumCheckoutLoading, setPremiumCheckoutLoading] = useState(false);
  const [premiumCheckoutError, setPremiumCheckoutError] = useState('');
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    bio: ''
  });
  const likedIds = Array.isArray(authUser?.likes) ? authUser.likes.map((value) => String(value)) : [];
  const bookmarkedIds = Array.isArray(authUser?.bookmarks) ? authUser.bookmarks.map((value) => String(value)) : [];
  const profileCacheScope = getFrontendCacheScope(authUser?.id || authUser?._id);

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
      setSubscriptionInfo(null);
      setSubscriptionError('');
    } else {
      fetchSubscriptionInfo();
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
        setError(data.error?.message || 'User not found');
        return;
      }

      setProfile(data.data.user);
      setContent(data.data.content || []);
      setIsFollowing(data.data.isFollowing || false);
      setStats({
        followerCount: data.data.followerCount || 0,
        followingCount: data.data.followingCount || 0
      });
      setProfileForm({
        username: data.data.user.username || '',
        email: data.data.user.email || '',
        bio: data.data.user.bio || ''
      });
      setMembershipForm({
        subscriptionEnabled: Boolean(data.data.user.subscriptionEnabled),
        subscriptionPrice: String(data.data.user.subscriptionPrice ?? 0),
        subscriptionAbout: data.data.user.subscriptionAbout || ''
      });
      setError('');
    } catch (err) {
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

  const fetchSubscriptionInfo = async () => {
    try {
      setSubscriptionLoading(true);
      setSubscriptionError('');

      const data = await getSubscriptionInfo(resolvedUserId);

      if (!data.success) {
        setSubscriptionError(data.error?.message || 'Failed to load membership info');
        return;
      }

      setSubscriptionInfo(data.data || null);
    } catch (err) {
      setSubscriptionError('Failed to load membership info');
    } finally {
      setSubscriptionLoading(false);
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

      setProfile(data.data);
      setProfileForm((prev) => ({ ...prev, username: data.data.username, email: data.data.email, bio: data.data.bio || '' }));
      setCurrentUser({
        ...currentUser,
        ...data.data,
        id: data.data._id || currentUser?.id
      });
      emitCreatorPresentationRefresh(data.data);
      invalidateCreatorPresentationCaches();
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

    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(profileForm)
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to update profile');
        return;
      }

      setProfile(data.data);
      setCurrentUser({
        ...currentUser,
        ...data.data,
        id: data.data._id || currentUser?.id
      });
      emitCreatorPresentationRefresh(data.data);
      invalidateCreatorPresentationCaches();
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMembershipSubmit = async (event) => {
    event.preventDefault();
    setSavingMembership(true);
    setSubscriptionError('');
    setSubscriptionNotice('');

    try {
      const data = await updateSubscriptionSettings({
        subscriptionEnabled: membershipForm.subscriptionEnabled,
        subscriptionPrice: Number(membershipForm.subscriptionPrice || 0),
        subscriptionAbout: membershipForm.subscriptionAbout
      });

      if (!data.success) {
        setSubscriptionError(data.error?.message || 'Failed to update membership settings');
        return;
      }

      setProfile((prev) => (prev ? { ...prev, ...data.data } : prev));
      setCurrentUser({
        ...currentUser,
        ...data.data
      });
      setSubscriptionNotice(data.message || 'Membership settings updated successfully');
      invalidateFrontendCache([FRONTEND_CACHE_NAMESPACES.PROFILE]);
    } catch (err) {
      setSubscriptionError('Failed to update membership settings');
    } finally {
      setSavingMembership(false);
    }
  };

  const handleStartPremiumCheckout = async () => {
    setPremiumCheckoutLoading(true);
    setPremiumCheckoutError('');

    try {
      const data = await createMomoPremiumCheckout(premiumPlan);

      if (!data.success) {
        setPremiumCheckoutError(data.error?.message || 'Failed to start premium checkout');
        return;
      }

      if (!data.data?.payUrl) {
        setPremiumCheckoutError('Payment URL was not returned');
        return;
      }

      window.location.href = data.data.payUrl;
    } catch (err) {
      setPremiumCheckoutError('Failed to start premium checkout');
    } finally {
      setPremiumCheckoutLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setSubscriptionAction('subscribe');
    setSubscriptionError('');
    setSubscriptionNotice('');

    try {
      const data = await createMomoSubscriptionCheckout(resolvedUserId);

      if (!data.success) {
        setSubscriptionError(data.error?.message || 'Failed to start payment checkout');
        return;
      }

      if (!data.data?.payUrl) {
        setSubscriptionError('Payment URL was not returned');
        return;
      }

      window.location.href = data.data.payUrl;
    } catch (err) {
      setSubscriptionError('Failed to start payment checkout');
    } finally {
      setSubscriptionAction('');
    }
  };

  const handleUnsubscribe = async () => {
    setSubscriptionAction('unsubscribe');
    setSubscriptionError('');
    setSubscriptionNotice('');

    try {
      const data = await unsubscribeFromArtist(resolvedUserId);

      if (!data.success) {
        setSubscriptionError(data.error?.message || 'Failed to unsubscribe');
        return;
      }

      setSubscriptionNotice(data.message || 'Subscription cancelled');
      await fetchSubscriptionInfo();
    } catch (err) {
      setSubscriptionError('Failed to unsubscribe');
    } finally {
      setSubscriptionAction('');
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
  const isPremiumCreator = profile?.creatorPlan === 'premium_artist' && profile?.premiumStatus === 'active';
  const canShowSubscriptionCard = !isOwnProfile && Boolean(subscriptionInfo?.subscriptionEnabled);
  const canShowPremiumUpgradeCard = isOwnProfile && profile?.creatorPlan !== 'premium_artist';

  return (
    <div className="detail-shell max-w-7xl">
      <div className="detail-hero">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-1 items-start gap-6">
            <div className="relative">
              {profile?.avatar ? (
                <img
                  src={`${API_URL}${profile.avatar}`}
                  alt={profile.username}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-4xl font-semibold text-white">
                  {profile?.username?.charAt(0).toUpperCase()}
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
                <h1 className="detail-title mt-2">{profile?.username}</h1>
                <p className="text-slate-400">{profile?.email}</p>
              </div>

              {profile?.bio ? <p className="max-w-2xl text-sm leading-6 text-slate-300">{profile.bio}</p> : null}

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
      </div>

      {isOwnProfile ? (
        <form onSubmit={handleProfileSubmit} className="detail-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Edit Profile</h2>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
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
          </div>
        </form>
      ) : null}

      {canShowPremiumUpgradeCard ? (
        <section className="detail-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="detail-eyebrow">Creator plan</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Become Premium Artist</h2>
              <p className="mt-2 text-sm text-slate-400">
                Upgrade your account to unlock premium artist features and subscription controls.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPremiumPlanModal(true);
                setPremiumCheckoutError('');
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-light"
            >
              Upgrade to Premium
            </button>
          </div>
        </section>
      ) : null}

      <section className="detail-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="detail-eyebrow">Premium Artist</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Membership</h2>
          </div>
          {isOwnProfile && isPremiumCreator ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
              Premium artist active
            </span>
          ) : null}
        </div>

        {subscriptionError ? (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {subscriptionError}
          </div>
        ) : null}

        {subscriptionNotice ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {subscriptionNotice}
          </div>
        ) : null}

        {isOwnProfile ? (
          isPremiumCreator ? (
            <form onSubmit={handleMembershipSubmit} className="mt-5 space-y-5">
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                <div>
                  <p className="font-medium text-white">Enable membership</p>
                  <p className="mt-1 text-sm text-slate-400">Allow readers to subscribe to your monthly membership.</p>
                </div>
                <input
                  type="checkbox"
                  checked={membershipForm.subscriptionEnabled}
                  onChange={(event) => setMembershipForm((prev) => ({ ...prev, subscriptionEnabled: event.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Monthly price</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={membershipForm.subscriptionPrice}
                    onChange={(event) => setMembershipForm((prev) => ({ ...prev, subscriptionPrice: event.target.value }))}
                    className="input-base"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Membership description</label>
                  <textarea
                    value={membershipForm.subscriptionAbout}
                    onChange={(event) => setMembershipForm((prev) => ({ ...prev, subscriptionAbout: event.target.value }))}
                    className="input-base resize-none"
                    rows={4}
                    maxLength={500}
                    placeholder="Tell members what they get from your subscription."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingMembership}
                  className="inline-flex items-center justify-center rounded-2xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingMembership ? 'Saving...' : 'Save Membership'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
              <p className="font-medium text-white">Membership is not editable on this account.</p>
              <p className="mt-2">
                Current plan: {profile?.creatorPlan || 'free'}.
                {' '}Premium status: {profile?.premiumStatus || 'inactive'}.
              </p>
            </div>
          )
        ) : subscriptionLoading ? (
          <div className="mt-5 text-sm text-slate-400">Loading membership info...</div>
        ) : canShowSubscriptionCard ? (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-lg font-semibold text-white">Join {subscriptionInfo?.username}'s membership</p>
                <p className="text-sm text-slate-400">
                  {subscriptionInfo?.subscriptionAbout || 'Support this premium artist through a monthly membership.'}
                </p>
                <div className="flex flex-wrap gap-2 text-sm text-slate-300">
                  <span className="rounded-full border border-slate-700 px-3 py-1">
                    Price: {subscriptionInfo?.subscriptionPrice || 0} / month
                  </span>
                  <span className="rounded-full border border-slate-700 px-3 py-1">
                    Status: {subscriptionInfo?.userSubscriptionStatus || 'none'}
                  </span>
                  {subscriptionInfo?.userSubscriptionExpiresAt ? (
                    <span className="rounded-full border border-slate-700 px-3 py-1">
                      Expires: {new Date(subscriptionInfo.userSubscriptionExpiresAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0">
                {subscriptionInfo?.userSubscriptionStatus === 'active' ? (
                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={subscriptionAction === 'unsubscribe'}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {subscriptionAction === 'unsubscribe' ? 'Cancelling...' : 'Unsubscribe'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubscribe}
                    disabled={subscriptionAction === 'subscribe'}
                    className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {subscriptionAction === 'subscribe' ? 'Subscribing...' : 'Subscribe'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-sm text-slate-400">
            This creator does not currently offer a membership.
          </div>
        )}
      </section>

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
                  <img src={`${API_URL}${creator.avatar}`} alt={creator.username} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-lg font-semibold text-white">
                    {creator.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{creator.username}</p>
                  <p className="truncate text-sm text-slate-400">{creator.bio || 'No bio yet'}</p>
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
                  <img src={`${API_URL}${user.avatar}`} alt={user.username} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-purple-600 text-lg font-semibold text-white">
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{user.username}</p>
                  <p className="text-sm text-slate-400">{user.bio || 'No bio yet'}</p>
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
            <h2 className="mt-2 text-2xl font-semibold text-white">Content ({content.length})</h2>
          </div>
        </div>

        {content.length === 0 ? (
          <div className="detail-empty-state">
            <div className="text-lg font-semibold text-white">No content yet</div>
            <p className="max-w-md text-sm text-slate-400">No published content available</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {content.map((item) => {
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
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">
                        {item.status || 'approved'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{item.views || 0} views</span>
                  </div>

                  {!isStory && item.images && item.images[0] ? (
                    <div className="flex h-48 items-center justify-center bg-slate-950">
                      <img
                        src={item.images[0].startsWith('http') ? item.images[0] : `${API_URL}${item.images[0]}`}
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

      {showPremiumPlanModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="detail-eyebrow">MoMo checkout</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Choose Premium Artist Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!premiumCheckoutLoading) {
                    setShowPremiumPlanModal(false);
                    setPremiumCheckoutError('');
                  }
                }}
                className="detail-inline-button px-3 py-2 text-xs"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className={`block rounded-2xl border px-4 py-4 transition ${premiumPlan === 'monthly' ? 'border-brand/40 bg-brand/10' : 'border-slate-800 bg-slate-950/40'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="premiumPlan"
                    value="monthly"
                    checked={premiumPlan === 'monthly'}
                    onChange={(event) => setPremiumPlan(event.target.value)}
                    className="mt-1"
                    disabled={premiumCheckoutLoading}
                  />
                  <div>
                    <p className="font-medium text-white">Monthly plan</p>
                    <p className="mt-1 text-sm text-slate-400">99,000 VND / month</p>
                  </div>
                </div>
              </label>

              <label className={`block rounded-2xl border px-4 py-4 transition ${premiumPlan === 'yearly' ? 'border-brand/40 bg-brand/10' : 'border-slate-800 bg-slate-950/40'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="premiumPlan"
                    value="yearly"
                    checked={premiumPlan === 'yearly'}
                    onChange={(event) => setPremiumPlan(event.target.value)}
                    className="mt-1"
                    disabled={premiumCheckoutLoading}
                  />
                  <div>
                    <p className="font-medium text-white">Yearly plan</p>
                    <p className="mt-1 text-sm text-slate-400">999,000 VND / year</p>
                  </div>
                </div>
              </label>
            </div>

            {premiumCheckoutError ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {premiumCheckoutError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPremiumPlanModal(false);
                  setPremiumCheckoutError('');
                }}
                disabled={premiumCheckoutLoading}
                className="editor-action-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartPremiumCheckout}
                disabled={premiumCheckoutLoading}
                className="editor-action-primary"
              >
                {premiumCheckoutLoading ? 'Redirecting...' : 'Continue to MoMo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
