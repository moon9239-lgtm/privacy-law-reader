import test from "node:test";
import assert from "node:assert/strict";
import { renderPublicVisitorSummary } from "../src/public-visitor-counter.js";

test("visitor summary renders the designed total and today segments", () => {
  const element = { hidden: true, innerHTML: "" };

  renderPublicVisitorSummary(element, { totalVisitors: 1805, todayVisitors: 7 });

  assert.match(element.innerHTML, /class="visitor-total"/);
  assert.match(element.innerHTML, /class="visitor-today"/);
  assert.match(element.innerHTML, /class="visitor-label">Total<\/span>/);
  assert.match(element.innerHTML, /class="visitor-label">Today<\/span>/);
  assert.match(element.innerHTML, /class="visitor-value">1,805<\/span>/);
  assert.match(element.innerHTML, /class="visitor-value">7<\/span>/);
  assert.equal(element.hidden, false);
});

