import { getToken } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function requestJson(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  return response.json();
}

export function getSubscriptionInfo(artistId) {
  return requestJson(`/api/users/${artistId}/subscription-info`);
}

export function subscribeToArtist(artistId) {
  return requestJson(`/api/users/${artistId}/subscribe`, {
    method: 'POST'
  });
}

export function unsubscribeFromArtist(artistId) {
  return requestJson(`/api/users/${artistId}/subscribe`, {
    method: 'DELETE'
  });
}

export function updateSubscriptionSettings(payload) {
  return requestJson('/api/users/me/subscription-settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}
