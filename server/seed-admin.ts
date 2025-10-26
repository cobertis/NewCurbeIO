import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seedAdmin() {
  const adminEmail = "hello@curbe.io";
  const adminPassword = "Cuba2010";
  
  const existing = await db.select().from(users).where(eq(users.email, adminEmail));
  
  if (existing.length === 0) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await db.insert(users).values({
      email: adminEmail,
      password: hashedPassword,
      role: "superadmin",
      status: "active"
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
