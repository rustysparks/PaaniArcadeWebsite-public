import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';
import { getProfile } from 'backend/members.jsw';

$w.onReady(async () => {
  try {
    const member = await currentMember.getMember();  // FIXED
    const userId = member?._id;
    if (!userId) return;

    const row = await getProfile(userId);
    if (!row?.handle) wixWindow.openLightbox('HandleSetup');  // exact lightbox name
  } catch (e) {
    console.error('Home handle check failed', e);
  }
});
