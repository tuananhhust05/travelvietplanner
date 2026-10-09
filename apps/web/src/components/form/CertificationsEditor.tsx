'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle, FileText, ImageOff, Pencil, Plus, ShieldCheck, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { normalizeCertification, type Certification } from '@/lib/auth';

const MAX_ITEMS = 20;
/** The API accepts 25MB, but a phone photo that large is a slow upload over mobile
 *  data and a certificate never needs it — reject early rather than after the wait. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const EXPIRY_WARN_DAYS = 60;

const EMPTY: Certification = { name: '', issuer: '', code: '', issuedAt: '', expiresAt: '' };

/** Local calendar day as YYYY-MM-DD, built field by field to avoid locale surprises. */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Whole days from today to `dateStr`. Both ends are anchored to UTC midnight so the
 * difference is an exact day count — comparing a date-only string against `new Date()`
 * would drift by the local UTC offset and flip a certificate to "expired" a day early.
 */
function daysUntil(dateStr: string): number {
  const target = Date.parse(`${dateStr}T00:00:00Z`);
  const today = Date.parse(`${todayISO()}T00:00:00Z`);
  if (Number.isNaN(target)) return Number.POSITIVE_INFINITY;
  return Math.round((target - today) / 86_400_000);
}

function expiryState(cert: Certification): 'expired' | 'soon' | null {
  if (!cert.expiresAt) return null;
  const days = daysUntil(cert.expiresAt);
  if (days < 0) return 'expired';
  if (days <= EXPIRY_WARN_DAYS) return 'soon';
  return null;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function metaLine(cert: Certification): string {
  const parts: string[] = [];
  if (cert.issuer) parts.push(cert.issuer);
  if (cert.code) parts.push(`Số hiệu ${cert.code}`);
  if (cert.issuedAt) parts.push(`Cấp ${formatDate(cert.issuedAt)}`);
  if (cert.expiresAt) parts.push(`Hết hạn ${formatDate(cert.expiresAt)}`);
  return parts.join(' · ');
}

function Thumb({ cert }: { cert: Certification }) {
  const shell = 'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-1';
  if (!cert.fileUrl) {
    return (
      <div className={cn(shell, 'text-text-muted')} aria-hidden>
        <ImageOff size={20} />
      </div>
    );
  }
  if (cert.fileMime === 'application/pdf') {
    return (
      <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer"
        className={cn(shell, 'text-danger hover:border-primary')} aria-label={`Mở tệp PDF của ${cert.name}`}>
        <FileText size={22} />
      </a>
    );
  }
  return (
    <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer"
      className={cn(shell, 'hover:border-primary')} aria-label={`Xem ảnh chứng chỉ ${cert.name}`}>
      <img src={cert.fileUrl} alt="" className="h-full w-full object-cover" />
    </a>
  );
}

interface Props {
  value: (string | Certification)[];
  onChange: (v: Certification[]) => void;
  onError: (msg: string) => void;
}

export function CertificationsEditor({ value, onChange, onError }: Props) {
  const items = value.map(normalizeCertification);
  // null = the form is closed. -1 = adding. >= 0 = editing that row.
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Certification>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // A file is demanded of new entries only. Entries that predate this editor were
  // stored as bare names, and blocking their row would leave the guide unable to save
  // any other part of the settings form until every old certificate was rephotographed.
  const isNew = editing === -1;
  const requiresFile = isNew;

  function openAdd() {
    if (items.length >= MAX_ITEMS) { onError(`Tối đa ${MAX_ITEMS} chứng chỉ.`); return; }
    setDraft(EMPTY);
    setFieldError('');
    setEditing(-1);
  }

  function openEdit(i: number) {
    setDraft({ ...EMPTY, ...items[i] });
    setFieldError('');
    setEditing(i);
  }

  function close() {
    setEditing(null);
    setDraft(EMPTY);
    setFieldError('');
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
    if (editing === i) close();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFieldError('Tệp vượt quá 10MB. Hãy chụp lại ở chất lượng thấp hơn hoặc nén tệp.');
      return;
    }
    const token = localStorage.getItem('tvp_token');
    if (!token) return;
    setUploading(true);
    setFieldError('');
    try {
      const { url, mimeType } = await api.uploadFile(file, token);
      setDraft((d) => ({ ...d, fileUrl: url, fileMime: mimeType }));
    } catch (err) {
      setFieldError((err as Error).message || 'Tải tệp thất bại, thử lại.');
    } finally {
      setUploading(false);
    }
  }

  function commit() {
    const name = (draft.name ?? '').trim();
    if (!name) { setFieldError('Vui lòng nhập tên chứng chỉ.'); return; }
    if (requiresFile && !draft.fileUrl) { setFieldError('Vui lòng tải lên ảnh hoặc bản scan chứng chỉ.'); return; }
    if (draft.issuedAt && draft.expiresAt && draft.expiresAt < draft.issuedAt) {
      setFieldError('Ngày hết hạn phải sau ngày cấp.'); return;
    }
    // Empty optional fields are dropped rather than stored as "" so the saved record
    // stays clean and `metaLine` does not have to filter blanks back out.
    const next: Certification = { name };
    const issuer = draft.issuer?.trim();
    const code = draft.code?.trim();
    if (issuer) next.issuer = issuer;
    if (code) next.code = code;
    if (draft.issuedAt) next.issuedAt = draft.issuedAt;
    if (draft.expiresAt) next.expiresAt = draft.expiresAt;
    if (draft.fileUrl) next.fileUrl = draft.fileUrl;
    if (draft.fileMime) next.fileMime = draft.fileMime;
    onChange(isNew ? [...items, next] : items.map((c, i) => (i === editing ? next : c)));
    close();
  }

  const dp = (k: keyof Certification) => ({
    value: draft[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value })),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-text">Chứng chỉ hành nghề</p>
        <span className="text-xs text-text-muted">{items.length}/{MAX_ITEMS}</span>
      </div>
      <p className="text-xs text-text-muted">
        Mỗi chứng chỉ cần kèm ảnh hoặc bản scan để khách có cơ sở tin tưởng. Nhận JPG, PNG, WEBP hoặc PDF, tối đa 10MB.
      </p>

      {items.length === 0 && editing === null && (
        <button type="button" onClick={openAdd}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-text-muted transition-colors hover:border-primary/50 hover:text-text">
          <ShieldCheck size={22} />
          <span className="text-sm font-medium">Thêm chứng chỉ đầu tiên</span>
          <span className="text-xs">Chứng chỉ HDV, thẻ hướng dẫn viên, bằng ngoại ngữ…</span>
        </button>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((cert, i) => {
            const exp = expiryState(cert);
            return (
              <li key={`${cert.name}-${i}`} className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
                <Thumb cert={cert} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{cert.name}</p>
                  {metaLine(cert) && <p className="mt-0.5 text-xs text-text-muted">{metaLine(cert)}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {!cert.fileUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        <AlertTriangle size={11} aria-hidden /> Thiếu ảnh chứng chỉ
                      </span>
                    )}
                    {exp === 'expired' && (
                      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">Đã hết hạn</span>
                    )}
                    {exp === 'soon' && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        Sắp hết hạn ({daysUntil(cert.expiresAt!)} ngày)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => openEdit(i)} aria-label={`Sửa ${cert.name}`}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => remove(i)} aria-label={`Xóa ${cert.name}`}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">{isNew ? 'Chứng chỉ mới' : 'Sửa chứng chỉ'}</p>
            <button type="button" onClick={close} aria-label="Đóng"
              className="rounded-lg p-1 text-text-muted hover:text-text"><X size={15} /></button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cert-name" className="text-sm font-medium text-text">Tên chứng chỉ</label>
            <Input id="cert-name" {...dp('name')} maxLength={200} placeholder="Thẻ hướng dẫn viên du lịch quốc tế" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="cert-issuer" className="text-sm font-medium text-text">
                Cơ quan cấp <span className="font-normal text-text-muted">(tuỳ chọn)</span>
              </label>
              <Input id="cert-issuer" {...dp('issuer')} maxLength={120} placeholder="Cục Du lịch Quốc gia Việt Nam" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cert-code" className="text-sm font-medium text-text">
                Số hiệu <span className="font-normal text-text-muted">(tuỳ chọn)</span>
              </label>
              <Input id="cert-code" {...dp('code')} maxLength={80} placeholder="123-456-789" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cert-issued" className="text-sm font-medium text-text">
                Ngày cấp <span className="font-normal text-text-muted">(tuỳ chọn)</span>
              </label>
              <Input id="cert-issued" type="date" max={todayISO()} {...dp('issuedAt')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cert-expires" className="text-sm font-medium text-text">
                Ngày hết hạn <span className="font-normal text-text-muted">(tuỳ chọn)</span>
              </label>
              <Input id="cert-expires" type="date" min={draft.issuedAt || undefined} {...dp('expiresAt')} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text">
              Ảnh / bản scan {requiresFile ? '' : <span className="font-normal text-text-muted">(tuỳ chọn)</span>}
            </p>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFile} />
            {draft.fileUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2">
                <Thumb cert={draft} />
                <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                  {draft.fileMime === 'application/pdf' ? 'Tệp PDF đã tải lên' : 'Ảnh đã tải lên'}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, fileUrl: undefined, fileMime: undefined }))}>
                  Xóa tệp
                </Button>
              </div>
            ) : (
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-primary/50 hover:text-text disabled:opacity-50">
                <Upload size={18} />
                <span className="text-sm font-medium">{uploading ? 'Đang tải lên…' : 'Chọn ảnh hoặc PDF'}</span>
                <span className="text-xs">JPG, PNG, WEBP, PDF · tối đa 10MB</span>
              </button>
            )}
          </div>

          {fieldError && <p className="text-xs text-danger">{fieldError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Hủy</Button>
            <Button type="button" size="sm" onClick={commit} disabled={uploading}>
              {isNew ? 'Thêm chứng chỉ' : 'Cập nhật'}
            </Button>
          </div>
        </div>
      )}

      {editing === null && items.length > 0 && items.length < MAX_ITEMS && (
        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <Plus size={15} /> Thêm chứng chỉ
        </Button>
      )}
    </div>
  );
}
