import assert from "node:assert/strict";
import test from "node:test";

import { getPrimaryNavItems, isNavItemActive } from "./sidebar-nav.ts";

test("exposes stable primary rail destinations", () => {
  const items = getPrimaryNavItems();

  assert.deepEqual(
    items.map((item) => item.label),
    ["Dashboard", "Jobs", "Personas"],
  );
  assert.deepEqual(
    items.map((item) => item.href),
    ["/dashboard", "/jobs", "/personas"],
  );
});

test("activates jobs for canonical and legacy job routes", () => {
  const jobsItem = getPrimaryNavItems().find((item) => item.label === "Jobs");

  assert.ok(jobsItem);
  assert.equal(isNavItemActive(jobsItem, "/jobs"), true);
  assert.equal(isNavItemActive(jobsItem, "/jobs/job-123"), true);
  assert.equal(isNavItemActive(jobsItem, "/interviews/job-123"), true);
});
