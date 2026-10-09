'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmojiPicker } from './EmojiPicker';
import { StickerPicker } from './StickerPicker';
import { GifPicker } from './GifPicker';
import { api, type CommentAttachment, type CreateCommentInput } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { getSticker, STICKER_SIZE } from '@/lib/stickers';
import type { Locale } from '@/lib/i18n';

/**
 * Comment composer (contract part 2 §4.5).
 *
 * Owns its own draft: text plus up to 4 attachments. `onSubmit` resolves `true`
 * when the parent accepted the comment (draft is cleared) and `false` when it did
 * not (draft is PRESERVED — §4.3 restores the text on a failed optimistic create,
 * and losing what the user typed on a flaky network is not acceptable).
 *
 * Nothing here may be wrapped in `overflow-hidden`: the emoji and sticker panels
 * float `absolute bottom-full` and any such ancestor clips them.
 */

const MAX_ATTACHMENTS = 4;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BODY = 5000;

/** One pending attachment. `url` is filled once the upload resolves. */
interface DraftAttachment {
  /** Client-only key. */
  key: string;
  kind: 'image' | 'sticker';
  /** Server-relative `/file/...` path. Null while the image is still uploading. */
  url: string | null;
  /** `URL.createObjectURL` blob, shown until `url` arrives, then revoked. */
  previewUrl?: string;
  stickerId?: string;
  uploading?: boolean;
}

export interface CommentComposerProps {
  /** Resolve `true` to clear the draft, `false` to keep it for a retry. */
  onSubmit: (input: CreateCommentInput) => Promise<boolean>;
  placeholder?: string;
  autoFocus?: boolean;
  locale?: Locale;
  /** When provided, a "Huỷ" button is rendered — reply boxes use this. */
  onCancel?: () => void;
  size?: 'sm' | 'md';
}

let seq = 0;
const nextKey = () => `d${Date.now().toString(36)}_${(seq += 1)}`;

