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
      {/* Left branding panel — clean solid blue */}
      <div className="relative flex flex-col items-center justify-center shrink-0 bg-blue-600 px-6 py-10 sm:py-12 pb-20 lg:pb-12 text-center text-white lg:flex-1 lg:min-h-screen lg:rounded-none rounded-b-[32px] transition-all duration-300 overflow-hidden">
        <div className="relative z-10 animate-fade-in">
          <div className="mx-auto mb-6 flex h-20 w-20 sm:mb-8 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-white/15 lg:h-28 lg:w-28 backdrop-blur-sm border border-white/10">
            <span className="text-3xl sm:text-4xl lg:text-5xl">🚚</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl lg:text-4xl tracking-tight">Tripwise</h1>
          <p className="mb-4 sm:mb-6 text-xs sm:text-sm lg:text-base text-blue-100 font-medium tracking-widest uppercase">Trip Management System</p>
          <p className="hidden text-sm text-blue-200/80 sm:block sm:max-w-xs sm:mx-auto lg:max-w-md lg:text-base leading-relaxed">
            Comprehensive trip management solution for
            <br className="hidden lg:block"/>fleet owners and drivers
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative z-10 flex flex-1 items-start lg:items-center justify-center bg-transparent lg:bg-slate-50 px-4 sm:px-6 py-0 pb-10 lg:py-10 -mt-10 lg:mt-0 transition-all duration-300">
        <div className="w-full max-w-md rounded-2xl bg-white px-6 py-8 sm:px-8 sm:py-10 shadow-lg border border-slate-100 animate-fade-in">
          <div className="text-center lg:text-left">
            <h2 className="mb-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="mb-8 text-sm text-slate-400">
              Sign in to access your trip management dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium animate-fade-in">
              <span className="shrink-0">⚠</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Email Address
              </label>
              <div className="group flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 hover:border-slate-300">
                <Mail className="mr-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
                <p className="text-xs font-medium text-red-500 mt-1">{formik.errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Password
              </label>
              <div className="group flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 hover:border-slate-300">
                <Lock className="mr-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
                <p className="text-xs font-medium text-red-500 mt-1">{formik.errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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
