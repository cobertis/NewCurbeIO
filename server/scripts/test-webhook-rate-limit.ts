import { webhookRateLimit, clearRateLimitStore, getRateLimitStore } from "../middleware/rate-limit";
import { Request, Response, NextFunction } from "express";

function createMockRequest(ip: string): Partial<Request> {
  return {
    ip,
    socket: { remoteAddress: ip } as any
  };
}

function createMockResponse(): Partial<Response> & { statusCode: number; body: any; headers: Record<string, string> } {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    set(name: string, value: string) {
      this.headers[name] = value;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log("=== Webhook Rate Limit Tests ===\n");
  
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<boolean>) {
    try {
      const result = await fn();
      if (result) {
        console.log(`✓ ${name}`);
        passed++;
      } else {
        console.log(`✗ ${name}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ ${name} - Error: ${err}`);
      failed++;
    }
  }

  await test("Test 1: 60 requests OK, 61st returns 429", async () => {
    clearRateLimitStore();
    const middleware = webhookRateLimit("test-endpoint");
    const ip = "192.168.1.1";

    for (let i = 1; i <= 60; i++) {
      const req = createMockRequest(ip) as Request;
      const res = createMockResponse();
      let nextCalled = false;
      const next: NextFunction = () => { nextCalled = true; };
      
      await middleware(req, res as Response, next);
      
      if (!nextCalled) {
        console.log(`  Failed at request ${i}`);
        return false;
      }
    }

    const req61 = createMockRequest(ip) as Request;
    const res61 = createMockResponse();
    let next61Called = false;
    const next61: NextFunction = () => { next61Called = true; };
    
    await middleware(req61, res61 as Response, next61);
    
    if (next61Called) {
      console.log(`  61st request should have been blocked`);
      return false;
    }
    
    if (res61.statusCode !== 429) {
      console.log(`  Expected status 429, got ${res61.statusCode}`);
      return false;
    }
    
    if (!res61.body?.error || res61.body.error !== "Too Many Requests") {
      console.log(`  Expected error message "Too Many Requests"`);
      return false;
    }
    
    // Verify Retry-After header is set
    if (!res61.headers["Retry-After"]) {
      console.log(`  Expected Retry-After header to be set`);
      return false;
    }

    return true;
  });

  await test("Test 2: Multi-endpoint independent counters", async () => {
    clearRateLimitStore();
    const middlewareA = webhookRateLimit("endpoint-a");
    const middlewareB = webhookRateLimit("endpoint-b");
    const ip = "192.168.1.2";

    for (let i = 1; i <= 30; i++) {
      const reqA = createMockRequest(ip) as Request;
      const resA = createMockResponse();
      let nextACalled = false;
      await middlewareA(reqA, resA as Response, () => { nextACalled = true; });
      
      if (!nextACalled) {
        console.log(`  Endpoint A failed at request ${i}`);
        return false;
      }
    }

    for (let i = 1; i <= 30; i++) {
      const reqB = createMockRequest(ip) as Request;
      const resB = createMockResponse();
      let nextBCalled = false;
      await middlewareB(reqB, resB as Response, () => { nextBCalled = true; });
      
      if (!nextBCalled) {
        console.log(`  Endpoint B failed at request ${i}`);
        return false;
      }
    }

    const store = getRateLimitStore();
    const keyA = `endpoint-a:${ip}`;
    const keyB = `endpoint-b:${ip}`;
    
    const recordA = store.get(keyA);
    const recordB = store.get(keyB);
    
    if (!recordA || recordA.count !== 30) {
      console.log(`  Endpoint A count should be 30, got ${recordA?.count}`);
      return false;
    }
    
    if (!recordB || recordB.count !== 30) {
      console.log(`  Endpoint B count should be 30, got ${recordB?.count}`);
      return false;
    }

    return true;
  });

  await test("Test 3: Reset after window expires", async () => {
    clearRateLimitStore();
    const middleware = webhookRateLimit("reset-test");
    const ip = "192.168.1.3";
    const key = `reset-test:${ip}`;

    for (let i = 1; i <= 60; i++) {
      const req = createMockRequest(ip) as Request;
      const res = createMockResponse();
      await middleware(req, res as Response, () => {});
    }

    const store = getRateLimitStore();
    const record = store.get(key);
    if (!record) {
      console.log(`  Record not found`);
      return false;
    }

    record.resetTime = Date.now() - 1000;

    const reqAfterReset = createMockRequest(ip) as Request;
    const resAfterReset = createMockResponse();
    let nextCalled = false;
    await middleware(reqAfterReset, resAfterReset as Response, () => { nextCalled = true; });

    if (!nextCalled) {
      console.log(`  Request after reset should have been allowed`);
      return false;
    }

    const newRecord = store.get(key);
    if (!newRecord || newRecord.count !== 1) {
      console.log(`  Counter should have reset to 1, got ${newRecord?.count}`);
      return false;
    }

    return true;
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