export function CommentComposer({
  onSubmit,
  placeholder,
  autoFocus = false,
  locale = 'vi',
  onCancel,
  size = 'md',
}: CommentComposerProps) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [items, setItems] = useState<DraftAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | null>(null);
  const blobs = useRef<Set<string>>(new Set());

  const vi = locale === 'vi';
  const uploading = items.some((i) => i.uploading);
  const atCap = items.length >= MAX_ATTACHMENTS;
  const hasContent = body.trim().length > 0 || items.length > 0;
  const canSubmit = hasContent && !busy && !uploading;

  // Revoke every outstanding blob url on unmount.
  useEffect(() => {
    const set = blobs.current;
    return () => {
      set.forEach((u) => URL.revokeObjectURL(u));
      set.clear();
    };
  }, []);

  // An upload finished: the <img> now points at the server url, so the blob is
  // free. Drop it in the same pass to avoid leaking one object url per image.
  useEffect(() => {
    if (!items.some((i) => i.previewUrl && i.url)) return;
    for (const i of items) {
      if (i.previewUrl && i.url) {
        URL.revokeObjectURL(i.previewUrl);
        blobs.current.delete(i.previewUrl);
      }
    }
    setItems((prev) => prev.map((i) => (i.previewUrl && i.url ? { ...i, previewUrl: undefined } : i)));
  }, [items]);

  // Restore the caret after an emoji splice so typing continues mid-sentence.
  useEffect(() => {
    const pos = caretRef.current;
    if (pos === null) return;
    caretRef.current = null;
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [body]);

  function insertAtCursor(text: string) {
    const el = textRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? start;
    const next = (body.slice(0, start) + text + body.slice(end)).slice(0, MAX_BODY);
    caretRef.current = Math.min(start + text.length, next.length);
    setBody(next);
  }

  function dropItem(key: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone?.previewUrl) {
        URL.revokeObjectURL(gone.previewUrl);
        blobs.current.delete(gone.previewUrl);
      }
      return prev.filter((i) => i.key !== key);
    });
  }

  function addSticker(stickerId: string) {
    if (atCap) return;
    setNotice(null);
    setItems((prev) =>
      prev.length >= MAX_ATTACHMENTS
        ? prev
        : [...prev, { key: nextKey(), kind: 'sticker', url: null, stickerId }],
    );
  }

  function addGif(url: string) {
    if (atCap) return;
    setNotice(null);
    setItems((prev) =>
      prev.length >= MAX_ATTACHMENTS
        ? prev
        : [...prev, { key: nextKey(), kind: 'image', url }],
    );
  }

  async function handleFiles(list: FileList | null) {
    if (fileRef.current) fileRef.current.value = '';
    if (!list || list.length === 0) return;

    // Read token from localStorage — refreshed by the auth context on every
    // successful API call, so this is always the latest valid access token.
    const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
    if (!token) {
      setNotice(vi ? 'Vui lòng đăng nhập để đính kèm ảnh.' : 'Please log in to attach photos.');
      return;
    }

    const room = MAX_ATTACHMENTS - items.length;
    const picked = Array.from(list).slice(0, Math.max(room, 0));
    if (picked.length === 0) {
      setNotice(vi ? `Tối đa ${MAX_ATTACHMENTS} tệp đính kèm.` : `Up to ${MAX_ATTACHMENTS} attachments.`);
      return;
    }
    setNotice(null);
    if (Array.from(list).length > picked.length) {
      setNotice(vi ? `Chỉ thêm được ${MAX_ATTACHMENTS} tệp đính kèm.` : `Only ${MAX_ATTACHMENTS} attachments allowed.`);
    }

    for (const file of picked) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setNotice(vi ? 'Chỉ hỗ trợ ảnh JPEG, PNG, WEBP hoặc GIF.' : 'Only JPEG, PNG, WEBP or GIF images are supported.');
        continue;
      }
      if (file.size > MAX_BYTES) {
        setNotice(vi ? 'Ảnh vượt quá 25MB. Vui lòng chọn ảnh nhỏ hơn.' : 'That image is over 25MB. Please pick a smaller one.');
        continue;
      }

      const key = nextKey();
      const previewUrl = URL.createObjectURL(file);
      blobs.current.add(previewUrl);
      setItems((prev) => [...prev, { key, kind: 'image', url: null, previewUrl, uploading: true }]);

      try {
        const { url } = await api.uploadFile(file, token);
        setItems((prev) => prev.map((i) => (i.key === key ? { ...i, url, uploading: false } : i)));
      } catch (e) {
        // A url-less image attachment would 422; drop it instead of sending it.
        dropItem(key);
        setNotice(
          (e as Error).message || (vi ? 'Tải ảnh lên thất bại.' : 'Upload failed.'),
        );
      }
    }
  }

  async function submit() {
    if (!canSubmit) return;
    const attachments: CommentAttachment[] = items
      .filter((i) => (i.kind === 'sticker' ? !!i.stickerId : !!i.url))
      .map((i) =>
        i.kind === 'sticker'
          ? { kind: 'sticker', stickerId: i.stickerId }
          : { kind: 'image', url: i.url as string },
      );
    const trimmed = body.trim().slice(0, MAX_BODY);
    if (!trimmed && attachments.length === 0) return;

    setBusy(true);
    setNotice(null);
    try {
      const ok = await onSubmit({
        ...(trimmed ? { body: trimmed } : {}),
        ...(attachments.length ? { attachments } : {}),
      });
      if (ok) {
        setBody('');
        for (const i of items) {
          if (i.previewUrl) {
            URL.revokeObjectURL(i.previewUrl);
            blobs.current.delete(i.previewUrl);
          }
        }
        setItems([]);
      } else {
        setNotice(vi ? 'Không gửi được bình luận. Vui lòng thử lại.' : 'Could not post the comment. Please try again.');
      }
    } catch (e) {
      setNotice((e as Error).message || (vi ? 'Không gửi được bình luận.' : 'Could not post the comment.'));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter newlines. Never submit mid-IME composition — Vietnamese telex
    // input fires Enter to accept a candidate.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  }

  const avatarSize = size === 'sm' ? 28 : 34;
  const pickerSize = size === 'sm' ? 'sm' : 'md';
  const iconBtn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconPx = size === 'sm' ? 16 : 18;

  return (
    <div className="flex gap-2">
      <Avatar
        name={user?.displayName ?? (vi ? 'Bạn' : 'You')}
        src={user?.avatarUrl}
        size={avatarSize}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <Textarea
          ref={textRef}
          rows={1}
          autoFocus={autoFocus}
          value={body}
          maxLength={MAX_BODY}
          placeholder={placeholder ?? (vi ? 'Viết bình luận…' : 'Write a comment…')}
          aria-label={vi ? 'Nội dung bình luận' : 'Comment body'}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'min-h-0 rounded-2xl bg-surface-2 py-2',
            size === 'sm' ? 'text-sm' : 'text-[15px]',
          )}
        />

        {items.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {items.map((i) => {
              const sticker = i.kind === 'sticker' ? getSticker(i.stickerId) : null;
              return (
                <li
                  key={i.key}
                  className="relative rounded-xl border border-border bg-surface-2"
                  style={{ width: STICKER_SIZE, height: STICKER_SIZE }}
                >
                  {sticker ? (
                    <span
                      className="flex h-full w-full items-center justify-center text-4xl leading-none"
                      role="img"
                      aria-label={sticker.label}
                    >
                      {sticker.glyph}
                    </span>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={i.url ?? i.previewUrl ?? ''}
                        alt=""
                        className="h-full w-full rounded-xl object-cover"
                      />
                      {i.uploading && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45">
                          <Loader2 size={18} className="animate-spin text-white" aria-hidden />
                          <span className="sr-only">{vi ? 'Đang tải lên' : 'Uploading'}</span>
                        </span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => dropItem(i.key)}
                    aria-label={
                      sticker
                        ? vi
                          ? 'Bỏ nhãn dán'
                          : 'Remove sticker'
                        : vi
                          ? 'Bỏ ảnh'
                          : 'Remove photo'
                    }
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-0.5 text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {notice && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {notice}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            aria-label={vi ? 'Thêm ảnh' : 'Add photo'}
            title={vi ? 'Thêm ảnh' : 'Add photo'}
            onClick={() => fileRef.current?.click()}
            disabled={atCap || uploading || busy}
            className={cn(
              'inline-flex items-center justify-center rounded-lg text-text-muted transition-colors',
              'hover:bg-surface-2 hover:text-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-40',
              iconBtn,
            )}
          >
            {uploading ? (
              <Loader2 size={iconPx} className="animate-spin" aria-hidden />
            ) : (
              <ImagePlus size={iconPx} aria-hidden />
            )}
          </button>

          <EmojiPicker
            onSelect={insertAtCursor}
            disabled={busy}
            locale={locale}
            size={pickerSize}
          />
          <StickerPicker
            onSelect={addSticker}
            disabled={atCap || busy}
            locale={locale}
            size={pickerSize}
          />
          <GifPicker
            onSelect={addGif}
            disabled={atCap || busy}
            locale={locale}
            size={pickerSize}
          />

          <div className="ml-auto flex items-center gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
                {vi ? 'Huỷ' : 'Cancel'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={!canSubmit}
              loading={busy}
            >
              {!busy && <Send size={14} aria-hidden />}
              {vi ? 'Gửi' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
