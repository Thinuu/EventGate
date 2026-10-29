const { validatePhoto } = require('./photoValidationService');
const { requiresPhotoVerification } = require('./ticketDeliveryService');
const { deleteImageFromAzure } = require('./azureBlobService');

const parseBoolean = (value) => value === true || value === 'true';

const parseFaceDescriptor = (body = {}) => {
  try {
    const parsed = body.faceDescriptor ? JSON.parse(body.faceDescriptor) : [];
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'number')) {
      return parsed;
    }
  } catch (err) {
    // ignore parse errors
  }
  return [];
};

const applyValidatedPhotoUpload = async ({
  attendee,
  event,
  fileBuffer,
  s3Data,
  body = {},
  rejectOnAiFailure = true,
}) => {
  if (!s3Data || !fileBuffer) {
    return { ok: false, status: 400, message: 'Photo is required.' };
  }

  const faceValidationPassed = body.faceValidationPassed === undefined
    ? true
    : parseBoolean(body.faceValidationPassed);

  if (!faceValidationPassed) {
    if (s3Data.key) await deleteImageFromAzure(s3Data.key).catch(console.error);
    return { ok: false, status: 400, message: 'Frontend face validation not passed.' };
  }

  const aiResults = await validatePhoto(fileBuffer, event?._id || event);
  const descriptor = parseFaceDescriptor(body);

  attendee.photo = s3Data.url;
  attendee.photoS3Key = s3Data.key;
  attendee.photoUploadedAt = new Date();
  attendee.photoHash = aiResults.hash;
  attendee.photoValidationMetrics = {
    ...(attendee.photoValidationMetrics || {}),
    faceCount: aiResults.metrics.faceCount,
    faceConfidence: aiResults.metrics.faceConfidence,
    sharpness: aiResults.metrics.sharpness,
    brightness: aiResults.metrics.brightness,
    faceCountClient: Number(body.faceCount || 0),
    faceConfidenceClient: Number(body.faceConfidence || 0),
    sharpnessClient: Number(body.sharpness || 0),
    brightnessClient: Number(body.brightness || 0),
  };

  if (descriptor.length > 0) {
    attendee.faceDescriptor = descriptor;
  }

  if (!aiResults.isValid) {
    attendee.photoVerificationStatus = 'rejected';
    attendee.photoRejectionReason = `AI Auto-Reject: ${aiResults.reason}`;

    if (rejectOnAiFailure) {
      if (s3Data.key) await deleteImageFromAzure(s3Data.key).catch(console.error);
      attendee.photo = undefined;
      attendee.photoS3Key = undefined;
      attendee.photoUploadedAt = undefined;
      attendee.photoHash = undefined;
      return {
        ok: false,
        status: 400,
        message: `Photo rejected by AI: ${(aiResults.reason || 'invalid').replace(/_/g, ' ')}`,
        aiResults,
      };
    }
  } else if (requiresPhotoVerification(event)) {
    attendee.photoVerificationStatus = 'pending';
    attendee.photoRejectionReason = null;
    attendee.qrCode = null;
  } else {
    attendee.photoVerificationStatus = 'verified';
    attendee.photoRejectionReason = null;
  }

  return { ok: true, aiResults };
};

module.exports = {
  applyValidatedPhotoUpload,
  parseFaceDescriptor,
};
