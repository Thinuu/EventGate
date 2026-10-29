import React from 'react';
import { TicketIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const EmptyState = ({
  title = 'No entry passes yet',
  message = 'Complete your ticket configuration to retrieve entry passes or invite guests.',
  actionLink = '/buyer/tickets',
  actionText = 'Manage Purchased Tickets',
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 sm:px-10 sm:py-14 text-center shadow-sm max-w-lg mx-auto">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
        <TicketIcon className="h-7 w-7" />
      </div>

      <h3 className="mt-5 text-base font-bold text-slate-900 sm:text-lg">
        {title}
      </h3>

      <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
        {message}
      </p>

      {actionLink && (
        <Link
          to={actionLink}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 transition"
        >
          {actionText}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
};

export default EmptyState;