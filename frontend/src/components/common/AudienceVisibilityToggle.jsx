import { Eye, LockKeyhole } from 'lucide-react';

const OPTIONS = {
  public: {
    title: 'Public',
    description: 'Anyone on the platform can open and read this post.',
    icon: Eye,
    accent: 'text-cyan-200'
  },
  premium: {
    title: 'Members only',
    description: 'Only users with an active membership to your creator account can unlock it.',
    icon: LockKeyhole,
    accent: 'text-amber-200'
  }
};

export function AudienceVisibilityToggle({ value, onChange, contentLabel = 'post' }) {
  const isPremium = Boolean(value);
  const selectedKey = isPremium ? 'premium' : 'public';

  return (
    <div className="mb-6 rounded-[1.65rem] border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 p-5 shadow-[0_18px_44px_rgba(245,158,11,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">Visibility</h3>
          <p className="mt-2 text-sm text-slate-300">
            Choose whether this {contentLabel} is visible to everyone or only to members who joined your artist membership.
          </p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
          isPremium
            ? 'border-amber-400/35 bg-amber-500/15 text-amber-100 shadow-[0_8px_24px_rgba(245,158,11,0.16)]'
            : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100 shadow-[0_8px_24px_rgba(34,211,238,0.12)]'
        }`}>
          {OPTIONS[selectedKey].title}
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-slate-950/75 p-2">
        <div className="relative grid grid-cols-2 gap-2">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-[1.1rem] border transition-transform duration-300 ease-out ${
              isPremium
                ? 'translate-x-full border-amber-400/30 bg-gradient-to-r from-amber-500/18 via-orange-400/14 to-amber-300/18 shadow-[0_14px_36px_rgba(245,158,11,0.18)]'
                : 'translate-x-0 border-cyan-400/24 bg-gradient-to-r from-cyan-500/14 via-sky-400/12 to-emerald-300/16 shadow-[0_14px_36px_rgba(34,211,238,0.12)]'
            }`}
          />

          {Object.entries(OPTIONS).map(([key, option]) => {
            const isSelected = selectedKey === key;
            const Icon = option.icon;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key === 'premium')}
                className={`relative z-10 rounded-[1.1rem] px-4 py-4 text-left transition duration-300 ${
                  isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className={isSelected ? option.accent : 'text-slate-500'} />
                  <span className="text-sm font-semibold">{option.title}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-xs leading-6 text-slate-300">
        Membership unlocks only premium posts from your account. Premium posts from other artists stay locked until users join them separately.
      </div>
    </div>
  );
}