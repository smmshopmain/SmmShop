import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogScheduleDateTime, isCatalogRefreshDue } from "./catalog-refresh-time";

test("catalog refresh schedule uses IST and handles midnight day rollover", () => {
  assert.deepEqual(getCatalogScheduleDateTime(new Date("2026-11-25T18:29:00.000Z")), {
    date: "2026-11-25",
    time: "23:59",
  });
  assert.deepEqual(getCatalogScheduleDateTime(new Date("2026-11-25T18:30:00.000Z")), {
    date: "2026-11-26",
    time: "00:00",
  });
});

test("catalog refresh becomes due at the configured IST time", () => {
  assert.equal(isCatalogRefreshDue(new Date("2026-11-25T05:29:00.000Z"), "11:00").due, false);
  assert.equal(isCatalogRefreshDue(new Date("2026-11-25T05:30:00.000Z"), "11:00").due, true);
});
