import React from 'react';
import { ExclamationTriangleIcon, ShieldCheckIcon, TicketIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import Stat from '../ui/Stat';

const MetricsGrid = ({ stats }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Stat label="Total Tickets Sold" value={stats.totalTickets} color="blue" icon={<TicketIcon className="h-5 w-5" />} />
    <Stat label="Total Confirmed Attendees" value={stats.confirmedAttendees} color="indigo" icon={<UserGroupIcon className="h-5 w-5" />} />
    <Stat label="Total Checked-In" value={stats.checkedInCount} color="purple" icon={<ShieldCheckIcon className="h-5 w-5" />} />
    <Stat label="Total Denied Entries" value={stats.deniedCount} color="red" icon={<ExclamationTriangleIcon className="h-5 w-5" />} />
  </div>
);

export default MetricsGrid;
