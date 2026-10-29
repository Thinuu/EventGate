import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const PhotoValidationFeedback = ({
  validationErrors = [],
  qualityAnalysis = null,
  faceAnalysis = null,
  allowOverride = false,
  onAllowOverrideChange,
  modelLoadFailed = false,
  validating = false,
}) => {
  if (validating) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-teal-600">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
        Analyzing photo quality and face detection…
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 text-left">
      {modelLoadFailed && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5">
          <p className="text-xs leading-relaxed text-amber-800">
            Advanced face matching is temporarily unavailable. Your photo can
            still be submitted for manual review.
          </p>
        </div>
      )}

      {qualityAnalysis && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Photo Quality:{' '}
              {qualityAnalysis.qualityRating?.rating || 'Pending'}
            </span>
            <span className="tabular-nums text-xs font-semibold text-slate-500">
              Score {qualityAnalysis.qualityRating?.score || 0}%
            </span>
          </div>

          {(faceAnalysis?.faceCount > 0 || qualityAnalysis.resolution) && (
            <div className="mt-2.5 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
              {qualityAnalysis.resolution && (
                <div>
                  Resolution:{' '}
                  {qualityAnalysis.resolution.dimensions?.width}×
                  {qualityAnalysis.resolution.dimensions?.height}
                </div>
              )}
              {faceAnalysis && (
                <div>Face count: {faceAnalysis.faceCount}</div>
              )}
              {faceAnalysis?.confidence > 0 && (
                <div>
                  Face confidence:{' '}
                  {(faceAnalysis.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-3.5">
          <div className="flex items-start gap-2.5">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Photo validation issues
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
                {validationErrors.map((error) => (
                  <li key={error} className="flex gap-1.5">
                    <span className="shrink-0">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>

              {onAllowOverrideChange && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={allowOverride}
                    onChange={(e) => onAllowOverrideChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Submit anyway for manual review
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoValidationFeedback;