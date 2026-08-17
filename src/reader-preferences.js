const STORAGE_KEY = "privacy-reader-view-v2";
const DEFAULT_PREFERENCES = Object.freeze({
  theme: "light",
  fontSize: 17,
  lineHeight: 1.6,
  showFutureAmendments: true,
});

export function readViewPreferences(storage) {
  try {
    const persisted = JSON.parse(storage?.getItem(STORAGE_KEY));
    return normalizePreferences(persisted);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writeViewPreferences(storage, preferences) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
  } catch {
    // Storage can be unavailable or full; view settings must never block reading.
  }
}

function normalizePreferences(preferences) {
  if (!preferences || typeof preferences !== "object") {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    theme: preferences.theme === "dark" ? "dark" : "light",
    fontSize: clampNumber(preferences.fontSize, 15, 20, DEFAULT_PREFERENCES.fontSize),
    lineHeight: clampNumber(preferences.lineHeight, 1.3, 1.8, DEFAULT_PREFERENCES.lineHeight),
    showFutureAmendments: preferences.showFutureAmendments !== false,
  };
}

function clampNumber(value, min, max, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}
