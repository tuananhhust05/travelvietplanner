import { useCallback, useEffect, useState } from 'react';

export interface Certification {
  name: string;
  issuer?: string;
  code?: string;
  issuedAt?: string;
  expiresAt?: string;
  fileUrl?: string;
  fileMime?: string;
}

/**
 * Certifications used to be bare strings. Both shapes coexist in the database and on
 * the wire — a client running an older bundle keeps sending strings — so every read
 * path funnels through here rather than assuming the newer shape.
 */
export function normalizeCertification(raw: string | Certification): Certification {
  return typeof raw === 'string' ? { name: raw } : raw;
}

export interface Profile {
  type: 'traveler' | 'agency' | 'business' | 'guide';
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  profileCompleteness: number;
  createdAt: string;
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

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;       // from active profile (flattened for convenience)
  handle: string | null;
  activeProfileType: 'traveler' | 'agency' | 'business' | 'guide';
  profiles: Profile[];
  roles: string[];
  avatarUrl?: string;        // from active profile
  bio?: string;              // from active profile
  profileCompleteness?: number; // from active profile
  locale: 'vi' | 'en';
}

const STORAGE_KEY_TOKEN = 'tvp_token';
const STORAGE_KEY_REFRESH = 'tvp_refresh';
const STORAGE_KEY_USER = 'tvp_user';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    if (!refreshToken) return null;

    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) return null;

    localStorage.setItem(STORAGE_KEY_TOKEN, data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken);
    }
    document.cookie = `tvp_token=${data.accessToken}; path=/; max-age=86400; SameSite=Lax`;
    return data.accessToken;
  } catch {
    return null;
  }
}

async function fetchMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/v1/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Try to refresh the access token before giving up
      const newToken = await refreshAccessToken();
      if (!newToken) {
        clearAuthStorage();
        return null;
      }
      // Retry with new token
      const retryRes = await fetch(`${API_URL}/v1/auth/me`, {
        headers: { authorization: `Bearer ${newToken}` },
      });
      if (!retryRes.ok) {
        clearAuthStorage();
        return null;
      }
      const retryData = await retryRes.json();
      const raw = retryData?.user;
      if (!raw) return null;
      return mapUser(raw);
    }

    if (!res.ok) return null;

    const data = await res.json();
    const raw = data?.user;
    if (!raw) return null;

    return mapUser(raw);
  } catch {
    return null;
  }
}

function mapUser(raw: Record<string, unknown>): AuthUser {
  const activeType = (raw.activeProfileType ?? raw.accountType ?? 'traveler') as AuthUser['activeProfileType'];
  const profiles = Array.isArray(raw.profiles) ? raw.profiles as Profile[] : [];
  const activeProfile = profiles.find(p => p.type === activeType) ?? profiles[0];

  return {
    id: (raw._id ?? raw.id) as string,
    email: raw.email as string,
    displayName: (activeProfile?.displayName ?? raw.displayName) as string,
    handle: (raw.handle as string | null) ?? null,
    activeProfileType: activeType,
    profiles,
    roles: Array.isArray(raw.roles) ? raw.roles as string[] : [],
    avatarUrl: (activeProfile?.avatarUrl ?? raw.avatarUrl) as string | undefined,
    bio: (activeProfile?.bio ?? raw.bio) as string | undefined,
    profileCompleteness: activeProfile?.profileCompleteness ?? raw.profileCompleteness as number | undefined,
    locale: ((raw.locale as AuthUser['locale']) ?? 'vi'),
  };
}

function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    // Migrate stale /uploads/ URLs — clear cache so fresh fetch replaces them
    if (user.avatarUrl && /\/uploads\//.test(user.avatarUrl)) {
      localStorage.removeItem(STORAGE_KEY_USER);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_REFRESH);
  localStorage.removeItem(STORAGE_KEY_USER);
  document.cookie = 'tvp_token=; path=/; max-age=0';
}

export async function apiSwitchProfile(profileType: 'traveler' | 'agency' | 'business' | 'guide'): Promise<AuthUser> {
  const token = localStorage.getItem('tvp_token');
  if (!token) throw new Error('not_authenticated');

  const res = await fetch(`${API_URL}/v1/auth/switch-profile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ profileType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).code ?? 'switch_failed');
  }

  const data = await res.json();
  if (data.accessToken) {
    localStorage.setItem('tvp_token', data.accessToken);
    document.cookie = `tvp_token=${data.accessToken}; path=/; max-age=86400; SameSite=Lax`;
  }
  if (data.refreshToken) localStorage.setItem('tvp_refresh', data.refreshToken);

  const user = mapUser(data.user);
  localStorage.setItem('tvp_user', JSON.stringify(user));
  return user;
}

/** @deprecated Use apiSwitchProfile instead */
export async function apiSwitchAccountType(newType: 'traveler' | 'agency' | 'business' | 'guide'): Promise<AuthUser> {
  return apiSwitchProfile(newType);
}

export async function apiAddProfile(
  profileType: 'traveler' | 'agency' | 'business' | 'guide',
  displayName: string
): Promise<AuthUser> {
  const token = localStorage.getItem('tvp_token');
  if (!token) throw new Error('not_authenticated');

  const res = await fetch(`${API_URL}/v1/auth/add-profile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ profileType, displayName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).code ?? 'add_profile_failed');
  }

  const data = await res.json();
  const user = mapUser(data.user);
  localStorage.setItem('tvp_user', JSON.stringify(user));
  return user;
}

export function useAuth() {
  // Initial state is IDENTICAL on server and client (null / true) so the first
  // render matches and React does not tear the tree down on hydration. Reading
  // localStorage here would render the logged-in shell on the client but the
  // logged-out shell on the server — a hydration mismatch on every AppShell page.
  // The effect below populates state right after mount, so the only cost is a
  // one-frame logged-out shell before the cached user is applied.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const cached = getCachedUser();
    if (cached) {
      // Apply the cached user immediately so the shell flips to logged-in, then
      // refresh in the background. Don't clear user if the refresh fails (network
      // issues, etc.).
      setUser(cached);
      setLoading(false);
      fetchMe(token).then((fresh) => {
        if (fresh) {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fresh));
          setUser(fresh);
        }
        // If fresh is null due to network error, keep cached user — don't log out
      });
    } else {
      // No cache: must fetch before we can show anything
      fetchMe(token).then((fresh) => {
        if (fresh) {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fresh));
          setUser(fresh);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    }
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    clearAuthStorage();
    setUser(null);
    // Fire-and-forget logout on backend to invalidate refresh token
    if (refreshToken) {
      fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    window.location.href = '/';
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) return;
    const fresh = await fetchMe(token);
    if (fresh) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fresh));
      setUser(fresh);
    } else {
      setUser(null);
    }
  }, []);

  const switchProfile = useCallback(async (profileType: 'traveler' | 'agency' | 'business' | 'guide') => {
    const fresh = await apiSwitchProfile(profileType);
    setUser(fresh);
    return fresh;
  }, []);

  /** @deprecated Use switchProfile instead */
  const switchAccountType = useCallback(async (newType: 'traveler' | 'agency' | 'business' | 'guide') => {
    return switchProfile(newType);
  }, [switchProfile]);

  const addProfile = useCallback(async (profileType: 'traveler' | 'agency' | 'business' | 'guide', displayName: string) => {
    const fresh = await apiAddProfile(profileType, displayName);
    setUser(fresh);
    return fresh;
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    loading,
    logout,
    refreshUser,
    switchProfile,
    addProfile,
    switchAccountType, // deprecated, kept for backward compat
  };
}
