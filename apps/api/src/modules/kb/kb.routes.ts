import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate, requirePermission } from '../auth/middleware.js';
import { uploadFile } from '../../lib/storage.js';
import * as svc from './kb.service.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['text/plain', 'text/markdown', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const publishSchema = z.object({ published: z.boolean() });

router.get(
  '/documents',
  authenticate(),
  requirePermission('admin:access'),
  asyncHandler(async (_req, res) => {
    res.json({ items: await svc.listDocuments() });
  }),
);

router.post(
  '/documents',
  authenticate(),
  requirePermission('admin:access'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ code: 'no_file', message: 'No file uploaded or unsupported type.' });
      return;
    }
    const title = (req.body.title as string) || req.file.originalname;
    const lang = (req.body.lang as 'vi' | 'en') || 'vi';
    const ext = path.extname(req.file.originalname).toLowerCase() || '.txt';
    const key = `kb/${req.user!.id}/${crypto.randomUUID()}${ext}`;
    const fileUrl = await uploadFile(key, req.file.buffer, req.file.mimetype);
    const result = await svc.createDocument({ title, fileUrl, mimeType: req.file.mimetype, lang });
    res.status(201).json(result);
  }),
);

router.post(
  '/documents/:id/process',
  authenticate(),
  requirePermission('admin:access'),
  asyncHandler(async (req, res) => {
    res.json(await svc.processDocument(String(req.params.id)));
  }),
);

router.delete(
  '/documents/:id',
  authenticate(),
  requirePermission('admin:access'),
  asyncHandler(async (req, res) => {
    await svc.deleteDocument(String(req.params.id));
    res.status(204).end();
  }),
);

router.patch(
  '/documents/:id',
  authenticate(),
  requirePermission('admin:access'),
  validateBody(publishSchema),
  asyncHandler(async (req, res) => {
    await svc.setPublished(String(req.params.id), req.body.published);
    res.json({ ok: true });
  }),
);

export default router;