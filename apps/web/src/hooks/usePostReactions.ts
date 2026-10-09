'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { getSocket, subscribeSocketChange } from '@/lib/socket';
import {
  applyReactionChange,
  normalizeCounts,
  type ReactionCounts,
  type ReactionType,
} from '@/lib/reactions';

/** Debounce before emitting `post:subscribe` so a burst of renders sends one batch. */
const SUBSCRIBE_DEBOUNCE_MS = 300;
/** Gateway caps a single subscribe payload at 50 ids. */
const MAX_IDS_PER_EMIT = 50;

/** Payload broadcast by the API on room `post:<id>`. Never carries `viewerReaction`. */
interface PostReactionPayload {
  postId?: unknown;
  counts?: unknown;
  total?: unknown;
}

/** Ack shape of `post:subscribe` — `joined` lists the ids the server authorized. */
interface SubscribeAck {
  ok?: unknown;
  joined?: unknown;
}

/** Callback invoked with the server's ABSOLUTE counts for one post. */
export type OnRemoteReaction = (postId: string, counts: ReactionCounts, total: number) => void;

/** Minimum shape a post needs for its reaction state to be managed here. */
export interface ReactablePost {
  _id: string;
  reactions: ReactionCounts;
  reactionsTotal: number;
  viewerReaction: ReactionType | null;
  /** Legacy alias kept in sync with `reactionsTotal`. */
  likeCount: number;
  viewerLiked?: boolean;
}

function chunk(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * The shared socket, re-rendering when it is created or torn down.
 *
 * Reading `getSocket()` once inside an effect is not enough: a page mounted
 * before the auth token existed (or before any other consumer opened the
 * connection) would keep the `null` it saw at mount and bind no listeners,
 * while still joining rooms — every broadcast silently discarded.
 */
function useSharedSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    setSocket(getSocket());
    // Re-resolve rather than adopting the notified value: `disconnectSocket()`
    // (the messages page calls it on unmount) clears the singleton, and a page
    // still showing posts wants a live connection, so ask for one again.
    return subscribeSocketChange(() => setSocket(getSocket()));
  }, []);
  return socket;
}

/**
 * Subscribes to reaction broadcasts for the currently rendered posts.
 *
 * Joins `post:<id>` rooms (debounced, incremental) and forwards `post:reaction`
 * events to `onRemote`. The payload is absolute, so the consumer overwrites
 * rather than increments. `viewerReaction` is deliberately left untouched: it is
 * the viewer's own state and is never broadcast.
 *
 * Degrades silently when there is no socket (guest / no token).
 */
