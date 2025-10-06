// backend/members.js
import wixData from 'wix-data';
import { mediaManager } from 'wix-media-backend'; // not required to read URLs, just for reference
import { events } from 'wix-members-backend';     // members events

const PROFILES = 'RacerProfiles';

// Store your default asset URLs in constants (upload once to Media Manager)
const DEFAULT_AVATAR = 'wix:image://v1/.../default-avatar.png';
const DEFAULT_COVER  = 'wix:image://v1/.../default-cover.jpg';

events.onMemberCreated(async (event) => {
  const userId = event.member._id;

  // if profile already exists, skip
  const r = await wixData.query(PROFILES).eq('userId', userId).limit(1).find({ suppressAuth: true });
  if (r.items.length) return;

  await wixData.insert(PROFILES, {
    userId,
    avatar: DEFAULT_AVATAR,
    coverImage: DEFAULT_COVER,
    commentsRequireApproval: true,
    commentsFriendsOnly: false,
    marketingOptIn: false,     // we’ll set this true if they consent later
    racesCount: 0              // if you track this
  }, { suppressAuth: true });
});
