import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Crown, Sparkles, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export function PremiumPromptBanner({ variant = 'profile', className = '' }) {
  const [dismissed, setDismissed] = useState(false);

  const banners = {
    profile: {
      eyebrow: 'Premium artist',
      title: 'Turn your profile into a premium studio.',
      description: 'Unlock stronger discovery, creator perks, and premium-only publishing controls from one upgrade.',
      cta: 'Upgrade to Premium',
      highlights: ['Feed boost', 'Premium badge', 'Locked posts'],
      accent: 'from-amber-400/30 via-orange-300/18 to-transparent',
      border: 'border-amber-400/20',
      button: 'border-amber-300/35 bg-amber-300 text-slate-950 hover:bg-amber-200',
      icon: Crown,
      shellClassName: 'bg-slate-950/95 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]',
      iconClassName: 'h-12 w-12 rounded-2xl border border-white/10 bg-white/5 text-amber-200 shadow-inner shadow-white/5',
      eyebrowClassName: 'border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-[0.24em] text-slate-300/90',
      titleClassName: 'mt-3 max-w-xl text-xl font-semibold leading-tight text-white sm:text-2xl',
      descriptionClassName: 'mt-2 max-w-2xl text-sm leading-6 text-slate-300',
      chipsClassName: 'mt-4 flex flex-wrap gap-2',
      chipClassName: 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200',
      footerClassName: 'mt-5 flex flex-col gap-3 sm:flex-row sm:items-center',
      helperText: 'Monthly and yearly plans available. Cancel anytime after expiry.',
      helperTextClassName: 'text-xs text-slate-400',
      closeClassName: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white'
    },
    create: {
      eyebrow: 'Creator upgrade',
      title: 'Publish as premium when you are ready.',
      description: 'Upgrade once to unlock premium-only posts and subscriber access controls for your work.',
      cta: 'See Premium Plans',
      highlights: ['Premium posts', 'Subscriber lock', 'Priority reach'],
      accent: 'from-violet-400/18 via-amber-300/12 to-transparent',
      border: 'border-slate-700/90',
      button: 'border-violet-300/20 bg-white/10 text-white hover:bg-white/14',
      icon: Sparkles,
      shellClassName: 'bg-slate-950/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.22)]',
      iconClassName: 'h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-violet-200',
      eyebrowClassName: 'border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-[0.2em] text-slate-300/80',
      titleClassName: 'mt-2 text-base font-semibold leading-tight text-white sm:text-lg',
      descriptionClassName: 'mt-1 text-sm leading-6 text-slate-300/90',
      chipsClassName: 'mt-3 flex flex-wrap gap-2',
      chipClassName: 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200/90',
      footerClassName: 'mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
      helperText: 'Available with monthly or yearly premium plans.',
      helperTextClassName: 'text-[11px] text-slate-400',
      closeClassName: 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition hover:border-white/20 hover:bg-white/10 hover:text-white'
    },
    view: {
      eyebrow: 'Creator upgrade',
      title: 'Stand out with premium creator perks.',
      description: 'Show a stronger creator identity, unlock premium content access, and convert followers into subscribers.',
      cta: 'See Premium Benefits',
      highlights: ['Priority reach', 'Subscriber unlocks', 'Creator prestige'],
      accent: 'from-violet-400/25 via-amber-300/14 to-transparent',
      border: 'border-violet-300/18',
      button: 'border-violet-300/30 bg-violet-200 text-slate-950 hover:bg-violet-100',
      icon: Sparkles
    }
  };

  const banner = banners[variant] || banners.profile;
  const BannerIcon = banner.icon;

  return (
    <AnimatePresence initial={false}>
      {!dismissed ? (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.985 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={`relative overflow-hidden rounded-[1.75rem] border ${banner.shellClassName} ${banner.border} ${className}`}
        >
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${banner.accent}`} />
          <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-16 h-24 w-24 rounded-full bg-violet-400/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className={`flex shrink-0 items-center justify-center ${banner.iconClassName}`}>
                <BannerIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className={`inline-flex items-center gap-2 rounded-full border font-semibold uppercase ${banner.eyebrowClassName}`}>
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  {banner.eyebrow}
                </div>

                <h3 className={banner.titleClassName}>{banner.title}</h3>
                <p className={banner.descriptionClassName}>{banner.description}</p>

                <div className={banner.chipsClassName}>
                  {banner.highlights.map((item) => (
                    <span key={item} className={banner.chipClassName}>
                      {item}
                    </span>
                  ))}
                </div>

                <div className={banner.footerClassName}>
                  <Link
                    to="/premium"
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors ${banner.button}`}
                  >
                    {banner.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className={banner.helperTextClassName}>{banner.helperText}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className={banner.closeClassName}
              aria-label="Dismiss premium prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
