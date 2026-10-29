import React from 'react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Table, Th, Td, Tr } from '../ui/Table';
import {
  EyeIcon,
  CheckBadgeIcon,
  NoSymbolIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const statusColor = {
  confirmed: 'green',
  pending: 'amber',
  invited: 'blue',
  'checked-in': 'green',
  checked_in: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

const verificationColor = {
  verified: 'green',
  pending: 'amber',
  rejected: 'red',
};

const AttendeeTable = ({
  attendees = [],
  loading = false,
  onView,
  onMarkAttendance,
  onDisableToggle,
  onDelete,
  canEdit = false,
}) => {
  if (loading) {
    return (
      <div className="space-y-3 p-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (!attendees.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-semibold text-slate-700">No attendees found</p>
        <p className="mt-1 text-xs text-slate-500">
          Try adjusting filters or add a new attendee.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[900px]">
        <thead>
          <Tr>
            <Th>Name</Th>
            <Th>Contact</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Verification</Th>
            <Th>Zones</Th>
            <Th className="text-right">Actions</Th>
          </Tr>
        </thead>
        <tbody>
          {attendees.map((attendee) => {
            const id = attendee._id || attendee.id;
            const status =
              attendee.status ||
              attendee.confirmationStatus ||
              'pending';
            const verification = attendee.verificationStatus || '—';
            const isDisabled = !!attendee.isDisabled;

            return (
              <Tr
                key={id}
                className={isDisabled ? 'opacity-60' : undefined}
              >
                <Td>
                  <p className="font-semibold text-slate-900">
                    {attendee.fullName || '—'}
                  </p>
                  {isDisabled && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
                      Disabled
                    </span>
                  )}
                </Td>
                <Td>
                  <p className="text-sm text-slate-700">
                    {attendee.email || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {attendee.phone || '—'}
                  </p>
                </Td>
                <Td>
                  <span className="text-sm text-slate-700">
                    {attendee.categoryName || '—'}
                  </span>
                </Td>
                <Td>
                  <Badge color={statusColor[status] || 'gray'}>
                    {status}
                  </Badge>
                </Td>
                <Td>
                  {verification !== '—' ? (
                    <Badge color={verificationColor[verification] || 'gray'}>
                      {verification}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1 max-w-[140px]">
                    {(attendee.allowedZones || []).slice(0, 2).map((z) => (
                      <span
                        key={z}
                        className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        {z}
                      </span>
                    ))}
                    {(attendee.allowedZones || []).length > 2 && (
                      <span className="text-[10px] text-slate-400">
                        +{(attendee.allowedZones || []).length - 2}
                      </span>
                    )}
                    {(attendee.allowedZones || []).length === 0 && (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* View — blue outline */}
                    <button
                      type="button"
                      onClick={() => onView?.(attendee)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600"
                      title="View details"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>

                    {/* Mark attendance — solid blue */}
                    {onMarkAttendance && (
                      <Button
                        size="sm"
                        className="h-8 bg-teal-600 px-2.5 text-xs hover:bg-teal-500 text-white"
                        onClick={() => onMarkAttendance(attendee)}
                        title="Mark attendance"
                      >
                        <CheckBadgeIcon className="mr-1 h-3.5 w-3.5" />
                        Check-in
                      </Button>
                    )}

                    {/* Disable / Enable */}
                    {onDisableToggle && (
                      <button
                        type="button"
                        onClick={() => onDisableToggle(attendee)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          isDisabled
                            ? 'border-teal-200 bg-teal-50 text-teal-600 hover:bg-teal-100'
                            : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600'
                        }`}
                        title={isDisabled ? 'Enable' : 'Disable'}
                      >
                        <NoSymbolIcon className="h-4 w-4" />
                      </button>
                    )}

                    {/* Delete — rose outline only */}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(id, attendee)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};

export default AttendeeTable;