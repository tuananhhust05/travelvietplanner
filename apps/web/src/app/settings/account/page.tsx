'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  User, Mail, Lock, MapPin, Globe, Phone, Building2,
  Camera, Plus, X, CheckCircle2, AlertCircle, Eye, EyeOff, Bell,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AddressPicker, addressValueLabel, parseAddressString, type AddressValue } from '@/components/form/AddressPicker';
import { TextareaField } from '@/components/form/TextareaField';
import { CertificationsEditor } from '@/components/form/CertificationsEditor';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import type { Certification } from '@/lib/auth';

// Kept in step with the z.string().max() limits in apps/api auth.routes.ts — a client
// that allows more than the server does turns a long answer into a failed save.
const LIMIT_BIO = 500;
const LIMIT_EXPERIENCE = 2000;
const LIMIT_DESCRIPTION = 1500;
const LIMIT_DISPLAY_NAME = 80;
const LIMIT_HANDLE = 30;
const LIMIT_ORG_NAME = 100;
const LIMIT_PHONE = 30;
// Tightest per-item cap among the array fields in auth.routes.ts (languages: 50).
// StringListInput is generic, so the tightest value is the safe one for any list.
const LIMIT_LIST_ITEM = 50;
// newPassword is min(8).max(128) — auth.routes.ts:164. currentPassword has NO server
// max, so it stays uncapped for the same reason `website` does.
const LIMIT_PASSWORD = 128;
// `address` is max(200) but this field holds only the street fragment; the composed
// value is `street + ", " + adminLabel`. Reserve room for the admin label.
const LIMIT_STREET = 120;

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = 'traveler' | 'agency' | 'business' | 'guide';
type Tab = 'profile' | 'security' | 'notifications';

