const supabase = require('./supabaseClient');

// Dedicated Supabase Storage buckets.
// ✅ IMPORTANT: Create these buckets MANUALLY in your Supabase Storage dashboard
// and configure RLS policies (see SUPABASE_SETUP_GUIDE.md)
const USER_BUCKET = 'users';
const PRODUCT_BUCKET = 'products';

/**
 * ✅ REMOVED AUTOMATIC BUCKET CREATION
 * Buckets should be created manually in Supabase dashboard with proper RLS policies.
 * This prevents RLS policy errors during runtime.
 */

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

  console.log(`Uploading to Supabase Storage — bucket: ${bucket}, path: ${storagePath}`);

  // ✅ FIXED: Upload with upsert and better error handling
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600'
    });

  if (error) {
    // ✅ ENHANCED: Better error messages
    console.error(`❌ Supabase upload error (bucket: ${bucket}, path: ${storagePath}):`, error);
    
    // Check for common errors
    if (error.message.includes('row-level security')) {
      throw new Error(
        `Supabase Storage RLS policy error. ` +
        `Please ensure bucket '${bucket}' exists and has proper RLS policies configured. ` +
        `See SUPABASE_SETUP_GUIDE.md for setup instructions. ` +
        `Error: ${error.message}`
      );
    }
    
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      throw new Error(
        `Supabase Storage bucket '${bucket}' does not exist. ` +
        `Please create it manually in your Supabase dashboard. ` +
        `Error: ${error.message}`
      );
    }
    
    throw new Error(`Supabase Storage upload failed (bucket: ${bucket}): ${error.message}`);
  }

  // ✅ FIXED: Get public URL
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  
  if (!urlData || !urlData.publicUrl) {
    throw new Error(`Failed to get public URL for uploaded file: ${storagePath}`);
  }
  
  console.log(`✅ Upload successful — public URL: ${urlData.publicUrl}`);
  return urlData.publicUrl;
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

    console.log(`Deleting from Supabase Storage — bucket: ${bucket}, path: ${storagePath}`);
    
    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.error(`❌ Supabase Storage delete error (bucket: ${bucket}):`, error.message);
    } else {
      console.log(`✅ Delete successful — bucket: ${bucket}, path: ${storagePath}`);
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
