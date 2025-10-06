import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';

const FOLLOWS = 'Follows'; // followerId, followeeId

$w.onReady(async () => {
  // 1) Force deterministic initial state
  safeInit();

  // 2) Load viewer id
  const { member } = await currentMember.getMember();
  if (!member) {
    // Not logged in – show empties and zero counts
    renderList([], $w('#repFollowers'), $w('#boxFollowersEmpty'));
    renderList([], $w('#repFollowing'), $w('#boxFollowingEmpty'));
    $w('#txtFollowersCount').text = '0';
    $w('#txtFollowingCount').text = '0';
    return;
  }
  const myId = member._id;

  // 3) Query both lists
  const [followersRes, followingRes] = await Promise.all([
    wixData.query(FOLLOWS).eq('followeeId', myId).find(),
    wixData.query(FOLLOWS).eq('followerId', myId).find(),
  ]);

  const followers = followersRes.items; // map to your profile cards as needed
  const following = followingRes.items;

  // 4) Render + counts
  renderList(followers, $w('#repFollowers'),  $w('#boxFollowersEmpty'));
  renderList(following, $w('#repFollowing'),  $w('#boxFollowingEmpty'));

  $w('#txtFollowersCount').text = String(followers.length);
  $w('#txtFollowingCount').text = String(following.length);
});

/** Ensure repeaters are empty & boxes collapsed before any data arrives. */
function safeInit() {
  if ($w('#repFollowers').data !== undefined)  $w('#repFollowers').data  = [];
  if ($w('#repFollowing').data !== undefined)  $w('#repFollowing').data  = [];

  // Be explicit even if you also set “Collapsed on load” in the editor
  if ($w('#boxFollowersEmpty').collapse) $w('#boxFollowersEmpty').collapse();
  if ($w('#boxFollowingEmpty').collapse) $w('#boxFollowingEmpty').collapse();

  // Optional: start with repeaters collapsed to avoid the template row flashing
  if ($w('#repFollowers').collapse) $w('#repFollowers').collapse();
  if ($w('#repFollowing').collapse) $w('#repFollowing').collapse();
}

/** Show either the list or the empty box (works well in Tabs). */
function renderList(items, $rep, $emptyBox) {
  if (!items || items.length === 0) {
    if ($rep.data !== undefined) $rep.data = [];
    if ($rep.collapse) $rep.collapse();
    if ($emptyBox.expand) $emptyBox.expand();
  } else {
    if ($emptyBox.collapse) $emptyBox.collapse();
    if ($rep.expand) $rep.expand();
    if ($rep.data !== undefined) $rep.data = items;
  }
}
