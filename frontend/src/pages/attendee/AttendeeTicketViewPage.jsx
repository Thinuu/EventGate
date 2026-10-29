import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AttendeeLayout from '../../components/attendee/AttendeeLayout';
import QRCodeDisplay from '../../components/attendee/QRCodeDisplay';
import api from '../../api/client';
import { 
  TicketIcon, 
  CalendarIcon, 
  MapPinIcon, 
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowLeftIcon,
  CameraIcon,
  ShieldCheckIcon,
  QrCodeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const AttendeeTicketViewPage = () => {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    if (ticketId) {
      loadTicket(ticketId);
    }
  }, [ticketId]);

  const loadTicket = async (id) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.get(`/user/ticket/${id}`);
      setTicket(data?.data?.ticket || null);
    } catch (err) {
      console.error('Error loading ticket:', err);
      setError(err?.response?.data?.message || err.message);
      setTicket(null);
    } finally {
      setLoading(false);
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
        return <CheckCircleSolid className="h-5 w-5 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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

  const isConfirmed = ticket?.status === 'CONFIRMED';
  const needsConfirmation = !isConfirmed;
  const needsPhoto = !ticket?.attendee?.photo && ticket?.event?.requirePhotoVerification;

  if (loading) {
    return (
      <AttendeeLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </AttendeeLayout>
    );
  }

  if (error || !ticket) {
    return (
      <AttendeeLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <XCircleIcon className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Ticket not found</h3>
              <p className="text-sm text-red-700 mt-1">{error || 'Ticket could not be loaded'}</p>
            </div>
          </div>
          <Link
            to="/attendee/tickets"
            className="mt-3 inline-flex items-center space-x-2 text-teal-600 hover:text-teal-700"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Tickets</span>
          </Link>
        </div>
      </AttendeeLayout>
    );
  }

  return (
    <AttendeeLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/attendee/tickets"
            className="inline-flex items-center space-x-2 text-teal-600 hover:text-teal-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Tickets</span>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ticket Details</h1>
              <p className="text-gray-600">View your ticket information and QR code</p>
            </div>
            
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border ${getStatusColor(ticket.attendee?.confirmationStatus)}`}>
              {getStatusIcon(ticket.attendee?.confirmationStatus)}
              <span className="text-sm font-medium capitalize">
                {ticket.attendee?.confirmationStatus || 'Pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Entry QR Code</h2>
                <QrCodeIcon className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="flex flex-col items-center">
                {isConfirmed ? (
                  <>
                    <QRCodeDisplay 
                      value={ticket.attendee?.qrCode || ticket.qrToken} 
                      size={250}
                      className="mb-4"
                    />
                    <p className="text-sm text-gray-600 text-center mb-4">
                      Show this QR code at the event entrance for quick entry
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircleSolid className="h-5 w-5" />
                        <span className="text-sm font-medium">Ticket Active</span>
                      </div>
                      <button
                        onClick={() => handleDownload(ticket.attendee?.qrToken, ticket.ticketNumber)}
                        disabled={downloading}
                        className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors w-full sm:w-auto disabled:opacity-50"
                      >
                        {downloading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownTrayIcon className="h-4 w-4 flex-shrink-0" />
                            <span>Download PDF Ticket</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : ticket?.status === 'PENDING_VERIFICATION' ? (
                  <div className="text-center py-8">
                    <div className="w-32 h-32 bg-amber-50 rounded-lg flex items-center justify-center mx-auto mb-4 border border-amber-100">
                      <ClockIcon className="h-16 w-16 text-amber-500" />
                    </div>
                    <p className="text-amber-800 font-semibold mb-2">
                      Awaiting Photo Verification
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                      The organizer is currently reviewing your uploaded face photo. The entry QR code will unlock once approved.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <QrCodeIcon className="h-16 w-16 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-4">
                      Complete confirmation to activate your QR code
                    </p>
                    {needsConfirmation && (
                      <Link
                        to={`/confirm/${ticket.attendee?.qrToken || ticket.qrToken}`}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
                      >
                        <ShieldCheckIcon className="h-4 w-4" />
                        <span>Complete Confirmation</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Details Section */}
          <div className="space-y-6">
            {/* Event Information */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{ticket.event?.name}</h3>
                    <p className="text-gray-600 mt-1">Ticket #{ticket.ticketNumber}</p>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-gray-600">
                    <CalendarIcon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{formatDate(ticket.event?.startDate)}</p>
                      <p className="text-sm">{formatTime(ticket.event?.startDate)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-gray-600">
                    <MapPinIcon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{ticket.event?.venue?.name || 'Venue TBD'}</p>
                      {ticket.event?.venue?.address && (
                        <p className="text-sm text-gray-500">{ticket.event.venue.address}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-gray-600">
                    <UserIcon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{ticket.categoryName || 'Standard'}</p>
                      <p className="text-sm text-gray-500">Ticket Category</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendee Information */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendee Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">{ticket.attendee?.fullName || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{ticket.attendee?.email || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium text-gray-900">{ticket.attendee?.phone || 'Not provided'}</p>
                  </div>
                  
                  {ticket.attendee?.allowedZones && ticket.attendee.allowedZones.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Zone Access</p>
                      <div className="flex flex-wrap gap-2">
                        {ticket.attendee.allowedZones.map((zone) => (
                          <span key={zone} className="px-3 py-1 bg-teal-100 text-teal-800 text-sm rounded-full">
                            {zone}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {ticket.attendee?.notes && (
                    <div>
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="text-gray-900">{ticket.attendee.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Required */}
            {(needsConfirmation || needsPhoto) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-600 text-sm font-bold">!</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-amber-800 mb-2">Action Required</h3>
                    <ul className="text-amber-700 space-y-2">
                      {needsConfirmation && (
                        <li className="flex items-center space-x-2">
                          <ShieldCheckIcon className="h-4 w-4" />
                          <span>Complete confirmation process</span>
                        </li>
                      )}
                      {needsPhoto && (
                        <li className="flex items-center space-x-2">
                          <CameraIcon className="h-4 w-4" />
                          <span>Upload photo verification</span>
                        </li>
                      )}
                    </ul>
                    
                    {needsConfirmation && (
                      <Link
                        to={`/confirm/${ticket.attendee?.confirmationToken}`}
                        className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
                      >
                        <ShieldCheckIcon className="h-4 w-4" />
                        <span>Complete Confirmation</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AttendeeLayout>
  );
};

export default AttendeeTicketViewPage;
