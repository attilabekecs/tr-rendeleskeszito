const EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rate/EUR/HUF";

const huf = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

const euro = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

let exchangeRate: number | null = null;
let exchangeDate = "";
let lastEurValue = -1;

function parseEuroValue(text: string) {
  const normalized = text.replace(/\s/g, "");
  const match = normalized.match(/[+-]?(?:€)?[\d.,]+/);
  if (!match) return 0;
  const value = match[0].replace("€", "");
  const sign = value.startsWith("-") ? -1 : 1;
  const unsigned = value.replace(/^[+-]/, "");
  return sign * Number(unsigned.replace(/\./g, "").replace(",", "."));
}

function formatCopiedOrder(text: string) {
  return text
    .replace(/\bdb\b/gi, "pc")
    .replace(/^\s*Összesen\s*:/gim, "Total:");
}

function installEnglishClipboardOutput() {
  if (typeof Clipboard === "undefined") return;

  const clipboardPrototype = Clipboard.prototype as Clipboard & {
    __trEnglishCopyInstalled?: boolean;
  };

  if (clipboardPrototype.__trEnglishCopyInstalled) return;

  const originalWriteText = Clipboard.prototype.writeText;
  if (typeof originalWriteText !== "function") return;

  try {
    Clipboard.prototype.writeText = function (text: string) {
      return originalWriteText.call(this, formatCopiedOrder(text));
    };
    clipboardPrototype.__trEnglishCopyInstalled = true;
  } catch {
    // If a browser does not allow overriding Clipboard.prototype, leave copying functional.
  }
}

