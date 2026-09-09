export type PricingOffer = {
  key: string;
  storage: string;
  grade: "A" | "A/B" | "B/C";
  price: number;
  psim: boolean;
  category: string;
};

export type PricedOrderRow = {
  quantity: number;
  selected?: PricingOffer;
};

export type OrderPricingSummary = {
  totalQuantity: number;
  totalValue: number;
  abPriceDifference: number;
  totalWithAbAlternative: number;
  comparableBcQuantity: number;
  unmatchedBcQuantity: number;
};

function findCheapestMatchingAbOffer(
  selected: PricingOffer,
  referenceOffers: PricingOffer[],
) {
  return referenceOffers
    .filter(
      (offer) =>
        offer.grade === "A/B" &&
        offer.key === selected.key &&
        offer.storage === selected.storage &&
        offer.category === selected.category &&
        offer.psim === selected.psim,
    )
    .reduce<PricingOffer | undefined>(
      (cheapest, offer) =>
        !cheapest || offer.price < cheapest.price ? offer : cheapest,
      undefined,
    );
}

export function calculateOrderPricing(
  rows: PricedOrderRow[],
  referenceOffers: PricingOffer[],
): OrderPricingSummary {
  const summary = rows.reduce<OrderPricingSummary>(
    (result, row) => {
      const quantity = Math.max(0, row.quantity);
      const selected = row.selected;

      result.totalQuantity += quantity;
      result.totalValue += quantity * (selected?.price ?? 0);

      if (!selected || selected.grade !== "B/C" || quantity === 0) {
        return result;
      }

      const abAlternative = findCheapestMatchingAbOffer(
        selected,
        referenceOffers,
      );
      if (!abAlternative) {
        result.unmatchedBcQuantity += quantity;
        return result;
      }

      result.comparableBcQuantity += quantity;
      result.abPriceDifference +=
        (abAlternative.price - selected.price) * quantity;
      return result;
    },
    {
      totalQuantity: 0,
      totalValue: 0,
      abPriceDifference: 0,
      totalWithAbAlternative: 0,
      comparableBcQuantity: 0,
      unmatchedBcQuantity: 0,
    },
  );

  return {
    ...summary,
    totalWithAbAlternative: summary.totalValue + summary.abPriceDifference,
  };
}
