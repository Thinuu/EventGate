import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import {
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const BankTransferSubmitPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [formData, setFormData] = useState({
    payerName: '',
    payerEmail: '',
    payerPhone: '',
    payerNicPassport: '',
    bankUsed: '',
    transferDate: '',
    transferTime: '',
    referenceNumber: '',
    amountPaid: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchOrderData();
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bank-transfer/instructions/${orderId}`);
      const data = await response.json();
      if (data.data) {
        setOrderData(data.data.order);
        setFormData((prev) => ({
          ...prev,
          amountPaid: data.data.order.totalAmount,
        }));
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
      toast.error('Failed to load order data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, and PDF files are allowed');
      return;
    }
    setReceiptFile(file);
    if (errors.receiptFile) {
      setErrors((prev) => ({ ...prev, receiptFile: '' }));
    }
  };

  const clearFile = () => setReceiptFile(null);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.payerName.trim()) newErrors.payerName = 'Payer name is required';
    if (!formData.payerEmail.trim()) {
      newErrors.payerEmail = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.payerEmail)) {
      newErrors.payerEmail = 'Please enter a valid email address';
    }
    if (!formData.payerPhone.trim()) newErrors.payerPhone = 'Phone number is required';
    if (!formData.bankUsed.trim()) newErrors.bankUsed = 'Bank name is required';
    if (!formData.transferDate) newErrors.transferDate = 'Transfer date is required';
    if (!formData.transferTime.trim()) newErrors.transferTime = 'Transfer time is required';
    if (!formData.referenceNumber.trim()) newErrors.referenceNumber = 'Reference number is required';
    if (!formData.amountPaid || parseFloat(formData.amountPaid) <= 0) {
      newErrors.amountPaid = 'Amount paid is required';
    }
    if (!receiptFile) newErrors.receiptFile = 'Receipt file is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('receipt', receiptFile);
      formDataToSend.append('payerName', formData.payerName);
      formDataToSend.append('payerEmail', formData.payerEmail);
      formDataToSend.append('payerPhone', formData.payerPhone);
      formDataToSend.append('payerNicPassport', formData.payerNicPassport);
      formDataToSend.append('bankUsed', formData.bankUsed);
      formDataToSend.append('transferDate', formData.transferDate);
      formDataToSend.append('transferTime', formData.transferTime);
      formDataToSend.append('referenceNumber', formData.referenceNumber);
      formDataToSend.append('amountPaid', formData.amountPaid);
      formDataToSend.append('notes', formData.notes);

      const response = await fetch(`/api/bank-transfer/submit/${orderId}`, {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Payment submitted successfully');
        navigate(`/bank-transfer/thank-you/${orderId}`);
      } else {
        toast.error(data.message || 'Failed to submit payment');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-main border-t-transparent" />
        </div>
      </PublicLayout>
    );
  }

  const currency =
    orderData?.currency ||
    orderData?.eventId?.settings?.currency ||
    orderData?.event?.settings?.currency ||
    'LKR';

  const inputClass = (hasError) =>
    `w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-main/20 ${
      hasError
        ? 'border-rose-400 focus:border-rose-400'
        : 'border-slate-200 focus:border-brand-main'
    }`;

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              Bank Transfer
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
              Submit Payment
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Provide your payment information and upload the receipt
            </p>
          </div>

          {/* Order Reference Banner */}
          {orderData && (
            <div className="mb-8 overflow-hidden rounded-[28px] border border-teal-100 bg-teal-50/60">
              <div className="flex flex-col gap-4 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500">
                    Order Reference
                  </p>
                  <p className="mt-1 text-lg font-black text-teal-900">
                    {orderData.orderNumber}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500">
                    Amount to Pay
                  </p>
                  <p className="mt-1 text-lg font-black text-teal-900">
                    {currency} {orderData.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ─── Payer Details ─── */}
            <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                  Payer Details
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-5 p-8 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="payerName"
                    value={formData.payerName}
                    onChange={handleInputChange}
                    placeholder="Enter payer's full name"
                    className={inputClass(errors.payerName)}
                  />
                  {errors.payerName && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.payerName}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="payerEmail"
                    value={formData.payerEmail}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    className={inputClass(errors.payerEmail)}
                  />
                  {errors.payerEmail && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.payerEmail}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    name="payerPhone"
                    value={formData.payerPhone}
                    onChange={handleInputChange}
                    placeholder="Enter mobile number"
                    className={inputClass(errors.payerPhone)}
                  />
                  {errors.payerPhone && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.payerPhone}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    NIC / Passport
                  </label>
                  <input
                    type="text"
                    name="payerNicPassport"
                    value={formData.payerNicPassport}
                    onChange={handleInputChange}
                    placeholder="Optional"
                    className={inputClass(false)}
                  />
                </div>
              </div>
            </div>

            {/* ─── Transfer Details ─── */}
            <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                  Transfer Details
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-5 p-8 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Bank Used *
                  </label>
                  <input
                    type="text"
                    name="bankUsed"
                    value={formData.bankUsed}
                    onChange={handleInputChange}
                    placeholder="e.g. Commercial Bank"
                    className={inputClass(errors.bankUsed)}
                  />
                  {errors.bankUsed && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.bankUsed}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    name="transferDate"
                    value={formData.transferDate}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputClass(errors.transferDate)}
                  />
                  {errors.transferDate && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.transferDate}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Transfer Time *
                  </label>
                  <input
                    type="time"
                    name="transferTime"
                    value={formData.transferTime}
                    onChange={handleInputChange}
                    className={inputClass(errors.transferTime)}
                  />
                  {errors.transferTime && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.transferTime}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Reference Number *
                  </label>
                  <input
                    type="text"
                    name="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={handleInputChange}
                    placeholder="Bank reference number"
                    className={inputClass(errors.referenceNumber)}
                  />
                  {errors.referenceNumber && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">
                      {errors.referenceNumber}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Amount Paid *
                  </label>
                  <input
                    type="number"
                    name="amountPaid"
                    value={formData.amountPaid}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="Enter amount paid"
                    className={inputClass(errors.amountPaid)}
                  />
                  {errors.amountPaid && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.amountPaid}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Receipt Upload ─── */}
            <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                  Upload Receipt
                </h2>
              </div>

              <div className="p-8">
                <input
                  type="file"
                  id="receipt"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!receiptFile ? (
                  <label
                    htmlFor="receipt"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 transition hover:border-brand-main/40 hover:bg-brand-main/5"
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <DocumentArrowUpIcon className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                      Click to upload or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      JPEG, PNG, or PDF · max 10MB
                    </p>
                  </label>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                        <CheckCircleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-900">{receiptFile.name}</p>
                        <p className="text-xs text-emerald-600">
                          {(receiptFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {errors.receiptFile && (
                  <p className="mt-2 text-xs font-medium text-rose-600">{errors.receiptFile}</p>
                )}
              </div>
            </div>

            {/* ─── Notes ─── */}
            <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
              <div className="p-8">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Add any additional information about your payment (optional)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-main focus:outline-none focus:ring-2 focus:ring-brand-main/20"
                />
              </div>
            </div>

            {/* ─── Submit ─── */}
            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Payment Details'}
              {!submitting && (
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-main"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Instructions
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
};

export default BankTransferSubmitPage;