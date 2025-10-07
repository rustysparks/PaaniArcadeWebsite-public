// Edit Profile (/blank)

// ===== Imports =====
import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';

import { createVideo, getMyVideos, deleteVideo } from 'backend/video.jsw';
import { getProfile } from 'backend/members.jsw';

// ===== Dataset IDs on this page (from your screenshot) =====
const EDIT_DATASET_ID     = '#profileDataset'; // main dataset (12 connected elements)
const OPTIONAL_DATASET_ID = '#dataset1';       // secondary dataset (3 connected elements)

// ===== Element IDs expected on this page =====
// #uplAvatar, #imgAvatar, #uplCover, #imgCover, #btnSaveProfile, #saveHint
// #repMyVideos, #btnAddVideo, #inpYoutubeUrl, #inpVidTitle, #inpVidDesc

// ===== Globals =====
let gUserId = null;
let gProfileId = null;
let uploadsInProgress = 0;

// ===== Helpers =====
function lockSave(lock) {
  const btn = $w('#btnSaveProfile');
  if (btn && typeof btn.enable === 'function' && typeof btn.disable === 'function') {
    lock ? btn.disable() : btn.enable();
  }
}
function beginUpload() {
  uploadsInProgress += 1;
  lockSave(true);
  $w('#saveHint')?.show?.();
}
function endUpload() {
  uploadsInProgress = Math.max(0, uploadsInProgress - 1);
  if (uploadsInProgress === 0) {
    lockSave(false);
    $w('#saveHint')?.hide?.();
  }
}
function toYouTubeWatchUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/watch?v=${u.pathname.replace('/', '')}`;
    }
    return url;
  } catch {
    return url;
  }
}

// Video repeater item renderer
function wireVideoRepeater() {
  if (!$w('#repMyVideos')) return;
  $w('#repMyVideos').onItemReady(($item, item) => {
    $item('#txtMyVidTitle').text = item.title || '';
    $item('#txtMyVidDesc').text  = item.description || '';

    const url = toYouTubeWatchUrl(item.youtubeUrl || '');
    if ($item('#vpVideo')?.videoUrl !== undefined) {
      $item('#vpVideo').videoUrl = url;
    } else if ($item('#vpVideo')?.src !== undefined) {
      $item('#vpVideo').src = url;
    }
    if ($item('#vpVideo')?.autoPlay !== undefined) $item('#vpVideo').autoPlay = false;
    if ($item('#vpVideo')?.controls  !== undefined) $item('#vpVideo').controls  = true;

    $item('#btnDeleteVideo')?.onClick(async () => {
      try {
        await deleteVideo(item._id);
        await loadMyVideos();
      } catch (e) {
        console.error('Delete failed', e);
      }
    });
  });
}

// Load videos for this member
async function loadMyVideos() {
  if (!gUserId || !gProfileId || !$w('#repMyVideos')) return;
  const videos = await getMyVideos({ userId: gUserId, profileId: gProfileId });
  $w('#repMyVideos').data = videos || [];
}

// Create a new video from inputs
async function addVideoFromInputs() {
  const youtubeUrl  = ($w('#inpYoutubeUrl')?.value || '').trim();
  const title       = ($w('#inpVidTitle')?.value || '').trim();
  const description = ($w('#inpVidDesc')?.value || '').trim();
  if (!youtubeUrl) return;

  await createVideo({
    profileId: gProfileId,
    userId: gUserId,
    youtubeUrl,
    title,
    description,
    isPublic: true
  });

  if ($w('#inpYoutubeUrl')) $w('#inpYoutubeUrl').value = '';
  if ($w('#inpVidTitle'))   $w('#inpVidTitle').value   = '';
  if ($w('#inpVidDesc'))    $w('#inpVidDesc').value    = '';

  await loadMyVideos();
}

// Safely wait for a dataset by ID (if it exists and supports onReady)
function datasetReady(id) {
  try {
    const ds = $w(id);
    if (ds && typeof ds.onReady === 'function') {
      return new Promise(resolve => ds.onReady(resolve));
    }
  } catch (_) {} // element may not exist; ignore
  return Promise.resolve();
}

// ===== Page init =====
$w.onReady(async () => {
  try {
    // 0) Prevents “onReady callback must be a function” errors
    await datasetReady(EDIT_DATASET_ID);
    await datasetReady(OPTIONAL_DATASET_ID);

    // 1) Who’s logged in?
    const member = await currentMember.getMember();   // fixed (no destructuring)
    if (!member) return;
    gUserId = member._id;

    // 2) Handle gate: open HandleSetup if no handle yet
    const row = await getProfile(gUserId);
    if (!row?.handle) {
      wixWindow.openLightbox('HandleSetup');          // exact lightbox name
    }

    // 3) Ensure we have a RacerProfiles row to attach videos to
    let r = await wixData.query('RacerProfiles').eq('userId', gUserId).limit(1).find();
    let profile = r.items[0];
    if (!profile) {
      profile = await wixData.insert('RacerProfiles', { userId: gUserId });
    }
    gProfileId = profile._id;

    // 4) Avatar upload
    if ($w('#uplAvatar')?.onChange) {
      $w('#uplAvatar').onChange(async () => {
        if (!$w('#uplAvatar').value?.length) return;
        beginUpload();
        try {
          const file = await $w('#uplAvatar').startUpload();
          if (file?.fileUrl && $w('#imgAvatar')) $w('#imgAvatar').src = file.fileUrl;
        } catch (err) {
          console.error('Avatar upload failed:', err);
        } finally {
          endUpload();
        }
      });
    }

    // 5) Cover upload
    if ($w('#uplCover')?.onChange) {
      $w('#uplCover').onChange(async () => {
        if (!$w('#uplCover').value?.length) return;
        beginUpload();
        try {
          const file = await $w('#uplCover').startUpload();
          if (file?.fileUrl && $w('#imgCover')) $w('#imgCover').src = file.fileUrl;
        } catch (err) {
          console.error('Cover upload failed:', err);
        } finally {
          endUpload();
        }
      });
    }

    // 6) Save Changes (saves the main dataset)
    if ($w('#btnSaveProfile')?.onClick) {
      $w('#btnSaveProfile').onClick(async () => {
        if (uploadsInProgress > 0) return;
        try {
          const ds = $w(EDIT_DATASET_ID);
          if (ds?.save) await ds.save();
        } catch (err) {
          console.error('Save failed:', err);
        }
      });
    }

    // 7) Videos section
    wireVideoRepeater();
    $w('#btnAddVideo')?.onClick(addVideoFromInputs);
    await loadMyVideos();

  } catch (e) {
    console.error('Edit Profile init failed', e);
  }
});
