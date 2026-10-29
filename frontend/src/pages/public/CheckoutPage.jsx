import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvent } from '../../api/events';
import { createOrder } from '../../api/orders';
import { getPaymentConfig } from '../../api/payment';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { io } from '../../utils/realtime';
import { getSocketUrl } from '../../utils/backend';

const parseBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return Boolean(value);
};

const getCategoryId = (category) =>
  String(category?.id || category?._id || category?.name || '');

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedTickets, eventId, event: initialEvent } = location.state || {};
  const [event, setEvent] = useState(initialEvent);
  const { user } = useAuth();

  const [buyerDetails, setBuyerDetails] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchEvent = () => {
    if (!eventId) return;
    getEvent(eventId)
      .then((res) => setEvent(res.data?.data?.event || res.data?.event))
      .catch((err) => console.error('Failed to sync event on checkout:', err));
  };

  useEffect(() => {
    if (!eventId) return undefined;
    fetchEvent();

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
    });
    socket.emit('join_event', { eventId });
    socket.on('event_update', () => fetchEvent());
    return () => {
      socket.emit('leave_event', { eventId });
      socket.disconnect();
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    getPaymentConfig(eventId)
      .then((res) => {
        const data = res.data?.data || res.data || res;
        const ok = res.data?.success ?? res.success ?? true;
        if (ok) {
          setGatewayConfig(data);
          setSelectedGateway(data.defaultGateway || data.gateways?.[0] || 'payhere');
        }
      })
      .catch(() => {
        setGatewayConfig({ gateways: ['payhere'], defaultGateway: 'payhere' });
        setSelectedGateway('payhere');
      });
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    setBuyerDetails((prev) => ({
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || '',
    }));
  }, [user]);

  const enabledMethods = useMemo(() => {
    const methods = event?.settings?.paymentMethods || {};
    return {
      card: parseBool(methods.card, true),
      bank_transfer: parseBool(methods.bank_transfer, true),
      cash: parseBool(methods.cash, true),
    };
  }, [event?.settings?.paymentMethods]);

  // Keep selected method valid when organiser disables a method
  useEffect(() => {
    const order = ['card', 'bank_transfer', 'cash'];
    if (enabledMethods[paymentMethod]) return;
    const next = order.find((key) => enabledMethods[key]);
    if (next) setPaymentMethod(next);
  }, [enabledMethods, paymentMethod]);

  if (!selectedTickets || !event) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-600">
            Access Denied
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            No tickets selected
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Please select tickets from the event page before proceeding to
            checkout.
          </p>
          <div className="mt-8">
            <Link
              to="/events"
              className="inline-flex rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700"
            >
              Back to events
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const isExpired = event.endDate && new Date(event.endDate) < new Date();

  if (isExpired) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-rose-500">
            Booking Closed
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Event Has Ended
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            This event is overdue. Ticket bookings are no longer available.
          </p>
          <div className="mt-8">
            <Link
              to="/events"
              className="inline-flex rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700"
            >
              Back to fixtures
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const categories = Array.isArray(event.categories) ? event.categories : [];
  const selectedCategories = categories.filter(
    (category) => (selectedTickets[getCategoryId(category)] || 0) > 0
  );
  const totalPrice = categories.reduce((sum, category) => {
    const id = getCategoryId(category);
    return sum + Number(category.price || 0) * (selectedTickets[id] || 0);
  }, 0);

  const currency = event.settings?.currency || event.currency || 'LKR';

  const formatCurrency = (value) =>
    value === 0
      ? 'Complimentary'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(value);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBuyerDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePayment = async () => {
    if (event.endDate && new Date(event.endDate) < new Date()) {
      toast.error('This event has already ended. Booking is closed.');
      return;
    }
    if (!buyerDetails.name || !buyerDetails.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (
      buyerDetails.phone &&
      !/^\+?[1-9]\d{1,14}$/.test(
        buyerDetails.phone.trim().replace(/\s+/g, '')
      )
    ) {
      toast.error('Please enter a valid international phone number');
      return;
    }
    if (!enabledMethods[paymentMethod]) {
      toast.error('Selected payment method is not available for this event.');
      return;
    }

    setIsProcessing(true);
    try {
      const tickets = selectedCategories.map((category) => ({
        categoryId: getCategoryId(category),
        categoryName: category.name,
        quantity: selectedTickets[getCategoryId(category)],
        price: category.price,
      }));

      // Backend expects cash_at_entrance (not "cash")
      const apiPaymentMethod =
        paymentMethod === 'cash' ? 'cash_at_entrance' : paymentMethod;

      const orderData = {
        eventId,
        buyerName: buyerDetails.name,
        buyerEmail: buyerDetails.email,
        buyerPhone: buyerDetails.phone,
        tickets,
        paymentMethod: apiPaymentMethod,
        gateway: paymentMethod === 'card' ? selectedGateway : undefined,
      };

      const response = await createOrder(orderData);
      const body = response.data || {};

      if (body.success) {
        const resData = body.data || {};
        if (paymentMethod === 'card') {
          if (resData.gatewayUsed === 'stripe' && resData.stripeSessionUrl) {
            toast.success('Redirecting to Stripe...');
            window.location.href = resData.stripeSessionUrl;
          } else if (resData.paymentData) {
            toast.success('Redirecting to secure payment gateway...');
            const form = document.createElement('form');
            form.method = 'POST';
            form.action =
              import.meta.env.REACT_APP_PAYHERE_URL ||
              'https://sandbox.payhere.lk/pay/checkout';
            Object.entries(resData.paymentData).forEach(([key, value]) => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = value;
              form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
          } else {
            toast.success('Order placed successfully!');
            navigate(`/order/${resData.confirmationToken}/confirm`);
          }
        } else if (paymentMethod === 'bank_transfer') {
          toast.success('Order created! Redirecting to instructions...');
          navigate(`/bank-transfer/instructions/${resData.orderId}`);
        } else {
          toast.success('Reservation placed successfully!');
          navigate(
            `/cash-entrance/instructions/${resData.confirmationToken}`
          );
        }
      } else {
        toast.error(body.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(
        error?.response?.data?.message || 'Payment failed. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const noMethodsEnabled =
    !enabledMethods.card &&
    !enabledMethods.bank_transfer &&
    !enabledMethods.cash;

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-16">
        <div className="absolute inset-x-0 top-0 h-72 bg-slate-950">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-50" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-teal-400 transition hover:text-teal-300"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Return to tickets
          </button>

          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Complete Purchase
            </h1>
            <p className="mt-2 text-base text-slate-400">
              {event.name} · Final step
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              {/* Buyer */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2.5 bg-slate-900 px-5 py-4 sm:px-6">
                  <ShieldCheckIcon className="h-5 w-5 text-teal-400" />
                  <h2 className="text-base font-semibold text-white">
                    Buyer Information
                  </h2>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="name"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        autoFocus
                        value={buyerDetails.name}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="email"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={buyerDetails.email}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="phone"
                      className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Phone Number{' '}
                      <span className="font-normal text-slate-400">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={buyerDetails.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                </div>
              </div>

              {/* Payment methods */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2.5 bg-slate-900 px-5 py-4 sm:px-6">
                  <CreditCardIcon className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-white">
                    Payment Method
                  </h2>
                </div>
                <div className="space-y-3 p-5 sm:p-6">
                  {noMethodsEnabled && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                      No payment methods are enabled for this event. Contact the
                      organiser.
                    </div>
                  )}

                  {enabledMethods.card && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`w-full cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                          paymentMethod === 'card'
                            ? 'border-teal-500 bg-teal-50/40'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-white ${
                                paymentMethod === 'card'
                                  ? 'text-teal-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              <CreditCardIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Card Payment
                              </p>
                              <p className="text-xs text-slate-500">
                                Debit / Credit Card
                              </p>
                            </div>
                          </div>
                          <div
                            className={`h-5 w-5 rounded-full border-[3px] ${
                              paymentMethod === 'card'
                                ? 'border-teal-200 bg-teal-600'
                                : 'border-slate-300 bg-white'
                            }`}
                          />
                        </div>
                      </button>

                      {paymentMethod === 'card' &&
                        gatewayConfig?.gateways?.length > 1 && (
                          <div className="ml-4 space-y-2 border-l-2 border-teal-100 pl-4">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Choose Provider
                            </p>
                            {gatewayConfig.gateways.includes('payhere') && (
                              <label
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                                  selectedGateway === 'payhere'
                                    ? 'border-teal-400 bg-white'
                                    : 'border-transparent hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="gateway"
                                  value="payhere"
                                  checked={selectedGateway === 'payhere'}
                                  onChange={(e) =>
                                    setSelectedGateway(e.target.value)
                                  }
                                  className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <div>
                                  <span className="text-sm font-semibold text-slate-900">
                                    PayHere
                                  </span>
                                  <p className="text-xs text-slate-500">
                                    Local Sri Lankan gateway
                                  </p>
                                </div>
                              </label>
                            )}
                            {gatewayConfig.gateways.includes('stripe') && (
                              <label
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                                  selectedGateway === 'stripe'
                                    ? 'border-teal-400 bg-white'
                                    : 'border-transparent hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="gateway"
                                  value="stripe"
                                  checked={selectedGateway === 'stripe'}
                                  onChange={(e) =>
                                    setSelectedGateway(e.target.value)
                                  }
                                  className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <div>
                                  <span className="text-sm font-semibold text-slate-900">
                                    Stripe
                                  </span>
                                  <p className="text-xs text-slate-500">
                                    International card payments
                                  </p>
                                </div>
                              </label>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  {enabledMethods.bank_transfer && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`w-full cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-teal-500 bg-teal-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-white ${
                              paymentMethod === 'bank_transfer'
                                ? 'text-teal-600'
                                : 'text-slate-400'
                            }`}
                          >
                            <WalletIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Bank Transfer
                            </p>
                            <p className="text-xs text-slate-500">
                              Manual verification
                            </p>
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-[3px] ${
                            paymentMethod === 'bank_transfer'
                              ? 'border-teal-200 bg-teal-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>
                    </button>
                  )}

                  {enabledMethods.cash && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`w-full cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                        paymentMethod === 'cash'
                          ? 'border-teal-500 bg-teal-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-white ${
                              paymentMethod === 'cash'
                                ? 'text-teal-600'
                                : 'text-slate-400'
                            }`}
                          >
                            <ShieldCheckIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Cash at Entrance
                            </p>
                            <p className="text-xs text-slate-500">
                              Pay on event day
                            </p>
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-[3px] ${
                            paymentMethod === 'cash'
                              ? 'border-teal-200 bg-teal-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>
                    </button>
                  )}

                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3.5">
                    <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      Transactions are secured with industry-standard
                      encryption.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-8">
                <div className="flex items-center gap-2.5 bg-slate-900 px-5 py-4 sm:px-6">
                  <WalletIcon className="h-5 w-5 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">
                    Order Summary
                  </h2>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="space-y-4">
                    {selectedCategories.map((category) => {
                      const id = getCategoryId(category);
                      const qty = selectedTickets[id] || 0;
                      return (
                        <div
                          key={id}
                          className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {category.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {qty} × {formatCurrency(category.price)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-teal-600">
                            {formatCurrency(qty * category.price)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-700">
                        {formatCurrency(totalPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-base font-semibold text-slate-900">
                        Total
                      </span>
                      <span className="text-xl font-bold text-slate-900">
                        {formatCurrency(totalPrice)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isProcessing || noMethodsEnabled}
                    className="mt-6 w-full rounded-xl bg-teal-600 py-4 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Processing…
                      </span>
                    ) : (
                      `Pay ${formatCurrency(totalPrice)}`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default CheckoutPage;