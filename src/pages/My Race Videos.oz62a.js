import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';

$w.onReady(async () => {
  $w('#btnOpenDrive').hide();
  $w('#statusText').text = "Loading your race videos...";

  const member = await currentMember.getMember().catch(() => null);
  if (!member) { $w('#statusText').text = "Please log in."; return; }

  const res = await wixData.query('MembersMeta').eq('userId', member._id).find();
  const row = res.items[0];

  if (row?.driveFolderUrl) {
    $w('#btnOpenDrive').link = row.driveFolderUrl;
    $w('#btnOpenDrive').target = "_blank";
    $w('#btnOpenDrive').show();
    $w('#statusText').text = "Your Drive folder has dated subfolders with your races.";
  } else {
    $w('#statusText').text = "No folder yet. Scan your QR at the desk and upload your first race.";
  }
});
