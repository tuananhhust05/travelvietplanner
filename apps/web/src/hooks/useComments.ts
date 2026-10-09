'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  api,
  type CommentView,
  type CommentTargetType,
  type CreateCommentInput,
} from '@/lib/api';
import { getSocket, subscribeSocketChange } from '@/lib/socket';
import {
  applyReactionChange,
  normalizeCounts,
  normalizeTotal,
  toReactionType,
  type ReactionCounts,
  type ReactionType,
} from '@/lib/reactions';

/** `childrenOf` / `cursors` key holding the top-level list. */
export const ROOT_KEY = 'root';
/** Page sizes matching the API defaults (contract part 2 §1). */
const ROOT_PAGE = 20;
const REPLY_PAGE = 10;

/**
 * Normalized comment tree (contract part 2 §4.2).
 *
 * Deliberately NOT a nested object: a `comment:new` for a reply at depth 7 would
 * force a recursive path-walk + rewrite on every broadcast. Here an insert is two
 * writes — `byId[id]` and a push into `childrenOf[parentId ?? 'root']`.
 */
export interface CommentTreeState {
  byId: Record<string, CommentView>;
  /** key `'root'` for top-level, else the parent comment id. */
  childrenOf: Record<string, string[]>;
  /** `'root'` | parentId → nextCursor. `null` = fully loaded. */
  cursors: Record<string, string | null>;
  /** Nodes whose replies are visible. */
  expanded: Set<string>;
}

const EMPTY_STATE: CommentTreeState = {
  byId: {},
  childrenOf: {},
  cursors: {},
  expanded: new Set(),
};

interface CommentNewPayload {
  targetType?: unknown;
  targetId?: unknown;
  /** @deprecated wire compat */
  postId?: unknown;
  comment?: unknown;
  postCommentCount?: unknown;
}
interface CommentDeletedPayload {
  targetType?: unknown;
  targetId?: unknown;
  /** @deprecated wire compat */
  postId?: unknown;
  commentId?: unknown;
  parentId?: unknown;
  postCommentCount?: unknown;
}
interface CommentReactionPayload {
  targetType?: unknown;
  targetId?: unknown;
  /** @deprecated wire compat */
  postId?: unknown;
  commentId?: unknown;
  counts?: unknown;
  total?: unknown;
}

export interface UseCommentsOptions {
  /** Fetch the first page on mount. Default `true`. */
  autoLoad?: boolean;
  /** Called with the post's absolute comment count from every realtime payload. */
  onPostCommentCount?: (count: number) => void;
}

export interface UseCommentsResult {
  /** Top-level ids, newest first. */
  rootIds: string[];
  byId: Record<string, CommentView>;
  childrenOf: Record<string, string[]>;
  expanded: Set<string>;
  /** Direct children of a node, `[]` when its replies have never been loaded. */
  childIds: (parentId: string) => string[];
  /** True until the first top-level page resolves. */
  loading: boolean;
  /** A `loadMore()` / `loadReplies()` request is in flight. */
  loadingMore: boolean;
  /** Per-node reply-fetch flag, keyed by parent id. */
  repliesLoading: Record<string, boolean>;
  /** More top-level comments exist. */
  hasMore: boolean;
  /** More replies exist under this node (pagination, not the collapsed state). */
  hasMoreReplies: (parentId: string) => boolean;
  /** Total top-level comments reported by the server, or `null` before the first page. */
  total: number | null;
  /** Message from the last failed mutation/fetch, cleared on the next attempt. */
  error: string | null;
  /** Optimistic `tmp_` ids in flight — disable their reaction bar and reply button. */
  pending: Set<string>;
  loadMore: () => void;
  /** Fetches the next reply page for a node (first page when never loaded). */
  loadReplies: (parentId: string) => void;
  /** Show/hide a node's replies; lazily loads the first page on expand. */
  toggleExpanded: (parentId: string) => void;
  /** Optimistic create. Resolves the saved comment, or `null` on failure (keep the draft). */
  create: (input: CreateCommentInput) => Promise<CommentView | null>;
  remove: (commentId: string) => Promise<boolean>;
  react: (commentId: string, type: ReactionType) => void;
  unreact: (commentId: string) => void;
}

