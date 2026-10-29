import React from 'react';

const TicketSelector = ({ categories = [], selectedTickets = {}, onQuantityChange }) => {
  const handleIncrement = (categoryId, maxAvailable) => {
    const current = selectedTickets[categoryId] || 0;
    if (current < maxAvailable) {
      onQuantityChange(categoryId, current + 1);
    }
  };

  const handleDecrement = (categoryId) => {
    const current = selectedTickets[categoryId] || 0;
    if (current > 0) {
      onQuantityChange(categoryId, current - 1);
    }
  };

  const handleInputChange = (categoryId, value, maxAvailable) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      onQuantityChange(categoryId, 0);
      return;
    }
    const clamped = Math.max(0, Math.min(maxAvailable, numValue));
    onQuantityChange(categoryId, clamped);
  };

  if (!categories.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
        No ticket categories available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const available = Math.max(0, (category.capacity || 0) - (category.sold || 0));
        const selected = selectedTickets[category.id] || 0;
        const isSoldOut = available <= 0;
        const isFree = Number(category.price) === 0;

        return (
          <div
            key={category.id}
            className={`rounded-xl border bg-white p-5 transition-all ${
              isSoldOut
                ? 'border-slate-200 opacity-60'
                : 'border-slate-200 hover:border-teal-200 hover:shadow-sm'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-slate-900">
                  {category.name}
                </h3>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-teal-600">
                    {isFree ? 'FREE' : `$${Number(category.price).toFixed(2)}`}
                  </span>
                  {!isFree && (
                    <span className="text-sm text-slate-400">per ticket</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                {isSoldOut ? (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                    Sold Out
                  </span>
                ) : (
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-slate-700">{available}</span> available
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {category.description && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {category.description}
              </p>
            )}

            {/* Quantity controls */}
            {!isSoldOut && (
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDecrement(category.id)}
                  disabled={selected === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Decrease ${category.name} quantity`}
                >
                  −
                </button>

                <input
                  type="number"
                  min={0}
                  max={available}
                  value={selected}
                  onChange={(e) =>
                    handleInputChange(category.id, e.target.value, available)
                  }
                  className="h-9 w-16 rounded-lg border border-slate-200 text-center text-sm font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  aria-label={`${category.name} quantity`}
                />

                <button
                  type="button"
                  onClick={() => handleIncrement(category.id, available)}
                  disabled={selected >= available}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Increase ${category.name} quantity`}
                >
                  +
                </button>

                {selected > 0 && (
                  <span className="ml-2 text-sm font-medium text-slate-500">
                    {selected} selected
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TicketSelector;