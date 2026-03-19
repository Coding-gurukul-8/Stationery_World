const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadToSupabase, PRODUCT_BUCKET } = require('../../utils/uploadToSupabase');

const router = express.Router();

// Multer uses memory storage — no local files are written.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit per file
});

// POST /api/uploads - expects 'images' as the form field (multiple files allowed).
// Accepts an optional 'productId' query parameter to name images after the product.
router.post('/', upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const productId = req.query.productId || null;

    const uploadPromises = req.files.map((file, idx) => {
      let storagePath;
      if (productId) {
        // Consistent index suffix prevents silent overwrites on repeat uploads.
        storagePath = `${productId}/image-${idx}.webp`;
      } else {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        storagePath = `tmp/${unique}.webp`;
      }
      return uploadToSupabase(file.buffer, file.mimetype, storagePath, PRODUCT_BUCKET);
    });

    const urls = await Promise.all(uploadPromises);

    return res.status(201).json({ success: true, message: 'Files uploaded successfully', urls });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

module.exports = router;
