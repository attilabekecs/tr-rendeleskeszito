import assert from "node:assert/strict";
import test from "node:test";
import {
  AB_REFERENCE_PRICES,
  formatAbReferenceStockList,
} from "../src/abReferencePrices.ts";

test("minden A/B referencia egyedi készülékváltozatot képvisel", () => {
  const identifiers = AB_REFERENCE_PRICES.map(
    (offer) =>
      `${offer.category}|${offer.key}|${offer.storage}|${offer.psim}`,
  );

  assert.equal(AB_REFERENCE_PRICES.length, 19);
  assert.equal(new Set(identifiers).size, identifiers.length);
  assert.ok(AB_REFERENCE_PRICES.every((offer) => offer.grade === "A/B"));
  assert.ok(AB_REFERENCE_PRICES.every((offer) => offer.price > 0));
});

test("az induló A/B készletblokk minden referenciaárat tartalmaz", () => {
  const stockList = formatAbReferenceStockList();

  for (const offer of AB_REFERENCE_PRICES) {
    assert.match(stockList, new RegExp(`${offer.name.replace(/[()+]/g, "\\$&")} A/B`));
  }
});
