const supabase = require('./supabaseClient');

// Dedicated Supabase Storage buckets.
// Create these buckets in your Supabase Storage dashboard and set them to Public.
const USER_BUCKET = 'users';
const PRODUCT_BUCKET = 'products';

/**
 * Upload a file buffer to Supabase Storage.
 *
 * @param {Buffer} fileBuffer   - The file contents as a Buffer (from multer memoryStorage).
 * @param {string} mimeType     - MIME type of the file (e.g. 'image/jpeg').
 * @param {string} storagePath  - Destination path inside the bucket
 *                                (e.g. '42/profile.jpg' inside the 'users' bucket).
 * @param {string} bucket       - Supabase Storage bucket name (e.g. 'users' or 'products').
 * @returns {Promise<string>}   - Resolves to the public URL of the uploaded file.
 */
async function uploadToSupabase(fileBuffer, mimeType, storagePath, bucket) {
  if (!bucket) {
    throw new Error('uploadToSupabase: bucket parameter is required.');
  }

  console.log(`Uploading to Supabase Storage — bucket: ${bucket}, path: ${storagePath}`);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed (bucket: ${bucket}): ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  console.log(`Upload successful — public URL: ${data.publicUrl}`);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage by its public URL or storage path.
 *
 * @param {string} urlOrPath - Full public URL or storage path of the file to delete.
 * @param {string} bucket    - Supabase Storage bucket name (e.g. 'users' or 'products').
 * @returns {Promise<void>}
 */
async function deleteFromSupabase(urlOrPath, bucket) {
  if (!bucket) {
    console.error('deleteFromSupabase: bucket parameter is required, skipping delete.');
    return;
  }

  try {
    // Extract the storage path from a full URL if needed.
    let storagePath = urlOrPath;
    if (urlOrPath.startsWith('http')) {
      // Public URL pattern: .../storage/v1/object/public/<bucket>/<path>
      const marker = `/object/public/${bucket}/`;
      const idx = urlOrPath.indexOf(marker);
      if (idx !== -1) {
        storagePath = urlOrPath.slice(idx + marker.length);
      }
    }

    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.error(`Supabase Storage delete error (bucket: ${bucket}):`, error.message);
    }
  } catch (e) {
    console.error('deleteFromSupabase error:', e.message);
  }
}

/**
 * Build the storage path for a user profile photo inside the 'users' bucket.
 *
 * @param {number|string} userId
 * @returns {string} e.g. '42/profile.jpg'
 */
function userPhotoPath(userId) {
  return `${userId}/profile.jpg`;
}

/**
 * Build the storage path for a product image inside the 'products' bucket.
 *
 * @param {number|string} productId - Product ID (used as the folder name).
 * @param {number} [index=0]        - Zero-based image index for products with multiple images.
 * @returns {string} e.g. '7/image-0.webp'
 */
function productImagePath(productId, index = 0) {
  return `${productId}/image-${index}.webp`;
}

module.exports = {
  uploadToSupabase,
  deleteFromSupabase,
  userPhotoPath,
  productImagePath,
  USER_BUCKET,
  PRODUCT_BUCKET,
};
