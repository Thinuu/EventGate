import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { changePassword } from '../../api/users';
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const PasswordChangePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleShowPassword = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePassword = (password) => {
    const requirements = [];
    if (password.length < 8) requirements.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) requirements.push('One uppercase letter');
    if (!/[a-z]/.test(password)) requirements.push('One lowercase letter');
    if (!/[0-9]/.test(password)) requirements.push('One number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) requirements.push('One special character');
    return requirements;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    const requirements = validatePassword(form.newPassword);
    if (requirements.length > 0) {
      toast.error('Password does not meet requirements');
      return;
    }

    if (form.currentPassword === form.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      navigate('/dashboard');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        'Failed to change password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const requirements = form.newPassword ? validatePassword(form.newPassword) : [];
  const passwordsMatch =
    form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;

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
            Change <span className="text-teal-600">Password</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Account Security Update
          </p>
        </div>

        {/* Main Card */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Current Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="currentPassword"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
              >
                Current Password
              </label>
              <div className="relative group">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                <input
                  id="currentPassword"
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={form.currentPassword}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('current')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                >
                  {showPasswords.current ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="newPassword"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
              >
                New Password
              </label>
              <div className="relative group">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                <input
                  id="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  name="newPassword"
                  value={form.newPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('new')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                >
                  {showPasswords.new ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Requirements feedback */}
              <div className="mt-3 space-y-1.5">
                {form.newPassword.length > 0 && requirements.length === 0 && (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircleIcon className="h-4 w-4" />
                    Password meets all requirements
                  </p>
                )}
                {requirements.map((req) => (
                  <div key={req} className="flex items-center gap-1.5 text-xs text-red-500">
                    <XCircleIcon className="h-3.5 w-3.5" />
                    {req}
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5"
              >
                Confirm New Password
              </label>
              <div className="relative group">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors pointer-events-none" />
                <input
                  id="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  className={`w-full rounded-2xl border bg-slate-50/50 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-teal-500/10 ${
                    form.confirmPassword && !passwordsMatch
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-slate-200 focus:border-teal-500'
                  }`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('confirm')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                >
                  {showPasswords.confirm ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {form.confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-sm text-red-500">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  Passwords match
                </p>
              )}
            </div>

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
                  Changing Password...
                </span>
              ) : (
                'Change Password'
              )}
            </button>
          </form>

          {/* Security Tips */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheckIcon className="h-4 w-4 text-teal-600" />
              <h4 className="text-sm font-semibold text-slate-700">Security Tips</h4>
            </div>
            <ul className="space-y-2 text-xs text-slate-500">
              <li className="flex items-start gap-2">
                <InformationCircleIcon className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                Use a unique password that you don’t use for other websites
              </li>
              <li className="flex items-start gap-2">
                <InformationCircleIcon className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                Consider using a password manager to store your credentials
              </li>
              <li className="flex items-start gap-2">
                <InformationCircleIcon className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                Enable two-factor authentication for additional security
              </li>
            </ul>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-teal-600 transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PasswordChangePage;