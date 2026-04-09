import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { getCurrentUser, getToken, setCurrentUser } from '../services/authService';
import { invalidateCreatorPresentationCaches } from '../services/appDataInvalidation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const IS_PRODUCTION = import.meta.env.PROD;
const MOMO_SUCCESS_RESULT_CODE = '0';
const MOMO_CANCELLED_RESULT_CODE = '1006';

function normalizeResultCode(resultCode) {
  return String(resultCode || '').trim();
}

function isSuccessfulReturn(resultCode) {
  return normalizeResultCode(resultCode) === MOMO_SUCCESS_RESULT_CODE;
}

function isCancelledReturn(resultCode) {
  return normalizeResultCode(resultCode) === MOMO_CANCELLED_RESULT_CODE;
}

function hasFailedReturn(resultCode) {
  const normalized = normalizeResultCode(resultCode);
  return Boolean(normalized) && normalized !== MOMO_SUCCESS_RESULT_CODE && normalized !== MOMO_CANCELLED_RESULT_CODE;
}

const DEFAULT_PAYMENT_CONTEXT = {
  retryPath: '/premium',
  retryLabel: 'Back to Premium Plans',
  successPath: '/profile',
  successMessage: 'Premium activated! Redirecting to your profile...',
  successNotice: 'Your premium artist account is now active! You can now create premium content and access all premium features.',
  pendingNotice: 'You can close this window and check your premium status in your profile.'
};

function buildPaymentContext(paymentData) {
  if (paymentData?.transactionType === 'artist_subscription') {
    const artistId = paymentData.artistId ? String(paymentData.artistId) : '';

    return {
      retryPath: artistId ? `/membership/${artistId}` : '/home',
      retryLabel: 'Back to Membership',
      successPath: artistId ? `/profile/${artistId}` : '/home',
      successMessage: 'Membership activated! Redirecting to the artist profile...',
      successNotice: 'Your artist membership is now active. This unlocks only premium posts from that artist. Premium posts from other artists still require their own memberships.',
      pendingNotice: 'You can close this window and check your membership status from the artist profile.'
    };
  }

  return DEFAULT_PAYMENT_CONTEXT;
}