function ensureRateStyle() {
  if (document.getElementById("huf-rate-style")) return;
  const style = document.createElement("style");
  style.id = "huf-rate-style";
  style.textContent = `
    .metrics { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .metrics .huf-metric strong { color: var(--success); }
    .metrics .huf-metric small,
    .metrics .combined-metric .combined-huf { 
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 9px;
      line-height: 1.35;
    }
    .metrics .combined-metric .combined-huf {
      color: var(--success);
      font-weight: 700;
    }
    .ab-comparison input:focus { outline: 2px solid rgba(125, 211, 252, .35); outline-offset: 1px; }
    @media (max-width: 1180px) {
      .metrics { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 900px) {
      .metrics { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 560px) {
      .metrics { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function getAbDifferenceFromRows() {
  let difference = 0;
  let manualQuantity = 0;

  document.querySelectorAll<HTMLTableRowElement>(".table-wrap table tbody tr").forEach((row) => {
    const comparison = row.querySelector<HTMLElement>(".ab-comparison");
    if (!comparison) return;

    const quantityInput = row.querySelector<HTMLInputElement>(".stepper input");
    const quantity = Number(quantityInput?.value ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    if (comparison.classList.contains("matched")) {
      const small = comparison.querySelector("small")?.textContent ?? "";
      const unitDifference = parseEuroValue(small);
      difference += unitDifference * quantity;
      return;
    }

    const input = comparison.querySelector<HTMLInputElement>("input");
    const rawValue = input?.value.trim() ?? "";
    if (!rawValue) return;

    const manualAbPrice = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(manualAbPrice) || manualAbPrice <= 0) return;

    const cells = Array.from(row.querySelectorAll("td"));
    const unitPriceCell = cells.find(
      (cell) => cell.classList.contains("number") && !cell.classList.contains("total"),
    );
    const bcPrice = parseEuroValue(unitPriceCell?.textContent ?? "0");
    if (bcPrice <= 0) return;

    difference += (manualAbPrice - bcPrice) * quantity;
    manualQuantity += quantity;
  });

  return { difference, manualQuantity };
}

function renderAbManualPricing() {
  const metrics = document.querySelector<HTMLElement>(".metrics");
  if (!metrics) return;

  const comparisonMetric = metrics.querySelector<HTMLElement>(".comparison-metric");
  const combinedMetric = metrics.querySelector<HTMLElement>(".combined-metric");
  if (!comparisonMetric || !combinedMetric) return;

  const current = getAbDifferenceFromRows();
  const comparisonStrong = comparisonMetric.querySelector("strong");
  if (comparisonStrong) {
    comparisonStrong.textContent = `${current.difference > 0 ? "+" : ""}${euro.format(current.difference)}`;
  }

  const comparisonSmall = comparisonMetric.querySelector("small");
  if (comparisonSmall) {
    const baseText = comparisonSmall.textContent?.replace(/ · Manuális A\/B:.*$/i, "") ?? "";
    comparisonSmall.textContent = current.manualQuantity > 0
      ? `${baseText} · Manuális A/B: ${current.manualQuantity} db`
      : baseText;
  }

  const orderMetric = Array.from(metrics.children).find((element) =>
    element !== combinedMetric && element.textContent?.includes("Rendelés értéke"),
  );
  const orderValue = parseEuroValue(orderMetric?.querySelector("strong")?.textContent ?? "0");
  const combinedValue = orderValue + current.difference;
  const combinedStrong = combinedMetric.querySelector("strong");
  if (combinedStrong) combinedStrong.textContent = euro.format(combinedValue);

  let combinedHuf = combinedMetric.querySelector<HTMLElement>(".combined-huf");
  if (!combinedHuf) {
    combinedHuf = document.createElement("small");
    combinedHuf.className = "combined-huf";
    const description = combinedMetric.querySelector("small:not(.combined-huf)");
    if (description) {
      description.insertAdjacentElement("afterend", combinedHuf);
    } else {
      combinedMetric.appendChild(combinedHuf);
    }
  }

  if (exchangeRate) {
    combinedHuf.textContent = `≈ ${huf.format(combinedValue * exchangeRate)} · 1 EUR = ${exchangeRate.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} HUF`;
  } else {
    combinedHuf.textContent = "HUF érték: árfolyam betöltése…";
  }
}

function renderHufMetric() {
  const metrics = document.querySelector<HTMLElement>(".metrics");
  if (!metrics) return;

  ensureRateStyle();
  renderAbManualPricing();

  let tile = metrics.querySelector<HTMLElement>(".huf-metric");
  if (!tile) {
    tile = document.createElement("div");
    tile.className = "huf-metric";
    tile.innerHTML = "<span>Érték HUF-ban</span><strong>—</strong><small>Aktuális középárfolyam betöltése…</small>";
    metrics.appendChild(tile);
  }

  const eurMetric = Array.from(metrics.children).find((element) =>
    element !== tile && element.textContent?.includes("Rendelés értéke"),
  );
  const eurValue = parseEuroValue(eurMetric?.querySelector("strong")?.textContent ?? "0");

  if (eurValue === lastEurValue && exchangeRate) return;
  lastEurValue = eurValue;

  const strong = tile.querySelector("strong");
  const small = tile.querySelector("small");
  if (!strong || !small) return;

  if (exchangeRate) {
    strong.textContent = huf.format(eurValue * exchangeRate);
    small.textContent = `1 EUR = ${exchangeRate.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} HUF${exchangeDate ? ` · ${exchangeDate}` : ""}`;
  } else {
    strong.textContent = "—";
    small.textContent = "Aktuális középárfolyam betöltése…";
  }
}

async function loadExchangeRate() {
  try {
    const response = await fetch(EXCHANGE_RATE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { rate?: number; date?: string };
    if (!Number.isFinite(data.rate)) throw new Error("Invalid EUR/HUF rate");
    exchangeRate = data.rate ?? null;
    exchangeDate = data.date ?? "";
    lastEurValue = -1;
    renderHufMetric();
  } catch {
    const small = document.querySelector<HTMLElement>(".huf-metric small");
    if (small) small.textContent = "Az árfolyam most nem érhető el";
  }
}

export function installOrderEnhancements() {
  installEnglishClipboardOutput();
  renderHufMetric();
  void loadExchangeRate();

  window.setInterval(renderHufMetric, 750);
}
