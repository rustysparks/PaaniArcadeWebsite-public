// --- Auto full-screen QR sizing ---
import wixWindow from 'wix-window';

function sizeQrFullScreen() {
  // viewport in pixels (works on mobile & desktop)
  const vw = wixWindow.getViewportWidth();
  const vh = wixWindow.getViewportHeight();

  // make the image exactly the size of the viewport
  $w('#qrFull').width  = vw;
  $w('#qrFull').height = vh;

  // optional: if your page background is black, this looks like a true full-screen QR
  // no extra styling needed; QR codes are square, so stretching is fine for scanning
}

$w.onReady(() => {
  sizeQrFullScreen();
  // keep it full-screen on device rotation / resize
  wixWindow.onResize(sizeQrFullScreen);
});
