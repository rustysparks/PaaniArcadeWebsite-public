import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';
import { createVideo, getMyVideos, deleteVideo } from 'backend/video.jsw';
let uploadsInProgress = 0;

function lockSave(lock) {
  $w('#btnSaveProfile')?.[lock ? 'disable' : 'enable']();
}

function beginUpload() {
  uploadsInProgress += 1;
  lockSave(true);
  $w('#saveHint')?.show(); // optional text: “Uploading…please wait”
}

function endUpload() {
  uploadsInProgress = Math.max(0, uploadsInProgress - 1);
  if (uploadsInProgress === 0) {
    lockSave(false);
    $w('#saveHint')?.hide();
  }
}

$w.onReady(async () => {
  // good habit: wait for dataset
  await $w('#editProfileDataset').onReady();

  // ===== Avatar upload =====
  $w('#uplAvatar').onChange(async () => {
    if (!$w('#uplAvatar').value?.length) return; // user canceled
    beginUpload();
    try {
      // Start the upload; returns file info object
      const file = await $w('#uplAvatar').startUpload();
      // Instant preview
      if (file?.fileUrl) $w('#imgAvatar').src = file.fileUrl;
      // Since the upload button is CONNECTED to the Avatar field,
      // the dataset field is now set; “Save Changes” will persist it.
    } catch (err) {
      console.error('Avatar upload failed:', err);
      // Optional: show a message to the user
    } finally {
      endUpload();
    }
  });

  // ===== Cover upload =====
  $w('#uplCover').onChange(async () => {
    if (!$w('#uplCover').value?.length) return;
    beginUpload();
    try {
      const file = await $w('#uplCover').startUpload();
      if (file?.fileUrl) $w('#imgCover').src = file.fileUrl;
    } catch (err) {
      console.error('Cover upload failed:', err);
    } finally {
      endUpload();
    }
  });

  // ===== Save Changes =====
  $w('#btnSaveProfile').onClick(async () => {
    if (uploadsInProgress > 0) {
      // Optional guard; you can also just disable the button during uploads
      return;
    }
    try {
      await $w('#editProfileDataset').save();
      // Optional: toast/snackbar that changes were saved
    } catch (err) {
      console.error('Save failed:', err);
    }
  });
});


// Globals
let gUserId = null;
let gProfileId = null;

// ---------- helpers ----------
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

// Bind how each repeater item displays
function wireVideoRepeater() {
  $w('#repMyVideos').onItemReady(($item, item) => {
    // title & description
    $item('#txtMyVidTitle').text = item.title || '';
    $item('#txtMyVidDesc').text  = item.description || '';

    // video player
    const url = toYouTubeWatchUrl(item.youtubeUrl || '');
    if ($item('#vpVideo').videoUrl !== undefined) {
      $item('#vpVideo').videoUrl = url;
    } else if ($item('#vpVideo').src !== undefined) {
      $item('#vpVideo').src = url;
    }
    if ($item('#vpVideo').autoPlay !== undefined) $item('#vpVideo').autoPlay = false;
    if ($item('#vpVideo').controls  !== undefined) $item('#vpVideo').controls  = true;

    // delete
    $item('#btnDeleteVideo').onClick(async () => {
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
  if (!gUserId || !gProfileId) return;
  const videos = await getMyVideos({ userId: gUserId, profileId: gProfileId });
  $w('#repMyVideos').data = videos || [];
}

// Create a new video from inputs
async function addVideoFromInputs() {
  const youtubeUrl = ($w('#inpYoutubeUrl').value || '').trim();
  const title      = ($w('#inpVidTitle').value || '').trim();
  const description = ($w('#inpVidDesc').value || '').trim();

  if (!youtubeUrl) {
    // feel free to show a message to the user here
    return;
  }
  await createVideo({
    profileId: gProfileId,
    userId: gUserId,
    youtubeUrl,
    title,
    description,
    isPublic: true
  });

  // clear inputs and refresh
  $w('#inpYoutubeUrl').value = '';
  $w('#inpVidTitle').value   = '';
  $w('#inpVidDesc').value    = '';
  await loadMyVideos();
}

// ---------- page init ----------
$w.onReady(async () => {
  // (Optional) wait for the profile dataset if you use it elsewhere
  if ($w('#profileDataset')) {
    try { await $w('#profileDataset').onReady(); } catch (_) {}
  }

  // who’s logged in?
  const { member } = await currentMember.getMember();
  if (!member) return;
  gUserId = member._id;

  // find (or create) their RacerProfiles row so we have profileId
  let r = await wixData.query('RacerProfiles').eq('userId', gUserId).limit(1).find();
  let profile = r.items[0];
  if (!profile) {
    // create a minimal row if none exists yet
    const inserted = await wixData.insert('RacerProfiles', { userId: gUserId });
    profile = inserted;
  }
  gProfileId = profile._id;

  // wire UI
  wireVideoRepeater();
  $w('#btnAddVideo').onClick(addVideoFromInputs);

  // initial load
  await loadMyVideos();
});