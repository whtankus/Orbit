import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("the page loads the standalone stylesheet and application module", () => {
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/src\/app\/main\.js"/);
});

test("the application imports the JPL astronomy engine", () => {
  assert.match(app, /from '\.\.\/astronomy\/index\.js'/);
  assert.match(app, /function updatePlanetPositions/);
  assert.match(app, /orbitalPath\(name,simulationDate,240\)/);
});

test("the Solar System has a date control bounded to the JPL model interval", () => {
  assert.match(html, /id="simulationDate"[^>]*min="1800-01-01T00:00"[^>]*max="2050-12-31T23:59"/);
  assert.match(html, /JPL APPROX · J2000 ECLIPTIC/);
});

test("Night Sky reports calculated planet altitude and azimuth separately from its schematic stars", () => {
  assert.match(html, /id="skyPlanetReadout"/);
  assert.match(app, /observerEphemeris\(body,date,latitude,longitude\)/);
  assert.match(html, /star-field illustration remains schematic/);
});

test("the external browser application module parses", () => {
  const source = app.replace(/^import\s+[\s\S]*?;\s*$/gm, "");
  assert.doesNotThrow(() => new Function(source));
});

test("the stylesheet has the observatory and responsive layouts", () => {
  assert.match(styles, /\.astro-timebar/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /\.research-card/);
});
