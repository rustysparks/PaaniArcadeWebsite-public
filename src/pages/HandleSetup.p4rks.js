// Lightbox: HandleSetup
import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';
import { setEmailMarketingOptIn } from 'backend/marketing.jsw';

// ---- CONFIG: set your default images (replace with your Media Manager URLs) ----
const DEFAULT_AVATAR = 'wix:image://v1/.../default-avatar.png';
const DEFAULT_COVER  = 'wix:image://v1/.../default-cover.jpg';

const PROFILES = 'RacerProfiles';
// letters, numbers, dot, underscore; 3–24 chars
const HANDLE_REGEX = /^[a-z0-9_.]{3,24}$/i;

$w.onReady(async () => {
  // make sure checkbox is checked by default
  if ($w('#chkMarketing')?.checked !== undefined) {
    $w('#chkMarketing').checked = true;
  }
  // hide error label
  safeCollapse('#errHandleMsg');

  // Prefill if user already has a row
  try {
    const { member } = await currentMember.getMember();
    if (!member) {
      wixWindow.lightbox.close({ ok: false, reason: 'NOT_LOGGED_IN' });
      return;
    }
    const r = await wixData.query(PROFILES).eq('userId', member._id).limit(1).find();
    const row = r.items[0];
    if (row) {
      if ($w('#handleInput')?.value !== undefined && row.handle) {
        $w('#handleInput').value = row.handle;
      }
      if ($w('#chkMarketing')?.checked !== undefined && typeof row.marketingOptIn === 'boolean') {
        $w('#chkMarketing').checked = row.marketingOptIn;
      }
    }
  } catch (e) {
    // non-blocking
    console.warn('Prefill failed:', e);
  }

  // Wire save
  $w('#btnHandleSave').onClick(saveHandleAndConsent);
});

async function saveHandleAndConsent() {
  try {
    $w('#btnHandleSave').disable();
    showError(''); // clear

    const { member } = await currentMember.getMember();
    if (!member) throw new Error('NOT_LOGGED_IN');
    const userId = member._id;

    // 1) Validate handle
    const handle = ($w('#handleInput')?.value || '').trim();
    if (!handle) return showError('Please enter a handle.');
    if (!HANDLE_REGEX.test(handle)) {
      return showError('Handle must be 3–24 characters and can include letters, numbers, "." or "_".');
    }
    const handleLc = handle.toLowerCase();

    // 2) Ensure uniqueness (excluding own record if editing)
    const taken = await wixData.query(PROFILES).eq('handle_lc', handleLc).find();
    const someoneElse = taken.items.find(i => i.userId !== userId);
    if (someoneElse) return showError('That handle is already taken. Please choose another.');

    // 3) Create or update profile row
    const marketingOptIn = !!$w('#chkMarketing')?.checked;
    let r = await wixData.query(PROFILES).eq('userId', userId).limit(1).find();
    let row = r.items[0];

    const base = {
      userId,
      handle,
      handle_lc: handleLc,
      slug: handleLc, // your dynamic page uses slug
      marketingOptIn,
      commentsRequireApproval: row?.commentsRequireApproval ?? true,
      commentsFriendsOnly: row?.commentsFriendsOnly ?? false,
      avatar: row?.avatar || DEFAULT_AVATAR,
      coverImage: row?.coverImage || DEFAULT_COVER
    };

    if (row) {
      row = Object.assign(row, base);
      await wixData.update(PROFILES, row);
    } else {
      await wixData.insert(PROFILES, base);
    }

    // 4) Sync CRM email marketing subscription (non-blocking if it fails)
    try {
      await setEmailMarketingOptIn(marketingOptIn);
    } catch (crmErr) {
      console.warn('CRM opt-in update failed: ', crmErr);
    }

    // 5) Close OK
    wixWindow.lightbox.close({ ok: true, handle });

  } catch (err) {
    showError(normalizeErr(err));
  } finally {
    $w('#btnHandleSave').enable();
  }
}

/* ---------------- helpers ---------------- */

function showError(msg) {
  if ($w('#errHandleMsg')?.text !== undefined) {
    $w('#errHandleMsg').text = msg || '';
    if (msg) $w('#errHandleMsg').expand?.(); else safeCollapse('#errHandleMsg');
  } else {
    if (msg) console.error(msg);
  }
}

function safeCollapse(sel) {
  try { $w(sel).collapse?.(); } catch (e) { /* ignore */ }
}

function normalizeErr(e) {
  const m = typeof e === 'string' ? e : (e?.message || 'Something went wrong. Please try again.');
  // you can map backend codes to friendlier text here if needed
  return m;
}
