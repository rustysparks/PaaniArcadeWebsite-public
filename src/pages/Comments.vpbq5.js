import wixWindow from 'wix-window';
import { currentMember } from 'wix-members-frontend';
import {
  listComments,
  addComment,
  likeComment,
  deleteComment
} from 'backend/video.jsw';

let viewerId = null;
let profileOwnerId = null; // memberId of the profile owner (send when opening the lightbox)
let videoId = null;        // send when opening the lightbox

// Simple paging memory (optional)
let pageSize = 20;
let allComments = [];
let shownCount = 0;

$w.onReady(async () => {
  // 1) Read context from opener (public profile page should open with { videoId, profileOwnerId })
  const ctx = wixWindow.lightbox.getContext() || {};
  videoId = ctx.videoId || null;
  profileOwnerId = ctx.profileOwnerId || null;

  // 2) Get logged-in viewer (if any)
  try {
    const { member } = await currentMember.getMember();
    viewerId = member?._id || null;
  } catch (e) {
    viewerId = null;
  }

  // 3) Wire top-level buttons
  if ($w('#btnClose')) {
    $w('#btnClose').onClick(() => wixWindow.lightbox.close());
  }

  if ($w('#btnPost')) {
    $w('#btnPost').onClick(onPostNewComment);
  }

  if ($w('#btnLoadMoreC')) {
    $w('#btnLoadMoreC').onClick(() => renderNextPage());
  }

  // 4) Repeater template binding
  $w('#repComments').onItemReady(($item, item) => {
    // Author & time
    $item('#txtAuthor').text = item.displayName || 'Racer';
    $item('#txtWhen').text = timeAgo(item._createdDate) || '';
    $item('#txtBody').text = item.body || '';

    // --- Like UI (vector icons) ---
    // Default: show outline, hide filled
    safeCollapse($item('#icoCHeartOn'));
    safeExpand($item('#icoCHeartOff'));
    if ($item('#lblCommentLikes')) $item('#lblCommentLikes').text = String(item.likes || 0);

    // Clicking outline (off) => like (increment)
    if ($item('#icoCHeartOff')) {
      $item('#icoCHeartOff').onClick(async () => {
        try {
          const res = await likeComment(item._id); // { ok:true, likes: next }
          setCommentLikeUI($item, true, res.likes);
          // Also update the in-memory item so paging refresh keeps count
          item.likes = res.likes;
        } catch (e) {
          // Optional: show error toast
        }
      });
    }

    // Clicking filled (on) — no-op unless you later implement toggle-unlike
    if ($item('#icoCHeartOn')) {
      $item('#icoCHeartOn').onClick(() => {
        // To support unlike, create a CommentLikes collection & toggle API similar to videos.
        // For now, do nothing (visual only).
      });
    }

    // --- Delete visibility ---
    const canDelete =
      (viewerId && viewerId === item.userId) ||      // this commenter
      (viewerId && viewerId === profileOwnerId);     // the profile owner
    if ($item('#btnDeleteComment')) {
      $item('#btnDeleteComment').visible = !!canDelete;
      if (canDelete) {
        $item('#btnDeleteComment').onClick(async () => {
          try {
            await deleteComment(item._id);
            await reloadAllComments();
          } catch (e) {
            // Optional: show error toast
          }
        });
      }
    }
  });

  // 5) Initial load
  await reloadAllComments();
});

/* =========================
   Helpers
   ========================= */

async function reloadAllComments() {
  if (!videoId) return;
  allComments = await listComments(videoId, 200); // approved comments
  shownCount = 0;
  renderNextPage(true);
}

function renderNextPage(reset = false) {
  if (reset) {
    shownCount = 0;
  }
  const next = allComments.slice(0, Math.min(allComments.length, shownCount + pageSize));
  $w('#repComments').data = next;
  shownCount = next.length;

  // Load more visibility
  if ($w('#btnLoadMoreC')) {
    $w('#btnLoadMoreC').visible = shownCount < allComments.length;
  }
}

async function onPostNewComment() {
  if (!videoId) return;
  const text = ($w('#inpNewComment')?.value || '').trim();
  if (!text) return;
  try {
    await addComment(videoId, text); // respects approval / friends-only, etc.
    if ($w('#inpNewComment')) $w('#inpNewComment').value = '';
    await reloadAllComments();
    // Optional: scroll to top so they see their comment (if auto-approved)
  } catch (e) {
    // Optional: surface e.message to user
  }
}

// Show filled vs outline & update count
function setCommentLikeUI($item, liked, count) {
  if (liked) {
    safeExpand($item('#icoCHeartOn'));
    safeCollapse($item('#icoCHeartOff'));
  } else {
    safeExpand($item('#icoCHeartOff'));
    safeCollapse($item('#icoCHeartOn'));
  }
  if ($item('#lblCommentLikes')) $item('#lblCommentLikes').text = String(count ?? 0);

  // Accessibility label (if available)
  try {
    const label = liked ? 'Unlike comment (liked)' : 'Like comment';
    if ($item('#icoCHeartOff')?.ariaLabel !== undefined) $item('#icoCHeartOff').ariaLabel = label;
    if ($item('#icoCHeartOn')?.ariaLabel !== undefined)  $item('#icoCHeartOn').ariaLabel  = label;
  } catch (_) {}
}

function timeAgo(date) {
  try {
    const d = new Date(date);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    const m = Math.floor(s / 60), h = Math.floor(m / 60), dd = Math.floor(h / 24);
    if (s < 60) return `${s}s ago`;
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${dd}d ago`;
  } catch {
    return '';
  }
}

// Guard expand/collapse calls in case vector is missing
function safeExpand(el) { try { el && el.expand && el.expand(); } catch(_){} }
function safeCollapse(el) { try { el && el.collapse && el.collapse(); } catch(_){} }
