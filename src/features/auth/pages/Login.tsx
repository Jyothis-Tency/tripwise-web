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
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      {/* Left branding panel */}
      <div className="flex flex-1 items-center justify-center bg-linear-to-br from-indigo-500 to-indigo-400 px-8 py-12 text-center text-white">
        <div>
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-[56px] bg-white/20 md:h-32 md:w-32">
            <span className="text-4xl md:text-5xl">🚚</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Tripwise</h1>
          <p className="mb-6 text-sm md:text-base opacity-90">Trip Management System</p>
          <p className="hidden text-sm opacity-80 md:block">
            Comprehensive trip management solution for
            <br />
            owners and drivers
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md rounded-xl bg-white px-8 py-10 shadow-md">
          <h2 className="mb-2 text-2xl font-semibold text-slate-900">Welcome Back</h2>
          <p className="mb-8 text-sm text-slate-500">
            Sign in to access your trip management dashboard
          </p>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-slate-700">
                Email Address
              </label>
              <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2">
                <Mail className="mr-2 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.email}
                  className="h-6 w-full border-none bg-transparent text-sm outline-none"
                />
              </div>
              {formik.touched.email && formik.errors.email && (
                <p className="text-xs text-red-600">{formik.errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-slate-700">
                Password
              </label>
              <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2">
                <Lock className="mr-2 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.password}
                  className="h-6 w-full border-none bg-transparent text-sm outline-none"
                />
              </div>
              {formik.touched.password && formik.errors.password && (
                <p className="text-xs text-red-600">{formik.errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

