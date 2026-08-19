const numberFormatter = new Intl.NumberFormat("en-US");

function safeCount(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

export function formatPublicVisitorSummary({ totalVisitors = 0, todayVisitors = 0 } = {}) {
  return `방문자수 | Total ${numberFormatter.format(safeCount(totalVisitors))} · Today ${numberFormatter.format(safeCount(todayVisitors))}`;
}

export function renderPublicVisitorSummary(element, { totalVisitors = 0, todayVisitors = 0 } = {}) {
  if (!element) return;
  const total = numberFormatter.format(safeCount(totalVisitors));
  const today = numberFormatter.format(safeCount(todayVisitors));
  element.innerHTML = `
    <span class="visitor-total">
      <svg class="visitor-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>
      <span class="visitor-label">Total</span><span class="visitor-value">${total}</span>
    </span>
    <span class="visitor-today">
      <svg class="visitor-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 7h6.5a3 3 0 0 1 0 6H7h6.5a3 3 0 0 1 0 6H7"></path></svg>
      <span class="visitor-label">Today</span><span class="visitor-value">${today}</span>
    </span>`;
  element.hidden = false;
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
      renderPublicVisitorSummary(element, summary);
    } catch {
      element.hidden = true;
    }
  };

  void refresh();
  const intervalId = windowObject?.setInterval?.(refresh, 60 * 60 * 1000);
  return () => windowObject?.clearInterval?.(intervalId);
}

