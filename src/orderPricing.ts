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

function normalizeUploadedModel(value: string) {
  let key = value
    .toUpperCase()
    .replace(/APPLE/g, "")
    .replace(/IPHONE/g, "")
    .replace(/SE\s*\(2022\)/g, "SE 2022")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\s*(GB|TB)\b/g, " ")
    .replace(/\bWIFI\b|\bCELLULAR\b/g, " ")
    .replace(/[+'’"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return key
    .replace(/^SE\s*3\b/, "SE 2022")
    .replace(/^SE\s*2022\b/, "SE 2022")
    .replace(/^16E\b/, "16E");
}

function getUploadedAbOffersFromDom(): PricingOffer[] {
  if (typeof document === "undefined") return [];

  const textarea = document.querySelector<HTMLTextAreaElement>("textarea.stock-input");
  const text = textarea?.value ?? "";
  if (!text) return [];

  let category = "iPhone";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => {
      if (!line) return [];
      if (/^IPAD$/i.test(line)) {
        category = "iPad";
        return [];
      }
      if (/^STOCK\b/i.test(line)) {
        category = "iPhone";
        return [];
      }

      const match = line.match(
        /^(.*?)\s+(A\/B)\s*-\s*€\s*([\d.,]+)\s*,?\s*-?\s*(?:\((P-SIM)\))?\s*$/i,
      );
      if (!match) return [];

      const name = match[1].trim();
      const price = Number(match[3].replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(price)) return [];

      const storage =
        name.match(/(\d+\s*(?:GB|TB))/i)?.[1].replace(/\s/g, "") ?? "—";

      return [
        {
          key: normalizeUploadedModel(name),
          storage,
          grade: "A/B" as const,
          price,
          psim: Boolean(match[4]),
          category,
        },
      ];
    });
}

export function getAbComparison(
  selected: PricingOffer | undefined,
  fallbackOffers: PricingOffer[],
  unusedFallbackOffers: PricingOffer[] = [],
): AbComparison | undefined {
  if (!selected || selected.grade !== "B/C") return undefined;

  // The A/B section pasted into the current TR list is the primary source.
  // The built-in reference list is only a fallback when the uploaded list has no match.
  const uploadedOffers = getUploadedAbOffersFromDom();
  const uploadedReference = findMatchingAbOffer(selected, uploadedOffers);
  const reference = uploadedReference
    ?? findMatchingAbOffer(selected, unusedFallbackOffers)
    ?? findMatchingAbOffer(selected, fallbackOffers);

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
  referenceOffers: PricingOffer[],
  fallbackOffers: PricingOffer[] = [],
): OrderPricingSummary {
  const summary = rows.reduce<OrderPricingSummary>(
    (result, row) => {
      const quantity = Math.max(0, row.quantity);
      const selected = row.selected;

      result.totalQuantity += quantity;
      result.totalValue += quantity * (selected?.price ?? 0);

      const comparison = getAbComparison(selected, referenceOffers, fallbackOffers);
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
