import React from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/solid';

const EmptyState = ({ message }) => {
  return (
    <div className="text-center py-12">
      <CalendarDaysIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
      <p className="text-gray-600">{message}</p>
    </div>
  );
};

export default EmptyState;
