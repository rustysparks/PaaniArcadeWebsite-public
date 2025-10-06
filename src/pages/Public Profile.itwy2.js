// ---------- IMPORTS (must be at top) ----------
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';

// backend helpers you created in backend/videos.jsw


import {
  listVideosForProfile,
  isLiked,
  toggleLike
} from 'backend/video.jsw';


// ---------- CONSTANTS ----------
const FOLLOW_COLLECTION = 'Follows';
const PAGE_SIZE = 5;

// ---------- STATE ----------
let ownerId = null;        // member _id of the profile owner
let profileRow = null;     // RacerProfiles row bound to this page
let nextCursor = null;     // paging cursor for videos
let loaded = [];           // accumulated loaded videos

// ---------- PAGE READY ----------
$w.onReady(async () => {
  // Wait for owner dataset (RacerProfiles) to be ready
  await $w('#publicProfileDataset').onReady();
  profileRow = $w('#publicProfileDataset').getCurrentItem();
  if (!profileRow || !profileRow.userId) {
    // No owner data — hide action buttons just in case
    if ($w('#btnFollow').hide) $w('#btnFollow').hide();
    if ($w('#btnEditProfile').hide) $w('#btnEditProfile').hide();
    return;
  }
  ownerId = profileRow.userId;

  // Set up Edit vs Follow buttons
  await setupOwnerAndFollowButtons(ownerId);

  // Wire repeater binder
  $w('#repPublicVideos').onItemReady(bindVideoItem);

  // First page
  await loadMoreVideos();

  // Load more
  $w('#btnLoadMore').onClick(loadMoreVideos);
});

// ---------- OWNER / FOLLOW UI ----------
async function setupOwnerAndFollowButtons(ownerUserId) {
  const { member } = await currentMember.getMember();

  if (!member) {
    // Not logged in: hide Edit, show Follow (you can disable or route to login on click)
    showFollow('Follow');
    hideEdit();
    // Optional: require login on click
    // $w('#btnFollow').onClick(() => wixLocation.to('/signup-login'));
    return;
  }

  const viewerId = member._id;

  if (viewerId === ownerUserId) {
    // This is the owner’s own page: show Edit Profile, hide Follow
    hideFollow();
    showEdit(() => wixLocation.to('/my-profile')); // change to your edit page path if different
    return;
  }

  // Not owner: show Follow/Unfollow
  hideEdit();
  showFollow('Follow');

  // Check if already following
  const r = await wixData.query(FOLLOW_COLLECTION)
    .eq('followerId', viewerId)
    .eq('followeeId', ownerUserId)
    .limit(1)
    .find();

  let isFollowing = r.items.length > 0;
  $w('#btnFollow').label = isFollowing ? 'Unfollow' : 'Follow';

  $w('#btnFollow').onClick(async () => {
    $w('#btnFollow').disable();
    try {
      if (isFollowing) {
        await wixData.remove(FOLLOW_COLLECTION, r.items[0]._id);
        isFollowing = false;
        $w('#btnFollow').label = 'Follow';
      } else {
        const inserted = await wixData.insert(FOLLOW_COLLECTION, {
          followerId: viewerId,
          followeeId: ownerUserId,
          createdAt: new Date()
        });
        r.items = [inserted]; // keep handle so next click can remove
        isFollowing = true;
        $w('#btnFollow').label = 'Unfollow';
      }
    } finally {
      $w('#btnFollow').enable();
    }
  });
}

function showEdit(onClick) {
  if ($w('#btnEditProfile').show) $w('#btnEditProfile').show();
  if (onClick) $w('#btnEditProfile').onClick(onClick);
}
function hideEdit() {
  if ($w('#btnEditProfile').hide) $w('#btnEditProfile').hide();
}
function showFollow(label = 'Follow') {
  if ($w('#btnFollow').show) $w('#btnFollow').show();
  $w('#btnFollow').label = label;
}
function hideFollow() {
  if ($w('#btnFollow').hide) $w('#btnFollow').hide();
}

// ---------- VIDEO PAGING ----------
async function loadMoreVideos() {
  const r = await listVideosForProfile(profileRow._id, PAGE_SIZE, nextCursor);
  loaded = loaded.concat(r.items || []);
  nextCursor = r.nextCursor || null;

  // Bind data into repeater
  $w('#repPublicVideos').data = loaded;

  // Handle Load More visibility
  if (!nextCursor || (r.items || []).length === 0) {
    $w('#btnLoadMore').collapse?.();
  } else {
    $w('#btnLoadMore').expand?.();
  }
}

// ---------- REPEATER ITEM BINDER ----------
function bindVideoItem($item, item) {
  // Title/Description
  $item('#txtVidTitle').text = item.title || '';
  $item('#txtVidDesc').text = item.description || '';

  // Video player URL (Wix Video Player accepts standard YouTube watch links)
  if ($item('#vpVideo').videoUrl !== undefined) {
    $item('#vpVideo').videoUrl = item.youtubeUrl || '';
  } else if ($item('#vpVideo').src !== undefined) {
    $item('#vpVideo').src = item.youtubeUrl || '';
  }

  // Counts
  $item('#lblLikes').text = String(item.likesCount || 0);
  $item('#lblComments').text = String(item.commentsCount || 0);

  // Like UI (icons)
  initLikeUI($item, item);

  // Comments button -> open lightbox, and update count on return
  $item('#btnComments').onClick(async () => {
    const res = await wixWindow.openLightbox('CommentsLB', {
      videoId: item._id,
      ownerUserId: ownerId
    });
    if (res && typeof res.commentsCount === 'number') {
      item.commentsCount = res.commentsCount;
      $item('#lblComments').text = String(item.commentsCount);
    }
  });
}

// ---------- LIKE HELPERS ----------
async function initLikeUI($item, item) {
  // Default: treat as not-liked until confirmed
  setLikeUI($item, false, item.likesCount || 0);

  try {
    const liked = await isLiked(item._id);
    setLikeUI($item, liked, item.likesCount || 0);
  } catch (_e) {
    // Not logged in or backend error – leave as unliked
  }

  const handleToggle = async () => {
    disableLikeIcons($item, true);
    try {
      const res = await toggleLike(item._id);
      item.likesCount = res.likesCount; // keep in sync
      setLikeUI($item, res.liked, res.likesCount);
    } finally {
      disableLikeIcons($item, false);
    }
  };

  $item('#icoHeartOff').onClick(handleToggle);
  $item('#icoHeartOn').onClick(handleToggle);
}

function setLikeUI($item, liked, count) {
  if (liked) {
    $item('#icoHeartOn').expand?.();
    $item('#icoHeartOff').collapse?.();
  } else {
    $item('#icoHeartOff').expand?.();
    $item('#icoHeartOn').collapse?.();
  }
  $item('#lblLikes').text = String(count ?? 0);

  // Accessibility label
  if ($item('#icoHeartOff').ariaLabel !== undefined) {
    const label = liked ? 'Unlike (liked)' : 'Like';
    $item('#icoHeartOff').ariaLabel = label;
    $item('#icoHeartOn').ariaLabel = label;
  }
}

function disableLikeIcons($item, disabled) {
  const off = $item('#icoHeartOff');
  const on  = $item('#icoHeartOn');
  if (disabled) {
    off.disable?.();
    on.disable?.();
  } else {
    off.enable?.();
    on.enable?.();
  }
}
