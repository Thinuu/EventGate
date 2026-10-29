import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { getApiBase } from '../../utils/backend';
import toast from 'react-hot-toast';
import {
  LockClosedIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const ChangeTempPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const tempToken = location.state?.tempToken;

  useEffect(() => {
    if (!tempToken) {
      toast.error('Session expired. Please log in again.');
      navigate('/login');
    }
  }, [tempToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      return toast.error('Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match.');
    }

    setLoading(true);
    try {
      const response = await axios.post(`${getApiBase()}/auth/change-temp-password`, {
        tempToken,
        newPassword: password,
      });

      if (response.data.success) {
        toast.success('Security Update Complete | You can now log in');
        navigate('/login');
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Failed to update password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!tempToken) return null;

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
            Security <span className="text-teal-600">Update</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Mandatory Access Key Rotation
          </p>
        </div>

        {/* Main Card */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Security Notice */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-teal-50/70 border border-teal-100">
              <ShieldCheckIcon className="h-5 w-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] font-medium text-teal-900 leading-relaxed">
                You are currently using a temporary access key. For your security, you must define a
                new permanent password before proceeding.
              </p>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
              >
                New Permanent Key
              </label>
              <div className="relative group">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
              >
                Confirm New Key
              </label>
              <div className="relative group">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
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
                  Updating Security...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Update and Login
                  <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-teal-600 transition-colors"
            >
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

export default ChangeTempPasswordPage;