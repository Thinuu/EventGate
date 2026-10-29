import React from 'react';
import Badge from '../ui/Badge';
import QRCodeDisplay from '../common/QRCodeDisplay';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const TicketCard = ({ ticket }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-2xl bg-slate-100 overflow-hidden">
          {ticket.attendee?.photo ? (
            <img src={ticket.attendee.photo} alt="Attendee" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">Photo</div>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Ticket</p>
          <h3 className="text-lg font-bold text-slate-900">{ticket.attendee?.fullName || 'Attendee'}</h3>
          <Badge color="yellow" className="mt-2">{ticket.categoryName || 'Category'}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
        <CheckCircleIcon className="h-5 w-5" />
        {ticket.attendee?.confirmationStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
      </div>
    </div>

    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <QRCodeDisplay value={ticket.attendee?.qrCode} size={180} />
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Zone Access</h4>
        <div className="flex flex-wrap gap-2">
          {(ticket.attendee?.allowedZones || ticket.allowedZones || []).map((zone) => (
            <span key={zone} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              {zone}
            </span>
          ))}
          {(ticket.attendee?.allowedZones || ticket.allowedZones || []).length === 0 && (
            <span className="text-xs text-slate-400">No zones assigned.</span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          Ticket Number: <span className="font-semibold text-slate-700">{ticket.ticketNumber}</span>
        </div>
        {ticket.attendee?.notes && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Note: {ticket.attendee.notes}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default TicketCard;
