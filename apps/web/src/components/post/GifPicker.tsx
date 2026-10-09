'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';

/**
 * GIF picker powered by Giphy API.
 *
 * Shows trending GIFs on open, then debounced search as the user types.
 * `onSelect` receives the original-resolution URL; the caller is responsible
 * for embedding it as a media attachment.
 *
 * Dismissal mirrors StickerPicker — document-level `pointerdown` + Escape.
 * The panel floats `absolute bottom-full`, so no ancestor may be
 * `overflow-hidden`.
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
    original: GiphyImage;
  };
}

interface GiphyResponse {
  data: GiphyGif[];
}

export interface GifPickerProps {
  /** Called with the GIF's original-resolution URL. */
  onSelect: (url: string) => void;
  disabled?: boolean;
  locale?: Locale;
  size?: 'sm' | 'md';
}

export function GifPicker({
  onSelect,
  disabled = false,
  locale = 'vi',
  size = 'md',
}: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = locale === 'vi' ? 'Chèn GIF' : 'Insert GIF';

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Outside-click dismissal (same pattern as StickerPicker).
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open, close]);

  // Reset state when the panel closes so it opens fresh next time.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setGifs([]);
      setLoading(false);
      setFetchError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [open]);

  // Fetch trending on open; debounced search on query change.
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();

    if (!trimmed) {
      // Trending — no debounce needed.
      setLoading(true);
      setFetchError(null);
      setGifs([]);
      fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=g`,
      )
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<GiphyResponse>;
        })
        .then((data) => setGifs(data.data ?? []))
        .catch((e: unknown) => {
          setGifs([]);
          setFetchError((e as Error).message ?? 'Lỗi tải GIF');
        })
        .finally(() => setLoading(false));
      return;
    }

    // Debounce search by 400 ms.
    setLoading(true);
    setFetchError(null);
    setGifs([]);
    debounceRef.current = setTimeout(() => {
      fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(trimmed)}&limit=20&rating=g`,
      )
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<GiphyResponse>;
        })
        .then((data) => setGifs(data.data ?? []))
        .catch((e: unknown) => {
          setGifs([]);
          setFetchError((e as Error).message ?? 'Lỗi tải GIF');
        })
        .finally(() => setLoading(false));
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query]);

  const btn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'sm' ? 16 : 18;
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
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close(true);
            }
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
            className="mt-2 grid grid-cols-2 gap-1 max-h-[240px] overflow-y-auto"
          >
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-24 animate-pulse rounded-lg bg-surface-3"
                />
              ))
            ) : fetchError ? (
              <p className="col-span-2 py-6 text-center text-sm text-danger">
                {fetchError}
              </p>
            ) : gifs.length === 0 ? (
              <p className="col-span-2 py-6 text-center text-sm text-text-muted">
                {emptyText}
              </p>
            ) : (
              gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  aria-label={gif.title || 'GIF'}
                  title={gif.title || undefined}
                  onClick={() => {
                    onSelect(gif.images.original.url);
                    close(false);
                  }}
                  className={cn(
                    'overflow-hidden rounded-lg',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    loading="lazy"
                    className="h-24 w-full cursor-pointer object-cover transition-opacity hover:opacity-80"
                  />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            close(true);
          }
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-text-muted transition-colors',
          'hover:bg-surface-2 hover:text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-40',
          btn,
          open && 'bg-surface-2 text-text',
        )}
      >
        <Film size={icon} aria-hidden />
      </button>
    </div>
  );
}
