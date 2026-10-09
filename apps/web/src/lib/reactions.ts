/**
 * Single source of truth for reaction metadata + pure optimistic-update logic.
 * Shared by ReactionBar / ReactionSummary / ReactionListModal and every page
 * that keeps post state. Keep this file free of React imports so it can be
 * used from server components too.
 */

export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích', color: '#1877F2' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích', color: '#F33E58' },
  { type: 'haha', emoji: '😆', label: 'Haha', color: '#F7B125' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: '#F7B125' },
  { type: 'sad', emoji: '😢', label: 'Buồn', color: '#F7B125' },
  { type: 'angry', emoji: '😡', label: 'Tức giận', color: '#E9710F' },
] as const;

export type ReactionDef = (typeof REACTIONS)[number];
export type ReactionType = ReactionDef['type'];
export type ReactionCounts = Record<ReactionType, number>;

export const REACTION_TYPES = REACTIONS.map((r) => r.type) as readonly ReactionType[];

export const REACTION_MAP: Record<ReactionType, ReactionDef> = REACTIONS.reduce(
  (acc, r) => {
    acc[r.type] = r;
    return acc;
  },
  {} as Record<ReactionType, ReactionDef>,
);

export const EMPTY_REACTION_COUNTS: ReactionCounts = {
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
};

/** Item returned by `GET /v1/posts/:id/reactions`. */
export interface ReactionListItem {
  _id: string;
  type: ReactionType;
  createdAt: string;
  user: {
    _id: string;
    displayName: string;
    handle?: string;
    avatarUrl?: string;
    accountType: string;
  };
  viewerFollowing: boolean;
  isSelf: boolean;
}

export interface ReactionState {
  viewerReaction: ReactionType | null;
  counts: ReactionCounts;
  total: number;
}

function isReactionType(v: unknown): v is ReactionType {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EMPTY_REACTION_COUNTS, v);
}

/** Narrows an untrusted value (e.g. an API field) to a ReactionType or null. */
export function toReactionType(v: unknown): ReactionType | null {
  return isReactionType(v) ? v : null;
}

/**
 * Accepts a partial/absent counts object from an older API deploy and returns
 * all six keys as non-negative integers. Every API read path must use this.
 */
export function normalizeCounts(raw: unknown): ReactionCounts {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY_REACTION_COUNTS };
  for (const { type } of REACTIONS) {
    const n = Number(src[type]);
    out[type] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return out;
}

/** Clamps an untrusted total to a non-negative integer. */
export function normalizeTotal(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Compact count label using the vi-VN decimal comma.
 * <1000 → integer, <1e6 → K, else M. One decimal, truncated, trailing ",0" dropped.
 * 1155 → '1,1K'; 1_200_000 → '1,2M'; 1000 → '1K'.
 */
export function formatCount(n: number): string {
  const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (v < 1000) return String(v);
  const [divisor, suffix] = v < 1_000_000 ? ([1000, 'K'] as const) : ([1_000_000, 'M'] as const);
  // Truncate (not round) to one decimal so 1155 reads as 1,1K.
  const tenths = Math.floor((v / divisor) * 10);
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return frac === 0 ? `${whole}${suffix}` : `${whole},${frac}${suffix}`;
}

/**
 * Types with count > 0, highest count first. Ties keep the canonical REACTIONS
 * order so the emoji cluster is stable between renders.
 */
export function topReactions(c: ReactionCounts, max = 3): ReactionType[] {
  const order = new Map(REACTIONS.map((r, i) => [r.type, i] as const));
  return REACTIONS.map((r) => r.type)
    .filter((type) => (c?.[type] ?? 0) > 0)
    .sort((a, b) => {
      const diff = (c[b] ?? 0) - (c[a] ?? 0);
      return diff !== 0 ? diff : (order.get(a) ?? 0) - (order.get(b) ?? 0);
    })
    .slice(0, Math.max(0, max));
}

/**
 * Counts/total after the viewer moves from `prev` to `next`.
 * prev=null → had not reacted. next=null → removing the reaction.
 * Pure, no side effects, never returns a negative number.
 *
 * | prev   | next   | counts               | total     |
 * |--------|--------|----------------------|-----------|
 * | null   | like   | like +1              | +1        |
 * | like   | love   | like -1, love +1     | unchanged |
 * | like   | like   | unchanged            | unchanged |
 * | like   | null   | like -1              | -1        |
 * | null   | null   | unchanged            | unchanged |
 */
export function applyReactionChange(
  counts: ReactionCounts,
  total: number,
  prev: ReactionType | null,
  next: ReactionType | null,
): { counts: ReactionCounts; total: number } {
  const c = normalizeCounts(counts);
  let t = normalizeTotal(total);

  if (prev === next) return { counts: c, total: t };

  if (prev) c[prev] = Math.max(0, c[prev] - 1);
  if (next) c[next] = Math.max(0, c[next] + 1);

  if (!prev && next) t = Math.max(0, t + 1);
  else if (prev && !next) t = Math.max(0, t - 1);

  return { counts: c, total: t };
}
