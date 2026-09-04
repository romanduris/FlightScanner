"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "HTML");
const statisticsHtml = fs.readFileSync(path.join(root, "statistics", "index.html"), "utf8");
const statisticsJs = fs.readFileSync(path.join(root, "statistics", "statistics.js"), "utf8");
const engagementJs = fs.readFileSync(path.join(root, "statistics", "engagement.js"), "utf8");
const dashboardJs = fs.readFileSync(path.join(root, "dashboard.js"), "utf8");

assert.match(statisticsHtml, /id="click-offers"/);
assert.match(statisticsHtml, /id="click-ryanair"/);
assert.match(statisticsHtml, /id="click-wizz"/);
assert.match(statisticsHtml, /id="click-booking"/);
assert.equal((statisticsHtml.match(/data-collapsible/g) || []).length, 5);
assert.equal((statisticsHtml.match(/class="section-toggle"/g) || []).length, 5);
assert.match(statisticsJs, /queryLanguage === "sk" \? "sk" : "en"/);
assert.match(statisticsJs, /clicks\.offer_opens/);
assert.match(statisticsJs, /bindCollapsibleSections/);
assert.match(engagementJs, /data-stat-click/);
assert.match(dashboardJs, /trackClick\("offer_open", offer\.airline\)/);

console.log("Anonymous click statistics wiring: OK");
