import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET;

if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for secure unsubscribe tokens");
}

/**
 * Generate a secure unsubscribe token for a user
 */
export function generateUnsubscribeToken(email: string): string {
  const hmac = crypto.createHmac("sha256", SECRET!);
  hmac.update(email.toLowerCase());
  return hmac.digest("hex");
}

/**
 * Verify an unsubscribe token is valid for a given email
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  try {
    // Validate token format: must be hex string of correct length (64 chars for SHA-256)
    if (!token || typeof token !== "string" || !/^[0-9a-f]{64}$/i.test(token)) {
      return false;
    }

    const expectedToken = generateUnsubscribeToken(email);
    
    return crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken, "hex")
    );
  } catch (error) {
    // Any error in validation means invalid token
    return false;
  }
}
