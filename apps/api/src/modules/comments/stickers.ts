/**
 * Sticker catalogue — shared shape with `apps/web/src/lib/stickers.ts`.
 *
 * A sticker is a curated Unicode glyph rendered large (64px on the web), not a
 * binary asset. There is nothing to upload, nothing to serve and nothing that
 * can 404. The API's only job is to reject an id that is not in this list, so
 * `attachments[].stickerId` can never become an arbitrary client-supplied
 * string that the web then has to defend against.
 *
 * Ids are namespaced `<pack>.<name>` and are part of the wire format: they are
 * stored on comment documents forever. Add ids freely, never rename or remove
 * one — an old stored id would then render as the web's neutral placeholder.
 */

export interface Sticker {
  id: string;
  glyph: string;
  label: string;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'travel',
    name: 'Du lịch',
    stickers: [
      { id: 'travel.plane', glyph: '✈️', label: 'Máy bay' },
      { id: 'travel.island', glyph: '🏝️', label: 'Đảo' },
      { id: 'travel.map', glyph: '🗺️', label: 'Bản đồ' },
      { id: 'travel.luggage', glyph: '🧳', label: 'Vali' },
      { id: 'travel.camera', glyph: '📷', label: 'Máy ảnh' },
      { id: 'travel.mountain', glyph: '⛰️', label: 'Núi' },
      { id: 'travel.beach', glyph: '🌊', label: 'Biển' },
      { id: 'travel.tent', glyph: '⛺', label: 'Cắm trại' },
      { id: 'travel.train', glyph: '🚆', label: 'Tàu hỏa' },
      { id: 'travel.motorbike', glyph: '🏍️', label: 'Xe máy' },
      { id: 'travel.compass', glyph: '🧭', label: 'La bàn' },
      { id: 'travel.sunset', glyph: '🌅', label: 'Bình minh' },
    ],
  },
  {
    id: 'emotion',
    name: 'Cảm xúc',
    stickers: [
      { id: 'emotion.love', glyph: '😍', label: 'Yêu thích' },
      { id: 'emotion.laugh', glyph: '😂', label: 'Cười' },
      { id: 'emotion.wow', glyph: '😮', label: 'Ngạc nhiên' },
      { id: 'emotion.cry', glyph: '😢', label: 'Khóc' },
      { id: 'emotion.cool', glyph: '😎', label: 'Ngầu' },
      { id: 'emotion.think', glyph: '🤔', label: 'Suy nghĩ' },
      { id: 'emotion.sleepy', glyph: '😴', label: 'Buồn ngủ' },
      { id: 'emotion.heart', glyph: '❤️', label: 'Trái tim' },
      { id: 'emotion.thumbsup', glyph: '👍', label: 'Tuyệt' },
      { id: 'emotion.clap', glyph: '👏', label: 'Vỗ tay' },
      { id: 'emotion.hug', glyph: '🤗', label: 'Ôm' },
      { id: 'emotion.shy', glyph: '😳', label: 'Mắc cỡ' },
    ],
  },
  {
    id: 'food',
    name: 'Đồ ăn',
    stickers: [
      { id: 'food.pho', glyph: '🍜', label: 'Phở' },
      { id: 'food.banhmi', glyph: '🥬', label: 'Bánh mì' },
      { id: 'food.coffee', glyph: '☕', label: 'Cà phê' },
      { id: 'food.rice', glyph: '🍚', label: 'Cơm' },
      { id: 'food.springroll', glyph: '🥟', label: 'Chả giò' },
      { id: 'food.seafood', glyph: '🦐', label: 'Hải sản' },
      { id: 'food.fruit', glyph: '🥭', label: 'Trái cây' },
      { id: 'food.icecream', glyph: '🍦', label: 'Kem' },
      { id: 'food.beer', glyph: '🍺', label: 'Bia' },
      { id: 'food.tea', glyph: '🍵', label: 'Trà' },
      { id: 'food.hotpot', glyph: '🍲', label: 'Lẩu' },
      { id: 'food.cake', glyph: '🍰', label: 'Bánh ngọt' },
    ],
  },
  {
    id: 'celebrate',
    name: 'Chúc mừng',
    stickers: [
      { id: 'celebrate.party', glyph: '🎉', label: 'Tiệc' },
      { id: 'celebrate.confetti', glyph: '🎊', label: 'Hoa giấy' },
      { id: 'celebrate.gift', glyph: '🎁', label: 'Quà' },
      { id: 'celebrate.cheers', glyph: '🥂', label: 'Cạn ly' },
      { id: 'celebrate.fireworks', glyph: '🎆', label: 'Pháo hoa' },
      { id: 'celebrate.trophy', glyph: '🏆', label: 'Cúp' },
      { id: 'celebrate.star', glyph: '⭐', label: 'Ngôi sao' },
      { id: 'celebrate.flower', glyph: '💐', label: 'Hoa' },
      { id: 'celebrate.balloon', glyph: '🎈', label: 'Bóng bay' },
      { id: 'celebrate.cakebday', glyph: '🎂', label: 'Bánh sinh nhật' },
      { id: 'celebrate.sparkles', glyph: '✨', label: 'Lấp lánh' },
      { id: 'celebrate.medal', glyph: '🎖️', label: 'Huân chương' },
    ],
  },
];

/**
 * Flattened id set, built once at module load. The route validator runs this on
 * every attachment of every comment write, so a linear scan over four packs is
 * the wrong shape even at this size.
 */
const STICKER_IDS: ReadonlySet<string> = new Set(
  STICKER_PACKS.flatMap((pack) => pack.stickers.map((sticker) => sticker.id)),
);

/**
 * True when `id` exists in the catalogue. Imported by the route validator,
 * which turns a false into a `422`.
 *
 * Takes `unknown`-friendly input on purpose: zod hands over a validated string,
 * but the type guard means a caller that skips validation cannot pass an object
 * whose `toString` happens to match.
 */
export function isValidStickerId(id: string): boolean {
  return typeof id === 'string' && STICKER_IDS.has(id);
}

/** Lookup for rendering/logging a stored id. `null` when unknown. */
export function findSticker(id: string): Sticker | null {
  if (typeof id !== 'string') return null;
  for (const pack of STICKER_PACKS) {
    const hit = pack.stickers.find((sticker) => sticker.id === id);
    if (hit) return hit;
  }
  return null;
}
