import wixData from 'wix-data';

export async function beforeInsert(item) { return normalize(item); }
export async function beforeUpdate(item) { return normalize(item); }

function toSlug(s) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function normalize(item) {
  // Ensure lowercase copy & slug
  if (item.handle) {
    const lc = item.handle.trim().toLowerCase();
    item.handle_lc = lc;
    item.slug = toSlug(item.handle);   // <— used by the dynamic page URL
  }
  return item;
}
