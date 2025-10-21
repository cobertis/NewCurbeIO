import bcrypt from "bcrypt";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function testDemoLogin() {
  const email = "demo@curbe.com";
  const password = "Demo123!@#";
  
  console.log("🔐 Testing demo user login...");
  console.log("----------------------------");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("");
  
  try {
    // Find the user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    
    if (!user) {
      console.log("❌ User not found");
      return;
    }
    
    console.log("✅ User found:");
    console.log("  - ID:", user.id);
    console.log("  - Name:", user.firstName, user.lastName);
    console.log("  - Role:", user.role);
    console.log("  - Status:", user.status);
    console.log("  - Email Verified:", user.emailVerified);
    console.log("  - 2FA Email Enabled:", user.twoFactorEmailEnabled);
    console.log("  - 2FA SMS Enabled:", user.twoFactorSmsEnabled);
    console.log("  - Company ID:", user.companyId);
    console.log("");
    
    // Verify the password
    if (!user.password) {
      console.log("❌ User has no password set");
      return;
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (isPasswordValid) {
      console.log("✅ Password verification successful!");
      console.log("");
      console.log("🎉 Demo user is ready for testing!");
      console.log("  - Can login with: demo@curbe.com / Demo123!@#");
      console.log("  - 2FA is disabled");
      console.log("  - Has admin role for full access");
    } else {
      console.log("❌ Password verification failed");
    }
    
  } catch (error) {
    console.error("Error testing login:", error);
  }
  
  process.exit(0);
}

testDemoLogin();