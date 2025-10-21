import bcrypt from "bcrypt";

async function generateHash() {
  const password = "Demo123!@#";
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log("Password:", password);
    console.log("Hash:", hash);
    
    // Verify the hash works
    const isValid = await bcrypt.compare(password, hash);
    console.log("Hash verification:", isValid ? "✅ Valid" : "❌ Invalid");
    
    return hash;
  } catch (error) {
    console.error("Error generating hash:", error);
  }
}

generateHash();