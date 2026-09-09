import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderPricing } from "../src/orderPricing.ts";

function offer(overrides) {
  return {
    key: "15",
    storage: "128GB",
    grade: "B/C",
    price: 325,
    psim: false,
    category: "iPhone",
    ...overrides,
  };
}

test("összesíti a B/C készülékek pontos A/B alternatívájának árkülönbözetét", () => {
  const selected = offer({});
  const offers = [
    selected,
    offer({ grade: "A/B", price: 360 }),
    offer({ grade: "A/B", price: 370 }),
  ];

  const summary = calculateOrderPricing(
    [{ quantity: 3, selected }],
    offers,
  );

  assert.deepEqual(summary, {
    totalQuantity: 3,
    totalValue: 975,
    abPriceDifference: 105,
    totalWithAbAlternative: 1080,
    comparableBcQuantity: 3,
    unmatchedBcQuantity: 0,
  });
});

test("nem hasonlít össze eltérő tárhelyű vagy P-SIM kivitelű ajánlatokat", () => {
  const selected = offer({ psim: true });
  const offers = [
    selected,
    offer({ grade: "A/B", price: 360, psim: false }),
    offer({ grade: "A/B", price: 390, storage: "256GB", psim: true }),
  ];

  const summary = calculateOrderPricing(
    [{ quantity: 2, selected }],
    offers,
  );

  assert.equal(summary.abPriceDifference, 0);
  assert.equal(summary.totalWithAbAlternative, 650);
  assert.equal(summary.comparableBcQuantity, 0);
  assert.equal(summary.unmatchedBcQuantity, 2);
});

test("az A és A/B rendelési sorokat csak a normál összértékbe számolja", () => {
  const selected = offer({ grade: "A/B", price: 360 });

  const summary = calculateOrderPricing(
    [{ quantity: 4, selected }],
    [selected],
  );

  assert.equal(summary.totalValue, 1440);
  assert.equal(summary.abPriceDifference, 0);
  assert.equal(summary.totalWithAbAlternative, 1440);
});
