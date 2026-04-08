import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { confirmPaymentFromReturnDev, getPaymentStatus } from '../services/paymentService';
import { getCurrentUser, getToken, setCurrentUser } from '../services/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function resolveUiStatus(paymentStatus) {
  if (paymentStatus === 'paid') return 'success';
  if (paymentStatus === 'pending') return 'pending';
  return 'failure';
}

export default function PaymentReturnPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState(null);
  const [devConfirming, setDevConfirming] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const orderId = searchParams.get('orderId') || '';
  const momoResultCode = searchParams.get('resultCode') || '';
  const momoMessage = searchParams.get('message') || '';

  useEffect(() => {
    const fetchStatus = async () => {
      if (!orderId) {
        setError('Missing orderId in payment return URL.');
        setLoading(false);
        return;
      }

      try {
        const data = await getPaymentStatus(orderId);
        if (!data.success) {
          setError(data.error?.message || 'Failed to load payment status');
          setLoading(false);
          return;
        }

        setPayment(data.data || null);
      } catch (fetchError) {
        setError('Failed to load payment status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [orderId]);

  useEffect(() => {
    const autoConfirmFromReturnInDev = async () => {
      if (!payment || payment.status !== 'pending') {
        return;
      }

      if (momoResultCode !== '0') {
        return;
      }

      try {
        setDevConfirming(true);
        const confirmData = await confirmPaymentFromReturnDev(orderId, {
          resultCode: momoResultCode,
          message: momoMessage
        });

        if (!confirmData.success) {
          return;
        }

        const refreshed = await getPaymentStatus(orderId);
        if (refreshed.success) {
          setPayment(refreshed.data || null);
        }
      } finally {
        setDevConfirming(false);
      }
    };

    autoConfirmFromReturnInDev();
  }, [orderId, momoMessage, momoResultCode, payment]);

  useEffect(() => {
    const refreshCurrentUserAfterPremiumUpgrade = async () => {
      if (payment?.status !== 'paid' || payment?.transactionType !== 'premium_artist_upgrade') {
        return;
      }

      const currentUser = getCurrentUser();
      const userId = currentUser?.id || currentUser?._id;
      if (!userId) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        });
        const data = await response.json();
        if (!data.success || !data.data?.user) {
          return;
        }

        const nextUser = {
          ...currentUser,
          ...data.data.user,
          id: data.data.user._id || currentUser?.id
        };
        setCurrentUser(nextUser);
      } catch {
        // Keep return page resilient; profile refresh can still happen manually.
      }
    };

    refreshCurrentUserAfterPremiumUpgrade();
  }, [payment]);

  const uiStatus = resolveUiStatus(payment?.status);
  const statusLabel = uiStatus === 'success'
    ? 'Payment successful'
    : uiStatus === 'pending'
      ? 'Payment pending confirmation'
      : 'Payment failed';

  return (
    <div className="panel mx-auto max-w-3xl p-6">
      <p className="detail-eyebrow">MoMo payment return</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Subscription Payment Status</h1>

      {loading ? (
        <p className="mt-4 text-sm text-slate-300">Checking payment status...</p>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            uiStatus === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : uiStatus === 'pending'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}>
            {statusLabel}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
            <p>Order ID: {payment?.orderId || orderId}</p>
            <p className="mt-1">Transaction status: {payment?.status || 'unknown'}</p>
            {typeof payment?.amount === 'number' ? <p className="mt-1">Amount: {payment.amount} {payment.currency || 'VND'}</p> : null}
            {momoResultCode ? <p className="mt-1">MoMo resultCode: {momoResultCode}</p> : null}
            {momoMessage ? <p className="mt-1">MoMo message: {momoMessage}</p> : null}
          </div>
        </div>
      )}

      {devConfirming ? (
        <p className="mt-4 text-sm text-amber-200">Confirming payment from return...</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/home" className="editor-action-secondary">
          Back to Home
        </Link>
        {payment?.artistId ? (
          <Link to={`/profile/${payment.artistId}`} className="editor-action-primary">
            View Artist Profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}
