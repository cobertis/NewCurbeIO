import { db } from "./db";
import { users } from "@shared/schema";

async function seedTestUsers() {
  const testUsers = [
    { email: 'moderator@curbe.io', password: 'Test123', role: 'moderator' },
    { email: 'viewer@curbe.io', password: 'Test123', role: 'viewer' },
    { email: 'user1@example.com', password: 'Test123', role: 'viewer' },
    { email: 'user2@example.com', password: 'Test123', role: 'viewer' }
  ];
  
  for (const user of testUsers) {
    try {
      await db.insert(users).values(user);
      console.log('Created:', user.email);
    } catch (e) {
      console.log('Skipped (exists):', user.email);
    }
  }
  
  process.exit(0);
}

seedTestUsers().catch((err) => {
  console.error("Error seeding test users:", err);
  process.exit(1);
});
