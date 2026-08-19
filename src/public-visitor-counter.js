const numberFormatter = new Intl.NumberFormat("en-US");

function safeCount(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

export function formatPublicVisitorSummary({ totalVisitors = 0, todayVisitors = 0 } = {}) {
  return `방문자수 | Total ${numberFormatter.format(safeCount(totalVisitors))} · Today ${numberFormatter.format(safeCount(todayVisitors))}`;
}

export async function fetchPublicVisitorSummary({ fetchImpl = globalThis.fetch, endpoint = "/api/public-analytics" } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const response = await fetchImpl(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Public analytics request failed (${response.status})`);
  const payload = await response.json();
  return {
    totalVisitors: safeCount(payload?.totalVisitors),
    todayVisitors: safeCount(payload?.todayVisitors),
  };
}

export function installPublicVisitorSummary(documentObject, windowObject, fetchImpl = windowObject?.fetch?.bind(windowObject)) {
  const element = documentObject?.querySelector?.("#publicVisitorSummary");
  if (!element || typeof fetchImpl !== "function") return () => {};

  const refresh = async () => {
    try {
      const summary = await fetchPublicVisitorSummary({ fetchImpl });
      element.textContent = formatPublicVisitorSummary(summary);
      element.hidden = false;
    } catch {
      element.hidden = true;
    }
  };

  void refresh();
  const intervalId = windowObject?.setInterval?.(refresh, 60 * 60 * 1000);
  return () => windowObject?.clearInterval?.(intervalId);
}

