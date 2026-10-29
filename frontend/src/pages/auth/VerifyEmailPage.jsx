import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Track called tokens to prevent double-verification in React 18 Strict Mode
const calledTokens = new Set();

const VerifyEmailPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || calledTokens.has(token)) {
      return;
    }
    calledTokens.add(token);

    const verifyEmail = async () => {
      try {
        const response = await api.get(`/auth/verify-email/${token}`);
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message);
          toast.success('Email verified! You can now log in.');
        } else {
          calledTokens.delete(token);
          setStatus('error');
          setMessage(response.data.message || 'Verification failed.');
        }
      } catch (err) {
        calledTokens.delete(token);
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
            'The verification link is invalid or has expired.'
        );
      }
    };

    verifyEmail();
  }, [token]);

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
            Email <span className="text-teal-600">Verification</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Account Activation Protocol
          </p>
        </div>

        {/* Status Card */}
        <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

          <div className="text-center">
            {status === 'verifying' && (
              <>
                <div className="mx-auto h-14 w-14 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
                <h2 className="mt-6 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                  Verifying Email...
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Please wait while we confirm your account.
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                  <CheckCircleIcon className="h-9 w-9 text-emerald-600" />
                </div>
                <h2 className="mt-6 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                  Email Verified!
                </h2>
                <p className="mt-2 text-sm text-slate-500">{message}</p>
                <div className="mt-8">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-2xl bg-teal-600 hover:bg-teal-700 px-8 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all active:scale-[0.98]"
                  >
                    Go to Login
                  </Link>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100">
                  <XCircleIcon className="h-9 w-9 text-red-500" />
                </div>
                <h2 className="mt-6 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                  Verification Failed
                </h2>
                <p className="mt-2 text-sm text-slate-500">{message}</p>
                <div className="mt-8 space-y-3">
                  <Link
                    to="/signup"
                    className="block w-full rounded-2xl bg-teal-600 hover:bg-teal-700 px-8 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all active:scale-[0.98] text-center"
                  >
                    Back to Signup
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    Try Logging In
                  </Link>
                </div>
              </>
            )}
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

export default VerifyEmailPage;