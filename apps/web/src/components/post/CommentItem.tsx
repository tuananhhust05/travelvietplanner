'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CornerDownRight, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { ReactionBar } from '@/components/feed/ReactionBar';
import { ReactionSummary } from '@/components/feed/ReactionSummary';
import { ReactionListModal } from '@/components/feed/ReactionListModal';
import { CommentComposer } from '@/components/post/CommentComposer';
import { getStickerGlyph, STICKER_SIZE } from '@/lib/stickers';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';
import type { CommentAttachment, CommentAuthor } from '@/lib/api';
import type { UseCommentsResult } from '@/hooks/useComments';

/** Contract part 1 §3: logical depth is unbounded, indentation is not. */
const VISUAL_MAX_DEPTH = 3;
const INDENT_PX = 32;

type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

function accountType(v: string | undefined): AccountType | undefined {
  return v === 'traveler' || v === 'agency' || v === 'business' || v === 'guide' ? v : undefined;
}

/** Same shape as the post detail page's helper: handle without `@`, `_id` fallback. */
function profileHref(author: CommentAuthor | null): string {
  const handle = author?.handle?.replace(/^@/, '');
  if (handle && handle !== 'traveler') return `/profile/${handle}`;
  if (author?._id) return `/profile/${author._id}`;
  return '#';
}

function timeAgo(iso: string | undefined, locale: Locale): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor(Math.max(0, Date.now() - then) / 60000);
  if (mins < 1) return locale === 'vi' ? 'Vừa xong' : 'Just now';
  if (mins < 60) return `${mins} ${locale === 'vi' ? 'phút' : 'm'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${locale === 'vi' ? 'giờ' : 'h'}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${locale === 'vi' ? 'ngày' : 'd'}`;
  return new Date(then).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
}

export interface CommentItemProps {
  id: string;
  /** Walk depth from the root list, not `node.depth` — they agree, this one is local. */
  depth: number;
  /** Parent's display name, rendered as a mention chip past the visual cap. */
  parentName: string | null;
  locale: Locale;
  /** The whole `useComments` result; this node reads only what it needs. */
  comments: UseCommentsResult;
  /**
   * False for a logged-out viewer. Passed down from `CommentThread` rather than
   * read via `useAuth` here: that hook fires a /me request per mount, and a long
   * thread renders hundreds of these nodes.
   */
  canInteract: boolean;
}

/**
 * One node of the comment tree, recursing into its own children.
 *
 * Indentation is absolute per node (`marginLeft` on the ROW, never on the wrapper),
 * so nesting does not compound and the cap at depth 3 actually holds.
 *
 * No `overflow-hidden` anywhere in here on purpose: `ReactionBar`'s picker is
 * `absolute bottom-full` and any clipping ancestor eats it. Phase 1 paid for this
 * lesson once already.
 */
