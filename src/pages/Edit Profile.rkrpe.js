// ---------- IMPORTS ----------
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';

import { createVideo, getMyVideos, deleteVideo } from 'backend/video.jsw';

// ---------- CONSTANTS ----------
const PROFILES = 'RacerProfiles';

// IDs in your editor (rename here if yours differ)
const EDIT_DATASET_ID     = '#profileDataset';  // dataset bound to inputs (Set to Read & Write in Editor)
const OPTIONAL_DATASET_ID = '#dataset1';        // remove if you don't have this

const INP_DISPLAY = '#inpDisplayName'; // bound to your Display Name field (we also set displayName_lc)
const INP_REAL    = '#inpRealName';    // bound to realName

// Your default images
const DEFAULT_AVATAR = 'https://static.wixstatic.com/media/144d60_f764ac01681447b5b2962b4b787d1d00~mv2.jpg';
const DEFAULT_COVER  = 'https://static.wixstatic.com/media/144d60_d8bb3358581e47ceb61df2085f888225~mv2.jpg';

// ---------- STATE ----------
let gUserId = null;
let gProfileId = null;
let uploads = 0;

// Helper: await a dataset’s onReady (Velo’s onReady takes a callback, not a Promise)
function ready(ds) {
  return new Promise((resolve) => ds.onReady(() => resolve()));
}

// ---------- PAGE READY ----------
$w.onReady(async () => {
  const ds  = $w(EDIT_DATASET_ID);
  const opt = $w(OPTIONAL_DATASET_ID);

  // Wait for datasets safely (no bare ds.onReady())
  if (ds && ds.onReady)  await ready(ds);
  if (opt && opt.onReady) await ready(opt);

  const me = await currentMember.getMember().catch(() => null);
  if (!me) return;
  gUserId = me._id;

  // Ensure a profile row exists (seed defaults once)
  let r = await wixData.query(PROFILES).eq('userId', gUserId).limit(1).find();
  let row = r.items[0];
  if (!row) {
    row = await wixData.insert(PROFILES, {
      userId: gUserId,
      avatarImage: DEFAULT_AVATAR,
      coverImage: DEFAULT_COVER
    });
  }
  gProfileId = row._id;

  // Scope dataset to this member (Editor: set dataset to **Read & Write**, not Write-only)
  try {
    if (ds && ds.setFilter) {
      await ds.setFilter(wixData.filter().eq('userId', gUserId));
    }
  } catch (e) {
    console.warn('Dataset is Write-Only. In the Editor, set the dataset mode to "Read & Write".');
  }

  // Save button
  const saveBtn = $w('#btnSaveProfile');
  if (saveBtn && saveBtn.onClick) {
    saveBtn.onClick(async () => {
      if (uploads > 0) return;                 // don’t save while uploads running
      const ok = await validateDisplayNameUnique(ds);
      if (!ok) return;
      await ds?.save?.().catch((e) => console.error('save failed', e));
    });
  }

  // View public profile (works even unsaved)
  const viewBtn = $w('#btnViewPublicProfile');
  if (viewBtn && viewBtn.onClick) {
    viewBtn.onClick(() => {
      const cur = ds?.getCurrentItem ? ds.getCurrentItem() : row;
      const slug = cur?.slug || cur?.handle || cur?.displayName_lc;
      if (slug) wixLocation.to(`/profile/${slug}`);
    });
  }

  // Instant uploads (preview + persist)
  wireUploads();

  // Videos
  wireVideoRepeater();
  const add = $w('#btnAddVideo');
  if (add && add.onClick) add.onClick(addVideoFromInputs);
  await loadMyVideos();
});

// ---------- UPLOAD HELPERS ----------
function startUploadUI() { uploads += 1; $w('#saveHint')?.show?.(); }
function endUploadUI()   { uploads = Math.max(0, uploads - 1); if (uploads === 0) $w('#saveHint')?.hide?.(); }