export function usePostReactions(postIds: string[], onRemote: OnRemoteReaction): void {
  const socket = useSharedSocket();

  const onRemoteRef = useRef(onRemote);
  useEffect(() => {
    onRemoteRef.current = onRemote;
  }, [onRemote]);

  // Ids the server CONFIRMED we joined — the only ones worth re-joining on reconnect.
  const joinedRef = useRef<Set<string>>(new Set());
  // Ids already asked about, authorized or not. A `followers`-only post the viewer
  // does not follow is denied; without this it would be re-requested on every
  // list change, forever.
  const requestedRef = useRef<Set<string>>(new Set());
  // Stable string key: avoids re-running on a new array with identical contents.
  const key = postIds.join(',');

  useEffect(() => {
    if (!socket) return;

    const handleReaction = (payload: PostReactionPayload) => {
      const postId = typeof payload?.postId === 'string' ? payload.postId : null;
      if (!postId) return;
      const counts = normalizeCounts(payload?.counts);
      const rawTotal = typeof payload?.total === 'number' ? payload.total : NaN;
      const total = Number.isFinite(rawTotal)
        ? Math.max(0, Math.round(rawTotal))
        : Object.values(counts).reduce((a, b) => a + b, 0);
      onRemoteRef.current(postId, counts, total);
    };

    // A reconnect drops server-side room membership: re-join everything we hold.
    const handleConnect = () => {
      const all = Array.from(joinedRef.current);
      for (const batch of chunk(all, MAX_IDS_PER_EMIT)) {
        socket.emit('post:subscribe', batch);
      }
    };

    socket.on('post:reaction', handleReaction);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('post:reaction', handleReaction);
      socket.off('connect', handleConnect);
      const all = Array.from(joinedRef.current);
      joinedRef.current = new Set();
      requestedRef.current = new Set();
      if (all.length === 0) return;
      for (const batch of chunk(all, MAX_IDS_PER_EMIT)) {
        socket.emit('post:unsubscribe', batch);
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const ids = key ? key.split(',').filter(Boolean) : [];
    const wanted = new Set(ids);

    // Leave rooms for posts no longer rendered, otherwise membership only ever
    // grows as the feed pages in.
    const stale = Array.from(requestedRef.current).filter((id) => !wanted.has(id));
    if (stale.length > 0) {
      for (const id of stale) {
        requestedRef.current.delete(id);
        joinedRef.current.delete(id);
      }
      for (const batch of chunk(stale, MAX_IDS_PER_EMIT)) {
        socket.emit('post:unsubscribe', batch);
      }
    }

    const pending = ids.filter((id) => !requestedRef.current.has(id));
    if (pending.length === 0) return;

    const timer = setTimeout(() => {
      for (const batch of chunk(pending, MAX_IDS_PER_EMIT)) {
        // Marked as requested before the ack lands so a re-render mid-flight
        // does not emit the same batch twice.
        for (const id of batch) requestedRef.current.add(id);
        socket.emit('post:subscribe', batch, (res: SubscribeAck) => {
          if (!res || res.ok !== true || !Array.isArray(res.joined)) return;
          for (const id of res.joined) {
            if (typeof id === 'string') joinedRef.current.add(id);
          }
        });
      }
    }, SUBSCRIBE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key, socket]);
}

/** The reaction state of a single post, independent of the containing list. */
interface ReactionSnapshot {
  counts: ReactionCounts;
  total: number;
  viewer: ReactionType | null;
}

/**
 * Reaction handlers for a page that holds an array of posts.
 *
 * Snapshot → optimistic via `applyReactionChange` → API → overwrite with the
 * server's absolute counts → revert to the snapshot on error. Kept here so the
 * three list pages share one implementation instead of copying the arithmetic.
 */
export function useReactionHandlers<T extends ReactablePost>(
  posts: T[],
  setPosts: Dispatch<SetStateAction<T[]>>,
): {
  onReact: (postId: string, type: ReactionType) => void;
  onUnreact: (postId: string) => void;
  applyRemoteReaction: OnRemoteReaction;
} {
  // Assigned during render, NOT in an effect. An effect runs after the commit,
  // so two clicks inside one render flush would both read the pre-update value
  // and each apply its own delta to the same base (+2 instead of +1).
  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Per-post request counter. Only the newest request may write its response:
  // like → love → remove fired in a burst resolve in any order, and the loser
  // would otherwise overwrite the newest state with its own absolute counts.
  const seqRef = useRef<Map<string, number>>(new Map());

  /**
   * Writes to state AND to `postsRef`, so the very next click reads this value
   * instead of waiting for the re-render. Every render rebases the ref from
   * real state, so it cannot drift.
   */
  const write = useCallback(
    (postId: string, next: ReactionType | null, counts: ReactionCounts, total: number) => {
      const apply = (list: T[]): T[] =>
        list.map((p) =>
          p._id === postId
            ? {
                ...p,
                reactions: counts,
                reactionsTotal: total,
                viewerReaction: next,
                likeCount: total,
                viewerLiked: next !== null,
              }
            : p,
        );
      postsRef.current = apply(postsRef.current);
      setPosts(apply);
    },
    [setPosts],
  );

  const change = useCallback(
    async (postId: string, next: ReactionType | null) => {
      const current = postsRef.current.find((p) => p._id === postId);
      if (!current) return;

      const snapshot: ReactionSnapshot = {
        counts: current.reactions,
        total: current.reactionsTotal,
        viewer: current.viewerReaction,
      };
      if (snapshot.viewer === next) return;

      const seq = (seqRef.current.get(postId) ?? 0) + 1;
      seqRef.current.set(postId, seq);

      const optimistic = applyReactionChange(snapshot.counts, snapshot.total, snapshot.viewer, next);
      write(postId, next, optimistic.counts, optimistic.total);

      try {
        const res = next ? await api.setReaction(postId, next) : await api.removeReaction(postId);
        // Superseded by a newer click: that request owns the final state.
        if (seqRef.current.get(postId) !== seq) return;
        write(postId, res.viewerReaction ?? null, normalizeCounts(res.counts), Math.max(0, res.total));
      } catch {
        if (seqRef.current.get(postId) !== seq) return;
        write(postId, snapshot.viewer, snapshot.counts, snapshot.total);
      }
    },
    [write],
  );

  const onReact = useCallback(
    (postId: string, type: ReactionType) => void change(postId, type),
    [change],
  );
  const onUnreact = useCallback((postId: string) => void change(postId, null), [change]);

  // Realtime: counts only. `viewerReaction` stays whatever the viewer set.
  const applyRemoteReaction = useCallback<OnRemoteReaction>(
    (postId, counts, total) => {
      const apply = (list: T[]): T[] =>
        list.map((p) =>
          p._id === postId ? { ...p, reactions: counts, reactionsTotal: total, likeCount: total } : p,
        );
      postsRef.current = apply(postsRef.current);
      setPosts(apply);
    },
    [setPosts],
  );

  return { onReact, onUnreact, applyRemoteReaction };
}
