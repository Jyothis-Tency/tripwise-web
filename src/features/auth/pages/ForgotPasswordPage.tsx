import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Moon,
  Sun,
} from "lucide-react";
import { authApi } from "../api";
import { useTheme } from "../../../hooks/useTheme";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";

type Step = "email" | "reset";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputWrap =
    "group flex items-center rounded-xl border border-slate-200 bg-[var(--bg-elevated)] px-4 py-3 transition-all hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 dark:border-[#1e2638] dark:hover:border-slate-600 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/30";
  const inputCls =
    "h-6 min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelCls =
    "text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400";

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.requestPasswordResetOtp(email.trim());
      setMessage(res.message);
      setStep("reset");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(msg ?? "Could not send reset code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
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
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(msg ?? "Could not reset password. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg-main)] lg:flex-row">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-[var(--bg-card)] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-[#1e2638] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>

      <div className="relative flex shrink-0 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-800 px-6 py-10 text-center text-white lg:min-h-screen lg:flex-1 dark:from-indigo-950 dark:via-[#0b1120] dark:to-[#060a15]">
        <div
          className="pointer-events-none absolute -top-20 -left-10 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 mx-auto mb-6 flex justify-center">
          <TripwiseLogo className="h-32 w-32 drop-shadow-[0_0_28px_rgba(99,102,241,0.45)] sm:h-36 sm:w-36" />
        </div>
        <h1 className="relative z-10 text-2xl font-bold">Reset password</h1>
        <p className="relative z-10 mt-2 max-w-xs text-sm text-indigo-100 dark:text-slate-400">
          We&apos;ll email you a one-time code. Your current password cannot be
          shown — set a new one with the code.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-[var(--bg-card)] px-6 py-8 shadow-lg sm:px-8 dark:border-[#1e2638] dark:shadow-xl dark:shadow-black/40">
          <Link
            to="/login"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {step === "email" ? "Forgot password?" : "Enter code & new password"}
          </h2>
          <p className="mt-1 mb-6 text-sm text-slate-400 dark:text-slate-500">
            {step === "email"
              ? "Use the email on your Tripwise owner account."
              : `Code sent to ${email}. Expires in 15 minutes.`}
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {message}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <div className="space-y-2">
                <label className={labelCls}>Email</label>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send reset code"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>6-digit code</label>
                <div className={inputWrap}>
                  <KeyRound className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className={`${inputCls} tracking-[0.3em]`}
                    placeholder="000000"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>New password</label>
                <div className={inputWrap}>
                  <Lock className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
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
                    className="ml-2 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                <label className={labelCls}>Confirm password</label>
                <div className={inputWrap}>
                  <Lock className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
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
                    const res = await authApi.requestPasswordResetOtp(
                      email.trim(),
                    );
                    setMessage(res.message);
                    setOtp("");
                  } catch (err: unknown) {
                    const msg =
                      err && typeof err === "object" && "response" in err
                        ? (
                            err as {
                              response?: { data?: { message?: string } };
                            }
                          ).response?.data?.message
                        : undefined;
                    setError(msg ?? "Could not resend code.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
              >
                Resend code
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Set new password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
