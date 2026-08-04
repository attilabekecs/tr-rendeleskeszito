"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Need = { model: string; quantity: number };
type Offer = {
  id: string;
  raw: string;
  name: string;
  key: string;
  storage: string;
  grade: "A" | "A/B" | "B/C";
  price: number;
  psim: boolean;
  category: string;
};
type OrderRow = {
  id: string;
  need: Need;
  offers: Offer[];
  selectedOfferId: string;
  quantity: number;
};
type Strategy = "cheapest" | "quality" | "psim";

const DEFAULT_TR = `Stock A
14 128GB A - €270,-
14 128GB A - €290,- (P-SIM)
14 PRO 128GB A - €410,-
14 PRO 256GB A - €440,-
15 128GB A - €380,-
15 512GB A - €430,-
15 PRO 128GB A - €490,-
15 PRO 256GB A - €570,- (P-SIM)
16 128GB A - €530,-
16 128GB A - €570,- (P-SIM)
16E 128GB A - €340,-
16 PRO 256GB A - €680,-
17 AIR 256GB A - €680,-
17 PRO 256GB A - €970,-
17 PRO MAX 256GB A - €1100,-
17 PRO MAX 512GB A - €1200,-

Stock A/B
SE 3 64GB A/B - €95,- (P-SIM)
14 128GB A/B - €250,-
14 128GB A/B - €270,- (P-SIM)
14 PRO 128GB A/B - €390,-
14 PRO 256GB A/B - €420,-
14 PRO MAX 256GB A/B - €455,-
15 128GB A/B - €360,-
15 512GB A/B - €410,-
15 PRO 128GB A/B - €470,-
15 PRO 256GB A/B - €550,- (P-SIM)
16 128GB A/B - €505,-
16 128GB A/B - €550,- (P-SIM)
16E 128GB A/B - €320,-
16 PRO 256GB A/B - €660,-
17 AIR 256GB A/B - €650,-
17 PRO 256GB A/B - €940,-
17 PRO MAX 256GB A/B - €1070,-
17 PRO MAX 512GB A/B - €1170,-

iPad
IPAD AIR 13 (2024) WIFI + CELLULAR 128GB A/B - €520,-
IPAD PRO 13 (2024) 13' WIFI + CELLULAR 256GB A - €800,-
IPAD PRO 13 (2024) 13' WIFI + CELLULAR 512GB A - €815,-

Stock B/C
14 PRO 128GB B/C - €390,- (P-SIM)
15 128GB B/C - €325,-
15 256GB B/C - €345,-
15 256GB B/C - €395,- (P-SIM)
15 PRO 128GB B/C - €430,-
15 PRO 128GB B/C - €470,- (P-SIM)
16 128GB B/C - €450,-
16 PRO 128GB B/C - €560,-`;

const qualityRank: Record<Offer["grade"], number> = { A: 0, "A/B": 1, "B/C": 2 };

function normalizeModel(value: string) {
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

  key = key
    .replace(/^SE\s*3\b/, "SE 2022")
    .replace(/^SE\s*2022\b/, "SE 2022")
    .replace(/^16E\b/, "16E");
  return key;
}

function offerMatches(need: string, offer: Offer) {
  const requested = normalizeModel(need);
  if (offer.category === "iPad" || requested.startsWith("IPAD")) {
    const req = requested.replace(/^IPAD\s*/, "");
    const candidate = offer.key.replace(/^IPAD\s*/, "");
    if (!req) return false;
    return candidate === req || candidate.startsWith(`${req} `);
  }
  return offer.key === requested;
}

function parseTRList(text: string): Offer[] {
  let category = "iPhone";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line, index) => {
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
        /^(.*?)\s+(A\/B|B\/C|A)\s*-\s*€\s*([\d.,]+)\s*,?\s*-?\s*(?:\((P-SIM)\))?\s*$/i,
      );
      if (!match) return [];
      const name = match[1].trim();
      const price = Number(match[3].replace(/\./g, "").replace(",", "."));
      const storage = name.match(/(\d+\s*(?:GB|TB))/i)?.[1].replace(/\s/g, "") ?? "—";
      return [
        {
          id: `${index}-${name}-${match[2]}-${price}-${match[4] ?? "no"}`,
          raw: line,
          name,
          key: normalizeModel(category === "iPad" ? name : name),
          storage,
          grade: match[2].toUpperCase() as Offer["grade"],
          price,
          psim: Boolean(match[4]),
          category,
        },
      ];
    });
}

