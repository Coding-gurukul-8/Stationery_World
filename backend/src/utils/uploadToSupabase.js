const supabase = require('./supabaseClient');

// Dedicated Supabase Storage buckets.
// Create these buckets in your Supabase Storage dashboard and set them to Public.
const USER_BUCKET = 'users';
const PRODUCT_BUCKET = 'products';

/**
 * Ensure the given Supabase Storage bucket exists, creating it (public) if it
 * does not.  Errors other than "already exists" are logged as warnings but do
 * not abort the upload — the upload itself will surface a clear error if the
 * bucket is still missing.
 *
 * @param {string} bucket - Bucket name.
 */
async function ensureBucketExists(bucket) {
  const { error } = await supabase.storage.createBucket(bucket, { public: true });
  // HTTP 409 Conflict means the bucket already exists — that is fine.
  if (error && error.status !== 409) {
    console.warn(`Warning: could not create bucket '${bucket}': ${error.message}`);
  }
}

async function uploadToSupabase(fileBuffer, mimeType, storagePath, bucket) {
  if (!supabase) {
    throw new Error(
      'Supabase client is not initialised. ' +
      'Set the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  if (!bucket) {
    throw new Error('uploadToSupabase: bucket parameter is required.');
  }

  // Create the bucket if it does not exist yet (idempotent).
  await ensureBucketExists(bucket);

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
  if (!supabase) {
    console.error('deleteFromSupabase: Supabase client is not initialised, skipping delete.');
    return;
  }

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
