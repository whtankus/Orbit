import test from "node:test";
import assert from "node:assert/strict";
import {
  EPHEMERIS_VALIDITY,
  JPL_PLANET_ELEMENTS,
  orbitalElementsAt,
  heliocentricPosition,
  orbitalPath,
  calculatePlanetStates,
  observerEphemeris,
  greenwichMeanSiderealTime,
  precessJ2000EquatorialToDate,
  precessEquatorialBetweenEpochs,
  equatorialToHorizontal
} from "../src/astronomy/index.js";

test("JPL element set includes all eight planets", () => {
  assert.deepEqual(Object.keys(JPL_PLANET_ELEMENTS), [
    "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"
  ]);
});

test("J2000 orbital elements reproduce their tabulated semi-major axes", () => {
  const date = new Date("2000-01-01T12:00:00.000Z");
  assert.ok(Math.abs(orbitalElementsAt("Earth", date).a - 1.00000261) < 1e-8);
  assert.ok(Math.abs(orbitalElementsAt("Jupiter", date).a - 5.202887) < 1e-8);
});

test("all planets return finite heliocentric positions in the JPL validity interval", () => {
  const date = new Date("2026-11-14T08:30:00.000Z");
  for (const body of Object.keys(JPL_PLANET_ELEMENTS)) {
    const state = heliocentricPosition(body, date);
    assert.equal(state.validForDate, true, body);
    assert.ok(state.distanceAU > 0, body);
    assert.ok([state.positionAU.x, state.positionAU.y, state.positionAU.z].every(Number.isFinite), body);
  }
});

test("orbital paths are closed sampled ellipses with expected point count", () => {
  const path = orbitalPath("Mars", new Date("2026-01-01T00:00:00Z"), 180);
  assert.equal(path.length, 180);
  assert.ok(Math.hypot(path[0].x - path[179].x, path[0].y - path[179].y, path[0].z - path[179].z) < 0.08);
});

test("planet-state collection computes plausible orbital speeds", () => {
  const states = calculatePlanetStates(new Date("2026-11-14T00:00:00Z"));
  assert.ok(states.Mercury.speedKmSec > 35 && states.Mercury.speedKmSec < 70);
  assert.ok(states.Earth.speedKmSec > 25 && states.Earth.speedKmSec < 35);
  assert.ok(states.Neptune.speedKmSec > 4 && states.Neptune.speedKmSec < 9);
});

test("JPL validity interval is explicitly bounded", () => {
  assert.equal(EPHEMERIS_VALIDITY.startYear, 1800);
  assert.equal(EPHEMERIS_VALIDITY.endYear, 2050);
  assert.equal(orbitalElementsAt("Earth", new Date("1750-01-01T00:00:00Z")).validForDate, false);
});

test("J2000 coordinates precess to the selected date without losing validity", () => {
  const p = precessJ2000EquatorialToDate(101.287, -16.716, new Date("2026-11-14T00:00:00Z"));
  assert.ok(Number.isFinite(p.rightAscensionDeg));
  assert.ok(Number.isFinite(p.declinationDeg));
  assert.ok(p.rightAscensionDeg >= 0 && p.rightAscensionDeg < 360);
  assert.ok(p.declinationDeg >= -90 && p.declinationDeg <= 90);
});

test("sidereal time and horizontal coordinates remain finite", () => {
  const date = new Date("2026-11-14T00:00:00.000Z");
  const gmst = greenwichMeanSiderealTime(date);
  assert.ok(gmst >= 0 && gmst < 360);
  const horizontal = equatorialToHorizontal(101.287, -16.716, date, 28.61, 77.21);
  assert.ok(Number.isFinite(horizontal.altitudeDeg));
  assert.ok(horizontal.azimuthDeg >= 0 && horizontal.azimuthDeg < 360);
});

test("observer ephemeris returns altitude and azimuth for the major planets", () => {
  const result = observerEphemeris("Jupiter", new Date("2026-11-14T00:00:00Z"), 28.61, 77.21);
  assert.ok(result.distanceAU > 0);
  assert.ok(result.altitudeDeg >= -90 && result.altitudeDeg <= 90);
  assert.ok(result.azimuthDeg >= 0 && result.azimuthDeg < 360);
});

test("arbitrary-epoch precession round-trips B1875 and J2000 coordinates", () => {
  const jdB1875 = 2415020.31352 + (1875 - 1900) * 365.242198781;
  const source = { ra: 343.0, dec: 34.5 };
  const j2000 = precessEquatorialBetweenEpochs(source.ra, source.dec, jdB1875, 2451545.0);
  const back = precessEquatorialBetweenEpochs(j2000.rightAscensionDeg, j2000.declinationDeg, 2451545.0, jdB1875);
  const deltaRa = Math.abs(((back.rightAscensionDeg - source.ra + 540) % 360) - 180);
  assert.ok(deltaRa < 1e-7);
  assert.ok(Math.abs(back.declinationDeg - source.dec) < 1e-7);
});
