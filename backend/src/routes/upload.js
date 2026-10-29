const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload, handleAzureUpload } = require('../middleware/azureUpload');
const { deleteImageFromAzure } = require('../services/azureBlobService');
const User = require('../models/User');
const Attendee = require('../models/Attendee');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/upload/profile-photo
 * Uploads and sets the profile photo for the authenticated user.
 */
router.post('/profile-photo', protect, upload.single('photo'), handleAzureUpload('profile-photos'), async (req, res) => {
  try {
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }

    const user = await User.findById(req.user._id);
    
    // Delete old photo from Azure Blob if exists
    if (user.profilePhotoS3Key) {
      await deleteImageFromAzure(user.profilePhotoS3Key).catch(err => {
        console.error('Failed to delete old profile photo:', err);
      });
    }

    // Update user with new photo data
    user.profilePhoto = req.s3Data.url;
    user.profilePhotoS3Key = req.s3Data.key;
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        url: user.profilePhoto,
        key: user.profilePhotoS3Key
      }
    });
  } catch (error) {
    console.error('PROFILE UPLOAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

/**
 * POST /api/upload/attendee-photo/:token
 * Public endpoint for attendees to upload their face photo during confirmation.
 */
router.post('/attendee-photo/:token', upload.single('photo'), handleAzureUpload('attendee-photos'), async (req, res) => {
  try {
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }

    const attendee = await Attendee.findOne({ confirmationToken: req.params.token });
    if (!attendee) {
      // Cleanup the uploaded photo if attendee not found
      await deleteImageFromAzure(req.s3Data.key).catch(console.error);
      return res.status(404).json({ success: false, message: 'Invalid confirmation token' });
    }

    // Delete old photo from Azure Blob if exists
    if (attendee.photoS3Key) {
      await deleteImageFromAzure(attendee.photoS3Key).catch(console.error);
    }

    // Update attendee with new photo data
    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    await attendee.save();

    res.json({
      success: true,
      message: 'Attendee photo uploaded successfully',
      data: {
        url: attendee.photo,
        key: attendee.photoS3Key
      }
    });
  } catch (error) {
    console.error('ATTENDEE UPLOAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

/**
 * POST /api/upload/system-asset
 * Endpoint for super admins to upload logos, favicons, etc.
 */
router.post('/system-asset', protect, upload.single('photo'), handleAzureUpload('system-assets'), async (req, res) => {
  try {
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    res.json({
      success: true,
      message: 'System asset uploaded successfully',
      data: {
        url: req.s3Data.url,
        key: req.s3Data.key
      }
    });
  } catch (error) {
    console.error('SYSTEM ASSET UPLOAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

/**
 * GET /api/upload/file
 * Generic file serving endpoint for uploaded files (receipts, etc.)
 * Requires authentication and security checks
 */
router.get('/file', protect, async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'File path is required' });
    }
    
    console.log('Requested file path:', filePath);
    
    // Handle both absolute and relative paths
    let resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    console.log('Resolved path:', resolvedPath);
    console.log('Uploads directory:', path.resolve(process.cwd(), 'uploads'));
    
    // Security check: ensure file is within uploads directory
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    // Normalize paths for comparison (case-insensitive for Windows)
    const normalizedResolved = path.normalize(resolvedPath).toLowerCase();
    const normalizedUploads = path.normalize(uploadsDir).toLowerCase();
    
    console.log('Normalized resolved path:', normalizedResolved);
    console.log('Normalized uploads directory:', normalizedUploads);
    
    if (!normalizedResolved.startsWith(normalizedUploads)) {
      console.error('Security check failed - path outside uploads directory');
      console.error('Resolved path does not start with uploads directory');
      return res.status(403).json({ success: false, message: 'Invalid file path' });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      console.error('File not found:', resolvedPath);
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    // Determine content type based on file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    }
    
    // Send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(resolvedPath)}"`);
    
    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error streaming file:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error serving file' });
      }
    });
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
