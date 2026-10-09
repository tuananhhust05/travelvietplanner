'use client';

import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import type { AccountType } from '@/components/feed/PostCard';
import { FileCard, ImageGrid, LinkCard, partitionAttachments } from './Attachments';
import { formatClock, URL_RE, type Message, type Participant } from './types';

/** Renders body text with inline links turned into anchors. */
function RichText({ text, mine }: { text: string; mine: boolean }) {
  const parts: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const raw = m[0];
    parts.push({ text: raw, href: raw.startsWith('http') ? raw : `https://${raw}` });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.href ? (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('cursor-pointer underline underline-offset-2', mine ? 'text-white' : 'text-primary')}
          >
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

export interface BubbleProps {
  message: Message;
  mine: boolean;
  /** First message of a consecutive run from the same sender. */
  isGroupStart: boolean;
  /** Last message of a consecutive run — shows avatar + timestamp. */
  isGroupEnd: boolean;
  peer: Participant | null;
  peerName: string;
  onOpenImage: (url: string) => void;
}

export function MessageBubble({
  message,
  mine,
  isGroupStart,
  isGroupEnd,
  peer,
  peerName,
  onOpenImage,
}: BubbleProps) {
  const { images, files } = partitionAttachments(message.attachments);
  const hasText = message.body.trim().length > 0;
  const hasMedia = images.length > 0 || files.length > 0 || !!message.linkPreview;
  // An image-only message drops bubble chrome so the photo reads as the content.
  const bare = images.length > 0 && !hasText && files.length === 0 && !message.linkPreview;

  return (
    <div
      className={cn(
        'group flex items-end gap-2',
        mine ? 'justify-end' : 'justify-start',
        isGroupEnd ? 'mb-2' : 'mb-0.5',
      )}
    >
      {/* Peer avatar rail — reserved even when hidden so bubbles never shift sideways. */}
      {!mine && (
        <span className="w-7 shrink-0 self-end">
          {isGroupEnd && (
            <Avatar
              name={peerName}
              src={peer?.avatarUrl}
              accountType={(peer?.accountType as AccountType) ?? 'traveler'}
              size={28}
            />
          )}
        </span>
      )}

      <div className={cn('flex min-w-0 flex-col', mine ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative min-w-0 max-w-[min(78vw,26rem)] text-sm shadow-e1 transition-colors',
            // Image bubbles need a DEFINITE width, not shrink-to-fit: an aspect-ratio
            // box derives its height from its width, so with no width to resolve
            // against the reserved box collapses to the alt text (measured 62px vs
            // ~312px) and the thread reflows the moment real pixels arrive. File and
            // link cards already have intrinsic heights, so they keep hugging content.
            // max-w-full is load-bearing, not belt-and-braces: a fixed width on a
            // block child cannot shrink like a flex item, so on panes narrower than
            // 78vw (tablet, where the list takes half the shell) the bubble spilled
            // across the conversation list. Clamping to the column keeps the width
            // definite for aspect-ratio while never exceeding the thread.
            images.length > 0 && 'w-[min(78vw,26rem)] max-w-full',
            bare ? 'overflow-hidden rounded-2xl' : 'px-3.5 py-2',
            !bare && (mine ? 'bg-primary text-white' : 'bg-surface-2 text-text'),
            // Squared inner corner marks the speaker's side; group runs keep it tight.
            mine
              ? cn('rounded-2xl', isGroupStart ? 'rounded-tr-2xl' : 'rounded-tr-md', isGroupEnd ? 'rounded-br-md' : 'rounded-br-md')
              : cn('rounded-2xl', isGroupStart ? 'rounded-tl-2xl' : 'rounded-tl-md', isGroupEnd ? 'rounded-bl-md' : 'rounded-bl-md'),
          )}
        >
          {hasMedia && (
            <div className={cn('flex flex-col gap-1.5', !bare && hasText && 'mb-1.5')}>
              {images.length > 0 && <ImageGrid items={images} onOpen={onOpenImage} />}
              {files.map((f) => (
                <FileCard key={f.url} item={f} mine={mine} />
              ))}
              {message.linkPreview && <LinkCard preview={message.linkPreview} mine={mine} />}
            </div>
          )}

          {hasText && <RichText text={message.body} mine={mine} />}
        </div>

        {isGroupEnd && (
          <span
            className={cn(
              'mt-0.5 flex items-center gap-1 px-1 text-[10px] text-text-muted',
              mine ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {formatClock(message.createdAt)}
            {mine &&
              (message.pending ? (
                <Clock size={11} aria-label="Đang gửi" />
              ) : (
                <CheckCheck size={12} aria-label="Đã gửi" className="text-primary" />
              ))}
          </span>
        )}
      </div>
    </div>
  );
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" />
      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Three-dot typing indicator shaped like an incoming bubble. */
export function TypingBubble({ peer, peerName }: { peer: Participant | null; peerName: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="w-7 shrink-0">
        <Avatar
          name={peerName}
          src={peer?.avatarUrl}
          accountType={(peer?.accountType as AccountType) ?? 'traveler'}
          size={28}
        />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
            style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
          />
        ))}
      </div>
    </div>
  );
}

/** Marks whether a message starts/ends a visual group of same-sender messages. */
export function groupFlags(list: Message[], i: number) {
  const cur = list[i];
  const prev = list[i - 1];
  const next = list[i + 1];
  const GROUP_WINDOW_MS = 5 * 60 * 1000;

  const contiguous = (a?: Message, b?: Message) =>
    !!a &&
    !!b &&
    a.senderId === b.senderId &&
    Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_WINDOW_MS;

  return {
    isGroupStart: !contiguous(prev, cur),
    isGroupEnd: !contiguous(cur, next),
  };
}