function wireUploads() {
  const upA = $w('#uplAvatar');
  if (upA && upA.onChange) {
    upA.onChange(async () => {
      if (!upA.value?.length) return;
      startUploadUI();
      try {
        const file = await upA.startUpload();
        if (file?.fileUrl) {
          const img = $w('#imgAvatar'); if (img) img.src = file.fileUrl; // instant preview
          const ds = $w(EDIT_DATASET_ID); ds?.setFieldValue?.('avatarImage', file.fileUrl);
          await ds?.save?.().catch(() => {});                             // persist immediately
        }
      } finally { endUploadUI(); }
    });
  }

  const upC = $w('#uplCover');
  if (upC && upC.onChange) {
    upC.onChange(async () => {
      if (!upC.value?.length) return;
      startUploadUI();
      try {
        const file = await upC.startUpload();
        if (file?.fileUrl) {
          const img = $w('#imgCover'); if (img) img.src = file.fileUrl;  // instant preview
          const ds = $w(EDIT_DATASET_ID); ds?.setFieldValue?.('coverImage', file.fileUrl);
          await ds?.save?.().catch(() => {});                             // persist immediately
        }
      } finally { endUploadUI(); }
    });
  }
}

// ---------- DISPLAY NAME UNIQUENESS ----------
async function validateDisplayNameUnique(ds) {
  const inp = $w(INP_DISPLAY);
  const raw = (inp && typeof inp.value === 'string') ? inp.value.trim() : '';
  if (!raw) return true;

  const lc = raw.toLowerCase();

  // Keep the lc field synced for uniqueness queries
  ds?.setFieldValue?.('displayName_lc', lc);

  const taken = await wixData.query(PROFILES)
    .eq('displayName_lc', lc)
    .ne('userId', gUserId)
    .limit(1)
    .find();

  if (taken.items.length) {
    showErr('That display name is taken. Please choose another.');
    return false;
  }
  hideErr();
  return true;
}

function showErr(msg) { const t = $w('#errMsg'); if (t && 'text' in t) { t.text = msg; t.expand?.(); } }
function hideErr()    { const t = $w('#errMsg'); if (t) t.collapse?.(); }

// ---------- VIDEOS ----------
async function addVideoFromInputs() {
  const url  = ($w('#inpYoutubeUrl')?.value || '').trim();
  if (!url) return;
  const title = ($w('#inpVidTitle')?.value || '').trim();
  const desc  = ($w('#inpVidDesc')?.value  || '').trim();

  await createVideo({ profileId: gProfileId, userId: gUserId, youtubeUrl: url, title, description: desc, isPublic: true });

  if ($w('#inpYoutubeUrl')) $w('#inpYoutubeUrl').value = '';
  if ($w('#inpVidTitle'))   $w('#inpVidTitle').value   = '';
  if ($w('#inpVidDesc'))    $w('#inpVidDesc').value    = '';
  await loadMyVideos();
}

function wireVideoRepeater() {
  const rep = $w('#repMyVideos');
  if (!rep || !rep.onItemReady) return;

  rep.onItemReady(($item, item) => {
    const tt = $item('#txtMyVidTitle'); if (tt) tt.text = item.title || '';
    const td = $item('#txtMyVidDesc');  if (td) td.text = item.description || '';

    const vp = $item('#vpVideo');
    if (vp && typeof vp.videoUrl !== 'undefined') vp.videoUrl = item.youtubeUrl || '';
    else if (vp && typeof vp.src !== 'undefined')  vp.src      = item.youtubeUrl || '';

    const del = $item('#btnDeleteVideo');
    if (del && del.onClick) del.onClick(async () => {
      await deleteVideo(item._id);
      await loadMyVideos();
    });
  });
}

async function loadMyVideos() {
  const rep = $w('#repMyVideos'); if (!rep) return;
  const vids = await getMyVideos({ userId: gUserId, profileId: gProfileId }).catch(() => []);
  rep.data = vids || [];
}
