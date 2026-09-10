"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../HTML/statistics/statistics.js"), "utf8");
const pagination = source.slice(source.indexOf("  let visibleRuns = 10;"), source.indexOf("  function renderRuns()"));
const rawRun = id => ({ id, status: "completed", conclusion: "success", event: "push", run_started_at: new Date(id * 60000).toISOString(), updated_at: new Date(id * 60000 + 20000).toISOString(), html_url: `https://github.com/romanduris/FlightScanner/actions/runs/${id}` });
const recent = Array.from({ length: 40 }, (_, i) => ({ ...rawRun(150 - i), started_at: rawRun(150 - i).run_started_at }));

function setup(fetch) {
  const context = { URL, AbortSignal, fetch, liveData: { github: { runs: recent } }, staticData: null, renderRuns() {} };
  vm.createContext(context);
  vm.runInContext(`${pagination}\nglobalThis.state = () => ({visibleRuns, nextRunsPage, moreRunsAvailable, runsError});`, context);
  return context;
}

test("reveals ten at a time, fetches beyond initial history, and deduplicates overlapping pages", async () => {
  const pages = [];
  const context = setup(async url => {
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    const ids = page === 1 ? Array.from({ length: 100 }, (_, i) => 150 - i) : Array.from({ length: 51 }, (_, i) => 51 - i);
    return { ok: true, json: async () => ({ workflow_runs: ids.map(rawRun) }) };
  });
  assert.equal(context.state().visibleRuns, 10);
  await context.showMoreRuns();
  assert.equal(context.state().visibleRuns, 20);
  assert.equal(pages.length, 0);
  for (let i = 0; i < 13; i++) await context.showMoreRuns();
  assert.equal(context.state().visibleRuns, 150);
  assert.equal(context.allRuns().length, 150);
  assert.deepEqual(pages, [1, 2]);
  assert.equal(context.state().moreRunsAvailable, false);
});

test("failed page can be retried without skipping records or clearing visible rows", async () => {
  let fail = true;
  const context = setup(async () => ({ ok: !fail, status: 429, json: async () => ({ workflow_runs: Array.from({length: 100}, (_, i) => rawRun(150 - i)) }) }));
  for (let i = 0; i < 4; i++) await context.showMoreRuns();
  assert.equal(context.state().visibleRuns, 40);
  assert.equal(context.state().nextRunsPage, 1);
  assert.equal(context.state().runsError, true);
  fail = false;
  await context.showMoreRuns();
  assert.equal(context.state().visibleRuns, 50);
  assert.equal(context.state().runsError, false);
});