export function CommentItem({
  id,
  depth,
  parentName,
  locale,
  comments,
  canInteract,
}: CommentItemProps) {
  const reduce = useReducedMotion();
  const [replying, setReplying] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const node = comments.byId[id];
  if (!node) return null;

  const deleted = node.status === 'deleted';
  // A tombstone only exists on screen to keep its subtree reachable.
  if (deleted && node.replyCount === 0) return null;

  const isPending = comments.pending.has(id);
  const indent = Math.min(depth, VISUAL_MAX_DEPTH) * INDENT_PX;
  const childIds = comments.childIds(id);
  const isExpanded = comments.expanded.has(id);
  const repliesBusy = !!comments.repliesLoading[id];
  const authorName = node.author?.displayName ?? (locale === 'vi' ? 'Người dùng' : 'Someone');
  const showMention = depth > VISUAL_MAX_DEPTH && !!parentName;

  async function submitReply(input: Parameters<UseCommentsResult['create']>[0]) {
    const saved = await comments.create({ ...input, parentId: id });
    if (!saved) return false;
    setReplying(false);
    return true;
  }

  return (
    <li className="flex flex-col">
      <motion.div
        layout={!reduce}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
        style={{ marginLeft: indent }}
        className={cn('flex gap-2.5 py-1.5', isPending && 'opacity-60')}
      >
        {deleted ? (
          <span
            aria-hidden
            className="mt-1 h-8 w-8 shrink-0 rounded-full bg-surface-3"
          />
        ) : (
          <Link
            href={profileHref(node.author)}
            className="mt-0.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar
              name={authorName}
              src={node.author?.avatarUrl ?? undefined}
              accountType={accountType(node.author?.accountType)}
              size={32}
            />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {deleted ? (
            <p className="rounded-2xl bg-surface-2 px-3.5 py-2 text-sm italic text-text-muted">
              {locale === 'vi' ? 'Bình luận đã bị xóa' : 'This comment was deleted'}
            </p>
          ) : (
            <>
              <div className="inline-block max-w-full rounded-2xl bg-surface-2 px-3.5 py-2">
                <Link
                  href={profileHref(node.author)}
                  className="block truncate text-[13px] font-semibold text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {authorName}
                </Link>
                {(showMention || node.body) && (
                  <p className="whitespace-pre-wrap break-words text-pretty text-sm text-text">
                    {showMention && (
                      <span className="mr-1 rounded-md bg-primary/12 px-1.5 py-0.5 text-[13px] font-medium text-primary">
                        @{parentName}
                      </span>
                    )}
                    {node.body}
                  </p>
                )}
              </div>

              {node.attachments.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-end gap-2">
                  {node.attachments.map((att: CommentAttachment, i) =>
                    att.kind === 'sticker' ? (
                      <span
                        key={`${att.stickerId ?? 'sticker'}-${i}`}
                        role="img"
                        aria-label={locale === 'vi' ? 'Nhãn dán' : 'Sticker'}
                        className="leading-none"
                        style={{ fontSize: STICKER_SIZE }}
                      >
                        {getStickerGlyph(att.stickerId)}
                      </span>
                    ) : att.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${att.url}-${i}`}
                        src={att.url}
                        alt=""
                        className="max-h-64 w-auto max-w-full rounded-xl object-contain"
                      />
                    ) : null,
                  )}
                </div>
              )}

              {/* Actions. Hidden entirely while the node is an in-flight `tmp_` id:
                  the reaction and delete endpoints would 400 on that id. */}
              {!isPending && (
                <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-1 text-xs text-text-muted">
                  {/* A guest keeps the counts and the timestamp — only the controls
                      that would 401 are withheld. */}
                  {canInteract && (
                    <>
                      <ReactionBar
                        size="sm"
                        viewerReaction={node.viewerReaction}
                        onSelect={(type) => comments.react(id, type)}
                        onRemove={() => comments.unreact(id)}
                      />
                      <button
                        type="button"
                        onClick={() => setReplying((v) => !v)}
                        className="rounded-full px-2 py-1 font-medium transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {locale === 'vi' ? 'Phản hồi' : 'Reply'}
                      </button>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <time dateTime={node.createdAt} className="tabular-nums">
                    {timeAgo(node.createdAt, locale)}
                  </time>
                  <ReactionSummary
                    counts={node.reactions}
                    total={node.reactionsTotal}
                    onOpenList={() => setListOpen(true)}
                    className="ml-1"
                  />
                  {node.viewerCanDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        const ask =
                          locale === 'vi' ? 'Xóa bình luận này?' : 'Delete this comment?';
                        if (window.confirm(ask)) void comments.remove(id);
                      }}
                      aria-label={locale === 'vi' ? 'Xóa bình luận' : 'Delete comment'}
                      className="ml-auto rounded-full p-1.5 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {replying && !deleted && !isPending && (
            <div className="mt-2">
              <CommentComposer
                size="sm"
                autoFocus
                locale={locale}
                onSubmit={submitReply}
                onCancel={() => setReplying(false)}
                placeholder={
                  locale === 'vi' ? `Phản hồi ${authorName}…` : `Reply to ${authorName}…`
                }
              />
            </div>
          )}

          {/* Collapsed by default. `toggleExpanded` lazily fetches page 1 on the
              first expand, so this must NOT also call `loadReplies`. */}
          {node.replyCount > 0 && (
            <button
              type="button"
              onClick={() => comments.toggleExpanded(id)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-xs font-semibold text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CornerDownRight size={13} aria-hidden />
              {isExpanded
                ? locale === 'vi'
                  ? 'Ẩn phản hồi'
                  : 'Hide replies'
                : locale === 'vi'
                  ? `Xem ${node.replyCount} phản hồi`
                  : `View ${node.replyCount} ${node.replyCount === 1 ? 'reply' : 'replies'}`}
              {repliesBusy && (
                <span
                  aria-hidden
                  className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary"
                />
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* Children live OUTSIDE the indented row so each descendant applies its own
          absolute indent instead of stacking on top of this node's. */}
      {isExpanded && childIds.length > 0 && (
        <ul className="flex flex-col">
          {childIds.map((childId) => (
            <CommentItem
              key={childId}
              id={childId}
              depth={depth + 1}
              parentName={node.author?.displayName ?? parentName}
              locale={locale}
              comments={comments}
              canInteract={canInteract}
            />
          ))}
        </ul>
      )}

      {isExpanded && comments.hasMoreReplies(id) && (
        <button
          type="button"
          onClick={() => comments.loadReplies(id)}
          disabled={repliesBusy}
          style={{ marginLeft: Math.min(depth + 1, VISUAL_MAX_DEPTH) * INDENT_PX }}
          className="mb-1 mt-0.5 self-start rounded-full px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {locale === 'vi' ? 'Xem thêm phản hồi' : 'View more replies'}
        </button>
      )}

      {/* Mounted only while open: a long thread renders hundreds of these nodes,
          and each idle instance would otherwise carry the modal's state + effects. */}
      {listOpen && (
        <ReactionListModal
          targetId={id}
          targetType="comment"
          open
          onClose={() => setListOpen(false)}
          initialCounts={node.reactions}
          initialTotal={node.reactionsTotal}
        />
      )}
    </li>
  );
}
