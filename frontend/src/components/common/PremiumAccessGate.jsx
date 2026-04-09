import { Crown, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatCurrency(amount) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))}₫`;
}

export function PremiumAccessGate({
  contentLabel = 'post',
  contentTitle = '',
  artistId = '',
  artistUsername = 'this artist',
  price = 0,
  membershipEnabled = true
}) {
  const checkoutPath = artistId ? `/membership/${artistId}` : '/home';
  const profilePath = artistId ? `/profile/${artistId}` : '/home';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-500/12 via-slate-950 to-slate-950 p-6 shadow-[0_26px_70px_rgba(15,23,42,0.4)] sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
          <LockKeyhole className="h-3.5 w-3.5" />
          Members only
        </div>

        <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
          Unlock {contentLabel} access from {artistUsername}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          {contentTitle ? `"${contentTitle}" is` : 'This post is'} reserved for active members of this artist. Joining this membership unlocks only premium posts from {artistUsername}; premium posts from other artists still require their own memberships.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">What you get</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>Open all members-only stories and artworks published by {artistUsername} while your membership is active.</span>
              </div>
              <div className="flex items-start gap-3">
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>Your access is scoped to this artist only. Other creators keep their own membership wall.</span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-amber-400/25 bg-amber-500/10 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Monthly membership</div>
            <div className="mt-3 text-3xl font-semibold text-white">{formatCurrency(price)}</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {membershipEnabled && price > 0
                ? 'Pay once with MoMo to unlock this artist’s premium posts for 30 days.'
                : 'This artist has not opened a purchasable membership yet.'}
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {membershipEnabled && price > 0 ? (
                <Link
                  to={checkoutPath}
                  className="inline-flex items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/20 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
                >
                  Join membership
                </Link>
              ) : null}

              <Link
                to={profilePath}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
              >
                View artist profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}