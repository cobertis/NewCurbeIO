
  // PATCH /api/telnyx/caller-id - Update caller ID name (CNAM) for a phone number
  app.patch("/api/telnyx/caller-id", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = req.user!.companyId!;
      const { phoneNumber, callerIdName } = req.body;
      
      if (!phoneNumber || !callerIdName) {
        return res.status(400).json({ message: "Phone number and caller ID name are required" });
      }
      
      // Sanitize CNAM - max 15 alphanumeric characters or spaces
      const sanitizedCnam = callerIdName.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 15).toUpperCase();
      
      if (sanitizedCnam.length === 0) {
        return res.status(400).json({ message: "Caller ID name must contain at least one alphanumeric character" });
      }
      
      // Verify the phone number belongs to this company
      const phoneNumberRecord = await db
        .select()
        .from(telnyxPhoneNumbers)
        .where(and(
          eq(telnyxPhoneNumbers.phoneNumber, phoneNumber),
          eq(telnyxPhoneNumbers.companyId, companyId)
        ))
        .limit(1);
      
      if (phoneNumberRecord.length === 0) {
        return res.status(404).json({ message: "Phone number not found" });
      }
      
      // Get Telnyx API key and managed account ID
      const apiKey = await getTelnyxMasterApiKey();
      const { getCompanyManagedAccountId } = await import("./services/telnyx-managed-accounts");
      const managedAccountId = await getCompanyManagedAccountId(companyId);
      
      // Use the stored Telnyx phone number ID
      const telnyxPhoneId = phoneNumberRecord[0].telnyxPhoneNumberId;
      if (!telnyxPhoneId) {
        return res.status(404).json({ message: "Phone number not linked to Telnyx" });
      }
      
      console.log(\`[CNAM] Setting CNAM "\${sanitizedCnam}" for phone \${phoneNumber} (telnyxId: \${telnyxPhoneId}) in managed account \${managedAccountId}\`);
      
      // Build headers
      const telnyxHeaders: Record<string, string> = {
        "Authorization": \`Bearer \${apiKey}\`,
        "Content-Type": "application/json"
      };
      if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
        telnyxHeaders["x-telnyx-account-id"] = managedAccountId;
      }
      
      // Use the managed account endpoint for CNAM (same as portal uses)
      let cnamUrl: string;
      if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
        // For managed accounts, use the managed account phone numbers endpoint
        cnamUrl = \`https://api.telnyx.com/v2/phone_numbers/\${telnyxPhoneId}\`;
      } else {
        cnamUrl = \`https://api.telnyx.com/v2/phone_numbers/\${telnyxPhoneId}\`;
      }
      
      // Update the phone number with caller_id_name field via PATCH
      const response = await fetch(cnamUrl, {
        method: "PATCH",
        headers: telnyxHeaders,
        body: JSON.stringify({
          caller_id_name_id: null, // Clear any existing CNAM listing reference
          cnam_listing_enabled: true
        })
      });
      
      let responseText = await response.text();
      console.log(\`[CNAM] PATCH phone number response (\${response.status}): \${responseText.substring(0, 500)}\`);
      
      if (!response.ok) {
        // Try creating a CNAM listing directly
        console.log("[CNAM] PATCH failed, trying POST to cnam_listings...");
        const cnamListingResponse = await fetch("https://api.telnyx.com/v2/cnam_listings", {
          method: "POST",
          headers: telnyxHeaders,
          body: JSON.stringify({
            phone_number_id: telnyxPhoneId,
            caller_id_name: sanitizedCnam
          })
        });
        
        responseText = await cnamListingResponse.text();
        console.log(\`[CNAM] POST cnam_listings response (\${cnamListingResponse.status}): \${responseText.substring(0, 500)}\`);
        
        if (!cnamListingResponse.ok) {
          // Update local database even if API fails (user configured it manually)
          await db
            .update(telnyxPhoneNumbers)
            .set({ callerIdName: sanitizedCnam, cnam: sanitizedCnam, updatedAt: new Date() })
            .where(eq(telnyxPhoneNumbers.id, phoneNumberRecord[0].id));
          
          return res.status(400).json({ 
            success: false, 
            message: "Failed to update CNAM in Telnyx. The CNAM Listings API returned an error. Please configure CNAM directly in the Telnyx portal.",
            callerIdName: null
          });
        }
      }
      
      // Update local database
      await db
        .update(telnyxPhoneNumbers)
        .set({ callerIdName: sanitizedCnam, cnam: sanitizedCnam, updatedAt: new Date() })
        .where(eq(telnyxPhoneNumbers.id, phoneNumberRecord[0].id));
      
      console.log(\`[CNAM] Successfully set CNAM "\${sanitizedCnam}" for \${phoneNumber}\`);
      res.json({ success: true, callerIdName: sanitizedCnam });
      
    } catch (error: any) {
      console.error("[CNAM] Error updating caller ID:", error);
      res.status(500).json({ message: "Failed to update caller ID name" });
    }
  });
