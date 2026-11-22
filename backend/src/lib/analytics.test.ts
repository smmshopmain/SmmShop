import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsDateFilter, InvalidAnalyticsDateRangeError } from "./analytics";

test("analytics date filter includes complete UTC calendar days", () => {
  assert.deepEqual(analyticsDateFilter("2026-02-28", "2026-03-01"), {
    createdAt: {
      $gte: new Date("2026-02-28T00:00:00.000Z"),
      $lt: new Date("2026-03-02T00:00:00.000Z"),
    },
  });
});

test("analytics date filter accepts a single-sided range and rejects invalid ranges", () => {
  assert.deepEqual(analyticsDateFilter("2026-02-28", null), {
    createdAt: { $gte: new Date("2026-02-28T00:00:00.000Z") },
  });
  assert.throws(() => analyticsDateFilter("2026-02-30", null), InvalidAnalyticsDateRangeError);
  assert.throws(() => analyticsDateFilter("2026-03-02", "2026-03-01"), InvalidAnalyticsDateRangeError);
});
