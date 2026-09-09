import type { PricingOffer } from "./orderPricing";

export type AbReferencePrice = PricingOffer & {
  name: string;
};

/*
 * ================================================================
 * MANUÁLISAN FRISSÍTENDŐ A/B REFERENCIAÁRAK
 * ================================================================
 *
 * 1. Írd át az AB_REFERENCE_UPDATED_AT dátumot YYYY-MM-DD formátumban.
 * 2. A meglévő készülékeknél csak a price értékét kell módosítani.
 * 3. Új változatnál másolj le egy sort, és töltsd ki az összes mezőt.
 * 4. A P-SIM és nem P-SIM változat mindig külön sor legyen.
 *
 * Ezt a listát használja a B/C → A/B árkülönbözet számítása, és ebből
 * készül az oldal induló Stock A/B készletblokkja is.
 */
export const AB_REFERENCE_UPDATED_AT = "2026-08-04";

export const AB_REFERENCE_PRICES: AbReferencePrice[] = [
  { name: "SE 3 64GB", key: "SE 2022", storage: "64GB", grade: "A/B", price: 95, psim: true, category: "iPhone" },
  { name: "14 128GB", key: "14", storage: "128GB", grade: "A/B", price: 250, psim: false, category: "iPhone" },
  { name: "14 128GB", key: "14", storage: "128GB", grade: "A/B", price: 270, psim: true, category: "iPhone" },
  { name: "14 PRO 128GB", key: "14 PRO", storage: "128GB", grade: "A/B", price: 390, psim: false, category: "iPhone" },
  { name: "14 PRO 256GB", key: "14 PRO", storage: "256GB", grade: "A/B", price: 420, psim: false, category: "iPhone" },
  { name: "14 PRO MAX 256GB", key: "14 PRO MAX", storage: "256GB", grade: "A/B", price: 455, psim: false, category: "iPhone" },
  { name: "15 128GB", key: "15", storage: "128GB", grade: "A/B", price: 360, psim: false, category: "iPhone" },
  { name: "15 512GB", key: "15", storage: "512GB", grade: "A/B", price: 410, psim: false, category: "iPhone" },
  { name: "15 PRO 128GB", key: "15 PRO", storage: "128GB", grade: "A/B", price: 470, psim: false, category: "iPhone" },
  { name: "15 PRO 256GB", key: "15 PRO", storage: "256GB", grade: "A/B", price: 550, psim: true, category: "iPhone" },
  { name: "16 128GB", key: "16", storage: "128GB", grade: "A/B", price: 505, psim: false, category: "iPhone" },
  { name: "16 128GB", key: "16", storage: "128GB", grade: "A/B", price: 550, psim: true, category: "iPhone" },
  { name: "16E 128GB", key: "16E", storage: "128GB", grade: "A/B", price: 320, psim: false, category: "iPhone" },
  { name: "16 PRO 256GB", key: "16 PRO", storage: "256GB", grade: "A/B", price: 660, psim: false, category: "iPhone" },
  { name: "17 AIR 256GB", key: "17 AIR", storage: "256GB", grade: "A/B", price: 650, psim: false, category: "iPhone" },
  { name: "17 PRO 256GB", key: "17 PRO", storage: "256GB", grade: "A/B", price: 940, psim: false, category: "iPhone" },
  { name: "17 PRO MAX 256GB", key: "17 PRO MAX", storage: "256GB", grade: "A/B", price: 1070, psim: false, category: "iPhone" },
  { name: "17 PRO MAX 512GB", key: "17 PRO MAX", storage: "512GB", grade: "A/B", price: 1170, psim: false, category: "iPhone" },
  { name: "IPAD AIR 13 (2024) WIFI + CELLULAR 128GB", key: "IPAD AIR 13", storage: "128GB", grade: "A/B", price: 520, psim: false, category: "iPad" },
];

function formatReferenceOffer(offer: AbReferencePrice) {
  return `${offer.name} A/B - €${offer.price},-${offer.psim ? " (P-SIM)" : ""}`;
}

export function formatAbReferenceStockList() {
  const iphoneOffers = AB_REFERENCE_PRICES
    .filter((offer) => offer.category === "iPhone")
    .map(formatReferenceOffer);
  const ipadOffers = AB_REFERENCE_PRICES
    .filter((offer) => offer.category === "iPad")
    .map(formatReferenceOffer);

  return [...iphoneOffers, "", "iPad", ...ipadOffers].join("\n");
}
