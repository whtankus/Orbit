import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const planetarium = readFileSync(new URL("../src/planetarium/planetarium.js", import.meta.url), "utf8");
const stars = JSON.parse(readFileSync(new URL("../src/planetarium/data/stars.json", import.meta.url), "utf8"));
const skyCulture = JSON.parse(readFileSync(new URL("../src/planetarium/data/constellations.json", import.meta.url), "utf8"));

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

test("planetarium data contains a measured star catalogue and all IAU constellations", () => {
  assert.ok(stars.stars.length > 9000);
  assert.equal(skyCulture.constellations.length, 88);
  assert.equal(skyCulture.edges.length, 781);
});

test("every star used by the 88 Stellarium figures resolves to a Hipparcos catalogue row", () => {
  const ids = new Set(stars.stars.filter(row => row[0] > 0).map(row => row[0]));
  const referenced = new Set(skyCulture.constellations.flatMap(c => c.lines.flatMap(line => line.ids)));
  assert.ok(referenced.size > 600);
  for (const id of referenced) assert.ok(ids.has(id), "Missing HIP " + id);
});

test("planetarium uses date and observer horizon calculations", () => {
  assert.match(planetarium, /precessJ2000EquatorialToDate/);
  assert.match(planetarium, /B1875_JD/);
  assert.match(planetarium, /stereographicProject/);
  assert.match(planetarium, /horizontalCoordinates/);
});

test("Night Sky page exposes star search, magnitude and layer controls", () => {
  assert.match(html, /id="skyStarSearch"/);
  assert.match(html, /id="skyMagnitude"/);
  assert.match(html, /id="skyShowBoundaries"/);
  assert.match(html, /id="skyShowLines"/);
  assert.match(html, /id="skyShowLabels"/);
});
