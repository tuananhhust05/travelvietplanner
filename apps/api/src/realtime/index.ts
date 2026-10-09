import type { Server as IOServer } from 'socket.io';

let io: IOServer | null = null;

export function setIO(server: IOServer): void {
  io = server;
}

export function getIO(): IOServer {
  if (!io) throw new Error('socket.io not initialized');
  return io;
}