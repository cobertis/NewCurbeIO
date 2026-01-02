import { credentialProvider } from "../server/services/credential-provider";
import * as fs from "fs";
import * as path from "path";

async function uploadToTelnyx(filePath: string, mediaName: string): Promise<string | null> {
  const { apiKey } = await credentialProvider.getTelnyx();
  
  if (!apiKey) {
    console.error("No Telnyx API key found");
    return null;
  }
  
  console.log(`Uploading ${filePath} as ${mediaName} (permanent storage)...`);
  
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });
  
  const formData = new FormData();
  formData.append('media', blob, path.basename(filePath));
  formData.append('media_name', mediaName);
  // No ttl_secs = permanent storage
  
  const response = await fetch('https://api.telnyx.com/v2/media', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });
  
  const result = await response.json();
  
  if (response.ok) {
    console.log(`Uploaded successfully:`, JSON.stringify(result, null, 2));
    return result.data?.media_name || mediaName;
  } else {
    // If already exists, try to update it
    if (result.errors?.[0]?.code === 'already_exists' || result.errors?.[0]?.title?.includes('already exists')) {
      console.log(`Media already exists, will use existing: ${mediaName}`);
      return mediaName;
    }
    console.error(`Upload failed:`, JSON.stringify(result, null, 2));
    return null;
  }
}

async function main() {
  console.log("Uploading recording announcement files to Telnyx (permanent storage)...\n");
  
  const englishFile = "attached_assets/Recording_1767389733079.mp3";
  const spanishFile = "attached_assets/Grabando_1767389733079.mp3";
  
  const enMediaName = await uploadToTelnyx(englishFile, "curbe-recording-announcement-en");
  const esMediaName = await uploadToTelnyx(spanishFile, "curbe-recording-announcement-es");
  
  console.log("\n=== Media Names to use ===");
  console.log(`TELNYX_RECORDING_MEDIA_EN=${enMediaName}`);
  console.log(`TELNYX_RECORDING_MEDIA_ES=${esMediaName}`);
}

main().catch(console.error);
