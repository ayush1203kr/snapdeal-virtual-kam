import test from "node:test";
import assert from "node:assert/strict";
import { extractSellerCommitment } from "../src/agent/commitmentParser.ts";

test("captures an explicit seller action and relative due date", () => {
  const result = extractSellerCommitment("Yes, I'll restock the Kitchen Storage Rack by tomorrow.");
  assert.ok(result);
  assert.equal(result.action, "restock the Kitchen Storage Rack");
  assert.ok(new Date(result.dueDate).getTime() > Date.now());
});

test("captures a seller action with an ISO due date", () => {
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const result = extractSellerCommitment(`I will correct the product title by ${future}`);
  assert.ok(result);
  assert.equal(result.action, "correct the product title");
});

test("does not create commitments without explicit action and due date", () => {
  assert.equal(extractSellerCommitment("I will restock the product"), null);
  assert.equal(extractSellerCommitment("Can you remind me to restock tomorrow?"), null);
  assert.equal(extractSellerCommitment("I might restock the product by tomorrow"), null);
  assert.equal(extractSellerCommitment("I can restock the product by tomorrow"), null);
});