function isTmp(id: string): boolean {
  return id.startsWith('tmp_');
}

function errMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Đã xảy ra lỗi, vui lòng thử lại.';
}

/** Narrows a broadcast/REST comment payload. Rejects anything without a usable `_id`. */
function toCommentView(raw: unknown): CommentView | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<CommentView>;
  if (typeof c._id !== 'string' || !c._id) return null;
  return {
    ...(c as CommentView),
    parentId: typeof c.parentId === 'string' ? c.parentId : null,
    attachments: Array.isArray(c.attachments) ? c.attachments : [],
    reactions: normalizeCounts(c.reactions),
    reactionsTotal: normalizeTotal(c.reactionsTotal),
    viewerReaction: toReactionType(c.viewerReaction),
    replyCount: normalizeTotal(c.replyCount),
    depth: normalizeTotal(c.depth),
    status: c.status === 'deleted' ? 'deleted' : 'visible',
  };
}

/**
 * The shared socket, re-rendering when it is created or torn down.
 *
 * Copied deliberately from `usePostReactions` — reading `getSocket()` once inside
 * an effect is not enough: a page mounted before the auth token existed would
 * keep the `null` it saw at mount and bind no listeners.
 */
function useSharedSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    setSocket(getSocket());
    return subscribeSocketChange(() => setSocket(getSocket()));
  }, []);
  return socket;
}

/**
 * Pure: writes one comment into the tree, deduping by `_id`.
 *
 * `countReply` is false only for the optimistic insert of the viewer's own reply:
 * the counter is bumped once later, by whichever of the POST response or the
 * broadcast lands first, so the author never sees `replyCount` move twice.
 */
function insertComment(
  s: CommentTreeState,
  c: CommentView,
  countReply = true,
): CommentTreeState {
  const key = c.parentId ?? ROOT_KEY;
  const existing = s.byId[c._id];
  const byId = { ...s.byId, [c._id]: existing ? { ...c, viewerReaction: existing.viewerReaction } : c };

  // Already in the list: the author's own POST response and the broadcast carry
  // the same comment, so refresh the entity but never push the id twice.
  const list = s.childrenOf[key];
  if (list?.includes(c._id)) return { ...s, byId };

  if (c.parentId === null) {
    return { ...s, byId, childrenOf: { ...s.childrenOf, [ROOT_KEY]: [c._id, ...(list ?? [])] } };
  }

  // Replies are only inserted into a list that is already loaded. Pushing into an
  // unloaded list would show a stray reply above older, unfetched siblings — so
  // bump the parent's counter instead and let it arrive when expanded.
  const parent = byId[c.parentId];
  const bumped =
    parent && countReply
      ? { ...byId, [c.parentId]: { ...parent, replyCount: parent.replyCount + 1 } }
      : byId;
  if (!list) {
    // Not loaded: the counter alone. `Xem N phản hồi` reflects it and the reply
    // arrives with the fetched page when the node is expanded.
    return { ...s, byId: bumped };
  }
  return { ...s, byId: bumped, childrenOf: { ...s.childrenOf, [c.parentId]: [...list, c._id] } };
}

/** Pure: turns a node into a tombstone and decrements its parent's reply count. */
function tombstone(s: CommentTreeState, id: string, parentId: string | null): CommentTreeState {
  const node = s.byId[id];
  const byId = { ...s.byId };
  if (node) {
    byId[id] = {
      ...node,
      status: 'deleted',
      body: '',
      attachments: [],
      author: null,
      viewerCanDelete: false,
    };
  }
  const pid = parentId ?? node?.parentId ?? null;
  if (pid && byId[pid]) {
    byId[pid] = { ...byId[pid], replyCount: Math.max(0, byId[pid].replyCount - 1) };
  }
  return { ...s, byId };
}

/**
 * Normalized comment tree for one post: paging, realtime and mutations.
 *
 * Realtime arrives on the existing `post:<id>` room, which the post detail page
 * already joins via `usePostReactions`. This hook therefore binds listeners only
 * and emits no subscribe of its own.
 */
