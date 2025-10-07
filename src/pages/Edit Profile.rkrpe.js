// Edit Profile (/blank)
// — keeps uploads + videos, adds dataset scoping & write mode, and handle gate —

import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';

import { createVideo, getMyVideos, deleteVideo } from 'backend/video.jsw';
import { getProfile } from 'backend/members.jsw';

const PROFILES = 'RacerProfiles';

// Dataset IDs on this page (from your screenshot)
const EDIT_DATASET_ID     = '#profileDataset'; // main dataset (12 connected elements)
const OPTIONAL_DATASET_ID = '#dataset1';       // secondary dataset (3 connected elements)

// Element IDs used (make sure they exist on the page)
// #uplAvatar, #imgAvatar, #uplCover, #imgCover, #btnSaveProfile, #saveHint
// #repMyVideos, #btnAddVideo, #inpYoutubeUrl, #inpVidTitle, #inpVidDesc
// #btnViewPublicProfile  (optional but recommended)

let gUserId = null;
let gProfileId = null;
let uploadsInProgress = 0;

/* ---------------- helpers ---------------- */

function lockSave(lock) {
  const btn = $w('#btnSaveProfile');
  if (btn?.enable && btn?.disable) (lock ? btn.disable() : btn.enable());
}
function beginUpload() { uploadsInProgress += 1; lockSave(true); $w('#saveHint')?.show?.(); }
function endUpload()   { uploadsInProgress = Math.max(0, uploadsInProgress - 1); if (!uploadsInProgress) { lockSave(false); $w('#saveHint')?.hide?.(); } }

function toYouTubeWatchUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
    return url;
  } catch { return url; }
}

function datasetReady(id) {
  try {
    const ds = $w(id);
    if (ds && typeof ds.onReady === 'function') return new Promise(res => ds.onReady(res));
  } catch (_) {}
  return Promise.resolve();
}

function wireVideoRepeater() {
  if (!$w('#repMyVideos')) return;
  $w('#repMyVideos').onItemReady(($item, item) => {
    $item('#txtMyVidTitle').text = item.title || '';
    $item('#txtMyVidDesc').text  = item.description || '';

    const url = toYouTubeWatchUrl(item.youtubeUrl || '');
    // Only set the player if we have a valid URL to avoid SDK "src cannot be empty" errors
    if (url) {
      if ($item('#vpVideo')?.videoUrl !== undefined) $item('#vpVideo').videoUrl = url;
      else if ($item('#vpVideo')?.src !== undefined) $item('#vpVideo').src = url;
      if ($item('#vpVideo')?.autoPlay !== undefined) $item('#vpVideo').autoPlay = false;
      if ($item('#vpVideo')?.controls  !== undefined) $item('#vpVideo').controls  = true;
    }

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

/* ---------------- page init ---------------- */

$w.onReady(async () => {
  try {
    // 0) Make sure datasets (if present) are initialized
    await datasetReady(EDIT_DATASET_ID);
    await datasetReady(OPTIONAL_DATASET_ID);

    // 1) Who’s logged in?
    const m = await currentMember.getMember();   // no destructuring; Wix returns a member object
    if (!m) return;                              // not logged in
    gUserId = m._id;

    // 2) Scope datasets to THIS member + ensure write mode
    const mainDs = $w(EDIT_DATASET_ID);
    if (mainDs?.setFilter) {
      await mainDs.setFilter(wixData.filter().eq('userId', gUserId));
      if (typeof mainDs.setMode === 'function') mainDs.setMode('write');
    }
    const optDs = $w(OPTIONAL_DATASET_ID);
    if (optDs?.setFilter) {
      await optDs.setFilter(wixData.filter().eq('userId', gUserId));
      if (typeof optDs.setMode === 'function') optDs.setMode('write');
    }

    // 3) Ensure a RacerProfiles row exists so inputs are bound to something
    let r = await wixData.query(PROFILES).eq('userId', gUserId).limit(1).find();
    let profile = r.items[0];
    if (!profile) profile = await wixData.insert(PROFILES, { userId: gUserId });
    gProfileId = profile._id;

    // 4) Handle gate – if no handle yet, open the setup lightbox
    const row = await getProfile(gUserId);
    if (!row?.handle) wixWindow.openLightbox('HandleSetup');

    // 5) "View Your Public Profile" button -> /{slug} (or change prefix if your dynamic page uses one)
    if (row?.slug && $w('#btnViewPublicProfile')) {
      $w('#btnViewPublicProfile').onClick(() => wixLocation.to(`/${row.slug}`));
    }

    // 6) Avatar upload
    if ($w('#uplAvatar')?.onChange) {
      $w('#uplAvatar').onChange(async () => {
        if (!$w('#uplAvatar').value?.length) return;
        beginUpload();
        try {
          const file = await $w('#uplAvatar').startUpload();
          if (file?.fileUrl && $w('#imgAvatar')) $w('#imgAvatar').src = file.fileUrl;
        } catch (err) { console.error('Avatar upload failed:', err); }
        finally { endUpload(); }
      });
    }

    // 7) Cover upload
    if ($w('#uplCover')?.onChange) {
      $w('#uplCover').onChange(async () => {
        if (!$w('#uplCover').value?.length) return;
        beginUpload();
        try {
          const file = await $w('#uplCover').startUpload();
          if (file?.fileUrl && $w('#imgCover')) $w('#imgCover').src = file.fileUrl;
        } catch (err) { console.error('Cover upload failed:', err); }
        finally { endUpload(); }
      });
    }

    // 8) Save Changes (saves the main dataset)
    if ($w('#btnSaveProfile')?.onClick) {
      $w('#btnSaveProfile').onClick(async () => {
        if (uploadsInProgress > 0) return;
        try { if (mainDs?.save) await mainDs.save(); }
        catch (err) { console.error('Save failed:', err); }
      });
    }

    // 9) Videos
    wireVideoRepeater();
    $w('#btnAddVideo')?.onClick(addVideoFromInputs);
    await loadMyVideos();

  } catch (e) {
    console.error('Edit Profile init failed', e);
  }
});
