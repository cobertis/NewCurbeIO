import { Request, Response, NextFunction } from "express";

const RATE_LIMIT_PER_MIN = parseInt(process.env.WEBHOOK_RATE_LIMIT_PER_MIN || "60");

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function webhookRateLimit(endpointName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${endpointName}:${ip}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, record);
      return next();
    }
    
    record.count++;
    
    if (record.count > RATE_LIMIT_PER_MIN) {
      const ipHash = ip.length > 8 ? ip.substring(0, 8) + "..." : ip;
      const retryAfterSecs = Math.ceil((record.resetTime - now) / 1000);
      
      // Log rate limit event (JSON structured for log aggregation)
      console.warn(JSON.stringify({
        level: "warn",
        event: "rate_limit_exceeded",
        endpoint: endpointName,
        ipHash,
        count: record.count,
        limit: RATE_LIMIT_PER_MIN,
        retryAfter: retryAfterSecs,
        timestamp: new Date().toISOString()
      }));
      
      // Set standard Retry-After header
      res.set("Retry-After", String(retryAfterSecs));
      
      return res.status(429).json({
        error: "Too Many Requests",
        retryAfter: retryAfterSecs
      });
    }
    
    next();
  };
}

export function clearRateLimitStore() {
  rateLimitStore.clear();
}

export function getRateLimitStore() {
  return rateLimitStore;
}
