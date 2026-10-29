const sharp = require('sharp');
const crypto = require('crypto');
const Attendee = require('../models/Attendee');
const createFaceClient = require('@azure-rest/ai-vision-face').default;
const { AzureKeyCredential } = require('@azure/core-auth');

// Helper to check Azure Face API configuration
const hasAzureFaceConfig = () => !!(process.env.AZURE_FACE_ENDPOINT && process.env.AZURE_FACE_KEY);

/**
 * Validates an uploaded photo for EventGate standards
 * @param {Buffer} buffer - Image buffer
 * @param {String} eventId - Event ID for duplicate checking
 * @returns {Promise<Object>} - Validation results
 */
const validatePhoto = async (buffer, eventId) => {
  const results = {
    isValid: true,
    reason: null,
    metrics: {
      faceCount: 0,
      faceConfidence: 0,
      sharpness: 0,
      brightness: 0,
      isDuplicate: false,
    },
    hash: null,
  };

  try {
    // 1. CLARITY CHECK (Sharpness)
    const metadata = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    
    const sharpness = stats.channels.reduce((acc, c) => acc + c.stdev, 0) / stats.channels.length;
    results.metrics.sharpness = sharpness;
    results.metrics.brightness = stats.channels.reduce((acc, c) => acc + c.mean, 0) / stats.channels.length;

    if (sharpness < 20) { // Threshold for "blurry"
      results.isValid = false;
      results.reason = 'IMAGE_BLURRY';
      return results;
    }

    // 2. DUPLICATE DETECTION
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    results.hash = hash;
    const existing = await Attendee.findOne({ event: eventId, photoHash: hash });
    if (existing) {
      results.isValid = false;
      results.reason = 'DUPLICATE_PHOTO';
      results.metrics.isDuplicate = true;
      return results;
    }

    // 3. FACE DETECTION (Azure Face API)
    if (hasAzureFaceConfig()) {
      const faceClient = createFaceClient(process.env.AZURE_FACE_ENDPOINT, new AzureKeyCredential(process.env.AZURE_FACE_KEY));
      const response = await faceClient.path('/detect').post({
        contentType: 'application/octet-stream',
        body: buffer,
        queryParameters: {
          detectionModel: 'detection_03',
          recognitionModel: 'recognition_04',
        },
      });
      const faces = response.body || [];
      const faceCount = Array.isArray(faces) ? faces.length : 0;
      results.metrics.faceCount = faceCount;

      if (faceCount === 0) {
        results.isValid = false;
        results.reason = 'NO_FACE_DETECTED';
      } else if (faceCount > 1) {
        results.isValid = false;
        results.reason = 'MULTIPLE_FACES_DETECTED';
      }
    } else {
      console.warn('Azure Face API not configured. Skipping AI face detection.');
    }

    return results;
  } catch (error) {
    console.error('PHOTO VALIDATION ERROR:', error);
    // On error, we allow the photo but flag it for manual review
    results.isValid = true;
    results.reason = 'VALIDATION_FAILED_SYSTEM_ERROR';
    return results;
  }
};

module.exports = {
  validatePhoto,
};
