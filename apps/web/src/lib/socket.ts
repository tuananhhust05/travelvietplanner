import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

type SocketListener = (socket: Socket | null) => void;
const listeners = new Set<SocketListener>();

function notify(): void {
  const current = socket;
  // Deferred so a `getSocket()` call made from inside a React effect cannot
  // re-enter a subscriber synchronously while that effect is still running.
  queueMicrotask(() => {
    for (const fn of listeners) fn(current);
  });
}

/**
 * Observe creation/teardown of the shared socket.
 *
 * Consumers that bind listeners need to know when the singleton is replaced:
 * a component mounted before the auth token existed would otherwise hold
 * `null` forever and silently receive no events.
 */
export function subscribeSocketChange(fn: SocketListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socket) return socket;

  const token = localStorage.getItem('tvp_token');
  if (!token) return null;

  // NOTE: no `disconnect` handler nulling this out. socket.io reconnects on its
  // own; dropping the reference made the next `getSocket()` open a SECOND
  // connection while existing listeners stayed bound to the first instance.
  socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
  notify();
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    notify();
  }
}
