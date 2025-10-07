// Edit Profile (/blank)
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';

import { createVideo, getMyVideos, deleteVideo } from 'backend/video.jsw';
import { getProfile } from 'backend/members.jsw';

const PROFILES = 'RacerProfiles';
const EDIT_DATASET_ID     = '#profileDataset'; // 12 elements
const OPTIONAL_DATASET_ID = '#dataset1';       // 3 elements

let gUserId = null;
let gProfileId = null;
let uploadsInProgress = 0;

$w.onReady(init);

async function init() {
  try {
    // Who's logged in?
    const m = await currentMember.getMember();
    if (!m) return;
    gUserId = m._id;

    // Ensure the row exists first
    let r = await wixData.query(PROFILES).eq('userId', gUserId).limit(1).find();
    let profile = r.items[0];
    if (!profile) profile = await wixData.insert(PROFILES, { userId: gUserId });
    gProfileId = profile._id;

    // Gate: ask for handle if missing
    const row = await getProfile(gUserId);
    if (!row?.handle) wixWindow.openLightbox('HandleSetup');

    // Scope datasets to THIS user and switch to write mode
    await bindDataset(EDIT_DATASET_ID, gUserId);
    await bindDataset(OPTIONAL_DATASET_ID, gUserId);

    // Optional “View Public Profile” button -> /profile/{slug}
    if (row?.slug && $w('#btnViewPublicProfile')) {
      $w('#btnViewPublicProfile').onClick(() => wixLocation.to(`/profile/${row.slug}`));
    }

    // Uploads
    wireUploads();

    // Videos
    wireVideoRepeater();
    $w('#btnAddVideo')?.onClick(addVideoFromInputs);
    await loadMyVideos();
  } catch (e) {
    console.error('Edit Profile init failed', e);
  }
}

async function bindDataset(sel, userId) {
  try {
    const ds = $w(sel);
    if (!ds?.setFilter) return;
    // write mode (if supported)
    if (typeof ds.setMode === 'function') ds.setMode('write');
    await ds.setFilter(wixData.filter().eq('userId', userId));
    await ds.refresh(); // important if we just created the row
  } catch (e) {
    console.warn('bindDataset failed for', sel, e);
  }
}

/* ===== uploads ===== */
function wireUploads() {
  $w('#uplAvatar')?.onChange(async () => {
    if (!$w('#uplAvatar').value?.length) return;
    beginUpload();
    try {
      const f = await $w('#uplAvatar').startUpload();
      if (f?.fileUrl && $w('#imgAvatar')) $w('#imgAvatar').src = f.fileUrl;
    } catch (e) { console.error('Avatar upload failed', e); }
    finally { endUpload(); }
  });

  $w('#uplCover')?.onChange(async () => {
    if (!$w('#uplCover').value?.length) return;
    beginUpload();
    try {
      const f = await $w('#uplCover').startUpload();
      if (f?.fileUrl && $w('#imgCover')) $w('#imgCover').src = f.fileUrl;
    } catch (e) { console.error('Cover upload failed', e); }
    finally { endUpload(); }
  });

  $w('#btnSaveProfile')?.onClick(async () => {
    if (uploadsInProgress > 0) return;
    try {
      const ds = $w(EDIT_DATASET_ID);
      if (ds?.save) await ds.save();
    } catch (e) {
      console.error('Save failed', e);
    }
  });
}

/* ===== videos ===== */
function wireVideoRepeater() {
  if (!$w('#repMyVideos')) return;
  $w('#repMyVideos').onItemReady(($item, item) => {
    $item('#txtMyVidTitle').text = item.title || '';
    $item('#txtMyVidDesc').text  = item.description || '';

    const url = toYouTubeWatchUrl(item.youtubeUrl || '');
    if (url) {
      if ($item('#vpVideo')?.videoUrl !== undefined) $item('#vpVideo').videoUrl = url;
      else if ($item('#vpVideo')?.src !== undefined) $item('#vpVideo').src = url;
      if ($item('#vpVideo')?.autoPlay !== undefined) $item('#vpVideo').autoPlay = false;
      if ($item('#vpVideo')?.controls  !== undefined) $item('#vpVideo').controls  = true;
    }

    $item('#btnDeleteVideo')?.onClick(async () => {
      try { await deleteVideo(item._id); await loadMyVideos(); }
      catch (e) { console.error('Delete failed', e); }
    });
  });
}

async function loadMyVideos() {
  if (!gUserId || !gProfileId || !$w('#repMyVideos')) return;
  const videos = await getMyVideos({ userId: gUserId, profileId: gProfileId });
  $w('#repMyVideos').data = videos || [];
}

async function addVideoFromInputs() {
  const youtubeUrl  = ($w('#inpYoutubeUrl')?.value || '').trim();
  const title       = ($w('#inpVidTitle')?.value   || '').trim();
  const description = ($w('#inpVidDesc')?.value    || '').trim();
  if (!youtubeUrl) return;

  await createVideo({ profileId: gProfileId, userId: gUserId, youtubeUrl, title, description, isPublic: true });

  if ($w('#inpYoutubeUrl')) $w('#inpYoutubeUrl').value = '';
  if ($w('#inpVidTitle'))   $w('#inpVidTitle').value   = '';
  if ($w('#inpVidDesc'))    $w('#inpVidDesc').value    = '';

  await loadMyVideos();
}

/* ===== misc helpers ===== */
function toYouTubeWatchUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
    return url;
  } catch { return url; }
}
function beginUpload() { uploadsInProgress += 1; $w('#btnSaveProfile')?.disable?.(); $w('#saveHint')?.show?.(); }
function endUpload()   { uploadsInProgress = Math.max(0, uploadsInProgress - 1); if (!uploadsInProgress) { $w('#btnSaveProfile')?.enable?.(); $w('#saveHint')?.hide?.(); } }
