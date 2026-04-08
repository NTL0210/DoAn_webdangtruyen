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

export function createMomoSubscriptionCheckout(artistId) {
  return requestJson(`/api/payments/momo/subscriptions/${artistId}/create`, {
    method: 'POST'
  });
}

export function createMomoPremiumCheckout(plan) {
  return requestJson('/api/payments/momo/premium/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ plan })
  });
}

export function getPaymentStatus(orderId) {
  return requestJson(`/api/payments/${encodeURIComponent(orderId)}/status`);
}

export function confirmPaymentFromReturnDev(orderId, payload) {
  return requestJson(`/api/payments/${encodeURIComponent(orderId)}/confirm-from-return-dev`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });
}