export function useComments(
  targetId: string,
  options: UseCommentsOptions & { targetType?: CommentTargetType } = {},
): UseCommentsResult {
  const { autoLoad = true, onPostCommentCount, targetType = 'post' } = options;
  const socket = useSharedSocket();
  // Legacy: keep a stable postId alias for any caller that reads it from state
  const postId = targetId;

  const [state, setState] = useState<CommentTreeState>(EMPTY_STATE);
  const [loading, setLoading] = useState<boolean>(autoLoad);
  const [loadingMore, setLoadingMore] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  // Rebased from committed state every render, so a second mutation in the same
  // tick reads the first one's result instead of the pre-update value.
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Keys whose first page has been fetched — drives the page-1 merge order. */
  const fetchedRef = useRef<Set<string>>(new Set());
  /** Per-comment request counter; only the newest reaction request may write. */
  const seqRef = useRef<Map<string, number>>(new Map());
  const countRef = useRef(onPostCommentCount);
  countRef.current = onPostCommentCount;
  /**
   * Count keys already reflected in `total` — `<id>` for a create, `del:<id>` for a
   * delete. Makes the optimistic delta idempotent against the viewer's own broadcast.
   */
  const countedRef = useRef<Set<string>>(new Set());

  const apply = useCallback((fn: (s: CommentTreeState) => CommentTreeState) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }, []);

  /**
   * Absolute count from the server (REST page or a broadcast). Always wins over a
   * local guess.
   *
   * `total` used to be written ONLY by the first page fetch, so the thread heading
   * froze at its page-load value: creating, deleting, and another user's comment all
   * left it stale even though the post header (fed by `countRef`) followed along.
   */
  const publishTotal = useCallback((raw: unknown) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
    const v = normalizeTotal(raw);
    setTotal(v);
    countRef.current?.(v);
  }, []);

  /**
   * Optimistic nudge for the viewer's own create/delete, applied AT MOST ONCE per key.
   *
   * The author is in the `post:<id>` room too, so they also receive their OWN
   * `comment:new` carrying an absolute count — and the server emits after the commit,
   * often before the HTTP response resolves, so "broadcast first" is the common
   * order, not the rare one. Without the key that order double-counts: the broadcast
   * sets N, then this delta makes it N+1. `onNew`/`onDeleted` claim the key before
   * publishing their absolute value, so both orderings converge on N.
   *
   * No-op before the first page lands (`null` = count still unknown).
   */
  const bumpTotal = useCallback((delta: number, key: string) => {
    if (countedRef.current.has(key)) return;
    countedRef.current.add(key);
    setTotal((t) => {
      if (t === null) return t;
      const next = Math.max(0, t + delta);
      countRef.current?.(next);
      return next;
    });
  }, []);

  /** Claim a count key without applying a delta — for absolute server values. */
  const claimCount = useCallback((key: string) => {
    countedRef.current.add(key);
  }, []);

  // Reset when the target changes — otherwise the previous thread bleeds through.
  useEffect(() => {
    stateRef.current = EMPTY_STATE;
    setState(EMPTY_STATE);
    fetchedRef.current = new Set();
    seqRef.current = new Map();
    countedRef.current = new Set();
    setRepliesLoading({});
    setPending(new Set());
    setTotal(null);
    setError(null);
  }, [postId]);

  const fetchRoot = useCallback(
    async (before?: string) => {
      if (!postId) return;
      setError(null);
      if (before) setLoadingMore(true);
      try {
        const res = await api.listComments(targetType, targetId, { limit: ROOT_PAGE, before });
        const items = res.items.map(toCommentView).filter((c): c is CommentView => c !== null);
        apply((s) => {
          const byId = { ...s.byId };
          for (const c of items) {
            // Keep the viewer's own reaction if this id is already known.
            byId[c._id] = s.byId[c._id] ? { ...c, viewerReaction: s.byId[c._id].viewerReaction } : c;
          }
          const seen = new Set(items.map((c) => c._id));
          const prev = s.childrenOf[ROOT_KEY] ?? [];
          const next = before
            ? [...prev, ...items.map((c) => c._id).filter((id) => !prev.includes(id))]
            : // First page: server order wins, locally-created ids stay in front.
              [...prev.filter((id) => !seen.has(id)), ...items.map((c) => c._id)];
          return {
            ...s,
            byId,
            childrenOf: { ...s.childrenOf, [ROOT_KEY]: next },
            cursors: { ...s.cursors, [ROOT_KEY]: res.nextCursor ?? null },
          };
        });
        fetchedRef.current.add(ROOT_KEY);
        publishTotal(res.total);
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apply, postId],
  );

  useEffect(() => {
    if (!autoLoad || !targetId) return;
    setLoading(true);
    void fetchRoot();
  }, [autoLoad, fetchRoot, targetId]);

  const loadMore = useCallback(() => {
    const cursor = stateRef.current.cursors[ROOT_KEY];
    if (!cursor || loadingMore) return;
    void fetchRoot(cursor);
  }, [fetchRoot, loadingMore]);

  const loadReplies = useCallback(
    (parentId: string) => {
      if (!parentId || isTmp(parentId)) return;
      const first = !fetchedRef.current.has(parentId);
      const cursor = stateRef.current.cursors[parentId];
      // `cursor === null` means the list is exhausted; `undefined` means never fetched.
      if (!first && !cursor) return;
      setRepliesLoading((m) => (m[parentId] ? m : { ...m, [parentId]: true }));
      setError(null);
      void (async () => {
        try {
          const res = await api.listReplies(parentId, {
            limit: REPLY_PAGE,
            after: cursor ?? undefined,
          });
          const items = res.items.map(toCommentView).filter((c): c is CommentView => c !== null);
          apply((s) => {
            const byId = { ...s.byId };
            for (const c of items) {
              byId[c._id] = s.byId[c._id]
                ? { ...c, viewerReaction: s.byId[c._id].viewerReaction }
                : c;
            }
            const prev = s.childrenOf[parentId] ?? [];
            const ids = items.map((c) => c._id);
            const seen = new Set(ids);
            // Replies read oldest-first, and anything already local is newer than
            // this page, so the fetched page goes in FRONT of the leftovers.
            const next = first
              ? [...ids, ...prev.filter((id) => !seen.has(id))]
              : [...prev, ...ids.filter((id) => !prev.includes(id))];
            return {
              ...s,
              byId,
              childrenOf: { ...s.childrenOf, [parentId]: next },
              cursors: { ...s.cursors, [parentId]: res.nextCursor ?? null },
              expanded: new Set(s.expanded).add(parentId),
            };
          });
          fetchedRef.current.add(parentId);
        } catch (e) {
          setError(errMessage(e));
        } finally {
          setRepliesLoading((m) => {
            const next = { ...m };
            delete next[parentId];
            return next;
          });
        }
      })();
    },
    [apply],
  );

  const toggleExpanded = useCallback(
    (parentId: string) => {
      const wasExpanded = stateRef.current.expanded.has(parentId);
      apply((s) => {
        const expanded = new Set(s.expanded);
        if (wasExpanded) expanded.delete(parentId);
        else expanded.add(parentId);
        return { ...s, expanded };
      });
      if (!wasExpanded && !fetchedRef.current.has(parentId)) loadReplies(parentId);
    },
    [apply, loadReplies],
  );

  const create = useCallback(
    async (input: CreateCommentInput): Promise<CommentView | null> => {
      if (!postId) return null;
      const parentId = input.parentId ?? null;
      const tmpId = `tmp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const parent = parentId ? stateRef.current.byId[parentId] : null;
      const optimistic: CommentView = {
        _id: tmpId,
        postId,
        targetType,
        targetId: postId,
        parentId,
        rootId: parent ? parent.rootId : tmpId,
        depth: parent ? parent.depth + 1 : 0,
        body: (input.body ?? '').trim(),
        attachments: input.attachments ?? [],
        status: 'visible',
        createdAt: new Date().toISOString(),
        editedAt: null,
        author: null,
        reactions: normalizeCounts(null),
        reactionsTotal: 0,
        viewerReaction: null,
        replyCount: 0,
        viewerCanDelete: false,
      };

      setError(null);
      setPending((p) => new Set(p).add(tmpId));
      apply((s) => {
        // The viewer's own reply must be visible even under a collapsed parent, so
        // open the list here; `loadReplies` merges the fetched page in front of it.
        const seeded =
          parentId && !s.childrenOf[parentId]
            ? {
                ...s,
                childrenOf: { ...s.childrenOf, [parentId]: [] },
                expanded: new Set(s.expanded).add(parentId),
              }
            : s;
        // `countReply: false` — the parent's counter is bumped once, later, by
        // whichever of the POST response or the broadcast lands first.
        return insertComment(seeded, optimistic, false);
      });

      const clearPending = () =>
        setPending((p) => {
          const next = new Set(p);
          next.delete(tmpId);
          return next;
        });

      try {
        const raw = await api.createComment(targetType, targetId, {
          body: input.body,
          parentId: parentId ?? undefined,
          attachments: input.attachments,
        });
        const saved = toCommentView(raw);
        if (!saved) throw new Error('Phản hồi không hợp lệ từ máy chủ.');
        // REPLACE the temp entry by id (never append) — a leftover `tmp_` id would
        // 400 the reaction and delete endpoints.
        apply((s) => {
          const key = parentId ?? ROOT_KEY;
          const byId = { ...s.byId };
          delete byId[tmpId];
          const list = (s.childrenOf[key] ?? []).filter((id) => id !== tmpId);
          // Drop the temp entry first, then let `insertComment` place the real one
          // (front for top-level, end for a reply) and dedupe against a broadcast
          // that may have arrived while the POST was in flight.
          return insertComment({ ...s, byId, childrenOf: { ...s.childrenOf, [key]: list } }, saved);
        });
        // The author is in the `post:<id>` room too, so their own broadcast follows
        // with an absolute count and overrides this guess. Bumping anyway keeps the
        // heading correct when the socket is down.
        bumpTotal(1, saved._id);
        return saved;
      } catch (e) {
        setError(errMessage(e));
        apply((s) => {
          const key = parentId ?? ROOT_KEY;
          const byId = { ...s.byId };
          delete byId[tmpId];
          const list = (s.childrenOf[key] ?? []).filter((id) => id !== tmpId);
          return { ...s, byId, childrenOf: { ...s.childrenOf, [key]: list } };
        });
        return null;
      } finally {
        clearPending();
      }
    },
    [apply, targetId, targetType],
  );

  const remove = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!commentId || isTmp(commentId)) return false;
      const snapshot = stateRef.current.byId[commentId];
      if (!snapshot) return false;
      setError(null);
      apply((s) => tombstone(s, commentId, snapshot.parentId));
      try {
        await api.deleteComment(commentId);
        bumpTotal(-1, `del:${commentId}`);
        return true;
      } catch (e) {
        setError(errMessage(e));
        apply((s) => {
          const byId = { ...s.byId, [commentId]: snapshot };
          const pid = snapshot.parentId;
          if (pid && byId[pid]) byId[pid] = { ...byId[pid], replyCount: byId[pid].replyCount + 1 };
          return { ...s, byId };
        });
        return false;
      }
    },
    [apply],
  );

  const writeReaction = useCallback(
    (commentId: string, viewer: ReactionType | null, counts: ReactionCounts, t: number) => {
      apply((s) => {
        const node = s.byId[commentId];
        if (!node) return s;
        return {
          ...s,
          byId: {
            ...s.byId,
            [commentId]: { ...node, reactions: counts, reactionsTotal: t, viewerReaction: viewer },
          },
        };
      });
    },
    [apply],
  );

  const change = useCallback(
    async (commentId: string, next: ReactionType | null) => {
      if (!commentId || isTmp(commentId)) return;
      const node = stateRef.current.byId[commentId];
      if (!node || node.status === 'deleted') return;
      const snap = {
        counts: node.reactions,
        total: node.reactionsTotal,
        viewer: node.viewerReaction,
      };
      if (snap.viewer === next) return;

      const seq = (seqRef.current.get(commentId) ?? 0) + 1;
      seqRef.current.set(commentId, seq);

      const optimistic = applyReactionChange(snap.counts, snap.total, snap.viewer, next);
      writeReaction(commentId, next, optimistic.counts, optimistic.total);

      try {
        const res = next
          ? await api.setCommentReaction(commentId, next)
          : await api.removeCommentReaction(commentId);
        // Superseded by a newer click: that request owns the final state.
        if (seqRef.current.get(commentId) !== seq) return;
        writeReaction(
          commentId,
          toReactionType(res.viewerReaction),
          normalizeCounts(res.counts),
          normalizeTotal(res.total),
        );
      } catch (e) {
        if (seqRef.current.get(commentId) !== seq) return;
        setError(errMessage(e));
        writeReaction(commentId, snap.viewer, snap.counts, snap.total);
      }
    },
    [writeReaction],
  );

  const react = useCallback(
    (commentId: string, type: ReactionType) => void change(commentId, type),
    [change],
  );
  const unreact = useCallback((commentId: string) => void change(commentId, null), [change]);

  // Realtime. The `post:<id>` room is already joined by `usePostReactions` on the
  // post detail page, so this only binds listeners.
  useEffect(() => {
    if (!socket || !postId) return;

    // Absolute server count -> both the thread heading (`total`) and the post header
    // (`countRef`). Previously this fed the header ONLY, which is why the heading
    // stayed frozen at its page-load value for the whole session.
    const reportCount = publishTotal;

    const onNew = (payload: CommentNewPayload) => {
      const payloadTarget = (payload?.targetId ?? payload?.postId) as unknown;
      if (payloadTarget !== targetId) return;
      const c = toCommentView(payload?.comment);
      // Claim BEFORE publishing: this absolute count already includes the comment, so
      // a `bumpTotal` for the same id (the viewer's own POST resolving afterwards)
      // must not add it a second time.
      if (c) claimCount(c._id);
      reportCount(payload?.postCommentCount);
      if (!c) return;
      apply((s) => insertComment(s, c));
    };

    const onDeleted = (payload: CommentDeletedPayload) => {
      const payloadTarget = (payload?.targetId ?? payload?.postId) as unknown;
      if (payloadTarget !== targetId) return;
      const id = typeof payload?.commentId === 'string' ? payload.commentId : null;
      if (id) claimCount(`del:${id}`);
      reportCount(payload?.postCommentCount);
      if (!id) return;
      const parentId = typeof payload?.parentId === 'string' ? payload.parentId : null;
      apply((s) => tombstone(s, id, parentId));
    };

    // Counts only. `viewerReaction` is the viewer's own state, is never broadcast,
    // and must survive another user's reaction.
    const onReaction = (payload: CommentReactionPayload) => {
      const payloadTarget = (payload?.targetId ?? payload?.postId) as unknown;
      if (payloadTarget !== targetId) return;
      const id = typeof payload?.commentId === 'string' ? payload.commentId : null;
      if (!id) return;
      const counts = normalizeCounts(payload?.counts);
      const t =
        typeof payload?.total === 'number' && Number.isFinite(payload.total)
          ? normalizeTotal(payload.total)
          : Object.values(counts).reduce((a, b) => a + b, 0);
      apply((s) => {
        const node = s.byId[id];
        if (!node) return s;
        return { ...s, byId: { ...s.byId, [id]: { ...node, reactions: counts, reactionsTotal: t } } };
      });
    };

    socket.on('comment:new', onNew);
    socket.on('comment:deleted', onDeleted);
    socket.on('comment:reaction', onReaction);
    return () => {
      socket.off('comment:new', onNew);
      socket.off('comment:deleted', onDeleted);
      socket.off('comment:reaction', onReaction);
    };
  }, [apply, claimCount, postId, publishTotal, socket]);

  const childIds = useCallback((parentId: string) => state.childrenOf[parentId] ?? [], [state]);
  const hasMoreReplies = useCallback(
    (parentId: string) => state.cursors[parentId] != null,
    [state],
  );

  return {
    rootIds: state.childrenOf[ROOT_KEY] ?? [],
    byId: state.byId,
    childrenOf: state.childrenOf,
    expanded: state.expanded,
    childIds,
    loading,
    loadingMore,
    repliesLoading,
    hasMore: state.cursors[ROOT_KEY] != null,
    hasMoreReplies,
    total,
    error,
    pending,
    loadMore,
    loadReplies,
    toggleExpanded,
    create,
    remove,
    react,
    unreact,
  };
}
