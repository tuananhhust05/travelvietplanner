export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://waki.autos';

export function postUrl(id: string): string {
  return `${SITE_URL}/post/${id}`;
}
