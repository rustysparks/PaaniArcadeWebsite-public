// backend/members.jsw
import wixData from 'wix-data';

const PROFILES = 'RacerProfiles';

/** Get the current member's profile row (or null). */
export async function getProfile(userId) {
  if (!userId) return null;
  const r = await wixData
    .query(PROFILES)
    .eq('userId', userId)
    .limit(1)
    .find({ suppressAuth: true });
  return r.items[0] || null;
}

/** Is a handle available? (optionally ignore the owner) */
export async function isHandleAvailable(handle, excludeUserId) {
  if (!handle) return false;
  const lc = String(handle).toLowerCase();
  const r = await wixData
    .query(PROFILES)
    .eq('handle_lc', lc)
    .find({ suppressAuth: true });
  return r.items.length === 0 || r.items.every(i => i.userId === excludeUserId);
}

/** Upsert the member's profile with the chosen handle and any extra fields. */
export async function claimHandle(userId, patch) {
  if (!userId) throw new Error('NO_USER');
  const lc = String(patch?.handle || patch?.slug || '').toLowerCase();
  if (!lc) throw new Error('NO_HANDLE');

  const set = {
    ...patch,
    userId,
    handle_lc: lc,
    slug: lc,
  };

  const existing = await getProfile(userId);
  if (existing) {
    return wixData.update(PROFILES, { ...existing, ...set }, { suppressAuth: true });
  }
  return wixData.insert(PROFILES, set, { suppressAuth: true });
}
