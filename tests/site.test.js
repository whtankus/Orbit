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
  assert.match(html, /SKY-AREA BORDERS/);
  assert.match(html, /proper motion is not propagated/);
  assert.match(html, /IAU\/Delporte/);
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


test("the observatory redesign establishes readable typography and responsive page layouts", () => {
  assert.match(html, /IBM[+ ]Plex[+ ]Mono:wght@400;500;600/);
  assert.match(html, /Space[+ ]Grotesk:wght@400;500;600;700/);
  assert.match(styles, /ORBIT 4\.0 — deliberate observatory design system/);
  assert.match(styles, /\.page-intro\{[^}]*font-size:16px/);
  assert.match(styles, /\.research-card p\{[^}]*font-size:15px/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(html, /page-reference-note/);
});

test("the soundscape uses layered ambient tones and page-specific interaction feedback", () => {
  assert.match(app, /Soft, widely spaced harmonic layers/);
  assert.match(app, /function soundEffect\(kind='ui'\)/);
  assert.match(app, /tone\(659\.25/);
  assert.match(app, /b\.classList\.contains\('nav-tab'\)/);
  assert.match(app, /kind='page'/);
});

test("planetarium canvas labels use the refreshed readable type scale", () => {
  assert.match(planetarium, /11px IBM Plex Mono/);
  assert.match(planetarium, /10px IBM Plex Mono/);
  assert.match(planetarium, /600 12px Space Grotesk/);
});


test("the 3D view no longer shows the Celestial Profile card or SYSTEM NOMINAL telemetry", () => {
  assert.match(html, /class="panel"/);
  assert.match(styles, /\.panel\{display:none!important\}/);
  assert.match(styles, /\.telemetry\{display:none!important\}/);
});

test("Night Sky includes a plain-language guide, compass shortcuts and map key", () => {
  assert.match(html, /sky-howto/);
  assert.match(html, /sky-map-key/);
  assert.match(html, /data-sky-constellation="Ori"/);
  assert.match(html, /data-sky-constellation="UMa"/);
  assert.match(app, /data-sky-constellation/);
  assert.match(planetarium, /HORIZON · 0°/);
  assert.match(planetarium, /STRAIGHT UP/);
  assert.match(planetarium, /Showing stars above your horizon/);
});

test("cosmic history changes its art direction for all ten timeline eras", () => {
  assert.match(app, /\$\('historyStage'\)\.dataset\.epoch=String\(epochIndex\)/);
  for (let i = 0; i < 10; i++) {
    assert.match(styles, new RegExp('\\.history-stage\\[data-epoch="' + i + '"\\]'));
  }
});

test("touch controls are larger and readable at narrow widths", () => {
  assert.match(styles, /\.tool-btn\{font-size:10px;min-height:44px/);
  assert.match(styles, /\.nav-tab\{font-size:9\.5px/);
});


test("Sound Studio offers three selectable original soundtrack modes", () => {
  assert.match(html, /data-track="horizon"/);
  assert.match(html, /data-track="solar"/);
  assert.match(html, /data-track="deep"/);
  assert.match(html, /id="musicPlayBtn"/);
  assert.match(html, /id="musicStopBtn"/);
  assert.match(html, /id="musicVolume"/);
  assert.match(app, /function startMusicTrack\(\)/);
  assert.match(app, /function stopMusicTrack\(\)/);
  assert.match(app, /function soundtrackPulse\(\)/);
  assert.match(app, /musicBus/);
});

test("Night Sky supports zoom, time stepping, star shortcuts and browser geolocation", () => {
  for (const id of ["skyZoomIn","skyZoomOut","skyZoomReset","skyLocate","skyBackHour","skyNextHour","skyNextDay","skyTonight"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
    assert.ok(app.includes("$('" + id + "').addEventListener"), "Missing handler for " + id);
  }
  assert.match(html, /data-sky-star="Sirius"/);
  assert.match(html, /data-sky-star="Vega"/);
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(planetarium, /zoom\(delta\)/);
  assert.match(planetarium, /resetZoom\(\)/);
});

test("desktop and mobile layouts have dedicated Sound Studio and observatory compositions", () => {
  assert.match(styles, /Sound Studio: three distinct original generative compositions/);
  assert.match(styles, /@media\(min-width:1250px\)/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /@media\(max-width:380px\)/);
  assert.match(styles, /@keyframes trackBars/);
  assert.match(styles, /button:hover/);
  assert.match(html, /STUDIO&nbsp; \+/);
});



test("responsive navigation preserves readable controls instead of shrinking the header", () => {
  assert.ok(styles.includes("Responsive foundation — predictable layouts across viewport sizes"));
  assert.ok(styles.includes("grid-template-rows:1fr 1fr"));
  assert.ok(styles.includes("overflow-x:auto"));
  assert.ok(styles.includes("env(safe-area-inset-bottom)"));
  assert.ok(styles.includes("100dvh"));
});

test("the 3D renderer uses a lower pixel ratio on compact screens and pauses hidden tabs", () => {
  assert.ok(app.includes("matches?1.2:1.55"));
  assert.ok(app.includes("if(document.hidden)return"));
  assert.ok(app.includes("document.addEventListener('visibilitychange'"));
});


test("section navigation and hidden panels expose accurate accessibility state", () => {
  for (const id of ["historyPage","skyPage","researchPage"]) {
    assert.match(html, new RegExp('id="' + id + '" aria-hidden="true"'));
  }
  assert.ok(html.includes('aria-controls="historyPage"'));
  assert.ok(html.includes('aria-controls="skyPage"'));
  assert.ok(html.includes('aria-controls="researchPage"'));
  assert.ok(html.includes('id="soundMixer" aria-hidden="true" inert'));
  assert.ok(app.includes("p.setAttribute('aria-hidden',String(!visible))"));
  assert.ok(app.includes("b.setAttribute('aria-pressed',String(selected))"));
  assert.ok(app.includes("setAttribute('inert','')"));
});


test("research cards group their reference links into aligned action areas", () => {
  assert.equal((html.match(/class="research-links"/g) || []).length, 5);
  assert.match(styles, /\.research-links\{display:grid/);
  assert.match(styles, /\.research-card \.research-links a\{display:flex/);
});


test("planet hover reveals a compact accessible readout and double-click starts a closer approach", () => {
  assert.match(app, /id='celestialHover'/);
  assert.match(app, /aria-live','polite'/);
  assert.match(app, /function hideCelestialHover\(\)/);
  assert.match(app, /renderer\.domElement\.addEventListener\('pointerleave',hideCelestialHover\)/);
  assert.match(app, /renderer\.domElement\.addEventListener\('dblclick'/);
  assert.match(app, /CLOSE APPROACH/);
  assert.match(styles, /\.celestial-hover\.visible/);
  assert.match(styles, /@media\(max-width:600px\)\{\.celestial-hover\{display:none\}\}/);
});


test("cosmic timeline announces progress and exposes playback and selected-era state", () => {
  assert.match(html, /id="timelineProgress" role="status" aria-live="polite"/);
  assert.match(html, /id="historyPlay"[^>]*aria-pressed="false"/);
  assert.match(app, /aria-label="Go to era /);
  assert.match(app, /b\.setAttribute\('aria-pressed',String\(selected\)\)/);
  assert.match(app, /b\.setAttribute\('aria-current','step'\)/);
  assert.match(app, /\$\('historyPlay'\)\.setAttribute\('aria-pressed','true'\)/);
  assert.match(app, /\$\('historyPlay'\)\.setAttribute\('aria-pressed','false'\)/);
});


test("Night Sky includes an interactive deep-sky atlas and mapped Solar System planet gallery", () => {
  assert.match(html, /id="deepSkyGrid"/);
  assert.match(html, /id="skyWorldGrid"/);
  assert.match(html, /id="skyWorldFocus"/);
  assert.match(app, /deepSkyCatalog/);
  assert.match(app, /NASA \/ ESA \/ CSA \/ STScI/);
  assert.match(app, /renderSkyWorlds\(\)/);
  assert.match(app, /selectBody\(name,true\)/);
  assert.match(styles, /\.deep-sky-grid/);
  assert.match(styles, /\.sky-world-sphere/);
});


test("the night-sky chart emphasizes one selected constellation instead of drawing all 88 figures and borders", () => {
  assert.match(planetarium, /if \(!selected\) continue;/);
  assert.match(planetarium, /const selected = constellationByCode\.get\(selectedCode\);/);
  assert.match(planetarium, /selectedIds\.has\(star\.id\)/);
  assert.match(planetarium, /labelAnchors\.some/);
  assert.match(planetarium, /data-sky-constellation/);
  assert.match(html, /id="skyShowBoundaries" type="checkbox"/);
  assert.match(html, /id="skyShowLabels" type="checkbox"/);
});

test("cosmic history uses distinct physical scene treatments for the Big Bang afterglow, solar nebula, impact era and Earth", () => {
  assert.match(html, /epoch-nebula/);
  assert.match(html, /epoch-companion/);
  assert.match(html, /epoch-debris/);
  for (const epoch of [0,1,2,3,4,5,6,7,8,9]) {
    assert.match(styles, new RegExp('\\.history-stage\\[data-epoch="' + epoch + '"\\]'));
  }
  assert.match(styles, /historyDiskTurn/);
  assert.match(styles, /debrisDrift/);
  assert.match(app, /style\.setProperty\('--epoch-accent'/);
  assert.match(app, /},4200\)/);
});
