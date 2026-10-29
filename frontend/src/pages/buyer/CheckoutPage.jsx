import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../../api/orders';
import { getPaymentConfig } from '../../api/payment';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import {
  CreditCardIcon,
  BanknotesIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ArrowLeftIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  const [checkoutData, setCheckoutData] = useState(null);
  const [buyerInfo, setBuyerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notificationChannel: 'email',
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState({});
  const [cashTermsAccepted, setCashTermsAccepted] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('checkoutData');
    if (!data) {
      toast.error('No checkout data found');
      navigate('/events');
      return;
    }

    try {
      const parsed = JSON.parse(data);
      setCheckoutData(parsed);

      if (parsed.eventId) {
        getPaymentConfig(parsed.eventId)
          .then((res) => {
            if (res.success) {
              setGatewayConfig(res.data);
              setSelectedGateway(res.data.defaultGateway || 'payhere');
            }
          })
          .catch((err) => {
            console.warn('Could not fetch payment config, using defaults:', err);
            setGatewayConfig({
              gateways: ['payhere'],
              defaultGateway: 'payhere',
              paymentMethods: ['card'],
            });
            setSelectedGateway('payhere');
          });
      }
    } catch (error) {
      console.error('Invalid checkout data:', error);
      toast.error('Invalid checkout data');
      navigate('/events');
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBuyerInfo((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!buyerInfo.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!buyerInfo.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(buyerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (buyerInfo.notificationChannel !== 'email') {
      if (!buyerInfo.phone.trim()) {
        newErrors.phone = 'Phone number is required for SMS notifications';
      } else if (!phoneRegex.test(buyerInfo.phone.trim())) {
        newErrors.phone = 'Enter a valid international phone number (e.g. +1234567890)';
      }
    } else if (buyerInfo.phone.trim() && !phoneRegex.test(buyerInfo.phone.trim())) {
      newErrors.phone = 'Enter a valid international phone number (e.g. +1234567890)';
    }

    if (paymentMethod === 'cash' && !cashTermsAccepted) {
      newErrors.cashTerms = 'Please accept the venue payment terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!checkoutData) {
      toast.error('Checkout data not found');
      return;
    }

    setPlacing(true);
    setErrors({});

    try {
      const tickets = Object.keys(checkoutData.selectedTickets)
        .filter((categoryId) => checkoutData.selectedTickets[categoryId] > 0)
        .map((categoryId) => {
          const category = checkoutData.categories.find((cat) => cat.id === categoryId);
          return {
            categoryName: category.name,
            quantity: checkoutData.selectedTickets[categoryId],
            price: category.price,
          };
        });

      const orderData = {
        eventId: checkoutData.eventId,
        buyerName: buyerInfo.name.trim(),
        buyerEmail: buyerInfo.email.trim().toLowerCase(),
        buyerPhone: buyerInfo.phone.trim(),
        notificationChannel: buyerInfo.notificationChannel,
        tickets,
        paymentMethod,
        gateway: paymentMethod === 'card' ? selectedGateway : undefined,
      };

      if (paymentMethod === 'bank_transfer') {
        const response = await createOrder(orderData);
        localStorage.removeItem('checkoutData');
        navigate(`/bank-transfer/instructions/${response.data.data.orderId}`);
      } else if (paymentMethod === 'cash') {
        const response = await createOrder(orderData);
        toast.success('Reservation placed successfully!');
        localStorage.removeItem('checkoutData');
        navigate(`/cash-entrance/instructions/${response.data.data.confirmationToken}`);
      } else {
        const response = await createOrder(orderData);
        const resData = response.data.data;
        localStorage.removeItem('checkoutData');

        if (resData.gatewayUsed === 'stripe' && resData.stripeSessionUrl) {
          window.location.href = resData.stripeSessionUrl;
        } else {
          toast.success('Order placed successfully!');
          navigate(`/confirm/${resData.confirmationToken}`);
        }
      }
    } catch (error) {
      console.error('Order placement failed:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to place order. Please try again.';
      toast.error(errorMessage);

      if (error.response?.data?.errors) {
        const backendErrors = {};
        error.response.data.errors.forEach((err) => {
          if (err.param) backendErrors[err.param] = err.msg;
        });
        setErrors(backendErrors);
      }
    } finally {
      setPlacing(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (!checkoutData) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-main border-t-transparent" />
        </div>
      </PublicLayout>
    );
  }

  const totalTickets = Object.values(checkoutData.selectedTickets).reduce(
    (sum, qty) => sum + qty,
    0
  );
  const totalPrice = checkoutData.categories.reduce((sum, cat) => {
    return sum + cat.price * (checkoutData.selectedTickets[cat.id] || 0);
  }, 0);
  const currency = checkoutData.event?.settings?.currency || 'LKR';

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              Secure Checkout
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
              Checkout
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Complete your order for{' '}
              <span className="font-bold text-slate-700">{checkoutData.eventName}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* ────────────── Left: Form ────────────── */}
            <div className="lg:col-span-3">
              <form onSubmit={handlePlaceOrder} className="space-y-6">
                {/* Buyer Information */}
                <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                  <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                      Buyer Information
                    </h2>
                  </div>

                  <div className="space-y-5 p-8">
                    {/* Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={buyerInfo.name}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        className={`w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-main/20 ${
                          errors.name
                            ? 'border-rose-400 focus:border-rose-400'
                            : 'border-slate-200 focus:border-brand-main'
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.name}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={buyerInfo.email}
                        onChange={handleInputChange}
                        placeholder="Enter your email address"
                        className={`w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-main/20 ${
                          errors.email
                            ? 'border-rose-400 focus:border-rose-400'
                            : 'border-slate-200 focus:border-brand-main'
                        }`}
                      />
                      {errors.email && (
                        <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.email}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={buyerInfo.phone}
                        onChange={handleInputChange}
                        placeholder="+1234567890"
                        className={`w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-main/20 ${
                          errors.phone
                            ? 'border-rose-400 focus:border-rose-400'
                            : 'border-slate-200 focus:border-brand-main'
                        }`}
                      />
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Format: +1234567890 (required for SMS)
                      </p>
                      {errors.phone && (
                        <p className="mt-1 text-xs font-medium text-rose-600">{errors.phone}</p>
                      )}
                    </div>

                    {/* Notification Channel */}
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Send Notifications Via
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'email', label: 'Email', icon: EnvelopeIcon },
                          { value: 'sms', label: 'SMS', icon: DevicePhoneMobileIcon },
                          { value: 'both', label: 'Both', icon: null },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setBuyerInfo((prev) => ({
                                ...prev,
                                notificationChannel: opt.value,
                              }))
                            }
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold uppercase tracking-wider transition ${
                              buyerInfo.notificationChannel === opt.value
                                ? 'border-brand-main bg-brand-main/5 text-brand-main'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {opt.icon && <opt.icon className="h-4 w-4" />}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                  <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                      Payment Method
                    </h2>
                  </div>

                  <div className="space-y-3 p-8">
                    {/* Card */}
                    <label
                      className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${
                        paymentMethod === 'card'
                          ? 'border-brand-main bg-brand-main/5'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 h-4 w-4 text-brand-main focus:ring-brand-main"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCardIcon className="h-5 w-5 text-slate-600" />
                          <span className="font-bold text-slate-900">Credit / Debit Card</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Instant payment with card</p>
                      </div>
                      {paymentMethod === 'card' && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-main text-white">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </label>

                    {/* Gateway sub-selection */}
                    {paymentMethod === 'card' &&
                      gatewayConfig?.gateways?.length > 1 && (
                        <div className="ml-8 space-y-2 border-l-2 border-brand-main/20 pl-5">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Choose Provider
                          </p>
                          {gatewayConfig.gateways.includes('payhere') && (
                            <label
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${
                                selectedGateway === 'payhere'
                                  ? 'border-brand-main/40 bg-brand-main/5'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="gateway"
                                value="payhere"
                                checked={selectedGateway === 'payhere'}
                                onChange={(e) => setSelectedGateway(e.target.value)}
                                className="h-3.5 w-3.5 text-brand-main"
                              />
                              <div>
                                <span className="text-sm font-bold text-slate-900">PayHere</span>
                                <p className="text-xs text-slate-500">
                                  Local Sri Lankan payment gateway
                                </p>
                              </div>
                            </label>
                          )}
                          {gatewayConfig.gateways.includes('stripe') && (
                            <label
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${
                                selectedGateway === 'stripe'
                                  ? 'border-brand-main/40 bg-brand-main/5'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="gateway"
                                value="stripe"
                                checked={selectedGateway === 'stripe'}
                                onChange={(e) => setSelectedGateway(e.target.value)}
                                className="h-3.5 w-3.5 text-brand-main"
                              />
                              <div>
                                <span className="text-sm font-bold text-slate-900">Stripe</span>
                                <p className="text-xs text-slate-500">
                                  International card payments
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      )}

                    {/* Cash */}
                    <label
                      className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${
                        paymentMethod === 'cash'
                          ? 'border-brand-main bg-brand-main/5'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        checked={paymentMethod === 'cash'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 h-4 w-4 text-brand-main focus:ring-brand-main"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <BanknotesIcon className="h-5 w-5 text-slate-600" />
                          <span className="font-bold text-slate-900">
                            Cash at Entrance
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Pay at the venue on the day of the event
                        </p>
                      </div>
                      {paymentMethod === 'cash' && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-main text-white">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Cash terms notice */}
                  {paymentMethod === 'cash' && (
                    <div className="mx-8 mb-8 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
                      <div className="px-6 py-5">
                        <h4 className="mb-3 text-sm font-black uppercase tracking-wide text-amber-900">
                          Pay at the Venue
                        </h4>
                        <ul className="space-y-2 text-sm text-amber-800">
                          <li>
                            Your tickets will be <strong>reserved</strong> until the event.
                          </li>
                          <li>
                            Arrive <strong>30–60 minutes before</strong> the event to complete
                            payment.
                          </li>
                          <li className="text-xs text-amber-700">
                            Failure to arrive may result in cancellation of your reservation.
                          </li>
                        </ul>

                        <label className="mt-5 flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={cashTermsAccepted}
                            onChange={(e) => setCashTermsAccepted(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-xs font-medium text-amber-800">
                            I accept that I must pay at the venue entrance and failure to arrive
                            early may result in cancellation. *
                          </span>
                        </label>
                        {errors.cashTerms && (
                          <p className="mt-2 text-xs font-medium text-rose-600">
                            {errors.cashTerms}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={placing}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placing ? 'Placing Order…' : 'Confirm & Continue'}
                </button>

                <p className="text-center text-[11px] text-slate-400">
                  By placing this order, you agree to our terms and conditions. You will receive a
                  confirmation notification based on your selected channel.
                </p>
              </form>
            </div>

            {/* ────────────── Right: Order Summary ────────────── */}
            <div className="lg:col-span-2">
              <div className="sticky top-8 overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 bg-slate-50/50 px-7 py-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Order Summary
                  </h2>
                </div>

                <div className="space-y-6 p-7">
                  {/* Event name */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Event
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-base font-bold text-slate-900">
                      {checkoutData.eventName}
                    </p>
                  </div>

                  {/* Ticket lines */}
                  <div className="space-y-4 border-t border-slate-50 pt-6">
                    {checkoutData.categories
                      .filter((cat) => checkoutData.selectedTickets[cat.id] > 0)
                      .map((category) => {
                        const qty = checkoutData.selectedTickets[category.id];
                        const lineTotal = qty * category.price;

                        return (
                          <div
                            key={category.id}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {category.name}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {qty} × {currency} {category.price.toLocaleString()}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-black text-slate-900">
                              {currency} {lineTotal.toLocaleString()}
                            </p>
                          </div>
                        );
                      })}
                  </div>

                  {/* Totals */}
                  <div className="space-y-3 border-t border-slate-50 pt-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Total Tickets</span>
                      <span className="font-bold text-slate-900">{totalTickets}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Total Amount
                      </span>
                      <span className="text-2xl font-black tracking-tighter text-brand-main">
                        {currency} {totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-10 text-center">
            <button
              onClick={() => navigate(-1)}
              disabled={placing}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-main disabled:opacity-50"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Event
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default CheckoutPage;