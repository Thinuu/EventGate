import React, { useCallback, useEffect, useState } from 'react';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { getPendingPhotos, getVerificationStats, approvePhoto, rejectPhoto } from '../../api/verification';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { getAssetUrl } from '../../utils/backend';

const statusColors = {
  pending: 'yellow',
  verified: 'green',
  rejected: 'red',
};

const VerificationDashboard = () => {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    eventId: localStorage.getItem('lastSelectedEventId') || '',
    status: 'pending',
    search: '',
    sortBy: 'createdAt',
    sortOrder: -1,
    checkoutOption: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  // Modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingAttendeeId, setRejectingAttendeeId] = useState(null);

  // Load attendees and stats
  const loadData = useCallback(async () => {
    if (!filters.eventId) return;
    
    setLoading(true);
    try {
      const [photosRes, statsRes] = await Promise.all([
        getPendingPhotos({
          eventId: filters.eventId,
          status: filters.status,
          search: filters.search,
          checkoutOption: filters.checkoutOption,
          page,
          limit,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        }),
        getVerificationStats({ eventId: filters.eventId }),
      ]);

      setAttendees(photosRes.data.data.attendees || []);
      setTotal(photosRes.data.data.total || 0);
      setPages(photosRes.data.data.pages || 0);
      setStats(statsRes.data.data || { pending: 0, verified: 0, rejected: 0 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(loadData, {
    enabled: !!filters.eventId,
    interval: 15000,
    immediate: false,
    deps: [filters.eventId, filters.status, filters.search, filters.checkoutOption, page, limit],
  });

  const handleEventChange = (eventId) => {
    setFilters((prev) => ({ ...prev, eventId }));
    localStorage.setItem('lastSelectedEventId', eventId);
    setPage(1);
  };

  const handleStatusChange = (status) => {
    setFilters((prev) => ({ ...prev, status }));
    setPage(1);
  };

  const handleSearchChange = (search) => {
    setFilters((prev) => ({ ...prev, search }));
    setPage(1);
  };

  const handleCheckoutOptionChange = (checkoutOption) => {
    setFilters((prev) => ({ ...prev, checkoutOption }));
    setPage(1);
  };

  const handleApprove = async (attendeeId) => {
    setProcessing(attendeeId);
    try {
      await approvePhoto({ attendeeId });
      toast.success('Photo approved');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    setProcessing(rejectingAttendeeId);
    try {
      await rejectPhoto({ attendeeId: rejectingAttendeeId, reason: rejectReason });
      toast.success('Photo rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setRejectingAttendeeId(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleViewPhoto = (attendee) => {
    setSelectedAttendee(attendee);
    setShowPreviewModal(true);
  };

  const handleInitiateReject = (attendeeId) => {
    setRejectingAttendeeId(attendeeId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  if (!filters.eventId) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
            <p className="text-teal-800">Please select an event from the sidebar to view pending photos.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Photo Verification</h1>
          <p className="text-gray-600 mt-1">Review and verify attendee photos</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-yellow-700">Pending</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
            <div className="text-sm text-green-700">Verified</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-red-700">Rejected</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="">All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Checkout Option</label>
              <select
                value={filters.checkoutOption}
                onChange={(e) => handleCheckoutOptionChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All</option>
                <option value="standard">Standard</option>
                <option value="vip">VIP</option>
                <option value="premium">Premium</option>
                <option value="group">Group</option>
                <option value="corporate">Corporate</option>
                <option value="early_bird">Early Bird</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Name, email, or ID"
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="createdAt">Date (Newest)</option>
                <option value="fullName">Name (A-Z)</option>
                <option value="resubmitCount">Resubmissions</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : attendees.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">No photos found</p>
          </div>
        ) : (
          <>
            {/* Grid view */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attendees.map((attendee) => (
                <div key={attendee._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                  {/* Photo */}
                  <div
                    className="relative bg-gray-200 h-48 cursor-pointer group"
                    onClick={() => handleViewPhoto(attendee)}
                  >
                    {attendee.photo ? (
                      <img
                          src={getAssetUrl(attendee.photo)}
                          alt={attendee.fullName}
                          className="w-full h-full object-cover group-hover:opacity-80 transition"
                        />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span>No photo</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge color={statusColors[attendee.photoVerificationStatus]}>
                        {attendee.photoVerificationStatus}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate">{attendee.fullName}</h3>
                    <p className="text-sm text-gray-600 truncate">{attendee.email}</p>

                    {/* Metrics */}
                    {attendee.photoValidationMetrics && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                        <p>
                          Confidence:{' '}
                          {(attendee.photoValidationMetrics.faceConfidence * 100).toFixed(0)}%
                        </p>
                        {attendee.photoValidationMetrics.faceMatchSimilarity > 0 && (
                          <p>
                            Match:{' '}
                            {(attendee.photoValidationMetrics.faceMatchSimilarity * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    )}

                    {/* Resubmit count */}
                    {attendee.resubmitCount > 0 && (
                      <p className="text-xs text-orange-600 mt-2">
                        Resubmitted {attendee.resubmitCount}x
                      </p>
                    )}

                    {/* Actions */}
                    {attendee.photoVerificationStatus === 'pending' && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          disabled={processing === attendee._id}
                          onClick={() => handleApprove(attendee._id)}
                          className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        >
                          ✓ Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing === attendee._id}
                          onClick={() => handleInitiateReject(attendee._id)}
                          className="flex-1"
                        >
                          ✕ Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center items-center mt-6 gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-gray-600">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Preview Modal */}
      <Modal open={showPreviewModal} onClose={() => setShowPreviewModal(false)}>
        {selectedAttendee && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">{selectedAttendee.fullName}</h2>
            <div className="mb-4">
              <img
                src={getAssetUrl(selectedAttendee.photo)}
                alt={selectedAttendee.fullName}
                className="w-full rounded-lg"
              />
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>Email:</strong> {selectedAttendee.email}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <Badge color={statusColors[selectedAttendee.photoVerificationStatus]}>
                  {selectedAttendee.photoVerificationStatus}
                </Badge>
              </p>
              {selectedAttendee.photoValidationMetrics && (
                <>
                  <p>
                    <strong>Face Confidence:</strong>{' '}
                    {(selectedAttendee.photoValidationMetrics.faceConfidence * 100).toFixed(1)}%
                  </p>
                  <p>
                    <strong>Brightness:</strong> {selectedAttendee.photoValidationMetrics.brightness}
                  </p>
                  <p>
                    <strong>Sharpness:</strong> {selectedAttendee.photoValidationMetrics.sharpness}
                  </p>
                  {selectedAttendee.photoValidationMetrics.faceMatchSimilarity > 0 && (
                    <p>
                      <strong>Face Match Similarity:</strong>{' '}
                      {(selectedAttendee.photoValidationMetrics.faceMatchSimilarity * 100).toFixed(1)}%
                    </p>
                  )}
                </>
              )}
            </div>
            <button
              className="mt-6 w-full px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              onClick={() => setShowPreviewModal(false)}
            >
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* Reject Reason Modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)}>
        <div className="max-w-md">
          <h2 className="text-2xl font-bold mb-4">Reject Photo</h2>
          <form onSubmit={handleRejectSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this photo rejected?"
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRejectModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={processing === rejectingAttendeeId || !rejectReason.trim()}
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                Reject
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default VerificationDashboard;
