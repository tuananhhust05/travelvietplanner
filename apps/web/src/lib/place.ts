export interface PlaceLike {
  name?: string;
  lat?: number;
  lng?: number;
}

export interface AddressLike {
  commune?: string;
  province?: string;
  label?: string;
}

/** Matches a name that is really just a "lat, lng" pair. */
const COORD_ONLY = /^\s*-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?\s*$/;

/**
 * Label to show for a post's location. The server-resolved commune/province wins
 * over `place.name`, which older posts stored as raw coordinates.
 */
export function placeLabel(
  place?: PlaceLike | null,
  address?: AddressLike | null,
): string {
  if (address?.label) return address.label;
  const name = place?.name?.trim();
  if (name && !COORD_ONLY.test(name)) return name;
  return '';
}
