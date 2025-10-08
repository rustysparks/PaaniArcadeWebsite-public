// ---------- IMPORTS ----------
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';

import { listVideosForProfile, isLiked, toggleLike } from 'backend/video.jsw';

// ---------- PAGE STATE ----------
const PAGE_SIZE = 5;
let ownerId = null;
let profileRow = null;
let nextCursor = null;
let loaded = [];

// ---------- PAGE READY ----------
$w.onReady(async () => {
  const ds = $w('#dynamicDataset');       // your dynamic dataset on the public profile page
  const editBtn = $w('#btnEditMine');     // add a regular Button with this id
  if (editBtn && editBtn.hide) editBtn.hide();

  await ds.onReady(async () => {
    profileRow = ds.getCurrentItem();
    ownerId = profileRow?.userId || null;

    // Owner-only "Edit Profile" button
    try {
      const me = await currentMember.getMember();
      if (me && profileRow && profileRow.userId === me._id && editBtn) {
        editBtn.show && editBtn.show();
        editBtn.onClick && editBtn.onClick(() => {
          // ⬇️ change to your actual edit page path if different
          wixLocation.to('/members-area/edit-profile');
        });
      }
    } catch (_) {}

    // Videos (if you placed a repeater)
    const rep = $w('#repPublicVideos');
    if (rep && rep.onItemReady) {
      rep.onItemReady(bindVideoItem);
      await loadMoreVideos();
      const more = $w('#btnLoadMore');
      if (more && more.onClick) more.onClick(loadMoreVideos);
    }
  });
});

// ---------- VIDEO PAGING ----------
async function loadMoreVideos() {
  if (!profileRow?._id) return;
  const rep = $w('#repPublicVideos');
  const more = $w('#btnLoadMore');

  const r = await listVideosForProfile(profileRow._id, PAGE_SIZE, nextCursor)
    .catch(() => ({ items: [], nextCursor: null }));

  loaded = loaded.concat(r.items || []);
  nextCursor = r.nextCursor || null;

  if (rep && typeof rep.data !== 'undefined') rep.data = loaded;

  if (more && more.expand && more.collapse) {
    (!nextCursor || (r.items || []).length === 0) ? more.collapse() : more.expand();
  }
}

// ---------- REPEATER BINDER ----------
function bindVideoItem($item, item) {
  const t = $item('#txtVidTitle'); if (t) t.text = item.title || '';
  const d = $item('#txtVidDesc');  if (d) d.text = item.description || '';

  const vp = $item('#vpVideo');
  if (vp && typeof vp.videoUrl !== 'undefined') vp.videoUrl = item.youtubeUrl || '';
  else if (vp && typeof vp.src !== 'undefined')  vp.src = item.youtubeUrl || '';

  const likes = $item('#lblLikes');     if (likes) likes.text = String(item.likesCount || 0);
  const comm  = $item('#lblComments');  if (comm)  comm.text  = String(item.commentsCount || 0);

  initLikeUI($item, item);

  const btnC = $item('#btnComments');
  if (btnC && btnC.onClick) {
    btnC.onClick(async () => {
      const res = await wixWindow.openLightbox('CommentsLB', {
        videoId: item._id,
        ownerUserId: ownerId
      }).catch(() => null);

      if (res && typeof res.commentsCount === 'number' && comm) {
        comm.text = String(res.commentsCount);
      }
    });
  }
}

// ---------- LIKE HELPERS ----------
async function initLikeUI($item, item) {
  setLikeUI($item, false, item.likesCount || 0);

  try {
    const liked = await isLiked(item._id);
    setLikeUI($item, liked, item.likesCount || 0);
  } catch (_) {}

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

  const off = $item('#icoHeartOff'); if (off && off.onClick) off.onClick(toggle);
  const on  = $item('#icoHeartOn');  if (on  && on.onClick)  on.onClick(toggle);
}

function setLikeUI($item, liked, count) {
  const off = $item('#icoHeartOff');
  const on  = $item('#icoHeartOn');

  if (off && on && off.collapse && on.collapse) {
    if (liked) { on.expand && on.expand(); off.collapse && off.collapse(); }
    else       { off.expand && off.expand(); on.collapse && on.collapse(); }
  }

  const lbl = $item('#lblLikes'); if (lbl) lbl.text = String(count ?? 0);
}

function disableLikeIcons($item, disabled) {
  const off = $item('#icoHeartOff');
  const on  = $item('#icoHeartOn');
  if (off && on) {
    if (disabled) { off.disable && off.disable(); on.disable && on.disable(); }
    else          { off.enable  && off.enable();  on.enable  && on.enable();  }
  }
}
