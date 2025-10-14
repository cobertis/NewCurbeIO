import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const adminEmail = "hello@curbe.io";
  
  const existing = await db.select().from(users).where(eq(users.email, adminEmail));
  
  if (existing.length === 0) {
    await db.insert(users).values({
      email: adminEmail,
      password: "Cuba2010",
      role: "superadmin"
    });
    console.log("Superadmin user created:", adminEmail);
  } else {
    console.log("Superadmin user already exists:", adminEmail);
  }
  
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Error seeding admin:", err);
  process.exit(1);
});
