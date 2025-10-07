import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';
import { getProfile } from 'backend/members.jsw';

$w.onReady(async () => {
  try {
    const m = await currentMember.getMember();
    if (!m) return;
    const row = await getProfile(m._id);
    if (!row?.handle) wixWindow.openLightbox('HandleSetup');
  } catch (e) {
    console.warn('Home handle gate failed', e);
  }
});
