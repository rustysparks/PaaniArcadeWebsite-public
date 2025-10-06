// masterPage.js
import wixData from 'wix-data';
import wixWindow from 'wix-window';
import { authentication, currentMember } from 'wix-members-frontend';

const COLLECTION = 'RacerProfiles';

// TODO: replace these with your real media URLs (copy from Media Manager)
// You can use wix:image://… or https://static.wixstatic.com/...
const DEFAULT_AVATAR = 'wix:image://default-avatar.png';
const DEFAULT_COVER  = 'wix:image://default-cover.jpg';

// Your own member _id (the account you want everyone to auto-follow)
// Tip: Console log `member._id` on your site while logged in as you, then paste it here.
const ADMIN_MEMBER_ID = 'PUT-YOUR-MEMBER-ID-HERE';

// ---- helpers ----
async function getMe() {
  const { member } = await currentMember.getMember();
  return member ?? null;
}

async function ensureProfile(userId) {
  let r = await wixData.query(COLLECTION).eq('userId', userId).limit(1).find();
  if (!r.items.length) {
    const item = {
      userId,
      avatar: DEFAULT_AVATAR,
      coverImage: DEFAULT_COVER,
      commentsRequireApproval: true,
      commentsFriendsOnly: false,
      followersCount: 0,
      followingCount: 0
    };
    const created = await wixData.insert(COLLECTION, item, { suppressAuth: true });
    return created;
  }
  // backfill defaults if older rows were missing them
  const prof = r.items[0];
  let dirty = false;
  if (!prof.avatar)     { prof.avatar     = DEFAULT_AVATAR; dirty = true; }
  if (!prof.coverImage) { prof.coverImage = DEFAULT_COVER;  dirty = true; }
  if (dirty) await wixData.update(COLLECTION, prof, { suppressAuth: true });
  return prof;
}

async function autoFollowBothWays(newUserId) {
  // Follows collection: followerId, followeeId
  const exists1 = await wixData.query('Follows')
    .eq('followerId', newUserId).eq('followeeId', ADMIN_MEMBER_ID).hasSome('_id', ['x']).find();

  if (!exists1.items.length) {
    await wixData.insert('Follows', { followerId: newUserId, followeeId: ADMIN_MEMBER_ID }, { suppressAuth: true });
  }
  const exists2 = await wixData.query('Follows')
    .eq('followerId', ADMIN_MEMBER_ID).eq('followeeId', newUserId).hasSome('_id', ['x']).find();

  if (!exists2.items.length) {
    await wixData.insert('Follows', { followerId: ADMIN_MEMBER_ID, followeeId: newUserId }, { suppressAuth: true });
  }
}

async function maybeOpenHandleSetup(prof, userId) {
  if (!prof.handle) {
    const res = await wixWindow.openLightbox('HandleSetup', { userId });
    // res?.ok true when user saved a handle
  }
}

async function onLoggedIn() {
  const me = await getMe();
  if (!me) return;
  const prof = await ensureProfile(me._id);
  // (First login) auto-follow both ways and only once.
  await autoFollowBothWays(me._id);
  await maybeOpenHandleSetup(prof, me._id);
}

$w.onReady(async () => {
  // Run on initial load (if already logged-in)
  await onLoggedIn();
  // Also run when the login event fires
  authentication.onLogin(onLoggedIn);
});
