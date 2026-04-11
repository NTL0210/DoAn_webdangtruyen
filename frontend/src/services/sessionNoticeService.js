const SESSION_NOTICE_EVENT = 'app-session-notice';

export function emitSessionNotice(payload) {
  if (typeof window === 'undefined' || !payload) {
    return;
  }

  window.dispatchEvent(new CustomEvent(SESSION_NOTICE_EVENT, {
    detail: {
      id: payload.id || `notice-${Date.now()}`,
      tone: payload.tone || 'info',
      title: payload.title || 'Account update',
      message: payload.message || ''
    }
  }));
}

export function subscribeToSessionNotices(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event) => callback(event.detail);
  window.addEventListener(SESSION_NOTICE_EVENT, handler);

  return () => {
    window.removeEventListener(SESSION_NOTICE_EVENT, handler);
  };
}