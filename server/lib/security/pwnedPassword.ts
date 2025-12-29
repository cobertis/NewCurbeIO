import crypto from "crypto";

type PwnedResult = { pwned: boolean; count: number };

const cache = new Map<string, { body: string; expiresAt: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchRange(prefix: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(prefix);
  if (hit && hit.expiresAt > now) return hit.body;

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: {
      "User-Agent": "curbe-password-check/1.0",
      "Add-Padding": "true",
    },
  });

  if (!res.ok) throw new Error(`HIBP range request failed: ${res.status}`);

  const body = await res.text();
  cache.set(prefix, { body, expiresAt: now + TTL_MS });
  return body;
}

export async function checkPwnedPassword(password: string): Promise<PwnedResult> {
  const sha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const body = await fetchRange(prefix);

  for (const line of body.split("\n")) {
    const [hashSuffix, countStr] = line.trim().split(":");
    if (hashSuffix === suffix) {
      return { pwned: true, count: Number(countStr || "0") };
    }
  }
  return { pwned: false, count: 0 };
}
