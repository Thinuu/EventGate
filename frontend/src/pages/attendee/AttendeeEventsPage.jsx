import React, { useState, useEffect } from 'react';
import AttendeeLayout from '../../components/attendee/AttendeeLayout';
import api from '../../api/client';
import { 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon,
  TicketIcon,
  UserIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

const AttendeeEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.get('/user/events');
      setEvents(data?.data?.events || []);
    } catch (err) {
      console.error('Error loading events:', err);
      setError(err?.response?.data?.message || err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = searchQuery === '' || 
      event.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.venue?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === 'all' || event.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isUpcoming = (startDate) => {
    return new Date(startDate) > new Date();
  };

  const isLive = (startDate, endDate) => {
    const now = new Date();
    return new Date(startDate) <= now && new Date(endDate) >= now;
  };

  if (loading) {
    return (
      <AttendeeLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </AttendeeLayout>
    );
  }

  return (
    <AttendeeLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Details</h1>
          <p className="text-gray-600">View information about your registered events</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="md:w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all">All Events</option>
                <option value="published">Published</option>
                <option value="live">Live Now</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Events List */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'You haven\'t registered for any events yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredEvents.map((event) => (
              <div key={event._id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Event Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{event.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                        {isLive(event.startDate, event.endDate) && (
                          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium animate-pulse">
                            LIVE NOW
                          </span>
                        )}
                        {isUpcoming(event.startDate) && (
                          <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                            UPCOMING
                          </span>
                        )}
                      </div>
                      
                      {event.description && (
                        <p className="text-gray-600 mb-4">{event.description}</p>
                      )}
                    </div>

                    {event.coverImage && (
                      <div className="w-24 h-24 rounded-lg overflow-hidden ml-4 flex-shrink-0">
                        <img 
                          src={event.coverImage} 
                          alt={event.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center space-x-3 text-gray-600">
                      <CalendarIcon className="h-5 w-5" />
                      <div>
                        <p className="text-sm">Date</p>
                        <p className="font-medium text-gray-900">{formatDate(event.startDate)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-gray-600">
                      <ClockIcon className="h-5 w-5" />
                      <div>
                        <p className="text-sm">Time</p>
                        <p className="font-medium text-gray-900">{formatTime(event.startDate)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-gray-600">
                      <MapPinIcon className="h-5 w-5" />
                      <div>
                        <p className="text-sm">Venue</p>
                        <p className="font-medium text-gray-900">{event.venue?.name || 'TBD'}</p>
                        {event.venue?.address && (
                          <p className="text-xs text-gray-500">{event.venue.address}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Ticket Capacity</p>
                        <p className="font-medium text-gray-900">
                          {event.ticketCapacity ? `${event.ticketCapacity} tickets` : 'Unlimited'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600">Ticket Price</p>
                        <p className="font-medium text-gray-900">
                          {event.ticketPrice ? `${event.settings?.currency || event.currency || 'LKR'} ${event.ticketPrice.toLocaleString()}` : 'Free'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600">Photo Verification</p>
                        <p className="font-medium text-gray-900">
                          {event.requirePhotoVerification ? 'Required' : 'Optional'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  {event.instructions && (
                    <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-teal-900 mb-2">Event Instructions</h4>
                      <p className="text-sm text-teal-800 whitespace-pre-wrap">{event.instructions}</p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-6 flex justify-end">
                    <button className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors">
                      <span>View Details</span>
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AttendeeLayout>
  );
};

export default AttendeeEventsPage;
