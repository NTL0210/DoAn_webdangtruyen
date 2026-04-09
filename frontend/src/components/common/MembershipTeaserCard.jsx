import { Crown, ImageIcon, LockKeyhole, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRoutePrefetchProps } from '../../services/routePrefetch';
import { formatRelative } from '../../utils/helpers';
import { formatTag, normalizeTagList } from '../../utils/hashtags';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function formatCurrency(amount) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))}₫`;
}

export function MembershipTeaserCard({ item }) {
  const tags = normalizeTagList(item.tags || []).slice(0, 3);
  const canPurchaseMembership = Boolean(item.membershipOffer?.isEnabled) && Number(item.membershipOffer?.price || 0) > 0;
  const detailPath = item.detailPath;
  const secondaryActionPath = item.viewerHasAccess
    ? null
    : canPurchaseMembership
      ? item.membershipOffer?.checkoutPath
      : item.author?._id
        ? `/profile/${item.author._id}`
        : null;
  const secondaryActionLabel = canPurchaseMembership ? 'Unlock via membership' : 'View artist profile';

  return (
    <article className="feed-card overflow-hidden">
      <div className="flex gap-3">
        <div className="shrink-0 pt-1">
          {item.author?.avatar ? (
            <img src={`${API_URL}${item.author.avatar}`} alt={item.author.username} className="feed-avatar" />
          ) : (
            <div className="feed-avatar-fallback">{item.author?.username?.[0]?.toUpperCase() || '?'}</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="truncate font-semibold text-white">{item.author?.username || 'Creator'}</span>
            <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              <LockKeyhole size={12} />
              Members only
            </div>
            <span className="text-slate-500">·</span>
            <span className="text-slate-500">{formatRelative(item.createdAt)}</span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  {item.contentType === 'story' ? 'Story teaser' : 'Artwork teaser'}
                </span>
                {item.viewerHasAccess ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                    Membership active
                  </span>
                ) : null}
              </div>

              {detailPath ? (
                <Link
                  to={detailPath}
                  {...getRoutePrefetchProps(detailPath)}
                  className="mt-4 inline-block text-2xl font-semibold text-white transition hover:text-cyan-200"
                >
                  {item.title}
                </Link>
              ) : (
                <h2 className="mt-4 text-2xl font-semibold text-white">{item.title}</h2>
              )}
              {item.description ? <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p> : null}
              {detailPath ? (
                <Link
                  to={detailPath}
                  {...getRoutePrefetchProps(detailPath)}
                  className="mt-4 block rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-400 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.05] hover:text-slate-200"
                >
                  {item.teaserText || 'Premium preview is partially hidden until membership is active.'}
                </Link>
              ) : (
                <p className="mt-4 rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-400">
                  {item.teaserText || 'Premium preview is partially hidden until membership is active.'}
                </p>
              )}

              {tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="feed-tag">
                      {formatTag(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.6rem] border border-slate-700 bg-slate-950/80 p-5">
              {detailPath ? (
                <Link
                  to={detailPath}
                  {...getRoutePrefetchProps(detailPath)}
                  className="relative block overflow-hidden rounded-[1.25rem] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_50%),linear-gradient(135deg,#020617,#111827)] p-5 transition hover:border-cyan-400/40 hover:shadow-[0_18px_40px_rgba(8,145,178,0.12)]"
                >
                  <div className="absolute inset-0 backdrop-blur-[3px]" />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        <ImageIcon size={14} />
                        Protected preview
                      </div>
                      <span className="text-xs text-slate-500">{item.teaser?.imageCount || 0} assets</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: Math.min(Math.max(item.teaser?.imageCount || 1, 1), 3) }).map((_, index) => (
                        <div key={index} className="aspect-[4/5] rounded-xl border border-white/10 bg-white/5" />
                      ))}
                    </div>
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-6 text-amber-100">
                      Full cover and full content stay hidden until membership is active.
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="relative overflow-hidden rounded-[1.25rem] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_50%),linear-gradient(135deg,#020617,#111827)] p-5">
                  <div className="absolute inset-0 backdrop-blur-[3px]" />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        <ImageIcon size={14} />
                        Protected preview
                      </div>
                      <span className="text-xs text-slate-500">{item.teaser?.imageCount || 0} assets</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: Math.min(Math.max(item.teaser?.imageCount || 1, 1), 3) }).map((_, index) => (
                        <div key={index} className="aspect-[4/5] rounded-xl border border-white/10 bg-white/5" />
                      ))}
                    </div>
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-6 text-amber-100">
                      Full cover and full content stay hidden until membership is active.
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>{item.membershipOffer?.title || 'Artist Membership'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>{item.membershipOffer?.description || 'Unlock this artist’s premium posts with one membership purchase.'}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Membership price</div>
                  <div className="mt-1 text-lg font-semibold text-white">{formatCurrency(item.membershipOffer?.price || 0)}</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {detailPath ? (
                    <Link
                      to={detailPath}
                      {...getRoutePrefetchProps(detailPath)}
                      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        item.viewerHasAccess
                          ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/18'
                          : 'border border-cyan-400/35 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/18'
                      }`}
                    >
                      {item.viewerHasAccess ? 'Open full post' : 'Open preview'}
                    </Link>
                  ) : null}
                  {secondaryActionPath ? (
                    <Link
                      to={secondaryActionPath}
                      {...getRoutePrefetchProps(secondaryActionPath)}
                      className="inline-flex items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/20 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/28"
                    >
                      {secondaryActionLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}