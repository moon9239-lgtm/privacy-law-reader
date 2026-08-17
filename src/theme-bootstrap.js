try {
  const view = JSON.parse(localStorage.getItem("privacy-reader-view-v2") || "{}");
  document.documentElement.dataset.theme = view.theme === "dark" ? "dark" : "light";
  if (Number.isFinite(view.fontSize)) {
    document.documentElement.style.setProperty("--reader-font-size", `${Math.min(Math.max(view.fontSize, 15), 20)}px`);
  }
  if (Number.isFinite(view.lineHeight)) {
    document.documentElement.style.setProperty("--reader-line-height", String(Math.min(Math.max(view.lineHeight, 1.3), 1.8)));
  }
} catch {
  // Invalid or unavailable local preferences fall back to stylesheet defaults.
}
