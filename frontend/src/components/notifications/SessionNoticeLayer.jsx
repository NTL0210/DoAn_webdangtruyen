import { CheckCircle2, Info, ShieldCheck, ShieldMinus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { subscribeToSessionNotices } from '../../services/sessionNoticeService';
import { toSafeInlineText, toSafeText } from '../../utils/safeText';

const NOTICE_LIFETIME = 7000;
const MAX_NOTICES = 3;

function getNoticeTheme(tone) {
  if (tone === 'success') {
    return {
      Icon: CheckCircle2,
      border: 'border-emerald-300/25',
      icon: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
    };
  }

  if (tone === 'admin') {
    return {
      Icon: ShieldCheck,
      border: 'border-sky-300/25',
      icon: 'border-sky-300/25 bg-sky-400/10 text-sky-100'
    };
  }

  if (tone === 'warning') {
    return {
      Icon: ShieldMinus,
      border: 'border-amber-300/25',
      icon: 'border-amber-300/25 bg-amber-400/10 text-amber-100'
    };
  }

  return {
    Icon: Info,
    border: 'border-white/10',
    icon: 'border-white/10 bg-white/5 text-white'
  };
}

export function SessionNoticeLayer() {
  const [notices, setNotices] = useState([]);
  const timersRef = useRef(new Map());

  const clearTimer = (noticeId) => {
    const timerId = timersRef.current.get(noticeId);

    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(noticeId);
    }
  };

  const dismissNotice = (noticeId) => {
    clearTimer(noticeId);
    setNotices((prev) => prev.filter((notice) => notice.id !== noticeId));
  };

  const scheduleDismiss = (noticeId) => {
    clearTimer(noticeId);
    const timerId = window.setTimeout(() => dismissNotice(noticeId), NOTICE_LIFETIME);
    timersRef.current.set(noticeId, timerId);
  };

  useEffect(() => subscribeToSessionNotices((notice) => {
    if (!notice?.id) {
      return;
    }

    setNotices((prev) => {
      const nextNotices = [notice, ...prev.filter((item) => item.id !== notice.id)].slice(0, MAX_NOTICES);
      prev
        .filter((item) => !nextNotices.some((nextItem) => nextItem.id === item.id))
        .forEach((item) => clearTimer(item.id));
      scheduleDismiss(notice.id);
      return nextNotices;
    });
  }), []);

  useEffect(() => () => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current.clear();
  }, []);

  if (!notices.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-[72] flex w-[min(92vw,26rem)] flex-col gap-3 sm:left-6 sm:top-6">
      {notices.map((notice) => {
        const theme = getNoticeTheme(notice.tone);
        const { Icon } = theme;

        return (
          <article
            key={notice.id}
            className={`pointer-events-auto relative overflow-hidden rounded-[1.4rem] border bg-slate-950/96 p-4 text-left shadow-[0_18px_40px_rgba(2,6,23,0.35)] ${theme.border}`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.96))]" />
            <div className="relative flex items-start gap-3 pr-8">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${theme.icon}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">{toSafeInlineText(notice.title, 'Account update')}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{toSafeText(notice.message)}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissNotice(notice.id)}
                className="absolute right-0 top-0 rounded-full border border-white/10 bg-black/20 p-1.5 text-slate-300 transition hover:border-white/20 hover:text-white"
                aria-label="Close session notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}