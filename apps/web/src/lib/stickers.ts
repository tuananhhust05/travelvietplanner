/**
 * Sticker catalogue (contract part 2 §3).
 *
 * A sticker is a curated large-rendered Unicode glyph — there is no binary asset,
 * so nothing to upload, nothing to serve and nothing that can 404. Ids are
 * namespaced `<pack>.<name>` and are versioned in code on BOTH sides: this file
 * and `apps/api/src/modules/comments/stickers.ts` must stay in sync, because the
 * API `422`s an id it does not recognise.
 *
 * Keep this file free of React imports so server components can use it too.
 */

export interface Sticker {
  /** Namespaced catalogue id, e.g. `travel.plane`. */
  id: string;
  /** The Unicode glyph the web renders at 64px. */
  glyph: string;
  /** Vietnamese label, used as the accessible name / tooltip. */
  label: string;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}

/** Rendered size in px for a sticker attachment and for picker cells. */
export const STICKER_SIZE = 64;

/**
 * Shown for an id this client does not know. An older client WILL meet ids added
 * by a newer deploy; rendering a neutral glyph is correct, throwing is not.
 */
export const PLACEHOLDER_STICKER: Sticker = {
  id: 'unknown',
  glyph: '❔',
  label: 'Nhãn dán không xác định',
};

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'travel',
    name: 'Du lịch',
    stickers: [
      { id: 'travel.plane', glyph: '✈️', label: 'Máy bay' },
      { id: 'travel.island', glyph: '🏝️', label: 'Đảo' },
      { id: 'travel.map', glyph: '🗺️', label: 'Bản đồ' },
      { id: 'travel.beach', glyph: '🏖️', label: 'Bãi biển' },
      { id: 'travel.mountain', glyph: '⛰️', label: 'Núi' },
      { id: 'travel.camping', glyph: '🏕️', label: 'Cắm trại' },
      { id: 'travel.backpack', glyph: '🎒', label: 'Ba lô' },
      { id: 'travel.luggage', glyph: '🧳', label: 'Hành lý' },
      { id: 'travel.train', glyph: '🚆', label: 'Tàu hỏa' },
      { id: 'travel.motorbike', glyph: '🛵', label: 'Xe máy' },
      { id: 'travel.boat', glyph: '⛵', label: 'Thuyền' },
      { id: 'travel.camera', glyph: '📷', label: 'Máy ảnh' },
    ],
  },
  {
    id: 'emotion',
    name: 'Cảm xúc',
    stickers: [
      { id: 'emotion.love', glyph: '😍', label: 'Yêu thích' },
      { id: 'emotion.laugh', glyph: '🤣', label: 'Cười' },
      { id: 'emotion.wow', glyph: '😲', label: 'Ngạc nhiên' },
      { id: 'emotion.cry', glyph: '😭', label: 'Khóc' },
      { id: 'emotion.angry', glyph: '😤', label: 'Tức' },
      { id: 'emotion.cool', glyph: '😎', label: 'Ngầu' },
      { id: 'emotion.think', glyph: '🤔', label: 'Suy nghĩ' },
      { id: 'emotion.sleepy', glyph: '😴', label: 'Buồn ngủ' },
      { id: 'emotion.hug', glyph: '🤗', label: 'Ôm' },
      { id: 'emotion.heart', glyph: '❤️', label: 'Trái tim' },
      { id: 'emotion.thumbsup', glyph: '👍', label: 'Tuyệt' },
      { id: 'emotion.clap', glyph: '👏', label: 'Vỗ tay' },
    ],
  },
  {
    id: 'food',
    name: 'Ăn uống',
    stickers: [
      { id: 'food.pho', glyph: '🍜', label: 'Phở' },
      { id: 'food.rice', glyph: '🍚', label: 'Cơm' },
      { id: 'food.banhmi', glyph: '🥖', label: 'Bánh mì' },
      { id: 'food.coffee', glyph: '☕', label: 'Cà phê' },
      { id: 'food.beer', glyph: '🍺', label: 'Bia' },
      { id: 'food.tea', glyph: '🍵', label: 'Trà' },
      { id: 'food.seafood', glyph: '🦐', label: 'Hải sản' },
      { id: 'food.springroll', glyph: '🥟', label: 'Nem' },
      { id: 'food.fruit', glyph: '🥭', label: 'Trái cây' },
      { id: 'food.icecream', glyph: '🍦', label: 'Kem' },
      { id: 'food.hotpot', glyph: '🍲', label: 'Lẩu' },
      { id: 'food.cheers', glyph: '🥂', label: 'Cạn ly' },
    ],
  },
  {
    id: 'celebrate',
    name: 'Chúc mừng',
    stickers: [
      { id: 'celebrate.party', glyph: '🎉', label: 'Tiệc' },
      { id: 'celebrate.confetti', glyph: '🎊', label: 'Hoa giấy' },
      { id: 'celebrate.cake', glyph: '🎂', label: 'Bánh sinh nhật' },
      { id: 'celebrate.gift', glyph: '🎁', label: 'Quà' },
      { id: 'celebrate.balloon', glyph: '🎈', label: 'Bóng bay' },
      { id: 'celebrate.firework', glyph: '🎆', label: 'Pháo hoa' },
      { id: 'celebrate.trophy', glyph: '🏆', label: 'Cúp' },
      { id: 'celebrate.medal', glyph: '🏅', label: 'Huy chương' },
      { id: 'celebrate.star', glyph: '🌟', label: 'Ngôi sao' },
      { id: 'celebrate.sparkles', glyph: '✨', label: 'Lấp lánh' },
      { id: 'celebrate.flower', glyph: '💐', label: 'Hoa' },
      { id: 'celebrate.lantern', glyph: '🏮', label: 'Đèn lồng' },
    ],
  },
];

/** Flat id → sticker index, built once at module load. */
const STICKER_INDEX: Record<string, Sticker> = STICKER_PACKS.reduce<Record<string, Sticker>>(
  (acc, pack) => {
    for (const s of pack.stickers) acc[s.id] = s;
    return acc;
  },
  {},
);

/** All stickers, pack order preserved. */
export const ALL_STICKERS: Sticker[] = STICKER_PACKS.flatMap((p) => p.stickers);

/** True when this client knows the id. Use before sending it to the API. */
export function isKnownStickerId(id: unknown): boolean {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(STICKER_INDEX, id);
}

/**
 * Resolves an id to a renderable sticker. NEVER throws and never returns
 * undefined — an unknown id (newer server catalogue, corrupt attachment) yields
 * `PLACEHOLDER_STICKER` so one bad attachment cannot blank the whole thread.
 */
export function getSticker(id: unknown): Sticker {
  if (typeof id !== 'string') return PLACEHOLDER_STICKER;
  return STICKER_INDEX[id] ?? PLACEHOLDER_STICKER;
}

/** The glyph to render for an id, placeholder glyph when unknown. */
export function getStickerGlyph(id: unknown): string {
  return getSticker(id).glyph;
}

/** Pack lookup for the picker tabs. */
export function getStickerPack(packId: string): StickerPack | undefined {
  return STICKER_PACKS.find((p) => p.id === packId);
}
