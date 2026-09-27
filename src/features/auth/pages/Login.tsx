import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useTheme } from "../../../hooks/useTheme";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";

const validationSchema = Yup.object({
  email: Yup.string()
    .required("Email or phone number is required")
    .test(
      "email-or-phone",
      "Enter a valid email or phone number",
      (value) => {
        const v = String(value || "").trim();
        if (!v) return false;
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        const digits = v.replace(/\D/g, "");
        const isPhone = digits.length >= 10;
        return isEmail || isPhone;
      },
    ),
  password: Yup.string().required("Password is required"),
});

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await login(values.email.trim(), values.password);
        navigate("/", { replace: true });
      } catch {
        // handled via error state
      }
    },
  });

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

      {/* Branding panel */}
      <div className="relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-b-[32px] bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-800 px-6 py-10 pb-20 text-center text-white sm:py-12 lg:min-h-screen lg:flex-1 lg:rounded-none lg:pb-12 dark:from-indigo-950 dark:via-[#0b1120] dark:to-[#060a15]">
        <div
          className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-300/15 blur-3xl dark:bg-indigo-400/10"
          aria-hidden
        />
        <div className="relative z-10 animate-fade-in">
          <div className="mx-auto mb-6 flex justify-center sm:mb-8">
            <TripwiseLogo className="h-32 w-32 drop-shadow-[0_0_32px_rgba(99,102,241,0.5)] sm:h-36 sm:w-36 lg:h-40 lg:w-40" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Tripwise
          </h1>
          <p className="mb-4 text-xs font-medium tracking-widest text-indigo-100 uppercase sm:mb-6 sm:text-sm lg:text-base dark:text-indigo-300/80">
            Fleet Management
          </p>
          <p className="mx-auto hidden max-w-xs text-sm leading-relaxed text-indigo-100/80 sm:block lg:max-w-md lg:text-base dark:text-slate-400">
            Comprehensive trip management for fleet owners and drivers
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative z-10 -mt-10 flex flex-1 items-start justify-center bg-transparent px-4 py-0 pb-10 transition-all duration-300 sm:px-6 lg:mt-0 lg:items-center lg:bg-[var(--bg-main)] lg:py-10">
        <div className="w-full max-w-md animate-fade-in rounded-2xl border border-slate-200 bg-[var(--bg-card)] px-6 py-8 shadow-lg sm:px-8 sm:py-10 dark:border-[#1e2638] dark:shadow-xl dark:shadow-black/40">
          <div className="text-center lg:text-left">
            <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              Welcome Back
            </h2>
            <p className="mb-8 text-sm text-slate-400 dark:text-slate-500">
              Sign in to access your trip management dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 animate-fade-in dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400"
              >
                Email or phone
              </label>
              <div className="group flex items-center rounded-xl border border-slate-200 bg-[var(--bg-elevated)] px-4 py-3 transition-all hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 dark:border-[#1e2638] dark:hover:border-slate-600 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/30">
                <Mail className="mr-3 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400" />
                <input
                  id="email"
                  name="email"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.email}
                  className="h-6 w-full border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Email or phone number"
                />
              </div>
              {formik.touched.email && formik.errors.email && (
                <p className="mt-1 text-xs font-medium text-rose-500 dark:text-rose-400">
                  {formik.errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400"
              >
                Password
              </label>
              <div className="group flex items-center rounded-xl border border-slate-200 bg-[var(--bg-elevated)] px-4 py-3 transition-all hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 dark:border-[#1e2638] dark:hover:border-slate-600 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/30">
                <Lock className="mr-3 h-5 w-5 shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.password}
                  className="h-6 min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="ml-2 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {formik.touched.password && formik.errors.password && (
                <p className="mt-1 text-xs font-medium text-rose-500 dark:text-rose-400">
                  {formik.errors.password}
                </p>
              )}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
