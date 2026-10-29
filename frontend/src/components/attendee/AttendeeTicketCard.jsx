import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  TicketIcon, 
  CalendarIcon, 
  MapPinIcon, 
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CameraIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import api from '../../api/client';
import toast from 'react-hot-toast';

const AttendeeTicketCard = ({ ticket }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (token, ticketNumber) => {
    if (!token) return;
    try {
      setDownloading(true);
      const response = await api.get(`/tickets/download/${token}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ticket-${ticketNumber || token}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ticket downloaded successfully!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error('Failed to download ticket PDF');
    } finally {
      setDownloading(false);
    }
  };
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return <CheckCircleSolid className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Time TBD';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const needsConfirmation = !ticket.attendee?.isConfirmed || ticket.attendee?.confirmationStatus !== 'confirmed';
  const needsPhoto = !ticket.attendee?.photo && ticket.event?.requirePhotoVerification;
  const isConfirmed = ticket.status === 'CONFIRMED';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col xs:flex-row xs:items-start justify-between gap-3 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TicketIcon className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
                {ticket.event?.name || 'Event Name'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">Ticket #{ticket.ticketNumber}</p>
            </div>
          </div>
          
          <div className={`flex items-center self-start xs:self-auto space-x-2 px-3 py-1 rounded-full border flex-shrink-0 ${getStatusColor(ticket.attendee?.confirmationStatus)}`}>
            {getStatusIcon(ticket.attendee?.confirmationStatus)}
            <span className="text-xs font-medium capitalize">
              {ticket.attendee?.confirmationStatus || 'Pending'}
            </span>
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <CalendarIcon className="h-4 w-4 flex-shrink-0" />
            <span>{formatDate(ticket.event?.startDate)} at {formatTime(ticket.event?.startDate)}</span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <MapPinIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{ticket.event?.venue?.name || 'Venue TBD'}</span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <UserIcon className="h-4 w-4 flex-shrink-0" />
            <span>{ticket.categoryName || 'Standard'}</span>
          </div>
        </div>

        {/* Action Requirements */}
        {ticket.status === 'PENDING_VERIFICATION' && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <ClockIcon className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-teal-800">Awaiting Photo Verification</p>
                <p className="text-teal-700 text-xs mt-0.5">Your organizer is reviewing your photo. The entry QR code will unlock once approved.</p>
              </div>
            </div>
          </div>
        )}

        {(needsConfirmation || needsPhoto) && ticket.status !== 'PENDING_VERIFICATION' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-600 text-xs font-bold">!</span>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-amber-800">Action Required</p>
                <ul className="text-amber-700 mt-1 space-y-1 text-xs">
                  {needsConfirmation && (
                    <li>Complete confirmation process</li>
                  )}
                  {needsPhoto && (
                    <li>Upload photo verification</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse xs:flex-row xs:items-center justify-between gap-4 mt-6">
          <div className="flex items-center space-x-3 w-full xs:w-auto">
            {needsConfirmation && (
              <Link
                to={`/confirm/${ticket.attendee?.confirmationToken}`}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors w-full xs:w-auto text-center"
              >
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                <span>Complete Confirmation</span>
              </Link>
            )}
            
            {needsPhoto && !needsConfirmation && (
              <button className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors w-full xs:w-auto">
                <CameraIcon className="h-4 w-4 flex-shrink-0" />
                <span>Upload Photo</span>
              </button>
            )}

            {isConfirmed && (
              <button
                onClick={() => handleDownload(ticket.attendee?.qrToken, ticket.ticketNumber)}
                disabled={downloading}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors w-full xs:w-auto disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-4 w-4 flex-shrink-0" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            )}
          </div>

          <Link
            to={`/attendee/ticket/${ticket._id}`}
            className="text-teal-600 hover:text-teal-700 text-sm font-semibold text-right xs:text-left w-full xs:w-auto"
          >
            View Ticket &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AttendeeTicketCard;
