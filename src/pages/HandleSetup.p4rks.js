// Lightbox: HandleSetup

import wixData from 'wix-data';
import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';

import { setEmailMarketingOptIn } from 'backend/marketing.jsw';
import { getProfile, isHandleAvailable, claimHandle } from 'backend/members.jsw';

const PROFILES = 'RacerProfiles';
// TODO: replace with your actual Media Manager URLs (wix:image://v1/...)
const DEFAULT_AVATAR = 'wix:image://v1/.../default-avatar.png';
const DEFAULT_COVER  = 'wix:image://v1/.../default-cover.jpg';

// letters, numbers, dot, underscore; 3–24 chars
const HANDLE_REGEX = /^[a-z0-9_.]{3,24}$/i;

$w.onReady(async () => {
  if ($w('#chkMarketing')?.checked !== undefined) $w('#chkMarketing').checked = true;
  safeCollapse('#errHandleMsg');

  // Prefill if they already have a row
  try {
    const m = await currentMember.getMember();
    if (!m) return wixWindow.lightbox.close({ ok: false, reason: 'NOT_LOGGED_IN' });

    const row = await getProfile(m._id);
    if (row) {
      if ($w('#handleInput')?.value !== undefined && row.handle) $w('#handleInput').value = row.handle;
      if ($w('#chkMarketing')?.checked !== undefined && typeof row.marketingOptIn === 'boolean') {
        $w('#chkMarketing').checked = row.marketingOptIn;
      }
    }
  } catch (e) {
    console.warn('Prefill failed:', e);
  }

  $w('#btnHandleSave').onClick(saveHandle);
});

async function saveHandle() {
  try {
    $w('#btnHandleSave')?.disable?.();
    showError('');

    const m = await currentMember.getMember();
    if (!m) throw new Error('NOT_LOGGED_IN');
    const userId = m._id;

    // 1) validate
    const handle = ($w('#handleInput')?.value || '').trim();
    if (!handle) return showError('Please enter a handle.');
    if (!HANDLE_REGEX.test(handle)) {
      return showError('Handle must be 3–24 characters and can include letters, numbers, "." or "_".');
    }
    const handleLc = handle.toLowerCase();

    // 2) availability (backend rechecks)
    const available = await isHandleAvailable(handle, userId);
    if (!available) return showError('That handle is already taken. Please choose another.');

    // 3) commit + defaults
    const marketingOptIn = !!$w('#chkMarketing')?.checked;
    await claimHandle(userId, {
      handle,
      handle_lc: handleLc,
      slug: handleLc,               // dynamic page uses slug
      marketingOptIn,
      commentsRequireApproval: true,
      commentsFriendsOnly: false,
      avatar: DEFAULT_AVATAR,
      coverImage: DEFAULT_COVER,
    });

    // 4) CRM (non-blocking)
    try { await setEmailMarketingOptIn(marketingOptIn); } catch (e) { console.warn('CRM opt-in failed', e); }

    // 5) done
    wixWindow.lightbox.close({ ok: true, handle });
  } catch (err) {
    showError(typeof err === 'string' ? err : err?.message || 'Something went wrong. Please try again.');
  } finally {
    $w('#btnHandleSave')?.enable?.();
  }
}

/* ------- helpers ------- */
function showError(msg) {
  if ($w('#errHandleMsg')?.text !== undefined) {
    $w('#errHandleMsg').text = msg || '';
    msg ? $w('#errHandleMsg').expand?.() : safeCollapse('#errHandleMsg');
  } else if (msg) {
    console.error(msg);
  }
}
function safeCollapse(sel) { try { $w(sel).collapse?.(); } catch (_) {} }
