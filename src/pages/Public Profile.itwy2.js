// Public Profile (dynamic)

import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';

import { listVideosForProfile, isLiked, toggleLike } from 'backend/video.jsw';

// ===== tweak this if your edit page lives elsewhere
const EDIT_PROFILE_PATH = '/members-area/edit-profile';

// ===== collections / paging
const PROFILES          = 'RacerProfiles';
const FOLLOW_COLLECTION = 'Follows';
const PAGE_SIZE         = 6;

// ===== element ids expected on this page =====
// Dataset:  #dynamicDataset  (or #publicProfileDataset; both are supported)
// Buttons:  #btnEditMine, #btnFollow, #btnLoadMore
// Repeater: #repPublicVideos with children:
//   #txtVidTitle #txtVidDesc #vpVideo #lblLikes #lblComments
//   #icoHeartOff #icoHeartOn #btnComments

const el = (id) => { try { return $w(id); } catch { return null; } };

function getDynDataset() {
  const ids = ['#dynamicDataset', '#publicProfileDataset', '#dataset1'];
  for (const id of ids) {
    try {
      const ds = $w(id);
      if (ds && typeof ds.onReady === 'function') return ds;
    } catch (_) {}
  }
  return null;
}

// ---------- state ----------
let ownerUserId  = null;   // member _id of the profile owner (from dataset.userId)
let viewerUserId = null;   // logged-in viewer (if any)
let profileRowId = null;   // RacerProfiles row _id bound to this page
let nextCursor   = null;
let loaded       = [];

// ---------- page ----------
$w.onReady(async () => {
  const ds = getDynDataset();
  if (!ds) {
    console.warn('Dynamic dataset not found. Ensure your page has #dynamicDataset.');
    return;
  }

  el('#btnEditMine')?.hide?.();
  el('#btnFollow')?.hide?.();
  el('#btnLoadMore')?.hide?.();

  await ds.onReady(async () => {
    const item = ds.getCurrentItem();
    profileRowId = item?._id || null;
    ownerUserId  = item?.userId || null; // make sure your collection has a userId field

    // who is viewing?
    const me = await currentMember.getMember().catch(() => null);
    viewerUserId = me?._id || null;

    // Edit vs Follow
    if (viewerUserId && ownerUserId && viewerUserId === ownerUserId) {
      const b = el('#btnEditMine');
      b?.show?.();
      b?.onClick?.(() => wixLocation.to(EDIT_PROFILE_PATH));
      el('#btnFollow')?.hide?.();
    } else {
      await setupFollowButton();
    }

    // videos
    wireVideoRepeater();
    await loadMoreVideos();
    el('#btnLoadMore')?.onClick?.(loadMoreVideos);
  });
});

// ---------- follow / unfollow ----------
async function setupFollowButton() {
  const btn = el('#btnFollow');
  if (!btn || !ownerUserId) return;

  // not logged in → route to login (or hide if you prefer)
  if (!viewerUserId) {
    btn.show?.();
    btn.label = 'Follow';
    btn.onClick(() => wixLocation.to('/signup-login'));
    return;
  }

  // check existing follow
  const r = await wixData.query(FOLLOW_COLLECTION)
    .eq('followerId', viewerUserId)
    .eq('followeeId', ownerUserId)
    .limit(1).find();

  let isFollowing = r.items.length > 0;
  btn.show?.();
  btn.label = isFollowing ? 'Unfollow' : 'Follow';

  btn.onClick(async () => {
    btn.disable?.();
    try {
      if (isFollowing) {
        await wixData.remove(FOLLOW_COLLECTION, r.items[0]._id).catch(() => {});
        isFollowing = false;
        btn.label = 'Follow';
      } else {
        const inserted = await wixData.insert(FOLLOW_COLLECTION, {
          followerId: viewerUserId,
          followeeId: ownerUserId,
          createdAt: new Date()
        });
        r.items = [inserted];
        isFollowing = true;
        btn.label = 'Unfollow';
      }
    } finally {
      btn.enable?.();
    }
  });
}

// ---------- videos ----------
function wireVideoRepeater() {
  const rep = el('#repPublicVideos');
  if (!rep) return;

  rep.onItemReady(($item, item) => {
    $item('#txtVidTitle')?.text = item.title || '';
    $item('#txtVidDesc')?.text  = item.description || '';

    const player = $item('#vpVideo');
    if (player) {
      if (player.videoUrl !== undefined) player.videoUrl = item.youtubeUrl || '';
      else if (player.src !== undefined) player.src = item.youtubeUrl || '';
      if (player.autoPlay !== undefined) player.autoPlay = false;
      if (player.controls  !== undefined) player.controls  = true;
    }

    $item('#lblLikes')?.text     = String(item.likesCount ?? 0);
    $item('#lblComments')?.text  = String(item.commentsCount ?? 0);

    initLikeUI($item, item);

    $item('#btnComments')?.onClick(async () => {
      const res = await wixWindow.openLightbox('CommentsLB', { videoId: item._id, ownerUserId });
      if (res && typeof res.commentsCount === 'number') {
        item.commentsCount = res.commentsCount;
        $item('#lblComments').text = String(item.commentsCount);
      }
    });
  });
}

async function loadMoreVideos() {
  if (!profileRowId) return;
  const r = await listVideosForProfile(profileRowId, PAGE_SIZE, nextCursor)
              .catch(() => ({ items: [], nextCursor: null }));

  loaded     = loaded.concat(r.items || []);
  nextCursor = r.nextCursor || null;

  const rep = el('#repPublicVideos');
  if (rep) rep.data = loaded;

  const lm = el('#btnLoadMore');
  if (!nextCursor || (r.items || []).length === 0) lm?.collapse?.(); else lm?.expand?.();
}

// ---------- likes ----------
async function initLikeUI($item, item) {
  setLikeUI($item, false, item.likesCount || 0);

  let liked = false;
  try { liked = await isLiked(item._id); } catch (_) {}
  setLikeUI($item, liked, item.likesCount || 0);

  const toggle = async () => {
    disableLikeIcons($item, true);
    try {
      const res = await toggleLike(item._id);
      item.likesCount = res.likesCount;
      setLikeUI($item, res.liked, res.likesCount);
    } finally {
      disableLikeIcons($item, false);
    }
  };

  $item('#icoHeartOff')?.onClick(toggle);
  $item('#icoHeartOn')?.onClick(toggle);
}

function setLikeUI($item, liked, count) {
  if (liked) {
    $item('#icoHeartOn')?.expand?.();
    $item('#icoHeartOff')?.collapse?.();
  } else {
    $item('#icoHeartOff')?.expand?.();
    $item('#icoHeartOn')?.collapse?.();
  }
  $item('#lblLikes')?.text = String(count ?? 0);
}

function disableLikeIcons($item, disabled) {
  if (disabled) {
    $item('#icoHeartOff')?.disable?.();
    $item('#icoHeartOn')?.disable?.();
  } else {
    $item('#icoHeartOff')?.enable?.();
    $item('#icoHeartOn')?.enable?.();
  }
}
