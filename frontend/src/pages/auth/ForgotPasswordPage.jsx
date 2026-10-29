import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getApiBase } from '../../utils/backend';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon,
  ChevronRightIcon,
  BoltIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${getApiBase()}/auth/forgot-password`, { email });
      if (response.data.success) {
        toast.success('Reset link dispatched to your email.');
        setSubmitted(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to process request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans selection:bg-teal-500/20 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      {/* Soft modern gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-teal-50/30" />

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
            Access <span className="text-teal-600">Recovery</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Identity Restoration Protocol
          </p>
        </div>

        {/* Main Card */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <p className="text-sm text-slate-600 leading-relaxed text-center">
                Enter your verified email address to receive a secure access restoration link.
              </p>

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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="identity@stadium.entrynex.lk"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed py-4 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm shadow-teal-200 transition-all duration-300 active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out]" />
                {loading ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Send Restoration Link
                    <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-5 py-2">
              <div className="mx-auto h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                <EnvelopeIcon className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  Link Dispatched
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  A secure access link has been sent to{' '}
                  <span className="font-medium text-teal-600">{email}</span>.
                  Please check your inbox and spam folder.
                </p>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Use different email
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Navigation
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-teal-600 transition-colors"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Return to Gateway
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
          EventGate Manage events. Monitor access.
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;