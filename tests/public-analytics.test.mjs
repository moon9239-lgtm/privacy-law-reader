import test from "node:test";
import assert from "node:assert/strict";
import { createPublicAnalyticsHandler } from "../api/public-analytics.js";

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    statusCode: 0,
    body: "",
    end(value) { this.body = value; },
  };
}

test("public analytics returns historical total and today's visitors", async () => {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("supabase.co")) {
      return { ok: true, async json() { return [{ snapshot_date: "2026-08-18", daily_visitors: 12 }]; } };
    }
    return { ok: true, async json() { return { data: [{ date: "2026-08-20", visitors: 7 }] }; } };
  };
  const response = responseRecorder();
  const handler = createPublicAnalyticsHandler({
    env: {
      VERCEL_ANALYTICS_TOKEN: "server-only",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only",
    },
    fetchImpl,
    now: new Date("2026-08-20T03:00:00.000Z"),
  });

  await handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { totalVisitors: 12, todayVisitors: 7 });
  assert.equal(calls.length, 2);
  assert.ok(calls.some((url) => url.includes("since=2026-08-20")));
});

