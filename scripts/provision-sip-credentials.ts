import { db } from "../server/db";
import { pbxExtensions } from "../shared/schema";
import { eq } from "drizzle-orm";
import { createUserSipCredentialWithExtension } from "../server/services/telnyx-e911-service";

const COMPANY_ID = "b5325600-9bf9-4eae-b34a-87d6ab2f5fb2";

async function provisionAllSipCredentials() {
  console.log("Starting SIP credential provisioning for all extensions...\n");

  const extensions = await db
    .select()
    .from(pbxExtensions)
    .where(eq(pbxExtensions.companyId, COMPANY_ID));

  console.log(`Found ${extensions.length} extensions to provision\n`);

  for (const ext of extensions) {
    if (!ext.userId) {
      console.log(`❌ Extension ${ext.extension} (${ext.displayName}) has no user assigned, skipping`);
      continue;
    }

    console.log(`\n📞 Provisioning extension ${ext.extension} (${ext.displayName})...`);
    
    try {
      const result = await createUserSipCredentialWithExtension(
        COMPANY_ID,
        ext.userId,
        ext.extension,
        ext.displayName
      );

      if (result.success) {
        console.log(`✅ SUCCESS: ${result.sipUsername}`);
        console.log(`   Credential ID: ${result.credentialId}`);
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log("\n\nProvisioning complete!");
  process.exit(0);
}

provisionAllSipCredentials().catch(console.error);
