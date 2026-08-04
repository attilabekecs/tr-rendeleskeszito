import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("creates a GitHub Pages-compatible static entry point", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<html lang="hu">/i);
  assert.match(html, /<title>TR Rendeléskészítő<\/title>/i);
  assert.match(html, /\/tr-rendeleskeszito\/assets\//i);
});
