import { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Loader, Sparkles } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, getToken } from '../services/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function formatCurrency(amount) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))}₫`;
}

function resolveUnavailableReason(offer) {
  if (!offer?.isEnabled) {
    return 'This artist is not accepting new memberships right now.';
  }

  if (Number(offer?.price || 0) <= 0) {
    return 'This artist has not configured a valid membership price yet.';
  }

  return 'Membership is not available right now.';
}

export default function ArtistMembershipPage() {
  const navigate = useNavigate();
  const { artistId } = useParams();
  const currentUser = getCurrentUser();
  const [artist, setArtist] = useState(null);
  const [membershipOffer, setMembershipOffer] = useState({ isAvailable: false, isEnabled: false, price: 0, durationDays: 30, title: 'Artist Membership', description: '', benefits: [] });
  const [viewerMembership, setViewerMembership] = useState({ isSubscribed: false, expiresAt: null, subscriptionId: null });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const isOwnProfile = String(currentUser?.id || currentUser?._id || '') === String(artistId || '');

  useEffect(() => {
    const loadArtist = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${API_URL}/api/users/${artistId}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error?.message || 'Unable to load artist membership.');
          return;
        }

        setArtist(data.data.user || null);
        setMembershipOffer(data.data.membershipOffer || { isAvailable: false, isEnabled: false, price: 0, durationDays: 30, title: 'Artist Membership', description: '', benefits: [] });
        setViewerMembership(data.data.viewerMembership || { isSubscribed: false, expiresAt: null, subscriptionId: null });
      } catch (err) {
        setError('Unable to load artist membership.');
      } finally {
        setLoading(false);
      }
    };

    loadArtist();
  }, [artistId]);

  const handleCheckout = async () => {
    if (processing || !artistId) {
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/payments/momo/subscriptions/${artistId}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Failed to create membership checkout.');
        return;
      }

      if (data.data?.payUrl) {
        window.location.href = data.data.payUrl;
        return;
      }

      setError('Payment URL not available. Please try again.');
    } catch (err) {
      setError('Failed to create membership checkout.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="panel flex min-h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading membership...</p>
        </div>
      </div>
    );
  }

  if (error && !artist) {
    return (
      <div className="detail-empty-state">
        <div className="text-lg font-semibold text-white">Cannot load membership</div>
        <p className="max-w-md text-sm text-slate-400">{error}</p>
        <button
          type="button"
          onClick={() => navigate(artistId ? `/profile/${artistId}` : '/home')}
          className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
        >
          Back to artist profile
        </button>
      </div>
    );
  }

  const isSubscribed = Boolean(viewerMembership?.isSubscribed);
  const canCheckout = membershipOffer?.isAvailable && !isSubscribed && !isOwnProfile;
  const unavailableReason = resolveUnavailableReason(membershipOffer);
  const membershipExpiresAt = viewerMembership?.expiresAt ? new Date(viewerMembership.expiresAt) : null;

  return (
    <div className="space-y-6">
      <section className="detail-card overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.28),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_45%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
              <Crown className="h-3.5 w-3.5" />
              {membershipOffer?.title || 'Artist membership'}
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Join {artist?.username}&apos;s membership</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {membershipOffer?.description || 'Unlock premium stories and artworks from this artist only. Membership access does not carry over to any other premium artist.'}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] px-5 py-4 text-sm text-slate-200">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Billing cycle</div>
            <div className="mt-2 text-2xl font-semibold text-white">{membershipOffer?.durationDays || 30} days</div>
            <div className="mt-1 text-slate-400">One artist, one membership wall</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="detail-card p-6">
          <h2 className="text-xl font-semibold text-white">What membership unlocks</h2>
          <div className="mt-5 space-y-4 text-sm text-slate-300">
            {Array.isArray(membershipOffer?.benefits) && membershipOffer.benefits.length > 0 ? membershipOffer.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{benefit}</span>
              </div>
            )) : null}
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>Open all members-only stories and artworks published by {artist?.username} while your membership is active.</span>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>Members-only access is scoped to this creator. Locked posts from other artists remain locked until you join them too.</span>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>Payments are processed with MoMo and activate immediately after successful confirmation.</span>
            </div>
          </div>
        </section>

        <section className="detail-card p-6">
          <div className={`rounded-[1.75rem] border p-5 transition ${
            isSubscribed
              ? 'border-emerald-400/30 bg-emerald-500/10'
              : canCheckout
              ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/14 via-slate-950 to-slate-950 shadow-[0_24px_60px_rgba(245,158,11,0.14)]'
              : 'border-slate-700 bg-slate-900/40'
          }`}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Monthly membership</div>
            <div className="mt-3 text-3xl font-semibold text-white">{formatCurrency(membershipOffer?.price || 0)}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {isSubscribed
                ? `You are already an active member of ${artist?.username}.`
                : isOwnProfile
                ? 'You cannot purchase your own membership.'
                : canCheckout
                ? `Unlock ${artist?.username}'s premium posts for the next ${membershipOffer?.durationDays || 30} days.`
                : unavailableReason}
            </p>

            {membershipExpiresAt ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Active until {membershipExpiresAt.toLocaleDateString()}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={!canCheckout || processing}
                className="inline-flex items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/20 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/28 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400"
              >
                {processing ? 'Redirecting to MoMo...' : isSubscribed ? 'Membership active' : 'Pay with MoMo'}
              </button>

              <Link
                to={artistId ? `/profile/${artistId}` : '/home'}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              >
                Back to artist profile
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}