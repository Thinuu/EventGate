import React from 'react';

const SummaryCard = ({
  selectedTickets = {},
  categories = [],
  totalTickets = 0,
  totalPrice = 0,
  currency = 'USD',
  onProceedToCheckout,
  isLoading = false,
}) => {
  const selectedCategories = categories.filter(
    (cat) => (selectedTickets[cat.id] || 0) > 0
  );

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'LKR' ? 'LKR' : 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Order Summary</h3>

      {/* Empty state */}
      {selectedCategories.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">No tickets selected</p>
          <p className="mt-1 text-xs text-slate-400">Choose tickets to continue</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {selectedCategories.map((category) => {
            const qty = selectedTickets[category.id] || 0;
            const lineTotal = qty * (Number(category.price) || 0);

            return (
              <div key={category.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {category.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {qty} × {formatPrice(category.price)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">
                  {formatPrice(lineTotal)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Totals */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-slate-900">Total</span>
          <span className="text-xl font-bold text-slate-900">
            {formatPrice(totalPrice)}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-slate-500">
          {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} selected
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onProceedToCheckout}
        disabled={totalTickets === 0 || isLoading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        {isLoading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing…
          </>
        ) : (
          'Proceed to Checkout'
        )}
      </button>
    </div>
  );
};

export default SummaryCard;