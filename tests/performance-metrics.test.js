"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("performance colors include boundaries and treat missing or invalid data as unknown", () => {
  const source = fs.readFileSync(path.join(__dirname, "../HTML/statistics/statistics.js"), "utf8");
  const code = source.slice(source.indexOf("  function setPerformanceMetric("), source.indexOf("  function barList("));
  const card = { dataset: {} };
  const context = { byId: () => ({ closest: () => card, setAttribute() {} }), text: key => key, setMetric() {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  for (const [good, fair] of [[2500, 4000], [200, 500], [0.1, 0.25], [2000, 4000]]) {
    for (const [value, expected] of [[0, "good"], [good, "good"], [(good + fair) / 2, "fair"], [fair, "fair"], [fair + 1, "poor"], [null, "unknown"], [undefined, "unknown"], [NaN, "unknown"], [-1, "unknown"]]) {
      context.setPerformanceMetric("metric", value, good, fair, String(value));
      assert.equal(card.dataset.quality, expected);
    }
  }
});
