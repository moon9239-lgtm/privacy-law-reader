const DEFAULT_TEAM_ID = "team_uuBpChdfNVdyTFQgCIVTO7we";
const DEFAULT_PROJECT_ID = "prj_Rb7mb32WNMLXy5OtRPRw9Pn7ZZLT";
const AGGREGATE_ENDPOINT = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";

function nonNegativeInteger(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function toKstDate(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nextKstDate(date) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function rowsFromResponse(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["daily", "data", "rows", "results", "items"]) {
    const rows = rowsFromResponse(value[key]);
    if (rows.length) return rows;
  }
  return [];
}

function writeJson(response, statusCode, value) {
  response.setHeader?.("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=300");
  response.setHeader?.("X-Content-Type-Options", "nosniff");
  if (typeof response.status === "function" && typeof response.json === "function") {
    return response.status(statusCode).json(value);
  }
  response.statusCode = statusCode;
  response.setHeader?.("Content-Type", "application/json; charset=utf-8");
  return response.end(JSON.stringify(value));
}

async function fetchTodayVisitors({ fetchImpl, env, today }) {
  const url = new URL(AGGREGATE_ENDPOINT);
  url.search = new URLSearchParams({
    teamId: env.VERCEL_TEAM_ID || DEFAULT_TEAM_ID,
    projectId: env.VERCEL_PROJECT_ID || DEFAULT_PROJECT_ID,
    since: today,
    until: nextKstDate(today),
    by: "day",
  });
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${env.VERCEL_ANALYTICS_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Vercel Analytics request failed (${response.status})`);
  const row = rowsFromResponse(await response.json()).find((item) => String(item?.date ?? item?.day ?? "").startsWith(today));
  return nonNegativeInteger(row?.visitors ?? row?.visitor ?? row?.users);
}

async function fetchHistoricalVisitors({ fetchImpl, env, today }) {
  const query = new URLSearchParams({
    select: "snapshot_date,daily_visitors",
    order: "snapshot_date.asc",
  });
  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/analytics_daily_snapshots?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Supabase snapshot request failed (${response.status})`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    if (row?.snapshot_date === today) return sum;
    return sum + nonNegativeInteger(row?.daily_visitors);
  }, 0);
}

export function createPublicAnalyticsHandler({ env = process.env, fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  return async function publicAnalyticsHandler(request, response) {
    if (request.method !== "GET") {
      response.setHeader?.("Allow", "GET");
      return writeJson(response, 405, { error: "Method not allowed" });
    }
    if (!env.VERCEL_ANALYTICS_TOKEN || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return writeJson(response, 503, { error: "Public analytics is not configured" });
    }

    try {
      const today = toKstDate(now);
      const [totalVisitors, todayVisitors] = await Promise.all([
        fetchHistoricalVisitors({ fetchImpl, env, today }),
        fetchTodayVisitors({ fetchImpl, env, today }),
      ]);
      return writeJson(response, 200, { totalVisitors, todayVisitors });
    } catch {
      return writeJson(response, 502, { error: "Public analytics upstream request failed" });
    }
  };
}

export default createPublicAnalyticsHandler();

