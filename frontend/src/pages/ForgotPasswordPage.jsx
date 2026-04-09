import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isCompleteOtpCode, sanitizeOtpCode } from '../utils/otp';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // 'email', 'code', 'password'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const codeInlineError = step === 'code' && code && !isCompleteOtpCode(code)
    ? 'Reset code must contain exactly 6 digits.'
    : '';

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Failed to send reset code');
        return;
      }

      setSuccess('Reset code sent to your email. Check your inbox.');
      setStep('code');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isCompleteOtpCode(code)) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Failed to reset password');
        return;
      }

      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-white">Reset Password</h1>
          <p className="mt-2 text-sm text-slate-400">
            {step === 'email' && 'Enter your email to receive a reset code'}
            {step === 'code' && 'Enter the code from your email and a new password'}
            {step === 'password' && 'Set your new password'}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <form onSubmit={step === 'email' ? handleRequestReset : handleResetPassword} className="mt-6 space-y-4">
            {step === 'email' && (
              <div>
                <label className="block text-sm font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base mt-2"
                  placeholder="your@email.com"
                />
              </div>
            )}

            {step === 'code' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Reset Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(sanitizeOtpCode(e.target.value))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="input-base mt-2"
                    placeholder="6-digit code from email"
                    maxLength={6}
                  />
                    {codeInlineError ? <p className="mt-2 text-xs text-rose-300">{codeInlineError}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-base mt-2"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-base mt-2"
                    placeholder="Confirm password"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="editor-action-primary w-full py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? step === 'email'
                  ? 'Sending...'
                  : 'Resetting...'
                : step === 'email'
                  ? 'Send Reset Code'
                  : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-brand-light transition hover:text-white"
              >
                Back to login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
