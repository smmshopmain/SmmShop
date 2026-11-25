import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogServiceChanges } from "./catalog-changes";

test("new catalog service records all tracked fields as additions", () => {
  const changes = getCatalogServiceChanges(undefined, {
    name: "Instagram Likes",
    category: "Instagram",
    type: "Default",
    providerRate: 1,
    sellingRate: 1.2,
    min: 10,
    max: 1000,
    refill: true,
    cancel: false,
    active: true,
  });

  assert.equal(changes.length, 10);
  assert.deepEqual(changes.find((change) => change.field === "sellingRate"), {
    field: "sellingRate",
    previous: null,
    current: 1.2,
  });
});

test("catalog sync reports only fields whose values changed", () => {
  const changes = getCatalogServiceChanges(
    { name: "Old name", sellingRate: 1.2, active: true },
    { name: "New name", sellingRate: 1.5, active: true },
  );

  assert.deepEqual(changes, [
    { field: "name", previous: "Old name", current: "New name" },
    { field: "sellingRate", previous: 1.2, current: 1.5 },
  ]);
});
