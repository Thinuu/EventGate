import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import {
  LockClosedIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const LoginPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', mfaToken: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);

  useEffect(() => {
    if (user?.role) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const getLoginErrorMessage = (error) => {
    if (error.response?.data?.message) return error.response.data.message;
    if (Array.isArray(error.response?.data?.errors) && error.response.data.errors.length > 0) {
      return error.response.data.errors[0]?.msg || 'Unable to sign in.';
    }
    if (!error.response) return 'Unable to reach the server. Please try again.';
    return 'Unable to sign in right now.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.email, form.password, form.mfaToken);
      if (result?.requireMfa) {
        setMfaStep(true);
        toast('MFA Required | Check your authenticator app');
        return;
      }
      if (result?.requirePasswordChange) {
        toast(result.message || 'Security update required');
        navigate('/change-password', { state: { tempToken: result.tempToken } });
        return;
      }
      toast.success(`Access Granted | Welcome, ${result.name}`);
      navigate(getDashboardPathForRole(result.role));
    } catch (err) {
      toast.error(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-teal-500/20 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      {/* Soft modern gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-teal-50/30" />

      {/* Subtle ambient glows */}
      <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-teal-400/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[480px] sm:max-w-[520px]">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm mb-5">
            <img
              src="/brand/eventgate-mark.svg"
              alt="Logo"
              className="h-9 w-9 object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Secure <span className="text-teal-600">Gateway</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Precision Access Management
          </p>
        </div>

        {/* Main Card – hybrid style */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {!mfaStep ? (
              <>
                {/* Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
                  >
                    Verification Email
                  </label>
                  <div className="relative group">
                    <EnvelopeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="identity@stadium.entrynex.lk"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
                    >
                      Access Key
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      Lost Key?
                    </Link>
                  </div>
                  <div className="relative group">
                    <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••••••"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="mfaToken"
                  className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 ml-0.5"
                >
                  MFA Security Token
                </label>
                <div className="relative group">
                  <BoltIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600 pointer-events-none" />
                  <input
                    id="mfaToken"
                    type="text"
                    required
                    autoFocus
                    value={form.mfaToken}
                    onChange={(e) => setForm((f) => ({ ...f, mfaToken: e.target.value }))}
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-2xl border border-teal-200 bg-teal-50/40 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMfaStep(false)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors mt-1"
                >
                  ← Back to Credentials
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed py-4 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm shadow-teal-200 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out]" />
              {loading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {mfaStep ? 'Verify Security Token' : 'Initiate Secure Access'}
                  <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Operations
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* Quick links */}
          <div className="mt-6 grid grid-cols-1 gap-3">
            <Link
              to="/signup"
              className="group p-4 rounded-2xl border border-slate-200 bg-slate-50/60 transition-all hover:bg-white hover:border-teal-200 hover:shadow-sm text-center"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-teal-600 mb-0.5">
                Recruit Attendee
              </span>
              <span className="text-[11px] text-slate-500">
                Join the high-fidelity ecosystem
              </span>
            </Link>

            <Link
              to="/"
              className="group p-4 rounded-2xl border border-slate-200 bg-slate-50/60 transition-all hover:bg-white hover:border-amber-200 hover:shadow-sm text-center"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-0.5">
                Public Terminal
              </span>
              <span className="text-[11px] text-slate-500">
                Access as unregistered guest
              </span>
            </Link>
          </div>

         {/* Lab Access (dev credentials) */}
         <div className="mt-6 border-t border-slate-100 pt-5">
            {/*<details className="group/details">
              <summary className="flex items-center justify-center gap-2 cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-teal-600 transition-colors">
                <span className="bg-teal-50 text-teal-600 px-2 py-0.5 rounded-md text-[10px]">
                  Lab Access
                </span>
                View System Credentials
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {[
                  { r: 'Admin', e: 'admin@stadium.entrynex.com', p: 'Admin@Matrix.Reset' },
                  { r: 'Organiser', e: 'organiser@stadium.entrynex.com', p: 'Organiser@Matrix.Reset' },
                  { r: 'Sub-Org', e: 'suborg@stadium.entrynex.com', p: 'SubOrg@Matrix.Reset' },
                  { r: 'Staff', e: 'staff@stadium.entrynex.com', p: 'Staff@Matrix.Reset' },
                  { r: 'Auditor', e: 'auditor@stadium.entrynex.com', p: 'Auditor@Matrix.Reset' },
                  { r: 'Sponsor', e: 'sponsor@stadium.entrynex.com', p: 'Sponsor@Matrix.Reset' },
                  { r: 'Attendee', e: 'attendee@stadium.entrynex.com', p: 'Attendee@Matrix.Reset' },
                ].map((item) => (
                  <div
                    key={item.r}
                    className="flex flex-col p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px]"
                  >
                    <span className="font-semibold text-teal-600 uppercase mb-1">{item.r}</span>
                    <div className="flex flex-wrap justify-between gap-x-2 text-slate-600 font-medium">
                      <span className="truncate">{item.e}</span>
                      <span className="text-slate-400">{item.p}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>*/}
          </div>
        </div>

        {/* Status + Footer */}
        <div className="mt-8 text-center space-y-4">
          <div className="inline-flex items-center gap-3 bg-white/80 px-5 py-2 rounded-full border border-slate-200 shadow-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Network Status: <span className="text-teal-600">Secured</span>
            </p>
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            EventGate Manage events. Monitor access.
          </p>
        </div>
      </div>

      {/* Desktop branding bar */}
      <div className="absolute bottom-8 inset-x-10 hidden lg:flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="h-0.5 w-10 bg-teal-500 rounded-full" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Elite Registry Protocol
          </span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300">
          © 2026 EventGate Event Access Management
        </span>
      </div>
    </div>
  );
};

export default LoginPage;