// Lightbox: HandleSetup
import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';
import { setEmailMarketingOptIn } from 'backend/marketing.jsw';
import { getProfile, isHandleAvailable, claimHandle } from 'backend/members.jsw';

const HANDLE_REGEX = /^[a-z0-9_]{3,24}$/i;

$w.onReady(async () => {
  // default opt-in checked if the checkbox exists
  if ($w('#chkMarketing')?.checked !== undefined) $w('#chkMarketing').checked = true;

  // prefill if they already have one
  try {
    const m = await currentMember.getMember();
    if (!m) return wixWindow.lightbox.close({ ok: false, reason: 'NOT_LOGGED_IN' });

    const row = await getProfile(m._id);
    if (row?.handle) {
      if ($w('#handleInput')?.value !== undefined) $w('#handleInput').value = row.handle;
      if ($w('#chkMarketing')?.checked !== undefined && typeof row.marketingOptIn === 'boolean') {
        $w('#chkMarketing').checked = row.marketingOptIn;
      }
    }
  } catch (e) {
    console.warn('prefill failed', e);
  }

  $w('#btnHandleSave')?.onClick(saveHandle);
});

function showError(msg = 'Something went wrong.') {
  if ($w('#errHandleMsg')?.text !== undefined) {
    $w('#errHandleMsg').text = String(msg);
    $w('#errHandleMsg').expand?.();
  }
  console.error(msg);
}

async function saveHandle() {
  try {
    $w('#btnHandleSave')?.disable?.();

    const m = await currentMember.getMember();
    const userId = m?._id;
    if (!userId) return showError('Please sign in and try again.');

    const raw = String($w('#handleInput')?.value || '').trim();
    if (!raw) return showError('Please enter a handle.');
    if (!HANDLE_REGEX.test(raw)) return showError('Handle must be 3–24 characters (letters, numbers, or "_").');

    // client-side uniqueness check (server will re-check)
    const available = await isHandleAvailable(raw, userId);
    if (!available) return showError('That handle is taken. Please choose another.');

    const marketingOptIn = !!$w('#chkMarketing')?.checked;

    const res = await claimHandle(userId, raw, marketingOptIn);
    if (res?.error) {
      return showError(res.error === 'HANDLE_TAKEN' ? 'That handle is taken. Please choose another.'
                                                   : 'Something went wrong. Please try again.');
    }

    // best-effort CRM – never block the UX
    try { await setEmailMarketingOptIn(marketingOptIn); } catch (_) {}

    wixWindow.lightbox.close({ ok: true, handle: raw });
  } catch (e) {
    showError('Unable to handle the request. Please try again.');
  } finally {
    $w('#btnHandleSave')?.enable?.();
  }
}
