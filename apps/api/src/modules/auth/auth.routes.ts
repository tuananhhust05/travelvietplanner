import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from './middleware.js';
import { validateAddressString } from '../geo/geo.service.js';
import * as svc from './auth.service.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80),
  locale: z.enum(['vi', 'en']).optional(),
  accountType: z.enum(['traveler', 'agency', 'business', 'guide']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

const googleSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  googleId: z.string().min(1),
  avatar: z.string().url().optional(),
});

router.post(
  '/google',
  validateBody(googleSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.googleAuth(req.body);
    res.json(result);
  }),
);

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const session = await svc.register(req.body);
    res.status(201).json(session);
  }),
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const session = await svc.login(req.body.email, req.body.password);
    res.json(session);
  }),
);

router.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const session = await svc.refresh(req.body.refreshToken);
    res.json(session);
  }),
);

router.post(
  '/logout',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    await svc.logout(req.body.refreshToken);
    res.status(204).end();
  }),
);

/**
 * Certificate scans are served by nginx from /file/, and this is the only URL shape our
 * own uploads produce (see lib/storage.ts). Restricting the value to that shape stops a
 * saved profile from pointing an <img> or a link at an attacker-chosen origin — the
 * field is rendered on a page the guide does not solely control.
 */
const RELATIVE_FILE = /^\/file\/[A-Za-z0-9._~-]+\/[A-Za-z0-9._~-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const certificationSchema = z
  .object({
    name: z.string().min(1).max(200),
    issuer: z.string().max(120).optional(),
    code: z.string().max(80).optional(),
    issuedAt: z.string().regex(ISO_DATE).optional(),
    expiresAt: z.string().regex(ISO_DATE).optional(),
    fileUrl: z.string().regex(RELATIVE_FILE).optional(),
    fileMime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional(),
  })
  .strict();

const updateProfileSchema = z
  .object({
    // Common
    displayName: z.string().min(1).max(80).optional(),
    handle: z.string().min(3).max(30).optional(),
    bio: z.string().max(500).optional(),
    avatarUrl: z.string().url().optional(),
    location: z.string().max(100).optional(),
    locale: z.enum(['vi', 'en']).optional(),
    // Traveler
    interests: z.array(z.string().min(1).max(50)).max(20).optional(),
    travelStyle: z.enum(['budget', 'balanced', 'luxury']).optional(),
    // Agency / business
    orgName: z.string().min(1).max(100).optional(),
    website: z.string().url().optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(200).optional(),
    description: z.string().max(1500).optional(),
    // Guide
    languages: z.array(z.string().min(1).max(50)).max(20).optional(),
    specialties: z.array(z.string().min(1).max(100)).max(20).optional(),
    // Bare strings are the pre-record shape. They stay accepted because a browser
    // running a cached older bundle keeps sending them, and rejecting those would
    // break saves for anyone who had not reloaded after a deploy.
    certifications: z
      .array(z.union([z.string().min(1).max(200), certificationSchema]))
      .max(20)
      .optional(),
    experience: z.string().max(2000).optional(),
    ratesPerDay: z.number().positive().optional(),
  })
  .strict();

router.get(
  '/me',
  authenticate(),
  asyncHandler(async (req, res) => {
    const user = await svc.getMe(req.user!.id);
    if (!user) return res.status(404).json({ code: 'not_found' });
    res.json({ user });
  }),
);

router.patch(
  '/me',
  authenticate(),
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    // These two hold a composed "[street, ]commune, province" string from the
    // address picker. Zod cannot check them (needs a DB round trip), so the
    // boundary lookup happens here before anything is persisted.
    const body = { ...req.body } as Record<string, unknown>;
    if (typeof body.location === 'string') {
      body.location = await validateAddressString(body.location, 'location');
    }
    if (typeof body.address === 'string') {
      body.address = await validateAddressString(body.address, 'address');
    }
    const updated = await svc.updateProfile(req.user!.id, body);
    res.json({ user: updated });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

router.post(
  '/change-password',
  authenticate(),
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    try {
      await svc.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      res.json({ ok: true });
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'wrong_password') {
        return res.status(400).json({ code: 'wrong_password', message: 'Mật khẩu hiện tại không đúng.' });
      }
      throw err;
    }
  }),
);

const switchAccountTypeSchema = z.object({
  accountType: z.enum(['traveler', 'agency', 'business', 'guide']),
});

router.post(
  '/switch-account-type',
  authenticate(),
  validateBody(switchAccountTypeSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.switchAccountType(req.user!.id, req.body.accountType);
    res.json(result);
  }),
);

const switchProfileSchema = z.object({
  profileType: z.enum(['traveler', 'agency', 'business', 'guide']),
});

router.post(
  '/switch-profile',
  authenticate(),
  validateBody(switchProfileSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.switchProfile(req.user!.id, req.body.profileType);
    res.json(result);
  }),
);

const addProfileSchema = z.object({
  profileType: z.enum(['traveler', 'agency', 'business', 'guide']),
  displayName: z.string().min(1).max(80),
});

router.post(
  '/add-profile',
  authenticate(),
  validateBody(addProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await svc.addProfile(req.user!.id, req.body.profileType, req.body.displayName);
    res.json({ user });
  }),
);

export default router;
