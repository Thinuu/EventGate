import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getMfaStatus, setupMfa, verifyMfa, disableMfa } from '../../api/users';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

const MfaSetupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const response = await getMfaStatus();
      setMfaStatus(response.data?.data);
    } catch (err) {
      toast.error('Failed to fetch MFA status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMfa = async () => {
    setLoading(true);
    try {
      const response = await setupMfa();
      const data = response.data?.data;
      setSetupData(data);
      setShowQrCode(true);
      toast.success('MFA setup initiated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      await verifyMfa(verificationCode);
      toast.success('Two-factor authentication enabled!');
      fetchMfaStatus();
      setSetupData(null);
      setVerificationCode('');
      setShowQrCode(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupData(null);
    setVerificationCode('');
    setShowQrCode(false);
  };

  const handleDisableMfa = async () => {
    if (
      !window.confirm(
        'Are you sure you want to disable two-factor authentication? This will make your account less secure.'
      )
    ) {
      return;
    }

    setDisabling(true);
    try {
      await disableMfa();
      toast.success('Two-factor authentication disabled');
      fetchMfaStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable MFA');
    } finally {
      setDisabling(false);
    }
  };

  const getQrCodeUrl = () => {
    if (!setupData?.qrCodeUrl) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      setupData.qrCodeUrl
    )}`;
  };

  if (loading) {
    return (
      <div className="relative min-h-screen w-full bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

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
            Two-Factor <span className="text-teal-600">Authentication</span>
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            {mfaStatus?.enabled
              ? 'Manage Security Settings'
              : 'Extra Layer of Protection'}
          </p>
        </div>

        {/* MFA Already Enabled */}
        {mfaStatus?.enabled && !setupData && (
          <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 mb-5">
                <CheckCircleIcon className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-2">
                Two-Factor Authentication is Enabled
              </h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Your account is protected with an extra layer of security. You’ll need to enter a
                verification code from your authenticator app when signing in.
              </p>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-6 text-left">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Recovery Codes</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Save these recovery codes in a safe place. You can use them to access your account
                  if you lose your authenticator device.
                </p>
                {mfaStatus.recoveryCodes ? (
                  <div className="bg-white rounded-xl p-3 border border-slate-200 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      {mfaStatus.recoveryCodes.map((code, index) => (
                        <span key={index} className="text-slate-700">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">Recovery codes not available</p>
                )}
              </div>

              <button
                onClick={handleDisableMfa}
                disabled={disabling}
                className="px-6 py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disabling ? 'Disabling...' : 'Disable Two-Factor Authentication'}
              </button>
            </div>
          </div>
        )}

        {/* Setup Flow */}
        {setupData && (
          <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

            {showQrCode && (
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-5">
                  Setup Authenticator App
                </h2>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 inline-block mb-4">
                  <img src={getQrCodeUrl()} alt="QR Code" className="w-48 h-48 mx-auto" />
                </div>

                <div className="text-left bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Can’t scan the QR code?
                  </p>
                  <p className="text-xs text-slate-500 break-all font-mono">
                    {setupData.qrCodeUrl}
                  </p>
                </div>

                <button
                  onClick={() => setShowQrCode(false)}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Enter code manually instead →
                </button>
              </div>
            )}

            {!showQrCode && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Manual Entry</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2.5 border-b border-slate-100">
                    <span className="text-slate-500">Account</span>
                    <span className="text-slate-700 font-mono text-right">
                      {setupData.accountName}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-slate-100">
                    <span className="text-slate-500">Key</span>
                    <span className="text-slate-700 font-mono text-right break-all max-w-[60%]">
                      {setupData.secret}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-slate-100">
                    <span className="text-slate-500">Time Based</span>
                    <span className="text-slate-700">Yes</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowQrCode(true)}
                  className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                >
                  ← Show QR Code
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyMfa} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ml-0.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 text-center text-2xl tracking-[0.4em] font-medium text-slate-900 placeholder:text-slate-300 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
                <p className="text-xs text-slate-500 text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelSetup}
                  className="flex-1 py-3.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || verificationCode.length !== 6}
                  className="flex-1 py-3.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-2xl shadow-sm shadow-teal-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Not Enabled */}
        {!mfaStatus?.enabled && !setupData && (
          <div className="relative rounded-[28px] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 mb-5">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-2">
                Enable Two-Factor Authentication
              </h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Two-factor authentication adds an extra layer of security. Even if someone discovers
                your password, they won’t be able to access your account without the verification
                code from your authenticator app.
              </p>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-6 text-left">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">What you’ll need:</h3>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    An authenticator app (Google Authenticator, Authy, 1Password, etc.)
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    A smartphone or device to scan QR codes
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    Recovery codes (we’ll provide these after setup)
                  </li>
                </ul>
              </div>

              <button
                onClick={handleSetupMfa}
                className="w-full flex items-center justify-center gap-2 py-4 text-[12px] font-bold uppercase tracking-wider text-white bg-teal-600 hover:bg-teal-700 rounded-2xl shadow-sm shadow-teal-200 transition-all active:scale-[0.98]"
              >
                <QrCodeIcon className="h-5 w-5" />
                Set Up Two-Factor Authentication
              </button>
            </div>
          </div>
        )}

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

export default MfaSetupPage;