function sortOffers(offers: Offer[], strategy: Strategy) {
  return [...offers].sort((a, b) => {
    if (strategy === "quality") {
      return qualityRank[a.grade] - qualityRank[b.grade] || a.price - b.price;
    }
    if (strategy === "psim") {
      return Number(b.psim) - Number(a.psim) || a.price - b.price;
    }
    return a.price - b.price || qualityRank[a.grade] - qualityRank[b.grade];
  });
}

const euro = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [needs, setNeeds] = useState<Need[]>([]);
  const [trText, setTrText] = useState(DEFAULT_TR);
  const [strategy, setStrategy] = useState<Strategy>("cheapest");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const parsedOffers = useMemo(() => parseTRList(trText), [trText]);
  const orderedRows = useMemo(
    () =>
      orders.map((row) => ({
        ...row,
        selected: row.offers.find((offer) => offer.id === row.selectedOfferId)!,
      })),
    [orders],
  );
  const totalQuantity = orderedRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = orderedRows.reduce(
    (sum, row) => sum + row.quantity * (row.selected?.price ?? 0),
    0,
  );

  async function readExcel(file?: File) {
    if (!file) return;
    setError("");
    if (!/\.xlsx?$/i.test(file.name)) {
      setError("Kérlek, .xlsx vagy .xls Excel-fájlt tölts fel.");
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const extracted: Need[] = [];
      workbook.SheetNames.forEach((sheetName) => {
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
          workbook.Sheets[sheetName],
          { header: 1, defval: "" },
        );
        rows.forEach((row, index) => {
          if (index === 0) return;
          const model = String(row[0] ?? "").trim();
          const quantity = Number(row[1]);
          if (
            model &&
            Number.isFinite(quantity) &&
            quantity > 0 &&
            !/^ÖSSZESEN/i.test(model)
          ) {
            extracted.push({ model, quantity: Math.round(quantity) });
          }
        });
      });
      if (!extracted.length) {
        throw new Error("Nem találtam termék–darabszám sorokat az Excelben.");
      }
      setNeeds(extracted);
      setFileName(file.name);
      setOrders([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Az Excel nem olvasható.");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void readExcel(event.dataTransfer.files[0]);
  }

  function createOrder() {
    setError("");
    if (!needs.length) {
      setError("Először töltsd fel a rendelendő Excelt.");
      return;
    }
    if (!parsedOffers.length) {
      setError("Nem találtam feldolgozható ajánlatot a TR-listában.");
      return;
    }
    const rows: OrderRow[] = [];
    needs.forEach((need, index) => {
      const matches = sortOffers(
        parsedOffers.filter((offer) => offerMatches(need.model, offer)),
        strategy,
      );
      if (!matches.length) {
        return;
      }
      rows.push({
        id: `${index}-${need.model}`,
        need,
        offers: matches,
        selectedOfferId: matches[0].id,
        quantity: need.quantity,
      });
    });
    setOrders(rows);
    requestAnimationFrame(() =>
      document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  function addOfferToOrder(offer: Offer) {
    setOrders((current) => {
      const existing = current.find((row) => row.selectedOfferId === offer.id);
      if (existing) {
        return current.map((row) =>
          row.id === existing.id ? { ...row, quantity: row.quantity + 1 } : row,
        );
      }
      return [
        ...current,
        {
          id: `manual-${offer.id}-${Date.now()}`,
          need: { model: "Kézi hozzáadás", quantity: 0 },
          offers: [offer],
          selectedOfferId: offer.id,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    setOrders((current) =>
      current.map((row) =>
        row.id === id ? { ...row, quantity: Math.max(0, Math.round(quantity || 0)) } : row,
      ),
    );
  }

  function orderText() {
    const lines = orderedRows
      .filter((row) => row.quantity > 0 && row.selected)
      .map(
        (row) =>
          `${row.selected.raw.replace(/\s*$/, "")} — ${row.quantity} db`,
      );
    return `${lines.join("\n")}\n\nÖsszesen: ${totalQuantity} db · ${euro.format(totalValue)}`;
  }

  async function copyOrder() {
    await navigator.clipboard.writeText(orderText());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadExcel() {
    const rows = orderedRows
      .filter((row) => row.quantity > 0 && row.selected)
      .map((row) => ({
        Termék: row.selected.name,
        Tárhely: row.selected.storage,
        Állapot: row.selected.grade,
        SIM: row.selected.psim ? "P-SIM" : "Nincs jelölve",
        "Egységár (EUR)": row.selected.price,
        "Darabszám": row.quantity,
        "Összesen (EUR)": row.selected.price * row.quantity,
      }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 34 },
      { wch: 12 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "TR rendelés");
    XLSX.writeFile(workbook, `TR-rendeles-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brandmark" aria-hidden="true">TR</div>
          <div>
            <h1>TR Rendeléskészítő</h1>
            <p>Excel alapján, az aktuális nagyker készletből</p>
          </div>
        </div>
        <div className="live"><span /> Helyben fut · az adatok nem kerülnek feltöltésre</div>
      </header>

      <div className="shell">
        <section className="input-grid compact-input-grid">
          <article className="panel upload-panel">
            <div className="panel-heading">
              <span className="step">1</span>
              <div>
                <h2>Rendelendő Excel</h2>
                <p>A fájl minden munkalapját átnézzük.</p>
              </div>
              {needs.length > 0 && <span className="badge success">{needs.length} termék</span>}
            </div>

            <div
              className={`dropzone ${dragging ? "dragging" : ""} ${fileName ? "loaded" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  void readExcel(event.target.files?.[0])
                }
              />
              <div className="file-icon">XLSX</div>
              {fileName ? (
                <>
                  <strong>{fileName}</strong>
                  <span>{needs.length} rendelési igény feldolgozva</span>
                </>
              ) : (
                <>
                  <strong>Húzd ide az Excel-fájlt</strong>
                  <span>vagy kattints a tallózáshoz</span>
                </>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <span className="step">2</span>
              <div>
                <h2>TR készletlista</h2>
                <p>Másold be változtatás nélkül a kapott listát.</p>
              </div>
              <span className="badge info">{parsedOffers.length} ajánlat</span>
            </div>
            <textarea
              className="stock-input"
              value={trText}
              onChange={(event) => {
                setTrText(event.target.value);
                setOrders([]);
              }}
              spellCheck={false}
              aria-label="TR készletlista"
            />
            <div className="textarea-footer">
              <span>A Stock A, A/B, B/C és iPad blokkok felismerése automatikus.</span>
              <button className="text-button" onClick={() => setTrText("")}>Törlés</button>
            </div>
          </article>
        </section>

        <section className="actionbar">
          <label>
            Kiválasztás:
            <select value={strategy} onChange={(event) => setStrategy(event.target.value as Strategy)}>
              <option value="cheapest">Legolcsóbb megfelelő ajánlat</option>
              <option value="quality">Legjobb állapot, majd ár</option>
              <option value="psim">P-SIM előnyben, majd ár</option>
            </select>
          </label>
          <button className="primary" onClick={createOrder}>
            Rendelés elkészítése <span>→</span>
          </button>
        </section>

        {error && <div className="alert error" role="alert">{error}</div>}

        {orders.length > 0 && (
          <section id="result" className="results">
            <div className="results-title">
              <div>
                <span className="eyebrow">Javasolt rendelés</span>
                <h2>Szerkeszthető TR rendelés</h2>
                <p>Válassz másik ajánlatot, vagy írd át a rendelni kívánt darabszámot.</p>
              </div>
              <div className="export-actions">
                <button className="secondary" onClick={copyOrder}>
                  {copied ? "Másolva ✓" : "Rendelés másolása"}
                </button>
                <button className="secondary strong" onClick={downloadExcel} disabled={!orders.length}>
                  Letöltés Excelben
                </button>
              </div>
            </div>

            <div className="metrics">
              <div><span>Rendelési sor</span><strong>{orders.length}</strong></div>
              <div><span>Összes mennyiség</span><strong>{totalQuantity} db</strong></div>
              <div><span>Rendelés értéke</span><strong>{euro.format(totalValue)}</strong></div>
            </div>

            {orders.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Excel igény</th>
                      <th>Választott TR ajánlat</th>
                      <th>Állapot</th>
                      <th>SIM</th>
                      <th>Egységár</th>
                      <th>Rendelendő db</th>
                      <th>Összesen</th>
                      <th aria-label="Törlés" />
                    </tr>
                  </thead>
                  <tbody>
                    {orderedRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.need.model === "Kézi hozzáadás" ? row.selected.name : row.need.model}</strong>
                          <small>{row.need.model === "Kézi hozzáadás" ? "TR listából hozzáadva" : `Excel: ${row.need.quantity} db`}</small>
                        </td>
                        <td>
                          <select
                            className="offer-select"
                            value={row.selectedOfferId}
                            onChange={(event) =>
                              setOrders((current) =>
                                current.map((item) =>
                                  item.id === row.id
                                    ? { ...item, selectedOfferId: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          >
                            {row.offers.map((offer) => (
                              <option key={offer.id} value={offer.id}>
                                {offer.name} · {offer.grade} · {offer.psim ? "P-SIM · " : ""}
                                {euro.format(offer.price)}
                              </option>
                            ))}
                          </select>
                          {row.offers.length > 1 && <small>{row.offers.length} választható ajánlat</small>}
                        </td>
                        <td><span className={`grade grade-${row.selected.grade.replace("/", "")}`}>{row.selected.grade}</span></td>
                        <td>{row.selected.psim ? <span className="psim">P-SIM</span> : <span className="muted">—</span>}</td>
                        <td className="number">{euro.format(row.selected.price)}</td>
                        <td>
                          <div className="stepper">
                            <button onClick={() => updateQuantity(row.id, row.quantity - 1)} aria-label="Csökkentés">−</button>
                            <input
                              type="number"
                              min="0"
                              value={row.quantity}
                              onChange={(event) => updateQuantity(row.id, Number(event.target.value))}
                              aria-label={`${row.need.model} darabszám`}
                            />
                            <button onClick={() => updateQuantity(row.id, row.quantity + 1)} aria-label="Növelés">+</button>
                          </div>
                        </td>
                        <td className="number total">{euro.format(row.selected.price * row.quantity)}</td>
                        <td>
                          <button
                            className="remove"
                            onClick={() => setOrders((current) => current.filter((item) => item.id !== row.id))}
                            aria-label={`${row.need.model} törlése`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="stock-catalog">
              <div className="stock-catalog-heading">
                <div>
                  <span className="eyebrow">Manuális kiegészítés</span>
                  <h3>TR készletlista</h3>
                  <p>Ha még szeretnél valamit rendelni, add hozzá innen egy kattintással.</p>
                </div>
                <span className="badge info">{parsedOffers.length} ajánlat</span>
              </div>
              <div className="table-wrap">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>TR termék</th>
                      <th>Állapot</th>
                      <th>SIM</th>
                      <th>Egységár</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {parsedOffers.map((offer) => (
                      <tr key={offer.id}>
                        <td><strong>{offer.name}</strong><small>{offer.category}</small></td>
                        <td><span className={`grade grade-${offer.grade.replace("/", "")}`}>{offer.grade}</span></td>
                        <td>{offer.psim ? <span className="psim">P-SIM</span> : <span className="muted">—</span>}</td>
                        <td className="number">{euro.format(offer.price)}</td>
                        <td>
                          <button className="add-offer" onClick={() => addOfferToOrder(offer)}>
                            + Hozzáadás
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
