export type MessageType = 'text' | 'image' | 'file' | 'link';

export interface Attachment {
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string | null;
}

export interface Participant {
  _id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accountType?: string;
}

export interface Conversation {
  _id: string;
  participantIds: string[];
  participants?: Participant[];
  lastMessage?: string | null;
  lastMessageAt?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type?: MessageType;
  attachments?: Attachment[];
  linkPreview?: LinkPreview | null;
  seq: number;
  createdAt: string;
  /** Client-only: set while an optimistic message is still in flight. */
  pending?: boolean;
}

/** Matches bare and protocol-prefixed URLs so the composer can offer a preview. */
export const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

export function firstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m || m.length === 0) return null;
  const raw = m[0].replace(/[.,;:!?)\]]+$/, '');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function isImage(a: Attachment): boolean {
  return (a.mimeType ?? '').startsWith('image/');
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Clock time only — used inside bubbles where the date is already established. */
export function formatClock(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Relative label for the conversation list: time today, "Hôm qua", else date. */
export function formatListStamp(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const dayMs = 86_400_000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (d.getTime() >= startOfToday) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    if (d.getTime() >= startOfToday - dayMs) return 'Hôm qua';
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
}

/** Full-day separator label shown between messages from different days. */
export function formatDaySeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return 'Hôm nay';
  if (d.getTime() >= startOfToday - 86_400_000) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Absolute URL for uploads so <img> works regardless of the API base path. */
export function resolveMediaUrl(url: string): string {
  return url;
}
