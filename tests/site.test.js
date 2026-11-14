import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the main page imports the JPL astronomy module", () => {
  assert.match(html, /from '\.\/src\/astronomy\/index\.js'/);
  assert.match(html, /function updatePlanetPositions/);
  assert.match(html, /orbitalPath\(name,simulationDate,240\)/);
});

test("the Solar System has a date control bounded to the JPL model interval", () => {
  assert.match(html, /id="simulationDate"[^>]*min="1800-01-01T00:00"[^>]*max="2050-12-31T23:59"/);
  assert.match(html, /JPL APPROX · J2000 ECLIPTIC/);
});

test("Night Sky reports calculated planet altitude and azimuth separately from its schematic stars", () => {
  assert.match(html, /id="skyPlanetReadout"/);
  assert.match(html, /observerEphemeris\(body,date,latitude,longitude\)/);
  assert.match(html, /star-field illustration remains schematic/);
});

test("main browser module parses after external imports are removed", () => {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/i);
  assert.ok(match, "module script exists");
  const source = match[1].replace(/^import\s+[\s\S]*?;\s*$/gm, "");
  assert.doesNotThrow(() => new Function(source));
});
