'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api, type NotificationView } from '@/lib/api';
import { getSocket, subscribeSocketChange } from '@/lib/socket';

/** Server payload for `notification:new`, emitted into the `user:<id>` room. */
interface NotificationNewPayload {
  notification?: NotificationView;
  unreadCount?: number;
}

/** Server payload for `notification:read` — badge number only. */
interface NotificationReadPayload {
  unreadCount?: number;
}

/**
 * The shared socket, re-rendering when it is created or torn down.
 *
 * Copied deliberately from `useComments` — reading `getSocket()` once inside an
 * effect is not enough: a component mounted before the auth token existed would
 * keep the `null` it saw at mount and bind no listeners. It also matters more
 * here than elsewhere, because `/messages` calls `disconnectSocket()` on unmount
 * and tears down the app-wide singleton; without this subscription the bell would
 * go permanently deaf after a user visited their inbox.
 */
function useSharedSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    setSocket(getSocket());
    return subscribeSocketChange(() => setSocket(getSocket()));
  }, []);
  return socket;
}

function clampCount(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : null;
}

/**
 * Just the bell badge.
 *
 * Deliberately separate from `useNotifications`: `AppShell` renders on every page,
 * and having it mount the full list hook would fetch a page of rows plus their
 * actor hydration on every navigation to render one number.
 */
export function useNotificationBadge(enabled: boolean): number {
  const [unread, setUnread] = useState(0);
  const socket = useSharedSocket();

  useEffect(() => {
    if (!enabled) {
      // A logged-out viewer must not keep a stale badge from a previous session.
      setUnread(0);
      return;
    }
    let alive = true;
    api
      .notificationUnreadCount()
      .then((r) => {
        if (alive) setUnread(clampCount(r.unreadCount) ?? 0);
      })
      // A failed badge fetch is not worth surfacing: the number simply stays 0
      // and the next navigation retries.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!socket || !enabled) return;

    // Both events carry an ABSOLUTE count, so there is no local delta to keep in
    // sync and no ordering hazard — last write wins, correctly.
    const onNew = (p: NotificationNewPayload) => {
      const n = clampCount(p?.unreadCount);
      if (n !== null) setUnread(n);
    };
    const onRead = (p: NotificationReadPayload) => {
      const n = clampCount(p?.unreadCount);
      if (n !== null) setUnread(n);
    };

    socket.on('notification:new', onNew);
    socket.on('notification:read', onRead);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:read', onRead);
    };
  }, [socket, enabled]);

  return unread;
}

export interface UseNotificationsResult {
  items: NotificationView[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Remounts the list from a clean state — the only honest retry after a failed first fetch. */
  retry: () => void;
}

/**
 * The notifications page: one keyset-paginated list plus realtime inserts.
 *
 * Rows are GROUPED server-side, so an incoming `notification:new` is just as
 * likely to be an update of a row already on screen (a second person reacting to
 * the same post) as a brand-new one. Both cases are handled by replacing on `_id`
 * and moving the row to the front, which mirrors the server's `updatedAt` sort.
 */
export function useNotifications(unreadOnly: boolean): UseNotificationsResult {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const socket = useSharedSocket();

  /**
   * Guards the pagination request against a filter switch or a retry landing
   * mid-flight: an in-flight page from the previous filter must not append itself
   * to the new list.
   */
  const runRef = useRef(0);

  useEffect(() => {
    const run = ++runRef.current;
    setLoading(true);
    setError(null);
    api
      .listNotifications({ limit: 20, unreadOnly })
      .then((res) => {
        if (runRef.current !== run) return;
        setItems(res.items ?? []);
        setCursor(res.nextCursor ?? null);
        setUnreadCount(clampCount(res.unreadCount) ?? 0);
      })
      .catch((e: unknown) => {
        if (runRef.current !== run) return;
        setItems([]);
        setCursor(null);
        setError(e instanceof Error ? e.message : 'Không tải được thông báo');
      })
      .finally(() => {
        if (runRef.current === run) setLoading(false);
      });
  }, [unreadOnly, attempt]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const run = runRef.current;
    setLoadingMore(true);
    api
      .listNotifications({ limit: 20, before: cursor, unreadOnly })
      .then((res) => {
        if (runRef.current !== run) return;
        // Dedupe on append: a row bumped between pages can shift above the cursor
        // and arrive twice. Keeping the copy already on screen preserves the
        // realtime state the socket may have written to it.
        setItems((prev) => {
          const seen = new Set(prev.map((n) => n._id));
          return [...prev, ...(res.items ?? []).filter((n) => !seen.has(n._id))];
        });
        setCursor(res.nextCursor ?? null);
        setUnreadCount(clampCount(res.unreadCount) ?? 0);
      })
      .catch((e: unknown) => {
        if (runRef.current === run) {
          setError(e instanceof Error ? e.message : 'Không tải thêm được');
        }
      })
      .finally(() => {
        if (runRef.current === run) setLoadingMore(false);
      });
  }, [cursor, loadingMore, unreadOnly]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (p: NotificationNewPayload) => {
      const n = clampCount(p?.unreadCount);
      if (n !== null) setUnreadCount(n);

      const row = p?.notification;
      if (!row || typeof row._id !== 'string') return;
      // An incoming row is always unread, so it does not belong on screen while
      // the "read" side of the filter is showing — but the count above still applies.
      setItems((prev) => [row, ...prev.filter((x) => x._id !== row._id)]);
    };

    const onRead = (p: NotificationReadPayload) => {
      const n = clampCount(p?.unreadCount);
      if (n !== null) setUnreadCount(n);
      // Another tab marked everything read. Reflect it here rather than leaving
      // rows highlighted that the server now considers read.
      if (n === 0) {
        setItems((prev) =>
          prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })),
        );
      }
    };

    socket.on('notification:new', onNew);
    socket.on('notification:read', onRead);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:read', onRead);
    };
  }, [socket]);

  const markRead = useCallback(
    (id: string) => {
      // The unread check reads the RENDERED list. It must not be computed inside a
      // `setItems` updater: React defers updater functions to the render phase, so a
      // flag assigned in there is still false on the next line and the request below
      // would never be sent at all. React's eager-state optimization hides this
      // whenever the update queue happens to be empty, which made it intermittent —
      // clicking a row left the bell badge stuck until a reload.
      const target = items.find((x) => x._id === id);
      if (!target || target.readAt) return;

      // Optimistic: the row un-highlights immediately. The server's absolute count
      // arrives in the response and overrides the local guess below.
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, readAt: now } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));

      api
        .markNotificationRead(id)
        .then((r) => setUnreadCount(clampCount(r.unreadCount) ?? 0))
        // Roll back on failure rather than leaving the row lying about its state.
        .catch(() => {
          setItems((prev) => prev.map((x) => (x._id === id ? { ...x, readAt: null } : x)));
          setUnreadCount((c) => c + 1);
        });
    },
    [items],
  );

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    const snapshot = items;
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
    setUnreadCount(0);
    api.markAllNotificationsRead().catch(() => {
      setItems(snapshot);
      setUnreadCount(snapshot.filter((x) => !x.readAt).length);
    });
  }, [items]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return {
    items,
    unreadCount,
    loading,
    loadingMore,
    hasMore: cursor !== null,
    error,
    loadMore,
    markRead,
    markAllRead,
    retry,
  };
}
