const EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rate/EUR/HUF";

const huf = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

let exchangeRate: number | null = null;
let exchangeDate = "";

function parseEuroValue(text: string) {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatCopiedOrder(text: string) {
  return text
    .replace(/(\d+)\s+db\b/g, "$1 pc")
    .replace(/^Összesen:/gm, "Total:");
}

function installEnglishClipboardOutput() {
  if (typeof Clipboard === "undefined") return;

  const prototype = Clipboard.prototype as Clipboard & {
    __trEnglishClipboardInstalled?: boolean;
  };

  if (prototype.__trEnglishClipboardInstalled) return;

  const originalWriteText = Clipboard.prototype.writeText;
  Clipboard.prototype.writeText = function (text: string) {
    return originalWriteText.call(this, formatCopiedOrder(text));
  };

  prototype.__trEnglishClipboardInstalled = true;
}

function ensureRateStyle() {
  if (document.getElementById("huf-rate-style")) return;
  const style = document.createElement("style");
  style.id = "huf-rate-style";
  style.textContent = `
    .metrics { grid-template-columns: repeat(4, 1fr); }
    .metrics .huf-metric strong { color: var(--success); }
    .metrics .huf-metric small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 9px;
      line-height: 1.35;
    }
    @media (max-width: 900px) {
      .metrics { grid-template-columns: 1fr 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function setTextIfChanged(element: Element | null, value: string) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function renderHufMetric() {
  const metrics = document.querySelector<HTMLElement>(".metrics");
  if (!metrics) return;

  ensureRateStyle();

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
  const strong = tile.querySelector("strong");
  const small = tile.querySelector("small");

  if (exchangeRate && eurValue >= 0) {
    setTextIfChanged(strong, huf.format(eurValue * exchangeRate));
    setTextIfChanged(
      small,
      `1 EUR = ${exchangeRate.toLocaleString("hu-HU", { maximumFractionDigits: 2 })} HUF${exchangeDate ? ` · ${exchangeDate}` : ""}`,
    );
  } else {
    setTextIfChanged(strong, "—");
    setTextIfChanged(small, "Aktuális középárfolyam betöltése…");
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
    renderHufMetric();
  } catch {
    const small = document.querySelector<HTMLElement>(".huf-metric small");
    setTextIfChanged(small, "Az árfolyam most nem érhető el");
  }
}

export function installOrderEnhancements() {
  installEnglishClipboardOutput();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(renderHufMetric);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  renderHufMetric();
  void loadExchangeRate();
}
