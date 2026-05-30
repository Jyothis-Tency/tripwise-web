import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api';

type Step = 'email' | 'reset';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputWrap =
    'group flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 hover:border-slate-300';
  const inputCls =
    'h-6 min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none';

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.requestPasswordResetOtp(email.trim());
      setMessage(res.message);
      setStep('reset');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(msg ?? 'Could not send reset code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPasswordWithOtp(
        email.trim(),
        code,
        newPassword,
      );
      setMessage(res.message);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(msg ?? 'Could not reset password. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="relative flex shrink-0 flex-col items-center justify-center bg-blue-600 px-6 py-10 text-center text-white lg:min-h-screen lg:flex-1">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 border border-white/10">
          <span className="text-4xl">🔐</span>
        </div>
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="mt-2 max-w-xs text-sm text-blue-100">
          We&apos;ll email you a one-time code. Your current password cannot be
          shown — set a new one with the code.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white px-6 py-8 shadow-lg sm:px-8">
          <Link
            to="/login"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <h2 className="text-xl font-bold text-slate-900">
            {step === 'email' ? 'Forgot password?' : 'Enter code & new password'}
          </h2>
          <p className="mt-1 mb-6 text-sm text-slate-400">
            {step === 'email'
              ? 'Use the email on your Tripwise owner account.'
              : `Code sent to ${email}. Expires in 15 minutes.`}
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Email
                </label>
                <div className={inputWrap}>
                  <Mail className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="name@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  6-digit code
                </label>
                <div className={inputWrap}>
                  <KeyRound className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className={`${inputCls} tracking-[0.3em]`}
                    placeholder="000000"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  New password
                </label>
                <div className={inputWrap}>
                  <Lock className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputCls}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="ml-2 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Confirm password
                </label>
                <div className={inputWrap}>
                  <Lock className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setMessage(null);
                  setLoading(true);
                  try {
                    const res = await authApi.requestPasswordResetOtp(email.trim());
                    setMessage(res.message);
                    setOtp('');
                  } catch (err: unknown) {
                    const msg =
                      err && typeof err === 'object' && 'response' in err
                        ? (err as { response?: { data?: { message?: string } } })
                            .response?.data?.message
                        : undefined;
                    setError(msg ?? 'Could not resend code.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
