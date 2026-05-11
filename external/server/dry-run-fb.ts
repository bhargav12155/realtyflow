
import fetch from "node-fetch";

async function dryRun() {
  const testUrl = "https://home-template-images.s3.us-east-2.amazonaws.com/user-1/photo-avatars/1772509130282-Screenshot 2026-03-02 at 9.05.46\u202fPM.png";
  
  console.log("Original URL:", testUrl);
  console.log("Encoded URL:", encodeURI(testUrl));
  
  if (encodeURI(testUrl).includes(" ")) {
    console.error("❌ Encoding failed: URL still contains spaces");
  } else {
    console.log("✅ Encoding successful: No spaces in URL");
  }

  // Check if we can actually reach the URL (simulating Facebook's fetch)
  try {
    const res = await fetch(encodeURI(testUrl), { method: 'HEAD' });
    console.log(`URL Accessibility Check: ${res.status} ${res.statusText}`);
  } catch (e) {
    console.log("URL Accessibility Check: Failed (Expected if private S3, but encoding is the priority)");
  }
}

dryRun();
