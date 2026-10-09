'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Paperclip, Send, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { FileCard, LinkCard } from './Attachments';
import { firstUrl, isImage, type Attachment, type LinkPreview } from './types';
import { EmojiPicker } from '@/components/post/EmojiPicker';
import { GifPicker } from './GifPicker';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const DOC_ACCEPT = 'application/pdf,.doc,.docx';
const MAX_ATTACHMENTS = 10;

interface Props {
  disabled?: boolean;
  onSend: (payload: {
    body: string;
    attachments: Attachment[];
    linkPreview: LinkPreview | null;
  }) => Promise<void>;
}

export function Composer({ disabled, onSend }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dismissedUrls, setDismissedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const imageInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Insert emoji at caret position
  function insertEmoji(emoji: string) {
    const el = textarea.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setText(next);
    // Restore caret after emoji
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  // Auto-grow the textarea up to a cap, then scroll internally.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  // Debounced og-tag scrape for the first URL in the draft.
  useEffect(() => {
    const url = firstUrl(text);
    if (!url || dismissedUrls.includes(url)) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    if (preview?.url === url) return;

    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.getLinkPreview(url);
        setPreview(data);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
    // `preview` is intentionally excluded — including it re-fires on every result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dismissedUrls]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const token = localStorage.getItem('tvp_token');
    if (!token) return;

    const room = MAX_ATTACHMENTS - attachments.length;
    const batch = Array.from(files).slice(0, room);
    if (batch.length < files.length) {
      setError(`Tối đa ${MAX_ATTACHMENTS} tệp mỗi tin nhắn.`);
    }

    setUploading((n) => n + batch.length);
    await Promise.all(
      batch.map(async (file) => {
        try {
          const res = await api.uploadFile(file, token);
          setAttachments((prev) => [
            ...prev,
            { url: res.url, name: res.name ?? file.name, size: res.size ?? file.size, mimeType: res.mimeType ?? file.type },
          ]);
        } catch (e) {
          setError(e instanceof Error ? e.message : `Không tải được ${file.name}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  const busy = sending || uploading > 0;
  const canSend = !busy && !disabled && (text.trim().length > 0 || attachments.length > 0);

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSend({ body: text.trim(), attachments, linkPreview: preview });
      setText('');
      setAttachments([]);
      setPreview(null);
      setDismissedUrls([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gửi tin nhắn thất bại');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface-1 px-3 py-2.5">
      {error && (
        <p className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Đóng" className="cursor-pointer shrink-0">
            <X size={13} />
          </button>
        </p>
      )}

      {/* Link preview card with dismiss */}
      {(previewLoading || preview) && (
        <div className="relative mb-2 max-w-sm">
          {previewLoading && !preview ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
              <Loader2 size={13} className="animate-spin" aria-hidden />
              Đang tải xem trước liên kết…
            </div>
          ) : (
            preview && (
              <>
                <LinkCard preview={preview} mine={false} />
                <button
                  type="button"
                  onClick={() => {
                    setDismissedUrls((prev) => [...prev, preview.url]);
                    setPreview(null);
                  }}
                  aria-label="Bỏ xem trước liên kết"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-bg/80 text-text backdrop-blur transition-colors hover:bg-bg"
                >
                  <X size={13} />
                </button>
              </>
            )
          )}
        </div>
      )}

      {/* Staged attachments */}
      {(attachments.length > 0 || uploading > 0) && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) =>
            isImage(a) ? (
              <li key={a.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => removeAttachment(a.url)}
                  aria-label={`Xoá ${a.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-danger text-white shadow-e1"
                >
                  <X size={11} />
                </button>
              </li>
            ) : (
              <li key={a.url} className="relative max-w-[15rem]">
                <FileCard item={a} mine={false} />
                <button
                  type="button"
                  onClick={() => removeAttachment(a.url)}
                  aria-label={`Xoá ${a.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-danger text-white shadow-e1"
                >
                  <X size={11} />
                </button>
              </li>
            ),
          )}
          {Array.from({ length: uploading }).map((_, i) => (
            <li
              key={`up-${i}`}
              className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-surface-2"
            >
              <Loader2 size={16} className="animate-spin text-text-muted" aria-hidden />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={imageInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={docInput}
          type="file"
          accept={DOC_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
          aria-label="Gửi ảnh"
          title="Gửi ảnh"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-text-muted transition-colors duration-base hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ImagePlus size={19} />
        </button>
        <button
          type="button"
          onClick={() => docInput.current?.click()}
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
          aria-label="Gửi tệp PDF hoặc Word"
          title="Gửi tệp (PDF, Word)"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-text-muted transition-colors duration-base hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Paperclip size={19} />
        </button>
        <GifPicker
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
          onSelect={(att) => setAttachments((prev) => [...prev, att])}
        />

        <div className="flex min-w-0 flex-1 items-end rounded-2xl border border-transparent bg-surface-2 px-3 py-2 transition-colors focus-within:border-ring">
          <textarea
            ref={textarea}
            rows={1}
            value={text}
            disabled={disabled}
            placeholder="Nhập tin nhắn…"
            aria-label="Nội dung tin nhắn"
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length > 0) {
                e.preventDefault();
                void handleFiles(e.clipboardData.files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            maxLength={5000}
            className="field-scroll max-h-[140px] w-full resize-none bg-transparent text-sm leading-relaxed text-text placeholder:text-text-muted focus:outline-none"
          />
          <EmojiPicker
            onSelect={insertEmoji}
            disabled={disabled}
            size="sm"
          />
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Gửi tin nhắn"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-white transition-all duration-base hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}
