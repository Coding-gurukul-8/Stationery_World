const path = require('path');
const supabase = require('./supabaseClient');

// All images are stored in a single public bucket.
// Create a bucket named 'images' in your Supabase Storage dashboard
// and set its visibility to Public.
const BUCKET_NAME = 'images';

/**
 * Upload a file buffer to Supabase Storage.
 *
 * @param {Buffer} fileBuffer   - The file contents as a Buffer (from multer memoryStorage).
 * @param {string} mimeType     - MIME type of the file (e.g. 'image/jpeg').
 * @param {string} storagePath  - Destination path inside the bucket
 *                                (e.g. 'products/12345.jpg' or 'users/42/profile.jpg').
 * @returns {Promise<string>}   - Resolves to the public URL of the uploaded file.
 */
async function uploadToSupabase(fileBuffer, mimeType, storagePath) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage by its public URL or storage path.
 *
 * @param {string} urlOrPath - Full public URL or storage path of the file to delete.
 * @returns {Promise<void>}
 */
async function deleteFromSupabase(urlOrPath) {
  try {
    // Extract the storage path from a full URL if needed.
    let storagePath = urlOrPath;
    if (urlOrPath.startsWith('http')) {
      // Public URL pattern: .../storage/v1/object/public/<bucket>/<path>
      const marker = `/object/public/${BUCKET_NAME}/`;
      const idx = urlOrPath.indexOf(marker);
      if (idx !== -1) {
        storagePath = urlOrPath.slice(idx + marker.length);
      }
    }

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) {
      console.error('Supabase Storage delete error:', error.message);
    }
  } catch (e) {
    console.error('deleteFromSupabase error:', e.message);
  }
}

/**
 * Build a unique storage path for a user profile photo.
 *
 * @param {number|string} userId
 * @param {string} originalName - Original filename (used to derive the extension).
 * @returns {string}
 */
function userPhotoPath(userId, originalName) {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  return `users/${userId}/profile${ext}`;
}

/**
 * Build a unique storage path for a product image.
 *
 * @param {string} originalName - Original filename (used to derive the extension).
 * @returns {string}
 */
function productImagePath(originalName) {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `products/${unique}${ext}`;
}

module.exports = {
  uploadToSupabase,
  deleteFromSupabase,
  userPhotoPath,
  productImagePath,
};
