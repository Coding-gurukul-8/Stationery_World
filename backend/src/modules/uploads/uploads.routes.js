const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadToSupabase } = require('../../utils/uploadToSupabase');

const router = express.Router();

// Multer uses memory storage — no local files are written.
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

    const uploadPromises = req.files.map((file) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const storagePath = `uploads/${unique}${ext}`;
      return uploadToSupabase(file.buffer, file.mimetype, storagePath);
    });

    const urls = await Promise.all(uploadPromises);

    return res.status(201).json({ success: true, message: 'Files uploaded successfully', urls });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

module.exports = router;
