import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  LockClosedIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const SignupPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'Attendee',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Security codes do not match');
      return;
    }

    if (form.password.length < 8) {
      toast.error('Security code must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
      });

      navigate('/signup-success');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Authorization matrix conflict';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-teal-500/20 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      {/* Soft modern gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-teal-50/30" />

      <div className="relative z-10 w-full max-w-[480px] sm:max-w-[520px] lg:max-w-[540px]">
        {/* Branding – premium but cleaner */}
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
            Elite <span className="text-teal-600">Recruitment</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Initialize System Authority
          </p>
        </div>

        {/* Main Card – hybrid of original glass + dashboard style */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8 lg:p-9">
          {/* subtle top accent line */}
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Identity Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
              >
                Identity Name
              </label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ex. Adrian Perera"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
              </div>
            </div>

            {/* Email + Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
                >
                  E-Mail
                </label>
                <div className="relative group">
                  <EnvelopeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="name@agency.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="phone"
                  className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
                >
                  Mobile Access
                </label>
                <div className="relative group">
                  <PhoneIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+94 77 123 4567"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>
            </div>

            {/* Security Codes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
                >
                  Security Code
                </label>
                <div className="relative group">
                  <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
                >
                  Confirm Code
                </label>
                <div className="relative group">
                  <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat code"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>
            </div>

            {/* Role note */}
            <p className="text-center text-[10px] font-medium uppercase tracking-widest text-slate-400 pt-1">
              Standard Attendee Operational Level
            </p>

            {/* Submit button – modern + premium */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed py-4 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm shadow-teal-200 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out]" />
              {loading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Initialising Profile...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Initialize Authority
                  <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </button>
          </form>

          {/* Footer link */}
          <div className="mt-7 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Already cleared?{' '}
              <Link
                to="/login"
                className="font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Access Portal
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom brand line */}
        <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
          EventGate Manage events. Monitor access.
        </p>
      </div>
    </div>
  );
};

export default SignupPage;