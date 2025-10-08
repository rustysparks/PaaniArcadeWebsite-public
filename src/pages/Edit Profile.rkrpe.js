// Edit Profile
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';

import { createVideo, getMyVideos, deleteVideo } from 'backend/video.jsw';
import { getProfile } from 'backend/members.jsw';

const PROFILES = 'RacerProfiles';

// datasets on the page
const EDIT_DATASET_ID     = '#profileDataset';
const OPTIONAL_DATASET_ID = '#dataset1';

// your defaults
const DEFAULT_AVATAR = 'https://static.wixstatic.com/media/144d60_f764ac01681447b5b2962b4b787d1d00~mv2.jpg';
const DEFAULT_COVER  = 'https://static.wixstatic.com/media/144d60_d8bb3358581e47ceb61df2085f888225~mv2.jpg';

// field keys (from Manage Fields)
const DISPLAY_NAME_FIELD = 'displayName_lc';
const REAL_NAME_FIELD    = 'realName';

const el = (id) => { try { return $w(id); } catch { return null; } };

function toYouTubeWatchUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
    return url;
  } catch { return url; }
}

function lockSave(lock) { const b = el('#btnSaveProfile'); lock ? b?.disable?.() : b?.enable?.(); }

let gUserId = null;
let gProfileId = null;
let gSlug = null;
let uploads = 0;
const beginUpload = () => { uploads++; lockSave(true); };
const endUpload   = () => { uploads = Math.max(0, uploads - 1); if (!uploads) lockSave(false); };

function wireVideoRepeater() {
  const rep = el('#repMyVideos');
  if (!rep) return;
  rep.onItemReady(($item, item) => {
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
      await deleteVideo(item._id).catch(console.error);
      await loadMyVideos();
    });
  });
}

async function loadMyVideos() {
  if (!gUserId || !gProfileId || !el('#repMyVideos')) return;
  const videos = await getMyVideos({ userId: gUserId, profileId: gProfileId }).catch(() => []);
  $w('#repMyVideos').data = videos || [];
}

async function ensureProfileFor(userId) {
  const q = await wixData.query(PROFILES).eq('userId', userId).limit(1).find();
  let row = q.items[0];
  if (!row) {
    row = await wixData.insert(PROFILES, {
      userId,
      avatarImage: DEFAULT_AVATAR,
      coverImage : DEFAULT_COVER
    });
  } else {
    const patch = {};
    if (!row.avatarImage && DEFAULT_AVATAR) patch.avatarImage = DEFAULT_AVATAR;
    if (!row.coverImage  && DEFAULT_COVER)  patch.coverImage  = DEFAULT_COVER;
    if (Object.keys(patch).length) row = await wixData.update(PROFILES, { _id: row._id, ...patch });
  }
  return row;
}

// uniqueness check against displayName_lc (lower-cased)
async function displayNameTaken(nameLc, myRowId) {
  if (!nameLc) return false;
  const r = await wixData.query(PROFILES)
    .eq(DISPLAY_NAME_FIELD, nameLc)
    .ne('_id', myRowId)
    .limit(1)
    .find();
  return r.items.length > 0;
}

$w.onReady(async () => {
  const me = await currentMember.getMember().catch(() => null);
  if (!me) return;
  gUserId = me._id;

  // IMPORTANT in Editor: set both datasets to **Read & Write** (not write-only)
  const mainDs = el(EDIT_DATASET_ID);
  const optDs  = el(OPTIONAL_DATASET_ID);
  try { await mainDs?.setFilter?.(wixData.filter().eq('userId', gUserId)); } catch(e){}
  try { await optDs?.setFilter?.(wixData.filter().eq('userId', gUserId)); } catch(e){}

  // ensure row + defaults
  const row = await ensureProfileFor(gUserId);
  gProfileId = row._id;
  gSlug = row.slug || null;

  // if no handle yet, open setup
  const p = await getProfile(gUserId).catch(() => null);
  if (!p?.handle) wixWindow.openLightbox('HandleSetup');
  if (p?.slug) gSlug = p.slug;

  // avatar upload (instant preview + save)
  if (el('#uplAvatar')) {
    $w('#uplAvatar').onChange(async () => {
      if (!$w('#uplAvatar').value?.length) return;
      beginUpload();
      try {
        const f = await $w('#uplAvatar').startUpload();
        if (f?.fileUrl && el('#imgAvatar')) $w('#imgAvatar').src = f.fileUrl;
        await wixData.update(PROFILES, { _id: gProfileId, avatarImage: f.fileUrl });
      } catch (e) { console.error('avatar upload', e); } finally { endUpload(); }
    });
  }

  // cover upload (instant preview + save)
  if (el('#uplCover')) {
    $w('#uplCover').onChange(async () => {
      if (!$w('#uplCover').value?.length) return;
      beginUpload();
      try {
        const f = await $w('#uplCover').startUpload();
        if (f?.fileUrl && el('#imgCover')) $w('#imgCover').src = f.fileUrl;
        await wixData.update(PROFILES, { _id: gProfileId, coverImage: f.fileUrl });
      } catch (e) { console.error('cover upload', e); } finally { endUpload(); }
    });
  }

  // Save: enforce display name uniqueness (lower-cased) and also normalize before saving
  el('#btnSaveProfile')?.onClick(async () => {
    if (uploads > 0) return;

    const rawDisplay = ($w('#inpDisplayName')?.value || '').trim();
    const nameLc = rawDisplay.toLowerCase();

    // normalize the field value in the dataset before save (so the CMS stores lowercase)
    try { mainDs?.setFieldValue?.(DISPLAY_NAME_FIELD, nameLc); } catch {}

    if (await displayNameTaken(nameLc, gProfileId)) {
      wixWindow.openLightbox('Message', {
        title: 'Name in use',
        text: 'That display name is already taken. Please choose another.'
      }).catch(()=>{});
      return;
    }

    await mainDs?.save?.().catch((e) => console.error('save failed', e));
    const p2 = await getProfile
