import { db } from './server/db';
import { telephonySettings, telnyxPhoneNumbers, wallets } from './shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { secretsService } from './server/services/secrets-service';

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const COMPANY_ID = "b5325600-9bf9-4eae-b34a-87d6ab2f5fb2";
const PHONE_NUMBER = "+13058423033";
const CREDENTIAL_CONNECTION_ID = "2846174477723633460";

async function repair() {
  console.log("=== COBERTIS TELEPHONY REPAIR ===\n");
  
  // Get API key from database (proper secure method)
  const TELNYX_API_KEY = await secretsService.getCredential("telnyx", "api_key");
  if (!TELNYX_API_KEY) {
    console.error("ERROR: Telnyx API key not found in database");
    return;
  }
  console.log("Telnyx API key retrieved from secure storage");
  
  // Get company's Telnyx account ID from wallets table
  const [wallet] = await db.select({ telnyxAccountId: wallets.telnyxAccountId })
    .from(wallets)
    .where(and(
      eq(wallets.companyId, COMPANY_ID),
      sql`${wallets.telnyxAccountId} IS NOT NULL`
    ))
    .limit(1);
  
  const [phoneRecord] = await db.select().from(telnyxPhoneNumbers).where(eq(telnyxPhoneNumbers.phoneNumber, PHONE_NUMBER));
  
  console.log("Telnyx Account ID:", wallet?.telnyxAccountId);
  console.log("DB Phone Number ID:", phoneRecord?.telnyxPhoneNumberId);
  
  const telnyxAccountId = wallet?.telnyxAccountId;
  if (!telnyxAccountId) {
    console.error("ERROR: No Telnyx account ID found in wallets");
    return;
  }
  
  const headers: HeadersInit = {
    "Authorization": `Bearer ${TELNYX_API_KEY}`,
    "Content-Type": "application/json",
    "x-managed-account-id": telnyxAccountId,
  };
  
  // Step 1: Check if phone number exists by searching
  console.log("\n--- Step 1: Searching for Phone Number ---");
  const searchResp = await fetch(`${TELNYX_API_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(PHONE_NUMBER)}`, {
    method: "GET",
    headers,
  });
  
  let actualPhoneId: string | null = null;
  
  if (searchResp.ok) {
    const searchData = await searchResp.json() as { data: Array<{ id: string; phone_number: string; connection_id?: string }> };
    console.log("Search found:", searchData.data?.length || 0, "numbers");
    
    if (searchData.data && searchData.data.length > 0) {
      actualPhoneId = searchData.data[0].id;
      console.log(`Found phone number with ID: ${actualPhoneId}`);
      console.log(`Current connection_id: ${searchData.data[0].connection_id}`);
      
      // Update DB if different
      if (actualPhoneId !== phoneRecord?.telnyxPhoneNumberId) {
        console.log("Updating database with correct Telnyx ID...");
        await db.update(telnyxPhoneNumbers)
          .set({ telnyxPhoneNumberId: actualPhoneId })
          .where(eq(telnyxPhoneNumbers.phoneNumber, PHONE_NUMBER));
        console.log("Database updated!");
      }
    } else {
      console.log("Phone number not found in Telnyx account!");
      console.log("The number may need to be repurchased.");
      return;
    }
  } else {
    console.error("Search failed:", searchResp.status, await searchResp.text());
    return;
  }
  
  // Step 2: Configure routing to credential connection
  console.log("\n--- Step 2: Configuring Routing ---");
  const routingPayload = {
    connection_id: CREDENTIAL_CONNECTION_ID,
  };
  
  const routingResp = await fetch(`${TELNYX_API_BASE}/phone_numbers/${actualPhoneId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(routingPayload),
  });
  
  if (routingResp.ok) {
    const routingData = await routingResp.json();
    console.log("Routing configured:", (routingData as any).data?.connection_id);
  } else {
    console.log(`Routing failed: ${routingResp.status} - ${await routingResp.text()}`);
  }
  
  // Step 3: Configure voice settings (recording, CNAM)
  console.log("\n--- Step 3: Configuring Voice Settings ---");
  const voicePayload = {
    call_forwarding: {
      call_forwarding_enabled: false,
    },
    call_recording: {
      inbound_call_recording_enabled: true,
      inbound_call_recording_format: "mp3",
      inbound_call_recording_channels: "single",
    },
    cnam_listing: {
      cnam_listing_enabled: true,
      cnam_listing_details: "COBERTIS",
    },
    media_features: {
      rtp_auto_adjust_enabled: true,
      accept_any_rtp_packets_enabled: true,
    },
  };
  
  const voiceResp = await fetch(`${TELNYX_API_BASE}/phone_numbers/${actualPhoneId}/voice`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(voicePayload),
  });
  
  if (voiceResp.ok) {
    const voiceData = await voiceResp.json() as { data: { call_recording?: { inbound_call_recording_enabled?: boolean }; cnam_listing?: { cnam_listing_enabled?: boolean } } };
    console.log("Recording enabled:", voiceData.data?.call_recording?.inbound_call_recording_enabled);
    console.log("CNAM enabled:", voiceData.data?.cnam_listing?.cnam_listing_enabled);
  } else {
    console.log(`Voice settings failed: ${voiceResp.status} - ${await voiceResp.text()}`);
  }
  
  // Step 4: Check and fix credential connection SRTP
  console.log("\n--- Step 4: Checking Credential Connection ---");
  const connResp = await fetch(`${TELNYX_API_BASE}/credential_connections/${CREDENTIAL_CONNECTION_ID}`, {
    method: "GET",
    headers,
  });
  
  if (connResp.ok) {
    const connData = await connResp.json() as { data: { active?: boolean; connection_name?: string; sip_uri_calling_preference?: string; encrypted_media?: string | null } };
    console.log("Connection active:", connData.data?.active);
    console.log("Connection name:", connData.data?.connection_name);
    console.log("SIP URI calling:", connData.data?.sip_uri_calling_preference);
    console.log("Encrypted media (SRTP):", connData.data?.encrypted_media);
    
    // Ensure SRTP is disabled for WebRTC compatibility
    if (connData.data?.encrypted_media !== null) {
      console.log("\nDisabling SRTP...");
      const srtpResp = await fetch(`${TELNYX_API_BASE}/credential_connections/${CREDENTIAL_CONNECTION_ID}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ encrypted_media: null }),
      });
      if (srtpResp.ok) {
        console.log("SRTP disabled successfully");
      }
    }
  } else {
    console.log(`Connection check failed: ${connResp.status}`);
  }
  
  // Step 5: Update DB settings
  console.log("\n--- Step 5: Updating Database Settings ---");
  await db.update(telephonySettings)
    .set({
      recordingEnabled: true,
      cnamEnabled: true,
      noiseSuppressionEnabled: true,
    })
    .where(eq(telephonySettings.companyId, COMPANY_ID));
  console.log("Database settings updated: recording=true, cnam=true, noise_suppression=true");
  
  console.log("\n=== REPAIR COMPLETE ===");
  process.exit(0);
}

repair().catch(e => {
  console.error("Repair failed:", e);
  process.exit(1);
});
