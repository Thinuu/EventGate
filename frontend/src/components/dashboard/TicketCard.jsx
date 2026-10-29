import React from 'react';
import Badge from '../ui/Badge';
import QRCodeDisplay from './QRCodeDisplay';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const TicketCard = ({ ticket }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-400">My Active Ticket</p>
        <h3 className="text-lg font-bold text-slate-900">{ticket.event?.name}</h3>
        <p className="text-sm text-slate-500">{ticket.event?.venue?.name}</p>
        <Badge color="yellow" className="mt-2">{ticket.categoryName}</Badge>
      </div>
      <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
        <CheckCircleIcon className="h-5 w-5" />
        {ticket.attendee?.confirmationStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
      </div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <QRCodeDisplay value={ticket.attendee?.qrCode} size={180} />
      <div>
        <h4 className="text-sm font-bold text-slate-900">Zones Allowed</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {(ticket.attendee?.allowedZones || ticket.allowedZones || []).map((zone) => (
            <span key={zone} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              {zone}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Ticket No: {ticket.ticketNumber}</p>
      </div>
    </div>
  </div>
);

export default TicketCard;
