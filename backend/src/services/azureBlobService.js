/**
 * Azure Blob Storage Configuration and Image Storage Service
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const hasAzureConfig = () => !!(
  process.env.AZURE_STORAGE_CONNECTION_STRING &&
  process.env.AZURE_STORAGE_CONTAINER &&
  process.env.AZURE_STORAGE_CONNECTION_STRING !== 'your-azure-storage-connection-string' &&
  process.env.AZURE_STORAGE_CONTAINER !== 'your-container-name'
);

// Configure Azure Blob Service Client
let blobServiceClient;
if (hasAzureConfig()) {
  blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
}
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'entrynex-photos';

// Container name already defined as containerName
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
const LOCAL_UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

const ensureLocalDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const saveImageLocally = async (fileBuffer, filename, category = 'attendee-photos') => {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw Object.assign(new Error('Configure Azure storage before accepting uploads'), { statusCode: 503 });
  const compressedBuffer = await sharp(fileBuffer, { limitInputPixels: 25000000 })
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  const uniqueId = uuidv4();
  const key = `${category}/${Date.now()}-${uniqueId}.jpg`;
  const absolutePath = path.join(LOCAL_UPLOAD_ROOT, key);
  await ensureLocalDir(path.dirname(absolutePath));
  await fs.promises.writeFile(absolutePath, compressedBuffer);

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    key: null,
    url: `${backendUrl}/uploads/${key.replace(/\\/g, '/')}`,
    bucket: 'local',
    storage: 'local',
    localPath: absolutePath,
  };
};

/**
 * Upload and compress image to Azure Blob Storage or local disk fallback
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {string} category - Upload category (e.g., 'attendee-photos')
 * @returns {Promise<{key: String|null, url: String}>}
 */
const uploadImageToAzure = async (fileBuffer, filename, category = 'attendee-photos') => {
  try {
    if (!hasAzureConfig()) {
      return saveImageLocally(fileBuffer, filename, category);
    }

    // Compress image using sharp
    const compressedBuffer = await sharp(fileBuffer, { limitInputPixels: 25000000 })
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const uniqueId = uuidv4();
    const key = `${category}/${Date.now()}-${uniqueId}.jpg`;

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(key);
    await blockBlobClient.uploadData(compressedBuffer, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' },
    });

    const url = blockBlobClient.url;
    return { key, url, storage: 'azure' };
  } catch (err) {
    console.error('Azure Blob upload error:', err);
    if (!hasAzureConfig()) {
      return saveImageLocally(fileBuffer, filename, category);
    }
    throw new Error(`Failed to upload image to Azure Blob: ${err.message}`);
  }
};

/**
 * Generate signed URL for private Azure Blob
 * @param {string} blobKey - Azure Blob object key
 * @param {number} expirySeconds - URL expiry time in seconds (default: 1 hour)
 * @returns {Promise<String>} Signed URL
 */
const getSignedUrl = async (blobKey, expirySeconds = SIGNED_URL_EXPIRY) => {
  // Azure Blob public URLs are accessible directly if container is public; otherwise generate SAS (not implemented).
  if (!hasAzureConfig()) {
    return null;
  }
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobKey);
  return blobClient.url;
};

/**
 * Delete image from Azure Blob Storage or local disk
 * @param {string} blobKey - Azure Blob object key
 * @returns {Promise<void>}
 */
const deleteImageFromAzure = async (blobKey) => {
  try {
    if (!blobKey) return;

    if (!hasAzureConfig()) {
      const localPath = path.join(LOCAL_UPLOAD_ROOT, blobKey);
      await fs.promises.unlink(localPath).catch(() => null);
      return;
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobKey);
    await blockBlobClient.deleteIfExists();
    console.log(`Deleted Azure Blob: ${blobKey}`);
  } catch (err) {
    console.error('Azure Blob delete error:', err);
    throw new Error(`Failed to delete image from Azure Blob: ${err.message}`);
  }
};

const deleteImagesFromAzure = async (blobKeys) => {
  if (!blobKeys || blobKeys.length === 0) return;

  try {
    if (!hasAzureConfig()) {
      await Promise.all(blobKeys.map((key) => deleteImageFromAzure(key)));
      return;
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const deletePromises = blobKeys.map((key) => {
      const blockBlobClient = containerClient.getBlockBlobClient(key);
      return blockBlobClient.deleteIfExists();
    });
    await Promise.all(deletePromises);
    console.log(`Deleted ${blobKeys.length} Azure Blobs`);
  } catch (err) {
    console.error('Azure batch delete error:', err);
    throw new Error(`Failed to delete images from Azure Blob: ${err.message}`);
  }
};

const getOldImagesInAzure = async (ageInDays = 30, prefix = 'attendee-photos/') => {
  // Azure Blob storage listing implementation (simplified, returns empty as placeholder)
  if (!hasAzureConfig()) return [];
  // Implement listing if needed.
  return [];
};

const cleanupOldImages = async (ageInDays = 90) => {
  // Azure cleanup placeholder
  console.log('Azure cleanup not implemented');
  return { deleted: 0, failed: 0 };
};

const getPublicUrl = (blobKey) => {
  if (!hasAzureConfig()) return null;
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobKey);
  return blobClient.url;
};

/**
 * Upload a buffer to Azure Blob Storage.
 * @param {Buffer} buffer - File data buffer.
 * @param {string} originalName - Original file name (for extension detection).
 * @param {string} mimeType - MIME type of the file.
 * @returns {Promise<string>} - URL of uploaded blob.
 */
const uploadBuffer = async (buffer, originalName, mimeType) => {
  if (!buffer || !originalName) {
    throw new Error('Invalid buffer or originalName for upload');
  }
  const ext = path.extname(originalName).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;

  if (!hasAzureConfig()) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw Object.assign(new Error('Configure Azure storage before accepting uploads'), { statusCode: 503 });
    // Fallback: store locally in the uploads folder
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localPath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(localPath, buffer);
    // Return a pseudo‑URL that the frontend can still use (served statically by Express)
    return `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${uniqueName}`;
  }

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(uniqueName);
  const uploadOptions = {
    blobHTTPHeaders: {
      blobContentType: mimeType || 'application/octet-stream',
    },
  };
  await blockBlobClient.uploadData(buffer, uploadOptions);
  return blockBlobClient.url;
};

module.exports = {
  uploadImageToAzure,
  getSignedUrl,
  deleteImageFromAzure,
  deleteImagesFromAzure,
  getOldImagesInAzure,
  cleanupOldImages,
  getPublicUrl,
  uploadBuffer,
  // Backward compatibility aliases
  uploadImageToS3: uploadImageToAzure,
  deleteImageFromS3: deleteImageFromAzure,
  deleteImagesFromS3: deleteImagesFromAzure,
  getOldImagesInS3: getOldImagesInAzure,
};
