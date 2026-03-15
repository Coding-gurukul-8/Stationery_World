const express = require('express');
const multer = require('multer');
const { uploadToCloudinary } = require('../../utils/cloudinary');

const router = express.Router();

// Use memory storage — files are uploaded directly to Cloudinary, not local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit per file
});

// POST /api/uploads - expects 'images' as the form field (multiple files allowed)
router.post('/', upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploads = await Promise.all(
      req.files.map(file => uploadToCloudinary(file.buffer, 'stationery_world/uploads'))
    );
    const urls = uploads.map(u => u.url);

    return res.status(201).json({ success: true, message: 'Files uploaded successfully', urls });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

module.exports = router;
