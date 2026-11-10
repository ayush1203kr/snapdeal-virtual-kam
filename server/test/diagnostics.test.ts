import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSeller } from "../src/services/diagnostics.ts";

const seller = {
  _id: "demo",
  metrics: {
    previous: { visits: 12000, orders: 360, revenue: 432000, inStockPct: 96, cancellationPct: 3, rating: 4.2, returnPct: 5 },
    current: { visits: 10200, orders: 245, revenue: 294000, inStockPct: 82, cancellationPct: 7, rating: 3.9, returnPct: 8 }
  },
  products: [
    { name: "Kitchen Storage Rack", sku: "UN-KSR-01", stock: 0, views: 2400, orders: 0 },
    { name: "Cookware Set", sku: "UN-NCS-02", stock: 18, views: 1900, orders: 74 }
  ]
};

test("calculates the seller funnel and sales movement", () => {
  const result = analyzeSeller(seller);
  assert.equal(result.current.conversionRate, 245 / 10200 * 100);
  assert.ok(Math.abs(result.changes.revenuePct - (-31.9444444444)) < 0.001);
  assert.ok(Math.abs(result.changes.visitsPct - (-15)) < 0.001);
  assert.ok(result.changes.conversionPoints < 0);
  assert.match(result.driverSummary, /visits/);
  assert.match(result.driverSummary, /conversion/);
});

test("prioritizes high-view zero-stock SKUs and fulfilment risks", () => {
  const result = analyzeSeller(seller);
  assert.equal(result.unavailableProducts[0].sku, "UN-KSR-01");
  assert.ok(result.signals.some(signal => signal.key === "stock"));
  assert.ok(result.signals.some(signal => signal.key === "cancellations"));
  assert.equal(result.actions[0].id, "availability");
  assert.ok(result.actions.some(action => action.id === "cancellations"));
});

test("keeps an empty or zero-traffic baseline safe", () => {
  const result = analyzeSeller({ metrics: { previous: { visits: 0, orders: 0, revenue: 0 }, current: { visits: 0, orders: 0, revenue: 0 } }, products: [] });
  assert.equal(result.current.conversionRate, 0);
  assert.equal(result.changes.revenuePct, 0);
  assert.equal(result.changes.visitsPct, 0);
  assert.equal(result.signals.length, 0);
  assert.equal(result.actions.length, 0);
});

test("reports a missing baseline rather than inventing a percentage", () => {
  const result = analyzeSeller({ metrics: { previous: { visits: 0, orders: 0, revenue: 0 }, current: { visits: 50, orders: 4, revenue: 2000 } }, products: [] });
  assert.equal(result.changes.revenuePct, null);
  assert.match(result.changes.revenueLabel, /No comparable baseline/);
});
