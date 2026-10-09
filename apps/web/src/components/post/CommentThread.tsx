'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentComposer } from '@/components/post/CommentComposer';
import { CommentItem } from '@/components/post/CommentItem';
import { useComments } from '@/hooks/useComments';
import { useAuth } from '@/lib/auth';
import type { CreateCommentInput } from '@/lib/api';
import type { Locale } from '@/lib/i18n';

export interface CommentThreadProps {
  postId: string;
  targetType?: 'post' | 'trip';
  locale?: Locale;
  /** Absolute comment count, from the REST total and every realtime payload. */
  onCommentCountChange?: (n: number) => void;
}

/**
 * Root of the comment tree: heading, root composer, top-level list, "load more".
 *
 * All state lives in `useComments` — this component fetches nothing itself and
 * creates nothing locally. The previous version faked creation with a
 * `local-<Date.now()>` id and never persisted anything; that is gone.
 *
 * The `attempt` key remounts `ThreadBody`, which is the only honest retry
 * available: the hook seeds its cursors from the first page, so after a failed
 * first fetch `loadMore()` sees no cursor and no-ops. A remount re-runs the
 * autoLoad effect from a clean state — and state is empty in exactly that case.
 */
export function CommentThread({ postId, targetType = 'post', locale = 'vi', onCommentCountChange }: CommentThreadProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ThreadBody
      key={attempt}
      postId={postId}
      targetType={targetType}
      locale={locale}
      onCommentCountChange={onCommentCountChange}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

/**
 * NOTE: no `overflow-hidden` on this section or on any row inside it.
 * `ReactionBar`'s picker is `absolute bottom-full`, so a clipping ancestor eats
 * it — the trap Phase 1 already paid for once.
 */
function ThreadBody({
  postId,
  targetType = 'post',
  locale,
  onCommentCountChange,
  onRetry,
}: {
  postId: string;
  targetType?: 'post' | 'trip';
  locale: Locale;
  onCommentCountChange?: (n: number) => void;
  onRetry: () => void;
}) {
  // `useAuth` runs its own `fetchMe` per mount, so it is called HERE ONLY and the
  // result is threaded down as a prop. Calling it inside `CommentItem` would fire
  // one /me request per node — hundreds on a long thread.
  const { user, loading: authLoading } = useAuth();
  const canInteract = !!user || authLoading;

  // Held in a ref so the hook's realtime listeners are not rebound every time the
  // parent re-renders with a fresh closure.
  const countRef = useRef(onCommentCountChange);
  countRef.current = onCommentCountChange;

  const comments = useComments(postId, {
    targetType,
    onPostCommentCount: (n) => countRef.current?.(n),
  });

  const { rootIds, total, loading, loadingMore, hasMore, error, loadMore } = comments;

  // The REST `total` is the post's comment count too; realtime pushes it through
  // the hook option above.
  useEffect(() => {
    if (typeof total === 'number') countRef.current?.(total);
  }, [total]);

  // Tombstones without replies are not rendered, so the heading trusts the
  // server's total over the array length.
  const count = total ?? rootIds.length;
  const heading = locale === 'vi' ? `Bình luận (${count})` : `Comments (${count})`;
  const emptyAfterLoad = !loading && rootIds.length === 0;

  async function submitRoot(input: CreateCommentInput): Promise<boolean> {
    const saved = await comments.create({ ...input, parentId: null });
    return saved !== null;
  }

  return (
    <section aria-label={locale === 'vi' ? 'Bình luận' : 'Comments'} className="mt-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <MessageCircle size={16} className="text-primary" aria-hidden />
        {heading}
      </h2>

      {/* A guest's POST can only 401, so offer sign-in instead of a dead box.
          `loading` counts as authenticated: a logged-in viewer whose profile is
          still in flight would otherwise see the prompt flash first. */}
      {canInteract ? (
        <div className="mt-3 flex items-start gap-3">
          <Avatar
            name={user?.displayName ?? 'Bạn'}
            src={user?.avatarUrl}
            accountType={user?.activeProfileType ?? 'traveler'}
            size={36}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <CommentComposer
              locale={locale}
              onSubmit={submitRoot}
              placeholder={locale === 'vi' ? 'Viết bình luận…' : 'Write a comment…'}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
          <Link
            href="/login"
            className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {locale === 'vi' ? 'Đăng nhập' : 'Log in'}
          </Link>
          {locale === 'vi'
            ? ' để bình luận và bày tỏ cảm xúc.'
            : ' to comment and react.'}
        </p>
      )}

      {/* A failed mutation surfaces the same `error`, so this banner sits above the
          list rather than replacing it. The retry only appears when there is
          nothing loaded, i.e. when the failure was the first fetch. */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{error}</p>
          {emptyAfterLoad && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              {locale === 'vi' ? 'Thử lại' : 'Retry'}
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <ul className="mt-5 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </li>
          ))}
        </ul>
      ) : rootIds.length === 0 ? (
        !error && (
          <p className="mt-5 rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-muted">
            {locale === 'vi'
              ? 'Chưa có bình luận. Hãy là người đầu tiên chia sẻ cảm nghĩ.'
              : 'No comments yet. Be the first to share your thoughts.'}
          </p>
        )
      ) : (
        <ul className="mt-4 flex flex-col">
          {rootIds.map((id) => (
            <CommentItem
              key={id}
              id={id}
              depth={0}
              parentName={null}
              locale={locale}
              comments={comments}
              canInteract={canInteract}
            />
          ))}
        </ul>
      )}

      {!loading && hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          loading={loadingMore}
          onClick={loadMore}
        >
          {locale === 'vi' ? 'Xem thêm bình luận' : 'View more comments'}
        </Button>
      )}
    </section>
  );
}
