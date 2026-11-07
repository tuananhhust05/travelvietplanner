import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../auth/middleware.js';
import { uploadFile } from '../../lib/storage.js';

const router = Router();

// The stored extension is what nginx uses to pick a Content-Type, so it comes
// from this map rather than the client's filename — otherwise a request can
// declare `image/jpeg` while naming the file `x.svg` and get a script-bearing
// SVG served inline from our own origin.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter(_req, file, cb) {
    cb(null, Object.hasOwn(ALLOWED_TYPES, file.mimetype));
  },
});

router.post(
  '/',
  authenticate(),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ code: 'no_file', message: 'No file uploaded or unsupported type.' });
      return;
    }
    const ext = ALLOWED_TYPES[req.file.mimetype] ?? '.bin';
    const key = `${req.user!.id}/${crypto.randomUUID()}${ext}`;
    const url = await uploadFile(key, req.file.buffer, req.file.mimetype);
    res.json({
      url,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  }),
);

export default router;
