export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(amount?: number): string {
  if (typeof amount !== 'number') return '';
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

/** Range of travel dates, collapsed to a single date when from === to. */
export function formatDateRange(from?: string, to?: string): string {
  const a = formatDate(from);
  const b = formatDate(to);
  if (!a) return '';
  if (!b || b === a) return a;
  return `${a} – ${b}`;
}