interface UserData {
  id?: string;
  displayName?: string;
  handle?: string;
  email?: string;
  accountType?: AccountType;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  locale?: string;
  hasPassword?: boolean;
  interests?: string[];
  travelStyle?: string;
  orgName?: string;
  website?: string;
  phone?: string;
  address?: string;
  description?: string;
  languages?: string[];
  specialties?: string[];
  certifications?: (string | Certification)[];
  experience?: string;
  ratesPerDay?: number;
  profileCompleteness?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERESTS_OPTIONS = ['Biển', 'Núi', 'Ẩm thực', 'Văn hóa', 'Phượt', 'Lịch sử', 'Mua sắm'];
const SPECIALTIES_OPTIONS = ['Trekking', 'Ẩm thực', 'Lịch sử', 'Nhiếp ảnh', 'Mạo hiểm', 'Nghỉ dưỡng'];
const TRAVEL_STYLES = [
  { id: 'budget', label: 'Tiết kiệm', desc: 'Đi bụi, khám phá theo ngân sách nhỏ' },
  { id: 'balanced', label: 'Cân bằng', desc: 'Kết hợp trải nghiệm và tiện nghi' },
  { id: 'luxury', label: 'Sang trọng', desc: 'Nghỉ dưỡng cao cấp, dịch vụ trọn gói' },
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  traveler: 'Người du lịch',
  agency: 'Công ty du lịch',
  business: 'Doanh nghiệp',
  guide: 'Hướng dẫn viên',
};

// ─── Completeness calculation ─────────────────────────────────────────────────

function calcCompleteness(u: UserData): { score: number; missing: string[] } {
  const missing: string[] = [];
  const checks: Array<[boolean, string]> = [
    [!!u.displayName, 'Tên hiển thị'],
    [!!u.avatarUrl, 'Ảnh đại diện'],
    [!!u.bio, 'Giới thiệu bản thân'],
    [!!u.location, 'Địa điểm'],
  ];
  if (u.accountType === 'traveler') {
    checks.push([!!(u.interests?.length), 'Sở thích du lịch']);
    checks.push([!!u.travelStyle, 'Phong cách chuyến đi']);
  }
  if (u.accountType === 'agency' || u.accountType === 'business') {
    checks.push([!!u.website, 'Website']);
    checks.push([!!u.phone, 'Số điện thoại']);
  }
  if (u.accountType === 'guide') {
    checks.push([!!(u.languages?.length), 'Ngôn ngữ hướng dẫn']);
    checks.push([!!(u.specialties?.length), 'Chuyên môn']);
  }
  checks.forEach(([ok, label]) => { if (!ok) missing.push(label); });
  const score = Math.round((checks.filter(([ok]) => ok).length / checks.length) * 100);
  return { score, missing };
}

// ─── StringList sub-component ─────────────────────────────────────────────────

function StringListInput({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text">{label}</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          // Per-ITEM server cap, not the whole list: auth.routes.ts:118 is
          // z.array(z.string().max(50)).max(20).
          maxLength={LIMIT_LIST_ITEM}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus size={16} />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-text">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="text-text-muted hover:text-danger">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

function SecurityTab({ showToast, hasPassword }: { showToast: (type: 'success' | 'error', msg: string) => void; hasPassword?: boolean }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isGoogleOnly = hasPassword === false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isGoogleOnly && !currentPw) errs.currentPw = 'Vui lòng nhập mật khẩu hiện tại.';
    if (newPw.length < 8) errs.newPw = 'Mật khẩu mới phải có ít nhất 8 ký tự.';
    if (newPw !== confirmPw) errs.confirmPw = 'Mật khẩu xác nhận không khớp.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    const token = localStorage.getItem('tvp_token');
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/auth/change-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: isGoogleOnly ? '' : currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        showToast('error', body.message ?? 'Đổi mật khẩu thất bại.');
      } else {
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        showToast('success', 'Mật khẩu đã được thiết lập thành công.');
      }
    } catch {
      showToast('error', 'Không thể kết nối, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text flex items-center gap-2">
          <Lock size={15} className="text-text-muted" /> {isGoogleOnly ? 'Thiết lập mật khẩu' : 'Đổi mật khẩu'}
        </h2>

        {isGoogleOnly && (
          <div className="rounded-lg bg-info/10 border border-info/20 px-4 py-3 text-sm text-text-muted">
            Tài khoản của bạn đang đăng nhập qua Google và chưa có mật khẩu. Bạn có thể thiết lập mật khẩu để đăng nhập bằng email.
          </div>
        )}

        {!isGoogleOnly && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Mật khẩu hiện tại</label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                className={cn('pr-10', errors.currentPw && 'border-danger')}
              />
              <button type="button" onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.currentPw && <p className="text-xs text-danger">{errors.currentPw}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text">Mật khẩu mới</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              maxLength={LIMIT_PASSWORD}
              className={cn('pr-10', errors.newPw && 'border-danger')}
            />
            <button type="button" onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.newPw && <p className="text-xs text-danger">{errors.newPw}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text">Xác nhận mật khẩu mới</label>
          <Input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            maxLength={LIMIT_PASSWORD}
            className={cn(errors.confirmPw && 'border-danger')}
          />
          {errors.confirmPw && <p className="text-xs text-danger">{errors.confirmPw}</p>}
        </div>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || (!isGoogleOnly && !currentPw) || !newPw || !confirmPw}>
          {saving ? 'Đang lưu…' : isGoogleOnly ? 'Thiết lập mật khẩu' : 'Đổi mật khẩu'}
        </Button>
      </div>
    </form>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

const NOTIF_KEY = 'tvp_notif_prefs';

interface NotifPrefs {
  newFollowers: boolean;
  newComments: boolean;
  newBookings: boolean;
  marketing: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  newFollowers: true,
  newComments: true,
  newBookings: true,
  marketing: false,
};

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        {desc && <p className="text-xs text-text-muted">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-primary' : 'bg-surface-3',
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )} />
      </button>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) setPrefs(JSON.parse(raw) as NotifPrefs);
    } catch {}
  }, []);

  function upd(k: keyof NotifPrefs, v: boolean) {
    setPrefs((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 divide-y divide-border">
        <h2 className="pb-3 text-sm font-semibold text-text flex items-center gap-2">
          <Bell size={15} className="text-text-muted" /> Thông báo email
        </h2>
        <Toggle checked={prefs.newFollowers} onChange={(v) => upd('newFollowers', v)} label="Người theo dõi mới" desc="Khi ai đó theo dõi bạn" />
        <Toggle checked={prefs.newComments} onChange={(v) => upd('newComments', v)} label="Bình luận mới" desc="Khi có người bình luận bài viết của bạn" />
        <Toggle checked={prefs.newBookings} onChange={(v) => upd('newBookings', v)} label="Yêu cầu đặt tour" desc="Khi có khách đặt dịch vụ của bạn" />
        <Toggle checked={prefs.marketing} onChange={(v) => upd('marketing', v)} label="Tin tức & khuyến mãi" desc="Cập nhật tính năng và ưu đãi từ travelvietplaner" />
      </Card>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-secondary flex items-center gap-1"><CheckCircle2 size={13} />Đã lưu</span>}
        <Button type="button" onClick={save}>Lưu tùy chọn</Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────


/**
 * Split a stored office address back into street + administrative parts.
 *
 * The canonical format written here and by onboarding is "<street>, <commune>,
 * <province>". Addresses saved before the picker existed are arbitrary free text,
 * so when the tail isn't a real province designation the whole value is kept as the
 * street rather than discarded — an unparseable legacy address must survive a save
 * untouched instead of being silently wiped.
 */
function splitStoredAddress(stored?: string): { street: string; value: AddressValue } {
  const parts = (stored ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && /^(Tỉnh|Thành phố)\s/.test(parts[parts.length - 1])) {
    return {
      street: parts.slice(0, -2).join(', '),
      value: { province: parts[parts.length - 1], commune: parts[parts.length - 2] },
    };
  }
  return { street: stored ?? '', value: { province: '', commune: '' } };
}

function parseUserResponse(raw: unknown): UserData {
  const f = raw as unknown as Record<string, unknown>;
  const activeType = (f.activeProfileType ?? f.accountType) as string | undefined;
  const profiles = f.profiles as Array<Record<string, unknown>> | undefined;
  const activeProfile = profiles?.find((p) => p.type === activeType) ?? profiles?.[0] ?? {};

  // Profile-specific fields come from the active profile (source of truth after updateProfile)
  // Top-level fields may be stale legacy data, so we prefer active profile
  return {
    id: (f._id ?? f.id) as string | undefined,
    displayName: (activeProfile.displayName ?? f.displayName) as string | undefined,
    handle: f.handle as string | undefined,
    email: f.email as string | undefined,
    accountType: activeType as AccountType | undefined,
    avatarUrl: (activeProfile.avatarUrl ?? f.avatarUrl) as string | undefined,
    bio: (activeProfile.bio ?? f.bio) as string | undefined,
    location: (activeProfile.location ?? f.location) as string | undefined,
    locale: f.locale as string | undefined,
    hasPassword: f.hasPassword as boolean | undefined,
    interests: (activeProfile.interests ?? f.interests) as string[] | undefined,
    travelStyle: (activeProfile.travelStyle ?? f.travelStyle) as string | undefined,
    orgName: (activeProfile.orgName ?? f.orgName) as string | undefined,
    website: (activeProfile.website ?? f.website) as string | undefined,
    phone: (activeProfile.phone ?? f.phone) as string | undefined,
    address: (activeProfile.address ?? f.address) as string | undefined,
    description: (activeProfile.description ?? f.description) as string | undefined,
    languages: (activeProfile.languages ?? f.languages) as string[] | undefined,
    specialties: (activeProfile.specialties ?? f.specialties) as string[] | undefined,
    certifications: (activeProfile.certifications ?? f.certifications) as (string | Certification)[] | undefined,
    experience: (activeProfile.experience ?? f.experience) as string | undefined,
    ratesPerDay: (activeProfile.ratesPerDay ?? f.ratesPerDay) as number | undefined,
    profileCompleteness: (activeProfile.profileCompleteness ?? f.profileCompleteness) as number | undefined,
  };
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [user, setUser] = useState<UserData>({});
  const [form, setForm] = useState<UserData>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Office address is stored as one string, but the picker needs the parts kept
  // separately: a province chosen before its commune has no canonical label yet and
  // would be lost if we re-derived the selection from the composed string.
  const [orgAddr, setOrgAddr] = useState<AddressValue>({ province: '', commune: '' });
  const [orgStreet, setOrgStreet] = useState('');
  // A traveler's home area has no street part, so a legacy value that isn't a real
  // commune/province pair has nowhere to live in the UI. It is parked here — still
  // sent on save — and surfaced as a notice instead of being dropped on load.
  const [homeAddr, setHomeAddr] = useState<AddressValue>({ province: '', commune: '' });
  const [legacyLocation, setLegacyLocation] = useState('');

  // Seed the picker from the stored string. Does not mark the form dirty: loading a
  // profile is not an edit, and flagging it would enable Save on a untouched page.
  const hydrateOrgAddress = useCallback((stored?: string) => {
    const { street, value } = splitStoredAddress(stored);
    setOrgStreet(street);
    setOrgAddr(value);
  }, []);

  const hydrateHomeLocation = useCallback((stored?: string) => {
    const { street, province, commune } = parseAddressString(stored ?? '');
    if (province && commune) {
      setHomeAddr({ province, commune });
      setLegacyLocation('');
      return;
    }
    setHomeAddr({ province: '', commune: '' });
    setLegacyLocation(street);
  }, []);

  function applyHomeLocation(next: AddressValue) {
    setHomeAddr(next);
    const composed = addressValueLabel(next);
    if (composed) setLegacyLocation('');
    upd('location', composed);
  }

  // Recompose the single stored string on every picker/street change, keeping
  // form.address the one source of truth so handleSave needs no special case.
  function applyOrgAddress(next: AddressValue, street: string) {
    setOrgAddr(next);
    setOrgStreet(street);
    const composed = [street.trim(), addressValueLabel(next)].filter(Boolean).join(', ');
    upd('address', composed);
  }

  // Load user data from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('tvp_token');
    if (!token) { router.push('/login'); return; }

    const raw = localStorage.getItem('tvp_user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UserData;
        setUser(parsed);
        setForm(parsed);
        hydrateOrgAddress(parsed.address);
        hydrateHomeLocation(parsed.location);
      } catch {}
    }

    // Fetch fresh data from API
    api.getMe(token).then(({ user: fresh }) => {
      const u = parseUserResponse(fresh);
      setUser(u);
      setForm(u);
      hydrateOrgAddress(u.address);
      hydrateHomeLocation(u.location);
      localStorage.setItem('tvp_user', JSON.stringify(u));
    }).catch(() => {});
  }, [router, hydrateOrgAddress, hydrateHomeLocation]);

  function upd<K extends keyof UserData>(k: K, v: UserData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('tvp_token');
    if (!token) return;
    setUploading(true);
    try {
      const { url } = await api.uploadFile(file, token);
      upd('avatarUrl', url);
      await api.updateProfile({ avatarUrl: url }, token);
      await refreshUser();
      showToast('success', 'Đã cập nhật ảnh đại diện.');
    } catch (err) {
      showToast('error', (err as Error).message ?? 'Tải ảnh thất bại.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('tvp_token');
    if (!token) return;
    setSaving(true);
    try {
      const profilePayload: Record<string, unknown> = {};
      const allowedFields = ['displayName', 'handle', 'bio', 'location', 'locale', 'interests', 'travelStyle', 'orgName', 'website', 'phone', 'address', 'description', 'languages', 'specialties', 'certifications', 'experience', 'ratesPerDay'];
      for (const key of allowedFields) {
        const val = (form as Record<string, unknown>)[key];
        if (val !== undefined) profilePayload[key] = val;
      }
      // avatarUrl only if it's a full URL (not relative path)
      if (form.avatarUrl && form.avatarUrl.startsWith('http')) {
        profilePayload.avatarUrl = form.avatarUrl;
      }
      const updated = await api.updateProfile(profilePayload, token) as { user: UserData };
      const parsedUser = parseUserResponse(updated.user ?? updated);
      setUser(parsedUser);
      setForm(parsedUser);
      localStorage.setItem('tvp_user', JSON.stringify(parsedUser));
      setDirty(false);
      showToast('success', 'Đã lưu thay đổi thành công.');
    } catch (err) {
      showToast('error', (err as Error).message ?? 'Lưu thất bại, thử lại sau.');
    } finally {
      setSaving(false);
    }
  }

  const { score, missing } = calcCompleteness(form);
  const accountType = form.accountType ?? 'traveler';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Hồ sơ' },
    { key: 'security', label: 'Bảo mật' },
    { key: 'notifications', label: 'Thông báo' },
  ];

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg transition-all',
          toast.type === 'success' ? 'bg-secondary/10 border border-secondary/30 text-secondary' : 'bg-danger/10 border border-danger/30 text-danger',
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Cài đặt tài khoản</h1>
          <p className="mt-1 text-sm text-text-muted">Quản lý thông tin hồ sơ và tùy chọn tài khoản của bạn.</p>
        </div>

        {/* Column on mobile: the tab bar below is `w-full`, so as a row sibling of the
            content it claimed a full viewport width of its own and pushed the form
            sideways off-screen. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          {/* Sidebar tabs */}
          <nav className="hidden w-48 shrink-0 flex-col gap-1 sm:flex">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors',
                  activeTab === key ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Mobile tab bar */}
          <div className="flex w-full gap-1 rounded-xl border border-border bg-surface-1 p-1 sm:hidden">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-xs font-medium transition-colors',
                  activeTab === key ? 'bg-primary text-primary-fg' : 'text-text-muted hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-4">
            {activeTab === 'profile' && (
              <form onSubmit={handleSave} className="space-y-4">
                {/* Completeness card */}
                {score < 100 && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-text">Độ hoàn thiện hồ sơ</p>
                      <span className="text-sm font-bold text-primary">{score}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${score}%` }} />
                    </div>
                    {missing.length > 0 && (
                      <p className="mt-2 text-xs text-text-muted">
                        Còn thiếu: {missing.join(' · ')}
                      </p>
                    )}
                  </Card>
                )}

                {/* Avatar section */}
                <Card className="p-5">
                  <h2 className="mb-4 text-sm font-semibold text-text">Ảnh đại diện</h2>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {uploading ? (
                        <div className="h-[72px] w-[72px] rounded-full bg-surface-2 animate-pulse flex items-center justify-center">
                          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                      ) : (
                        <Avatar name={form.displayName ?? 'U'} src={form.avatarUrl} accountType={accountType} size={72} />
                      )}
                      <button
                        type="button"
                        aria-label="Thay đổi ảnh"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-fg shadow-md hover:brightness-110 disabled:opacity-50"
                      >
                        <Camera size={13} />
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <div>
                      <p className="text-sm font-medium text-text">{form.displayName || 'Tên của bạn'}</p>
                      <p className="text-xs text-text-muted">{ACCOUNT_TYPE_LABELS[accountType]}</p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? 'Đang tải…' : 'Đổi ảnh'}
                        </Button>
                        {form.avatarUrl && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => upd('avatarUrl', undefined)}>
                            Xóa
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Common fields */}
                <Card className="p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-text">Thông tin cơ bản</h2>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text flex items-center gap-1.5">
                      <User size={14} className="text-text-muted" /> Tên hiển thị
                    </label>
                    <Input value={form.displayName ?? ''} onChange={(e) => upd('displayName', e.target.value)} maxLength={LIMIT_DISPLAY_NAME} placeholder="Nguyễn Minh Anh" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text flex items-center gap-1.5">
                      <User size={14} className="text-text-muted" /> Tên người dùng
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">@</span>
                      <Input value={form.handle ?? ''} onChange={(e) => upd('handle', e.target.value)} maxLength={LIMIT_HANDLE} placeholder="minhanhtravel" className="pl-7" />
                    </div>
                  </div>

                  <TextareaField
                    label="Giới thiệu bản thân"
                    value={form.bio ?? ''}
                    onChange={(v) => upd('bio', v)}
                    maxLength={LIMIT_BIO}
                    placeholder="Chia sẻ đôi điều về bạn và tình yêu du lịch..."
                    hint="Đoạn này xuất hiện ngay dưới tên bạn trên trang cá nhân."
                  />

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text flex items-center gap-1.5">
                      <MapPin size={14} className="text-text-muted" /> Địa điểm
                    </label>
                    <AddressPicker
                      value={homeAddr}
                      onChange={applyHomeLocation}
                      idPrefix="home-loc"
                    />
                    {legacyLocation && (
                      <p className="text-xs text-warning">
                        Địa điểm hiện tại của bạn là “{legacyLocation}” — giá trị này không khớp
                        đơn vị hành chính nào nên chưa hiển thị được ở trên. Chọn tỉnh/thành phố và
                        xã/phường để thay thế.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text flex items-center gap-1.5">
                      <Mail size={14} className="text-text-muted" /> Email
                    </label>
                    <Input value={form.email ?? ''} disabled className="opacity-60 cursor-not-allowed" />
                    <p className="text-xs text-text-muted">Email không thể thay đổi tại đây.</p>
                  </div>
                </Card>

                {/* Traveler-specific */}
                {accountType === 'traveler' && (
                  <Card className="p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-text">Sở thích du lịch</h2>
                    <div>
                      <p className="mb-2 text-sm font-medium text-text">Chủ đề yêu thích</p>
                      <div className="flex flex-wrap gap-2">
                        {INTERESTS_OPTIONS.map((v) => {
                          const on = (form.interests ?? []).includes(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                const cur = form.interests ?? [];
                                upd('interests', on ? cur.filter((x) => x !== v) : [...cur, v]);
                              }}
                              className={cn(
                                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                                on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-text-muted hover:text-text',
                              )}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium text-text">Phong cách chuyến đi</p>
                      <div className="space-y-2">
                        {TRAVEL_STYLES.map((s) => {
                          const on = form.travelStyle === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => upd('travelStyle', s.id)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                                on ? 'border-primary bg-primary/10' : 'border-border bg-surface-1 hover:bg-surface-2',
                              )}
                            >
                              <span className={cn('flex h-4 w-4 shrink-0 rounded-full border', on ? 'border-primary bg-primary' : 'border-border')} />
                              <span>
                                <span className="block text-sm font-medium text-text">{s.label}</span>
                                <span className="block text-xs text-text-muted">{s.desc}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Agency / Business-specific */}
                {(accountType === 'agency' || accountType === 'business') && (
                  <Card className="p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-text">Thông tin doanh nghiệp</h2>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text flex items-center gap-1.5"><Building2 size={14} className="text-text-muted" />Tên đơn vị</label>
                      <Input value={form.orgName ?? ''} onChange={(e) => upd('orgName', e.target.value)} maxLength={LIMIT_ORG_NAME} placeholder="Công ty Du lịch Sông Hồng" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text flex items-center gap-1.5"><Globe size={14} className="text-text-muted" />Website</label>
                      <Input value={form.website ?? ''} onChange={(e) => upd('website', e.target.value)} placeholder="https://example.com" type="url" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text flex items-center gap-1.5"><Phone size={14} className="text-text-muted" />Số điện thoại</label>
                      <Input value={form.phone ?? ''} onChange={(e) => upd('phone', e.target.value)} maxLength={LIMIT_PHONE} placeholder="0912 345 678" type="tel" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-text">Địa chỉ văn phòng</p>
                      <div className="space-y-1.5">
                        <label htmlFor="org-street" className="text-sm font-medium text-text">
                          Số nhà / đường <span className="font-normal text-text-muted">(tuỳ chọn)</span>
                        </label>
                        <Input
                          id="org-street"
                          value={orgStreet}
                          onChange={(e) => applyOrgAddress(orgAddr, e.target.value)}
                          placeholder="Ví dụ: 123 Đường Láng"
                          maxLength={LIMIT_STREET}
                        />
                      </div>
                      <AddressPicker
                        value={orgAddr}
                        onChange={(v) => applyOrgAddress(v, orgStreet)}
                        idPrefix="org-addr"
                      />
                    </div>
                    <TextareaField
                      label="Giới thiệu dịch vụ"
                      value={form.description ?? ''}
                      onChange={(v) => upd('description', v)}
                      maxLength={LIMIT_DESCRIPTION}
                      placeholder="Mô tả dịch vụ và điểm mạnh của đơn vị..."
                    />
                  </Card>
                )}

                {/* Guide-specific */}
                {accountType === 'guide' && (
                  <Card className="p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-text">Thông tin hướng dẫn viên</h2>
                    <StringListInput label="Ngôn ngữ hướng dẫn" value={form.languages ?? []} onChange={(v) => upd('languages', v)} placeholder="Tiếng Anh, 日本語..." />
                    <div>
                      <p className="mb-2 text-sm font-medium text-text">Chuyên môn</p>
                      <div className="flex flex-wrap gap-2">
                        {SPECIALTIES_OPTIONS.map((v) => {
                          const on = (form.specialties ?? []).includes(v);
                          return (
                            <button key={v} type="button"
                              onClick={() => {
                                const cur = form.specialties ?? [];
                                upd('specialties', on ? cur.filter((x) => x !== v) : [...cur, v]);
                              }}
                              className={cn(
                                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                                on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-text-muted hover:text-text',
                              )}>
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <TextareaField
                      label="Kinh nghiệm"
                      value={form.experience ?? ''}
                      onChange={(v) => upd('experience', v)}
                      maxLength={LIMIT_EXPERIENCE}
                      placeholder="Số năm dẫn tour, các tuyến quen thuộc, loại khách bạn từng phục vụ..."
                      hint="Kể cụ thể tuyến và loại khách sẽ thuyết phục hơn là nói chung chung."
                      maxHeight={360}
                    />
                    <div className="space-y-1.5">
                      <label htmlFor="rates-per-day" className="text-sm font-medium text-text">Phí hướng dẫn / ngày (VNĐ)</label>
                      <Input
                        id="rates-per-day"
                        type="number"
                        min={0}
                        value={form.ratesPerDay ?? ''}
                        // An empty box must not become 0: the server rejects a
                        // non-positive rate, which would fail the whole save.
                        onChange={(e) => upd('ratesPerDay', e.target.value === '' ? undefined : Number(e.target.value))}
                        placeholder="500000"
                      />
                    </div>
                    <div className="border-t border-border pt-4">
                      <CertificationsEditor
                        value={form.certifications ?? []}
                        onChange={(v) => upd('certifications', v)}
                        onError={(msg) => showToast('error', msg)}
                      />
                    </div>
                  </Card>
                )}

                {/* Save button */}
                <div className="flex items-center justify-between">
                  <Link href="/feed" className="text-sm text-text-muted hover:text-text">← Quay lại</Link>
                  <Button type="submit" loading={saving} disabled={!dirty || saving}>
                    {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <SecurityTab showToast={showToast} hasPassword={user.hasPassword} />
            )}

            {activeTab === 'notifications' && (
              <NotificationsTab />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
