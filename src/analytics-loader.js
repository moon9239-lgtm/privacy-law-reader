import { installPublicVisitorSummary } from "./public-visitor-counter.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  installPublicVisitorSummary(document, window);
}

