export function receiptCategory(tx: { productCategory?: string | null; items?: unknown }): string {
  if (tx.productCategory?.trim()) return tx.productCategory.trim();
  let items = tx.items;
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
  if (!Array.isArray(items)) return '—';
  return [...new Set(items.map(item => typeof item?.category === 'string' ? item.category.trim() : '').filter(Boolean))].join(', ') || '—';
}
export function receiptOrderNumber(note?: string | null): string {
  return note?.match(/(?:order\s*#\s*|^#)([A-Za-z0-9_-]+)/i)?.[1] || '—';
}
