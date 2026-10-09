import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody, validateQuery } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import * as svc from './messages.service.js';

const router = Router();

// Attachments may only reference paths our own upload endpoint produced. A bare
// string here would let `javascript:` or an off-site URL reach other users' DOM.
const uploadedPath = z
  .string()
  .regex(/^\/file\/[A-Za-z0-9._~-]+\/[A-Za-z0-9._~-]+$/, 'Must be an uploaded file path')
  .refine((v) => !v.includes('..'), 'Invalid path');

const httpUrl = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), 'Must be an http(s) URL');

const attachmentSchema = z.object({
  url: uploadedPath,
  name: z.string().min(1).max(300),
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(120).optional(),
});

const linkPreviewSchema = z.object({
  url: httpUrl,
  title: z.string().min(1).max(200),
  description: z.string().max(300).optional(),
  image: httpUrl.nullable().optional(),
});

const sendSchema = z.object({
  body: z.string().max(5000).default(''),
  type: z.enum(['text', 'image', 'file', 'link']).default('text'),
  attachments: z.array(attachmentSchema).max(10).default([]),
  linkPreview: linkPreviewSchema.nullable().optional(),
});

const createSchema = z.object({
  otherUserId: z.string().min(1),
});

const linkPreviewQuerySchema = z.object({
  url: httpUrl,
});

router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.listConversations(req.user!.id));
  }),
);

router.post(
  '/',
  authenticate(),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createConversation(req.user!.id, req.body.otherUserId));
  }),
);

router.get(
  '/link-preview',
  authenticate(),
  validateQuery(linkPreviewQuerySchema),
  asyncHandler(async (req, res) => {
    const { url } = req.query as { url: string };
    res.json(await svc.getLinkPreview(url));
  }),
);

router.get(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.getConversation(String(req.params.id), req.user!.id));
  }),
);

router.get(
  '/:id/messages',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.listMessages(String(req.params.id), req.user!.id));
  }),
);

router.post(
  '/:id/messages',
  authenticate(),
  validateBody(sendSchema),
  asyncHandler(async (req, res) => {
    const { body, type, attachments, linkPreview } = req.body;
    res
      .status(201)
      .json(
        await svc.sendMessage(String(req.params.id), req.user!.id, body, {
          type,
          attachments,
          linkPreview,
        }),
      );
  }),
);

export default router;