'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Search } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import type { Locale } from '@/lib/i18n';

/**
 * GIF picker for messages — same UI as post/GifPicker (Giphy, trending + search)
 * but fetches the chosen GIF and uploads it through our own /v1/uploads endpoint
 * so the attachment URL is a /file/... path accepted by the message API.
 */

const GIPHY_KEY = 'BPA4tX7WrM7G2WcJnarKfCUO4PgynE72';

interface GiphyImage {
  url: string;
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: GiphyImage;
    fixed_height_small: GiphyImage;
    original: GiphyImage;
    downsized: GiphyImage;
  };
}

interface GiphyResponse {
  data: GiphyGif[];
}

interface GifPickerProps {
  disabled?: boolean;
  locale?: Locale;
  size?: 'sm' | 'md';
  /** Called once the gif is uploaded — returns an Attachment-ready object */
  onSelect: (attachment: { url: string; name: string; size: number; mimeType: string }) => void;
}

export function GifPicker({
  disabled = false,
  locale = 'vi',
  size = 'md',
  onSelect,
}: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = locale === 'vi' ? 'Chèn GIF' : 'Insert GIF';

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Outside-click dismissal
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open, close]);

  // Reset state when panel closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setGifs([]);
      setLoading(false);
      setFetchError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [open]);

  // Fetch trending on open; debounced search on query change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();

    if (!trimmed) {
      setLoading(true);
      setFetchError(null);
      setGifs([]);
      fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=g`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<GiphyResponse>; })
        .then((data) => setGifs(data.data ?? []))
        .catch((e: unknown) => { setGifs([]); setFetchError((e as Error).message ?? 'Lỗi tải GIF'); })
        .finally(() => setLoading(false));
      return;
    }

    setLoading(true);
    setFetchError(null);
    setGifs([]);
    debounceRef.current = setTimeout(() => {
      fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(trimmed)}&limit=20&rating=g`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<GiphyResponse>; })
        .then((data) => setGifs(data.data ?? []))
        .catch((e: unknown) => { setGifs([]); setFetchError((e as Error).message ?? 'Lỗi tải GIF'); })
        .finally(() => setLoading(false));
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [open, query]);

  async function handleSelect(gif: GiphyGif) {
    const token = localStorage.getItem('tvp_token');
    if (!token) return;

    setUploadingId(gif.id);
    setFetchError(null);
    try {
      // Use downsized (~1MB) to keep upload fast; fall back to original
      const srcUrl = gif.images.downsized?.url ?? gif.images.original.url;
      const blob = await fetch(srcUrl).then((r) => r.blob());
      const file = new File([blob], `${gif.id}.gif`, { type: 'image/gif' });
      const res = await api.uploadFile(file, token);
      onSelect({ url: res.url, name: res.name ?? file.name, size: res.size ?? blob.size, mimeType: 'image/gif' });
      close(false);
    } catch {
      setFetchError('Gửi GIF thất bại. Thử lại.');
    } finally {
      setUploadingId(null);
    }
  }

  const btn = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  const icon = size === 'sm' ? 16 : 19;
  const placeholderText = locale === 'vi' ? 'Tìm GIF…' : 'Search GIFs…';
  const emptyText = locale === 'vi' ? 'Không tìm thấy GIF' : 'No GIFs found';

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {open && (
        <div
          role="dialog"
          aria-label={locale === 'vi' ? 'Bảng GIF' : 'GIF panel'}
          aria-busy={loading}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
          }}
          className={cn(
            'absolute bottom-full left-0 z-50 mb-2 w-[320px] rounded-2xl',
            'border border-border bg-surface-2 p-2 shadow-e3',
          )}
        >
          {/* Search input */}
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholderText}
              aria-label={placeholderText}
              autoComplete="off"
              className={cn(
                'w-full rounded-xl bg-surface-3 py-1.5 pl-7 pr-3 text-sm text-text',
                'placeholder:text-text-muted',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>

          {/* GIF grid */}
          <div
            role="group"
            aria-label={locale === 'vi' ? 'Kết quả GIF' : 'GIF results'}
            className="mt-2 grid max-h-[240px] grid-cols-2 gap-1 overflow-y-auto"
          >
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} aria-hidden className="h-24 animate-pulse rounded-lg bg-surface-3" />
              ))
            ) : fetchError ? (
              <p className="col-span-2 py-6 text-center text-sm text-danger">{fetchError}</p>
            ) : gifs.length === 0 ? (
              <p className="col-span-2 py-6 text-center text-sm text-text-muted">{emptyText}</p>
            ) : (
              gifs.map((gif) => {
                const isUploading = uploadingId === gif.id;
                return (
                  <button
                    key={gif.id}
                    type="button"
                    aria-label={gif.title || 'GIF'}
                    title={gif.title || undefined}
                    disabled={uploadingId !== null}
                    onClick={() => void handleSelect(gif)}
                    className={cn(
                      'relative overflow-hidden rounded-lg',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      uploadingId !== null ? 'opacity-60' : 'hover:opacity-80',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gif.images.fixed_height_small?.url ?? gif.images.fixed_height.url}
                      alt={gif.title}
                      loading="lazy"
                      className="h-24 w-full cursor-pointer object-cover"
                    />
                    {isUploading && (
                      <span className="absolute inset-0 flex items-center justify-center bg-bg/60">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || uploadingId !== null}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) { e.preventDefault(); close(true); }
        }}
        className={cn(
          'flex shrink-0 cursor-pointer items-center justify-center rounded-xl text-text-muted',
          'transition-colors duration-base hover:bg-surface-2 hover:text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-40',
          btn,
          open && 'bg-surface-2 text-text',
        )}
      >
        {uploadingId ? <Loader2 size={icon} className="animate-spin" /> : <Film size={icon} aria-hidden />}
      </button>
    </div>
  );
}
