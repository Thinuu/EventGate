const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('node:crypto');
function container() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING || !process.env.AZURE_PRIVATE_STORAGE_CONTAINER) throw Object.assign(new Error('Configure private Azure receipt storage'), { statusCode: 503 });
  return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getContainerClient(process.env.AZURE_PRIVATE_STORAGE_CONTAINER);
}
async function uploadReceipt(file) {
  const isPdf = file.mimetype === 'application/pdf';
  if (isPdf && !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw Object.assign(new Error('Invalid PDF'), { statusCode: 400 });
  let buffer = file.buffer;
  if (!isPdf) buffer = await require('sharp')(file.buffer, { limitInputPixels: 25000000 }).jpeg({ quality: 85 }).toBuffer();
  const client = container();
  const properties = await client.getProperties();
  if (properties.blobPublicAccess) throw new Error('Receipt container must have public access disabled');
  const key = `receipts/${crypto.randomUUID()}.${isPdf ? 'pdf' : 'jpg'}`;
  await client.getBlockBlobClient(key).uploadData(buffer, { blobHTTPHeaders: { blobContentType: isPdf ? 'application/pdf' : 'image/jpeg' } });
  return `azure-private:${key}`;
}
async function downloadReceipt(location) {
  const key = location.slice('azure-private:'.length);
  if (!/^receipts\/[a-f0-9-]+\.(pdf|jpg)$/.test(key)) throw new Error('Invalid receipt key');
  return container().getBlobClient(key).downloadToBuffer();
}
module.exports = { uploadReceipt, downloadReceipt };
