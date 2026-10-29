import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const SignupSuccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.role) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleResendVerification = async () => {
    const email = prompt('Please enter your email to resend verification:');
    if (!email) return;
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('Verification email resent successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend verification email');
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
            Elite <span className="text-teal-600">Recruitment</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            System Authority Initialized
          </p>
        </div>

        {/* Success Card */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-teal-600 p-4 rounded-full shadow-sm shadow-teal-200">
                <EnvelopeIcon className="h-7 w-7 text-white" />
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
              Account Created Successfully
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              We’ve sent a verification email to your registered email address.
            </p>
            <p className="text-sm font-medium text-slate-700">
              Please verify your email before logging in.
            </p>
            <p className="text-xs text-slate-500">
              If you don’t see the email, please check your Spam / Junk folder.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleResendVerification}
              className="group relative w-full overflow-hidden rounded-2xl bg-teal-600 hover:bg-teal-700 py-4 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm shadow-teal-200 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out]" />
              <span className="flex items-center justify-center gap-2">
                <ArrowPathIcon className="h-4 w-4" />
                Resend Verification Email
              </span>
            </button>

            <div className="text-center pt-1">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors"
              >
                Already verified?
                <span className="font-semibold text-teal-600">Back to Login</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
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

export default SignupSuccessPage;