export default function MoMoReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const [orderId, setOrderId] = useState('');
  const [paymentContext, setPaymentContext] = useState(DEFAULT_PAYMENT_CONTEXT);

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    const resultCode = searchParams.get('resultCode');
    const returnMessage = searchParams.get('message') || '';

    setOrderId(orderId || '');

    if (!orderId) {
      setStatus('error');
      setMessage('Invalid payment return. Order ID missing.');
      return;
    }

    verifyPaymentStatus(orderId, resultCode, returnMessage);
  }, [searchParams]);

  const confirmPaymentFromReturnDev = async ({ orderId, resultCode, returnMessage, token }) => {
    const response = await fetch(`${API_URL}/api/payments/${orderId}/confirm-from-return-dev`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        resultCode,
        message: returnMessage
      })
    });

    return response.json();
  };

  const syncAuthenticatedUser = async (token) => {
    const currentUser = getCurrentUser();
    const userId = currentUser?.id || currentUser?._id;

    if (!userId) {
      return;
    }

    invalidateCreatorPresentationCaches();

    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (response.ok && data?.success && data.data?.user) {
      setCurrentUser({
        ...currentUser,
        ...data.data.user
      });
    }
  };

  const handleSuccessfulConfirmation = async (token, paymentData) => {
    const nextContext = buildPaymentContext(paymentData);
    setPaymentContext(nextContext);
    await syncAuthenticatedUser(token);
    setStatus('success');
    setMessage(nextContext.successMessage);
    setTimeout(() => navigate(nextContext.successPath), 2500);
  };

  const handleCancelledPayment = (returnMessage = '', paymentData) => {
    const nextContext = buildPaymentContext(paymentData);
    setPaymentContext(nextContext);
    setStatus('cancelled');
    setMessage(returnMessage || 'Payment cancelled. You were not charged.');
    setTimeout(() => navigate(nextContext.retryPath), 3000);
  };

  const handleFailedPayment = (returnMessage = '', paymentData) => {
    const nextContext = buildPaymentContext(paymentData);
    setPaymentContext(nextContext);
    setStatus('error');
    setMessage(returnMessage || 'Payment failed or was not completed. Please try again.');
    setTimeout(() => navigate(nextContext.retryPath), 3000);
  };

  const verifyPaymentStatus = async (orderId, resultCode, returnMessage = '') => {
    try {
      const token = getToken();
      if (!token) {
        setStatus('error');
        setMessage('Session expired. Please login again.');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      const response = await fetch(`${API_URL}/api/payments/${orderId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      // Check payment status
      if (!data.success) {
        if (!IS_PRODUCTION && isSuccessfulReturn(resultCode)) {
          const confirmData = await confirmPaymentFromReturnDev({
            orderId,
            resultCode,
            returnMessage,
            token
          });

          if (confirmData.success) {
            await handleSuccessfulConfirmation(token, null);
            return;
          }
        }

        setStatus('error');
        setMessage(data.error?.message || 'Unable to verify payment status.');
        setTimeout(() => navigate('/premium'), 3000);
        return;
      }

      const paymentData = data.data || {};
      setPaymentContext(buildPaymentContext(paymentData));

      if (isCancelledReturn(resultCode)) {
        handleCancelledPayment(returnMessage, paymentData);
        return;
      }

      if (hasFailedReturn(resultCode)) {
        handleFailedPayment(returnMessage, paymentData);
        return;
      }

      const paymentStatus = data.data?.status;

      // Payment completed successfully
      if (paymentStatus === 'paid' || paymentStatus === 'completed') {
        await handleSuccessfulConfirmation(token, paymentData);
        return;
      }

      if (paymentStatus === 'cancelled') {
        handleCancelledPayment(returnMessage, paymentData);
        return;
      }

      if (paymentStatus === 'failed') {
        handleFailedPayment(returnMessage, paymentData);
        return;
      }

      // Payment pending (waiting for IPN confirmation)
      if (paymentStatus === 'pending') {
        if (!IS_PRODUCTION && isSuccessfulReturn(resultCode)) {
          setStatus('pending');
          setMessage('Payment received. Finalizing your premium activation in local development...');

          const confirmData = await confirmPaymentFromReturnDev({
            orderId,
            resultCode,
            returnMessage,
            token
          });

          if (confirmData.success) {
            await handleSuccessfulConfirmation(token, paymentData);
            return;
          }
        }

        setStatus('pending');
        setMessage(
          'Payment received! We\'re confirming with MoMo. This usually takes a few seconds. You can close this window.'
        );
        // Auto-check status after 3 seconds
        setTimeout(() => verifyPaymentStatus(orderId, resultCode, returnMessage), 3000);
        return;
      }

      // Payment fallback for development success return without IPN
      if (!IS_PRODUCTION && isSuccessfulReturn(resultCode)) {
        const confirmData = await confirmPaymentFromReturnDev({
          orderId,
          resultCode,
          returnMessage,
          token
        });

        if (confirmData.success) {
          await handleSuccessfulConfirmation(token, paymentData);
          return;
        }
      }

      handleFailedPayment(returnMessage, paymentData);
    } catch (err) {
      console.error('Payment verification error:', err);
      setStatus('error');
      setMessage('Error verifying payment. Please try again.');
      setTimeout(() => navigate('/premium'), 3000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700 bg-slate-900/50 p-8 backdrop-blur">
        {/* Icon based on status */}
        <div className="flex justify-center">
          {status === 'loading' || status === 'pending' ? (
            <Loader size={64} className="animate-spin text-brand" />
          ) : status === 'success' ? (
            <CheckCircle size={64} className="text-emerald-500" />
          ) : status === 'cancelled' ? (
            <AlertCircle size={64} className="text-amber-500" />
          ) : (
            <AlertCircle size={64} className="text-rose-500" />
          )}
        </div>

        {/* Status message */}
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-white">
            {status === 'loading' || status === 'pending'
              ? 'Verifying Payment'
              : status === 'success'
              ? 'Payment Successful'
              : status === 'cancelled'
              ? 'Payment Cancelled'
              : 'Payment Failed'}
          </h1>
          <p className="text-slate-300">{message}</p>
        </div>

        {/* Order ID (for reference) */}
        {orderId && (
          <div className="rounded-lg bg-slate-800/50 p-4">
            <p className="text-xs text-slate-400">Order ID</p>
            <p className="mt-1 break-all font-mono text-sm text-slate-200">{orderId}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3 pt-6">
          {status === 'error' && (
            <>
              <button
                onClick={() => navigate(paymentContext.retryPath)}
                className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white transition hover:bg-brand-light"
              >
                {paymentContext.retryLabel}
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-white transition hover:bg-slate-700"
              >
                Back to Home
              </button>
            </>
          )}
          {status === 'cancelled' && (
            <>
              <button
                onClick={() => navigate(paymentContext.retryPath)}
                className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white transition hover:bg-brand-light"
              >
                {paymentContext.retryLabel}
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-white transition hover:bg-slate-700"
              >
                Back to Home
              </button>
            </>
          )}
          {status === 'pending' && (
            <p className="text-xs text-slate-400 text-center">
              {paymentContext.pendingNotice}
            </p>
          )}
          {status === 'loading' && (
            <p className="text-xs text-slate-400 text-center animate-pulse">
              Please wait while we verify your payment...
            </p>
          )}
        </div>

        {/* Info box for paid status */}
        {status === 'success' && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4">
            <p className="text-sm text-emerald-300">
              {paymentContext.successNotice}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
