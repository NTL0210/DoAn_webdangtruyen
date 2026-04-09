import { useState } from 'react';
import { Crown, Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly Premium',
    price: '99,000₫',
    duration: '30 days',
    features: [
      'Premium artist badge',
      'Higher visibility boost',
      'Analytics dashboard',
      'Priority support'
    ],
    cta: 'Get Monthly'
  },
  {
    id: 'yearly',
    name: 'Yearly Premium',
    price: '999,000₫',
    duration: '365 days',
    features: [
      'Premium artist badge',
      'Higher visibility boost',
      'Advanced analytics',
      'Priority support',
      'Early access to features'
    ],
    bestseller: true,
    cta: 'Get Yearly'
  }
];

export default function PremiumPage() {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [error, setError] = useState('');

  const handleUpgradeClick = async (planId) => {
    setSelectedPlan(planId);
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/payments/momo/premium/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ plan: planId })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Failed to create payment');
        setSelectedPlan(null);
        return;
      }

      // Redirect to MoMo payment
      if (data.data?.payUrl) {
        window.location.href = data.data.payUrl;
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError('Payment URL not available. Please try again.');
        setSelectedPlan(null);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An error occurred. Please try again.');
      setSelectedPlan(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="detail-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Crown size={32} className="text-amber-400" />
          <div>
            <h1 className="text-3xl font-semibold text-white">Become a Premium Artist</h1>
            <p className="mt-2 text-slate-400">Unlock exclusive features and boost your visibility across the platform.</p>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="detail-card p-3 sm:p-4">
        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-2">
          <div className="relative grid grid-cols-2 gap-2">
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-[1.15rem] border border-amber-400/20 bg-gradient-to-r from-amber-500/18 via-orange-400/12 to-amber-300/18 shadow-[0_12px_30px_rgba(245,158,11,0.14)] transition-transform duration-300 ease-out ${
                selectedPlan === 'yearly' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;

              return (
                <button
                  key={`switch-${plan.id}`}
                  type="button"
                  onClick={() => !loading && setSelectedPlan(plan.id)}
                  className={`relative z-10 rounded-[1.15rem] px-4 py-4 text-left transition duration-300 ${
                    isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-sm font-semibold">{plan.name}</div>
                  <div className="mt-1 text-xs opacity-80">{plan.price} · {plan.duration}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid items-stretch gap-6 md:grid-cols-2">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isProcessing = loading && isSelected;

          return (
            <div
              key={plan.id}
              onClick={() => !loading && setSelectedPlan(plan.id)}
              className={`relative flex h-full cursor-pointer flex-col rounded-[1.9rem] border p-6 transition-all duration-300 ${
                plan.bestseller
                  ? `border-amber-500/50 ${
                      isSelected
                        ? 'bg-gradient-to-br from-amber-500/18 via-[#1a1622] to-slate-950 shadow-[0_24px_60px_rgba(245,158,11,0.16)] ring-1 ring-amber-300/35'
                        : 'bg-gradient-to-br from-amber-500/8 via-slate-900/60 to-slate-950 hover:border-amber-400/40 hover:bg-gradient-to-br hover:from-amber-500/10 hover:via-slate-900/70 hover:to-slate-950'
                    }`
                  : `border-slate-700 ${
                      isSelected
                        ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-[0_24px_60px_rgba(30,41,59,0.32)] ring-1 ring-violet-300/30'
                        : 'bg-slate-900/30 hover:border-slate-500 hover:bg-slate-900/55'
                    }`
              }`}
            >
              {plan.bestseller && (
                <div className="absolute -top-3 left-6 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                  Best Value
                </div>
              )}

              <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{plan.duration}</p>

              <div className="mt-4 min-h-[92px] space-y-2">
                <div className="text-3xl font-bold text-white">{plan.price}</div>
                <p className="text-sm text-slate-400">One-time payment</p>
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium transition ${
                  isSelected
                    ? plan.bestseller
                      ? 'bg-amber-500/14 text-amber-200'
                      : 'bg-violet-500/14 text-violet-200'
                    : 'bg-slate-800/80 text-slate-400'
                }`}>
                  {isSelected ? 'Currently selected' : 'Tap to choose'}
                </div>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                    <Zap size={16} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleUpgradeClick(plan.id)}
                disabled={isProcessing}
                className={`mt-6 w-full rounded-lg px-4 py-3 font-medium transition ${
                  plan.bestseller
                    ? 'border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'border border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Redirecting to MoMo...
                  </span>
                ) : (
                  isSelected ? `Continue with ${plan.name}` : `Pay for ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* FAQ Section */}
      <section className="detail-card p-6">
        <h2 className="text-lg font-semibold text-white">Frequently Asked Questions</h2>
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="font-medium text-white">What's included in Premium?</h3>
            <p className="mt-1 text-sm text-slate-400">
              A distinctive premium badge on your profile, higher visibility in search and feeds, detailed analytics on your content performance, and priority customer support.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-white">Can I cancel anytime?</h3>
            <p className="mt-1 text-sm text-slate-400">
              Premium membership is not automatically renewed. You purchase a fixed duration and can decide whether to extend when it expires.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-white">How does billing work?</h3>
            <p className="mt-1 text-sm text-slate-400">
              We use MoMo for secure payments. You'll be redirected to complete payment, and your premium access activates immediately upon successful transaction.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-white">What if I need help?</h3>
            <p className="mt-1 text-sm text-slate-400">
              Contact our support team anytime. Premium members get priority assistance and faster response times.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
