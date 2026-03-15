const cloudinary = require('cloudinary').v2;

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error(
    'Missing Cloudinary configuration. ' +
    'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET ' +
    'in your environment variables. ' +
    'Get your credentials at https://cloudinary.com → Dashboard.'
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} folder  - Cloudinary folder (e.g. 'stationery_world/products')
 * @returns {Promise<{url: string, publicId: string}>}
 */
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete an image from Cloudinary using its public_id.
 * Silently ignores missing / non-Cloudinary URLs.
 * @param {string} publicIdOrUrl - Cloudinary public_id or secure_url
 */
const deleteFromCloudinary = async (publicIdOrUrl) => {
  if (!publicIdOrUrl) return;
  try {
    // If a full URL was supplied, derive the public_id from it.
    let publicId = publicIdOrUrl;
    let isCloudinaryUrl = false;
    try {
      const parsed = new URL(publicIdOrUrl);
      isCloudinaryUrl = parsed.hostname === 'res.cloudinary.com';
    } catch (_) {
      // Not a valid URL — treat as a bare public_id
    }

    if (isCloudinaryUrl) {
      const uploadIndex = publicIdOrUrl.indexOf('/upload/');
      if (uploadIndex !== -1) {
        let raw = publicIdOrUrl.substring(uploadIndex + 8);
        raw = raw.replace(/^v\d+\//, '');              // strip version segment
        raw = raw.replace(/\.[^/.]+$/, '');            // strip extension
        publicId = raw;
      }
    }
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };
