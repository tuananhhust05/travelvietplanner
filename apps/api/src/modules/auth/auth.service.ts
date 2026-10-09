import argon2 from 'argon2';
import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import {
  signAccessToken,
  newRefreshToken,
  hashRefreshToken,
} from './jwt.js';
import { config } from '../../config.js';

export type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

export interface Certification {
  name: string;
  issuer?: string;
  code?: string;
  issuedAt?: string;
  expiresAt?: string;
  fileUrl?: string;
  fileMime?: string;
}

export interface Profile {
  type: AccountType;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  profileCompleteness: number;
  createdAt: Date;
  // traveler
  interests?: string[];
  travelStyle?: 'budget' | 'balanced' | 'luxury';
  // agency/business
  orgName?: string;
  website?: string;
  phone?: string;
  address?: string;
  description?: string;
  // guide
  languages?: string[];
  specialties?: string[];
  certifications?: (string | Certification)[];
  experience?: string;
  ratesPerDay?: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  locale?: 'vi' | 'en';
  accountType?: AccountType;
}

export interface UpdateProfileInput {
  // Common fields (all account types)
  displayName?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  locale?: 'vi' | 'en';
  // Traveler-specific
  interests?: string[];
  travelStyle?: 'budget' | 'balanced' | 'luxury';
  // Agency / business-specific
  orgName?: string;
  website?: string;
  phone?: string;
  address?: string;
  description?: string;
  // Guide-specific
  languages?: string[];
  specialties?: string[];
  certifications?: (string | Certification)[];
  experience?: string;
  ratesPerDay?: number;
}

/**
 * Coerce the legacy bare-string form into a record and reject any file the caller does
 * not own.
 *
 * Zod can confirm `fileUrl` looks like one of our upload paths but not whose it is. The
 * uploader keys every file as `<userId>/<uuid>`, so the second segment must match the
 * caller — otherwise a guide could point a certificate at another user's uploaded file,
 * which is both a privacy leak and a way to claim someone else's credential.
 */
function normalizeCertifications(
  raw: (string | Certification)[],
  userId: string,
): Certification[] {
  return raw.map((entry) => {
    const cert: Certification = typeof entry === 'string' ? { name: entry } : entry;
    if (cert.fileUrl && cert.fileUrl.split('/')[2] !== userId) {
      throw new ApiError(
        422,
        'invalid_certification_file',
        'Certificate file must be one you uploaded yourself',
      );
    }
    return cert;
  });
}

const ACCOUNT_ROLE: Record<string, string> = {
  traveler: 'traveler',
  agency: 'org.owner',
  business: 'org.owner',
  guide: 'guide',
};

export async function register(input: RegisterInput) {
  const db = getDb();
  const email = input.email.toLowerCase().trim();
  const existing = await db.collection('users').findOne({ email });
  if (existing) throw new ApiError(409, 'email_taken', 'Email already registered');

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const accountType = input.accountType ?? 'traveler';
  const now = new Date();
  const doc = {
    email,
    passwordHash,
    displayName: input.displayName,
    locale: input.locale ?? 'vi',
    accountType,
    roles: [ACCOUNT_ROLE[accountType] ?? 'traveler'],
    status: 'active',
    emailVerified: false,
    mfaEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
  const initialProfile: Profile = {
    type: accountType,
    displayName: input.displayName,
    profileCompleteness: 0,
    createdAt: now,
  };
  const docWithProfiles = {
    ...doc,
    profiles: [initialProfile],
    activeProfileType: accountType,
  };
  const { insertedId } = await db.collection('users').insertOne(docWithProfiles);
  return issueSession(insertedId.toString(), doc.roles);
}

export async function login(email: string, password: string) {
  const db = getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
  if (!user) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password');
  if (user.status !== 'active') throw new ApiError(403, 'account_disabled', 'Account is not active');
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password');
  return issueSession(user._id.toString(), user.roles ?? ['traveler']);
}

export async function refresh(refreshTokenRaw: string) {
  const db = getDb();
  const tokenHash = hashRefreshToken(refreshTokenRaw);
  const record = await db.collection('refreshTokens').findOne({ tokenHash });
  if (!record) throw new ApiError(401, 'invalid_refresh', 'Refresh token not recognized');
  if (record.expiresAt < new Date()) {
    await db.collection('refreshTokens').deleteOne({ _id: record._id });
    throw new ApiError(401, 'expired_refresh', 'Refresh token expired');
  }
  // rotation: invalidate old, issue new
  await db.collection('refreshTokens').deleteOne({ _id: record._id });
  const user = await db.collection('users').findOne({ _id: new ObjectId(record.userId) });
  if (!user) throw new ApiError(401, 'invalid_refresh', 'User no longer exists');
  return issueSession(user._id.toString(), user.roles ?? ['traveler']);
}

export async function logout(refreshTokenRaw: string): Promise<void> {
  const db = getDb();
  await db.collection('refreshTokens').deleteOne({ tokenHash: hashRefreshToken(refreshTokenRaw) });
}

function calculateProfileCompleteness(profile: Partial<Profile>): number {
  const type = profile.type;
  let score = 0;

  if (type === 'traveler') {
    if (profile.displayName) score += 20;
    if (profile.bio) score += 20;
    if (profile.avatarUrl) score += 15;
    if (profile.location) score += 15;
    if (Array.isArray(profile.interests) && profile.interests.length > 0) score += 15;
    if (profile.travelStyle) score += 15;
  } else if (type === 'agency' || type === 'business') {
    if (profile.displayName) score += 15;
    if (profile.bio) score += 15;
    if (profile.avatarUrl) score += 15;
    if (profile.website) score += 15;
    if (profile.phone) score += 15;
    if (profile.address) score += 10;
    if (profile.description) score += 15;
  } else if (type === 'guide') {
    if (profile.displayName) score += 15;
    if (profile.bio) score += 15;
    if (profile.avatarUrl) score += 15;
    if (profile.location) score += 10;
    if (Array.isArray(profile.languages) && profile.languages.length > 0) score += 15;
    if (Array.isArray(profile.specialties) && profile.specialties.length > 0) score += 15;
    if (profile.experience) score += 15;
  }

  return Math.min(100, score);
}

async function migrateToMultiProfile(userDoc: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (Array.isArray(userDoc.profiles) && userDoc.profiles.length > 0) {
    return userDoc;
  }

  const db = getDb();
  const type = (userDoc.accountType as AccountType) ?? 'traveler';
  const profile: Profile = {
    type,
    displayName: (userDoc.displayName as string) ?? '',
    bio: userDoc.bio as string | undefined,
    avatarUrl: userDoc.avatarUrl as string | undefined,
    location: userDoc.location as string | undefined,
    interests: userDoc.interests as string[] | undefined,
    travelStyle: userDoc.travelStyle as Profile['travelStyle'],
    orgName: userDoc.orgName as string | undefined,
    website: userDoc.website as string | undefined,
    phone: userDoc.phone as string | undefined,
    address: userDoc.address as string | undefined,
    description: userDoc.description as string | undefined,
    languages: userDoc.languages as string[] | undefined,
    specialties: userDoc.specialties as string[] | undefined,
    certifications: userDoc.certifications as string[] | undefined,
    experience: userDoc.experience as string | undefined,
    ratesPerDay: userDoc.ratesPerDay as number | undefined,
    profileCompleteness: 0,
    createdAt: (userDoc.createdAt as Date) ?? new Date(),
  };
  profile.profileCompleteness = calculateProfileCompleteness(profile);

  await db.collection('users').updateOne(
    { _id: userDoc._id as ObjectId },
    { $set: { profiles: [profile], activeProfileType: type } },
  );

  return { ...userDoc, profiles: [profile], activeProfileType: type };
}

export async function getMe(userId: string) {
  const db = getDb();
  const user = await db
    .collection('users')
    .findOne({ _id: new ObjectId(userId) });
  if (!user) throw new ApiError(404, 'user_not_found', 'User not found');
  const hasPassword = !!user.passwordHash;
  const { passwordHash: _, ...userWithoutHash } = user;
  return { ...(await migrateToMultiProfile(userWithoutHash as Record<string, unknown>)), hasPassword };
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const db = getDb();

  // Validate and normalise handle if provided
  if (data.handle !== undefined) {
    const handle = data.handle.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
      throw new ApiError(
        422,
        'invalid_handle',
        'Handle must be 3-30 characters and contain only lowercase letters, digits, or underscores',
      );
    }
    const existing = await db
      .collection('users')
      .findOne({ handle, _id: { $ne: new ObjectId(userId) } });
    if (existing) {
      throw new ApiError(409, 'handle_taken', 'This handle is already taken');
    }
    data = { ...data, handle };
  }

  if (data.certifications !== undefined) {
    data = { ...data, certifications: normalizeCertifications(data.certifications, userId) };
  }

  // Fetch current user (migrate to multi-profile if needed)
  let currentUser = await db
    .collection('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { passwordHash: 0 } });
  if (!currentUser) throw new ApiError(404, 'user_not_found', 'User not found');
  currentUser = await migrateToMultiProfile(currentUser as Record<string, unknown>) as typeof currentUser;

  const activeProfileType = (currentUser.activeProfileType ?? currentUser.accountType) as AccountType;

  // Profile fields written into the matching profile in profiles[]
  const PROFILE_FIELDS: Array<keyof UpdateProfileInput> = [
    'displayName', 'bio', 'avatarUrl', 'location',
    'interests', 'travelStyle',
    'orgName', 'website', 'phone', 'address', 'description',
    'languages', 'specialties', 'certifications', 'experience', 'ratesPerDay',
  ];
  // Top-level user fields (not stored in profile sub-doc)
  const TOP_LEVEL_FIELDS: Array<keyof UpdateProfileInput> = ['handle', 'locale'];

  const profileUpdate: Record<string, unknown> = {};
  for (const key of PROFILE_FIELDS) {
    if (data[key] !== undefined) {
      profileUpdate[`profiles.$[elem].${key}`] = data[key];
    }
  }

  const topLevelUpdate: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of TOP_LEVEL_FIELDS) {
    if (data[key] !== undefined) {
      topLevelUpdate[key] = data[key];
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { ...profileUpdate, ...topLevelUpdate } },
      { arrayFilters: [{ 'elem.type': activeProfileType }] },
    );
  } else if (Object.keys(topLevelUpdate).length > 1) {
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: topLevelUpdate },
    );
  }

  // Re-fetch and compute completeness for the active profile
  const updated = await db
    .collection('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { passwordHash: 0 } });
  if (!updated) throw new ApiError(404, 'user_not_found', 'User not found');

  const activeProfile = (updated.profiles as Profile[])?.find(p => p.type === activeProfileType);
  if (activeProfile) {
    const completeness = calculateProfileCompleteness(activeProfile);
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'profiles.$[elem].profileCompleteness': completeness } },
      { arrayFilters: [{ 'elem.type': activeProfileType }] },
    );
    // Re-fetch so the returned doc has the updated completeness value
    const final = await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) }, { projection: { passwordHash: 0 } });
    return final ?? updated;
  }

  return updated;
}

export async function switchProfile(userId: string, profileType: AccountType) {
  const db = getDb();
  let user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 0 } },
  );
  if (!user) throw new ApiError(404, 'user_not_found', 'User not found');
  user = await migrateToMultiProfile(user as Record<string, unknown>) as typeof user;

  const profiles = (user.profiles ?? []) as Profile[];
  const target = profiles.find(p => p.type === profileType);
  if (!target) throw new ApiError(400, 'profile_not_found', 'Profile type not found on this account');
  if (user.activeProfileType === profileType) throw new ApiError(400, 'same_profile', 'Already on this profile');

  const newRole = ACCOUNT_ROLE[profileType] ?? 'traveler';
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { activeProfileType: profileType, accountType: profileType, roles: [newRole], updatedAt: new Date() } },
  );

  const updated = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 0 } },
  );
  const session = await issueSession(userId, [newRole]);
  return { user: updated, ...session };
}

/** @deprecated Use switchProfile instead */
export async function switchAccountType(userId: string, newType: AccountType) {
  return switchProfile(userId, newType);
}

export async function addProfile(userId: string, profileType: AccountType, displayName: string) {
  const db = getDb();
  let user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 0 } },
  );
  if (!user) throw new ApiError(404, 'user_not_found', 'User not found');
  user = await migrateToMultiProfile(user as Record<string, unknown>) as typeof user;

  const profiles = (user.profiles ?? []) as Profile[];
  if (profiles.some(p => p.type === profileType)) {
    throw new ApiError(409, 'profile_exists', 'A profile of this type already exists');
  }

  const newProfile: Profile = {
    type: profileType,
    displayName,
    profileCompleteness: 0,
    createdAt: new Date(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $push: { profiles: newProfile } } as any,
  );

  const updated = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 0 } },
  );
  return updated;
}

export async function googleAuth(input: {
  email: string;
  name: string;
  googleId: string;
  avatar?: string;
}) {
  const db = getDb();
  const email = input.email.toLowerCase().trim();
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return { ...(await issueSession(existing._id.toString(), existing.roles ?? ['traveler'])), isNew: false };
  }
  const now = new Date();
  const initialProfile: Profile = {
    type: 'traveler',
    displayName: input.name,
    avatarUrl: input.avatar,
    profileCompleteness: 0,
    createdAt: now,
  };
  const doc = {
    email,
    googleId: input.googleId,
    displayName: input.name,
    avatarUrl: input.avatar,
    locale: 'vi' as const,
    accountType: 'traveler' as const,
    activeProfileType: 'traveler' as const,
    profiles: [initialProfile],
    roles: ['traveler'],
    status: 'active',
    emailVerified: true,
    mfaEnabled: false,
    needsOnboarding: true,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await db.collection('users').insertOne(doc);
  return { ...(await issueSession(insertedId.toString(), doc.roles)), isNew: true };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) {
    const err = new Error('User not found') as Error & { code: string };
    err.code = 'not_found';
    throw err;
  }
  // Google-only accounts have no passwordHash — allow setting one directly
  if (user.passwordHash) {
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) {
      const err = new Error('Wrong password') as Error & { code: string };
      err.code = 'wrong_password';
      throw err;
    }
  }
  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await db
    .collection('users')
    .updateOne({ _id: new ObjectId(userId) }, { $set: { passwordHash: newHash, updatedAt: new Date() } });
}

async function issueSession(userId: string, roles: string[]) {
  const db = getDb();
  const accessToken = signAccessToken({ sub: userId, roles });
  const { token: refreshTokenRaw, hash } = newRefreshToken();
  await db.collection('refreshTokens').insertOne({
    userId,
    tokenHash: hash,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + config.jwt.refreshTtl * 1000),
  });
  return { accessToken, refreshToken: refreshTokenRaw, userId, roles };
}
