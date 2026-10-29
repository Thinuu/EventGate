/**
 * Multer middleware for Azure Blob Storage uploads
 * Handles file validation before sending to Azure Blob Storage
 */

const multer = require('multer');
const { uploadImageToAzure } = require('../services/azureBlobService');

// Memory storage for Azure Blob upload (don't save to disk)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPG and PNG files are allowed'));
  }

  // Check file size (3MB limit)
  const maxSize = 3 * 1024 * 1024;
  if (file.size > maxSize) {
    return cb(new Error('File size exceeds 3MB limit'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
});

// Specialized filter for Excel/CSV bulk uploads
const excelFileFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/octet-stream' // fallback for some browsers
  ];

  if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
    return cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
  }

  cb(null, true);
};

const excelUpload = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB for larger sheets
  },
});

/**
 * Middleware to handle Azure Blob upload after multer processing
 * Attaches s3Data to req for use in route handlers
 */
const handleAzureUpload = (category = 'attendee-photos') => {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
      }

      // Validate file
      const minSize = 50 * 1024; // 50KB
      if (req.file.size < minSize) {
        return res.status(400).json({
          success: false,
          message: 'File size too small (minimum 50KB)',
        });
      }

      // Upload to Azure Blob Storage
      const azureData = await uploadImageToAzure(
        req.file.buffer,
        req.file.originalname,
        category,
      );

      // Attach Azure data to request
      req.s3Data = azureData;

      next();
    } catch (err) {
      console.error('Azure Blob upload middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image to Azure Blob Storage',
        error: err.message,
      });
    }
  };
};

module.exports = {
  upload,
  excelUpload,
  handleAzureUpload,
  // Backward compatibility alias
  handleS3Upload: handleAzureUpload,
};
