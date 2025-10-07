// Lightbox: HandleSetup
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';
import { setEmailMarketingOptIn } from 'backend/marketing.jsw';
import { getProfile, isHandleAvailable, claimHandle } from 'backend/members.jsw';

// Replace these with your Media Manager URLs
const DEFAULT_AVATAR = 'wix:image://v1/.../default-avatar.png';
const DEFAULT_COVER  = 'wix:image://v1/.../default-cover.jpg';

// letters, numbers, dot, underscore; 3–24 chars
const HANDLE_REGEX = /^[a-z0-9_.]{3,24}$/i;

$w.onReady(async () => {
  if ($w('#chkMarketing')?.checked !== undefined) $w('#chkMarketing').checked = true;
  clearError();

  try {
    const { member } = await currentMember.getMember();
    if (!member) return wixWindow.lightbox.close({ ok: false, reason: 'NOT_LOGGED_IN' });

    const row = await getProfile(member._id);
    if (row) {
      if ($w('#handleInput') && row.handle) $w('#handleInput').value = row.handle;
      if ($w('#chkMarketing')?.checked !== undefined && typeof row.marketingOptIn === 'boolean') {
        $w('#chkMarketing').checked = row.marketingOptIn;
      }
    }
  } catch (e) {
    console.warn('Prefill failed:', e);
  }

  $w('#btnHandleSave')?.onClick(saveHandleAndConsent);
});

async function saveHandleAndConsent() {
  try {
    $w('#btnHandleSave')?.disable();
    clearError();

    const { member } = await currentMember.getMember();
    if (!member) throw new Error('NOT_LOGGED_IN');
    const userId = member._id;

    const raw = ($w('#handleInput')?.value || '').trim();
    if (!raw) return showError('Please enter a handle.');
    if (!HANDLE_REGEX.test(raw)) {
      return showError('Handle must be 3–24 characters and can include letters, numbers, "." or "_".');
    }
    const handle = raw.toLowerCase();

    // quick feedback; final check happens in claimHandle
    if (!(await isHandleAvailable(handle))) {
      // not fatal—user might be editing their own handle; claimHandle verifies again
    }

    const marketingOptIn = !!$w('#chkMarketing')?.checked;
    const defaults = {
      commentsRequireApproval: true,
      commentsFriendsOnly: false,
      avatar: DEFAULT_AVATAR,
      coverImage: DEFAULT_COVER
    };

    await claimHandle({ userId, handle, marketingOptIn, defaults });

    try { await setEmailMarketingOptIn(marketingOptIn); } catch (e) { console.warn('CRM opt-in failed', e); }

    wixWindow.lightbox.close({ ok: true, handle });
  } catch (e) {
    const msg = typeof e === 'string' ? e : (e?.message || 'Something went wrong. Please try again.');
    if (msg.includes('taken')) showError('That handle is already taken. Please choose another.');
    else showError(msg);
  } finally {
    $w('#btnHandleSave')?.enable();
  }
}

function showError(msg) {
  if ($w('#errHandleMsg')?.text !== undefined) {
    $w('#errHandleMsg').text = msg || '';
    if (msg) $w('#errHandleMsg').expand?.(); else $w('#errHandleMsg').collapse?.();
  } else if (msg) console.error(msg);
}
function clearError(){ showError(''); }
