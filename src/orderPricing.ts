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

export type AbComparison = {
  matched: boolean;
  reference?: PricingOffer;
  difference: number;
};

export type OrderPricingSummary = {
  totalQuantity: number;
  totalValue: number;
  abPriceDifference: number;
  totalWithAbAlternative: number;
  comparableBcQuantity: number;
  unmatchedBcQuantity: number;
};

export function findMatchingAbOffer(
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

export function getAbComparison(
  selected: PricingOffer | undefined,
  uploadedOffers: PricingOffer[],
  fallbackOffers: PricingOffer[] = [],
): AbComparison | undefined {
  if (!selected || selected.grade !== "B/C") return undefined;

  // The uploaded TR list is always the primary source. The hard-coded
  // reference list is only used when the uploaded list has no matching A/B offer.
  const uploadedReference = findMatchingAbOffer(selected, uploadedOffers);
  const reference = uploadedReference ?? findMatchingAbOffer(selected, fallbackOffers);

  if (!reference) {
    return { matched: false, difference: 0 };
  }

  return {
    matched: true,
    reference,
    difference: reference.price - selected.price,
  };
}

export function calculateOrderPricing(
  rows: PricedOrderRow[],
  uploadedOffers: PricingOffer[],
  fallbackOffers: PricingOffer[] = [],
): OrderPricingSummary {
  const summary = rows.reduce<OrderPricingSummary>(
    (result, row) => {
      const quantity = Math.max(0, row.quantity);
      const selected = row.selected;

      result.totalQuantity += quantity;
      result.totalValue += quantity * (selected?.price ?? 0);

      const comparison = getAbComparison(selected, uploadedOffers, fallbackOffers);
      if (!comparison || quantity === 0) return result;

      if (!comparison.matched) {
        result.unmatchedBcQuantity += quantity;
        return result;
      }

      result.comparableBcQuantity += quantity;
      result.abPriceDifference += comparison.difference * quantity;
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
