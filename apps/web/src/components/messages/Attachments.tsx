'use client';

import { Download, FileText, File as FileIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, hostnameOf, isImage, type Attachment, type LinkPreview } from './types';

/** Grid of uploaded images. 1 image fills the bubble, 2+ tile into a square-ish grid. */
export function ImageGrid({
  items,
  onOpen,
}: {
  items: Attachment[];
  onOpen: (url: string) => void;
}) {
  if (items.length === 0) return null;
  const n = items.length;
  const single = n === 1;
  // A 2-column grid leaves a hole on odd counts, which reads as a missing photo.
  // 3-up gets its own column count; larger odd counts let the final tile span the
  // gap, so no bubble ever shows empty space where an image should be.
  const cols = single ? 'grid-cols-1' : n === 3 ? 'grid-cols-3' : 'grid-cols-2';
  const spansLast = n > 3 && n % 2 === 1;
  return (
    <div className={cn('grid gap-1 overflow-hidden rounded-xl', cols)}>
      {items.map((a, i) => (
        <button
          key={a.url}
          type="button"
          onClick={() => onOpen(a.url)}
          className={cn(
            // w-full is what makes aspect-ratio usable: without a definite width
            // the button shrink-to-fits the image's intrinsic size, so anything
            // that fails to decode collapses the box (measured at 62px instead of
            // ~312px) and the whole thread reflows once real bytes arrive.
            'group relative block w-full cursor-pointer overflow-hidden bg-surface-3',
            single ? 'aspect-[4/3] max-h-80' : 'aspect-square',
            // The odd tile out stretches across both columns at 2:1 so its height
            // still matches a square tile's and the row stays flush.
            spansLast && i === n - 1 && 'col-span-2 aspect-[2/1]',
          )}
          aria-label={`Xem ảnh ${a.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.url}
            alt={a.name}
            loading="lazy"
            decoding="async"
            className={cn(
              'h-full w-full transition-transform duration-base group-hover:scale-[1.02]',
              single ? 'object-contain' : 'object-cover',
            )}
          />
        </button>
      ))}
    </div>
  );
}

const PDF_MIME = 'application/pdf';

function fileGlyph(mimeType?: string) {
  if (mimeType === PDF_MIME) return { Icon: FileText, tint: 'text-danger', label: 'PDF' };
  if (mimeType?.includes('word')) return { Icon: FileText, tint: 'text-info', label: 'DOC' };
  return { Icon: FileIcon, tint: 'text-text-muted', label: 'FILE' };
}

/** Document card — click downloads/opens in a new tab. */
export function FileCard({ item, mine }: { item: Attachment; mine: boolean }) {
  const { Icon, tint, label } = fileGlyph(item.mimeType);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      download={item.name}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors duration-base',
        mine
          ? 'border-white/25 bg-white/10 hover:bg-white/20'
          : 'border-border bg-surface-1 hover:bg-surface-3',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          mine ? 'bg-white/20' : 'bg-surface-3',
        )}
      >
        <Icon size={20} className={mine ? 'text-white' : tint} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium', mine ? 'text-white' : 'text-text')}>
          {item.name}
        </span>
        <span className={cn('block text-xs', mine ? 'text-white/70' : 'text-text-muted')}>
          {label}
          {item.size ? ` · ${formatBytes(item.size)}` : ''}
        </span>
      </span>
      <Download
        size={16}
        aria-hidden
        className={cn('shrink-0 opacity-0 transition-opacity group-hover:opacity-100', mine ? 'text-white' : 'text-text-muted')}
      />
    </a>
  );
}

/** Rich link card with og:image when the scrape found one. */
export function LinkCard({ preview, mine }: { preview: LinkPreview; mine: boolean }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block cursor-pointer overflow-hidden rounded-xl border transition-colors duration-base',
        mine
          ? 'border-white/25 bg-white/10 hover:bg-white/20'
          : 'border-border bg-surface-1 hover:bg-surface-3',
      )}
    >
      {preview.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-36 w-full bg-surface-3 object-cover"
        />
      )}
      <span className="block p-2.5">
        <span
          className={cn(
            'mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide',
            mine ? 'text-white/70' : 'text-text-muted',
          )}
        >
          <ExternalLink size={11} aria-hidden />
          {hostnameOf(preview.url)}
        </span>
        <span className={cn('block text-sm font-semibold leading-snug', mine ? 'text-white' : 'text-text')}>
          {preview.title}
        </span>
        {preview.description && (
          <span
            className={cn(
              'mt-0.5 block text-xs leading-snug',
              mine ? 'text-white/70' : 'text-text-muted',
            )}
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {preview.description}
          </span>
        )}
      </span>
    </a>
  );
}

/** Splits attachment lists into images vs documents for separate rendering. */
export function partitionAttachments(items: Attachment[] = []) {
  return {
    images: items.filter(isImage),
    files: items.filter((a) => !isImage(a)),
  };
}
