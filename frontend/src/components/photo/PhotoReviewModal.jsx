import React, { useEffect } from 'react';
import Button from '../ui/Button';

const PhotoReviewModal = ({ 
  open, 
  onClose, 
  attendee, 
  onVerify, 
  onReject,
  isVerifying = false,
  isRejecting = false 
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !attendee) return null;

  const isLoading = isVerifying || isRejecting;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-review-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="photo-review-title" className="text-lg font-bold text-slate-900">
            Photo Review
          </h2>
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Photo side */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Uploaded Photo
            </p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {attendee.photo ? (
                <img 
                  src={attendee.photo} 
                  alt={`Photo of ${attendee.fullName || 'attendee'}`}
                  className="w-full max-h-[420px] object-contain"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                  No photo available
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Tip: Check face clarity, lighting, and that the photo matches the ID details.
            </p>
          </div>

          {/* Details side */}
          <div className="flex flex-col">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Attendee Details
            </p>
            
            <div className="mt-2 space-y-3 text-sm text-slate-700">
              <DetailRow label="Full Name" value={attendee.fullName} />
              <DetailRow label="National ID" value={attendee.nationalId} />
              <DetailRow 
                label="Date of Birth" 
                value={attendee.dateOfBirth 
                  ? new Date(attendee.dateOfBirth).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }) 
                  : null
                } 
              />
              <DetailRow label="Category" value={attendee.categoryName} />
              <DetailRow label="Event" value={attendee.event?.name} />
            </div>

            {/* Actions */}
            <div className="mt-auto flex gap-3 pt-6">
              <Button 
                onClick={onVerify} 
                disabled={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              >
                {isVerifying ? 'Verifying…' : 'Verify'}
              </Button>
              <Button 
                variant="danger" 
                onClick={onReject}
                disabled={isLoading}
                className="flex-1"
              >
                {isRejecting ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small helper for consistent detail rows
const DetailRow = ({ label, value }) => (
  <div className="flex gap-2">
    <span className="min-w-[110px] font-semibold text-slate-500">{label}:</span>
    <span className="text-slate-800">{value || '—'}</span>
  </div>
);

export default PhotoReviewModal;