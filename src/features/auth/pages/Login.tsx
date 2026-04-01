import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await login(values.email, values.password);
        navigate('/', { replace: true });
      } catch {
        // handled via error state
      }
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Left branding panel */}
      <div className="relative z-0 flex flex-col items-center justify-center shrink-0 bg-linear-to-br from-indigo-600 to-indigo-500 px-6 py-12 pb-20 lg:pb-12 text-center text-white lg:flex-1 lg:min-h-screen lg:rounded-none rounded-b-[40px] shadow-lg lg:shadow-none transition-all duration-300">
        <div>
          <div className="mx-auto mb-6 flex h-24 w-24 sm:mb-8 sm:h-28 sm:w-28 items-center justify-center rounded-[40px] sm:rounded-[56px] bg-white/20 lg:h-32 lg:w-32 shadow-inner backdrop-blur-sm">
            <span className="text-3xl sm:text-4xl lg:text-5xl">🚚</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl lg:text-4xl tracking-tight">Trip Management</h1>
          <p className="mb-4 sm:mb-6 text-xs sm:text-sm lg:text-base text-indigo-100/90 font-medium tracking-wide uppercase">System</p>
          <p className="hidden text-sm text-indigo-100/80 sm:block sm:max-w-xs sm:mx-auto lg:max-w-none">
            Comprehensive trip management solution for
            <br className="hidden lg:block"/> owners and drivers
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative z-10 flex flex-1 items-start lg:items-center justify-center bg-transparent lg:bg-slate-50 px-4 sm:px-6 py-0 pb-10 lg:py-10 -mt-12 lg:mt-0 transition-all duration-300">
        <div className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-xl px-6 py-8 sm:px-8 sm:py-10 shadow-xl lg:shadow-2xl border border-white/40 ring-1 ring-slate-900/5">
          <div className="text-center lg:text-left">
            <h2 className="mb-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="mb-8 text-xs sm:text-sm text-slate-500 font-medium">
              Sign in to access your trip management dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium shadow-sm">
              <span className="shrink-0 text-red-500">⚠</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Email Address
              </label>
              <div className="group flex items-center rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300">
                <Mail className="mr-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.email}
                  className="h-6 w-full border-none bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none"
                  placeholder="name@company.com"
                />
              </div>
              {formik.touched.email && formik.errors.email && (
                <p className="text-xs font-semibold text-red-600 mt-1">{formik.errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Password
              </label>
              <div className="group flex items-center rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300">
                <Lock className="mr-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.password}
                  className="h-6 w-full border-none bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 outline-none"
                  placeholder="••••••••"
                />
              </div>
              {formik.touched.password && formik.errors.password && (
                <p className="text-xs font-semibold text-red-600 mt-1">{formik.errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:-translate-y-0"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

