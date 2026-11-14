import { EPHEMERIS_VALIDITY, JPL_PLANET_ELEMENTS } from "./jpl-elements.js";
import { julianDayUTC, normalizeDegrees, eclipticJ2000ToEquatorial, equatorialToHorizontal } from "./coordinates.js";

const DEG = Math.PI / 180;
const AU_KM = 149597870.7;
const DAY_SECONDS = 86400;

function wrapSignedDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function solveEccentricAnomaly(meanAnomalyRad, eccentricity) {
  let E = meanAnomalyRad + eccentricity * Math.sin(meanAnomalyRad);
  for (let i = 0; i < 15; i++) {
    const delta = (E - eccentricity * Math.sin(E) - meanAnomalyRad) /
      (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-13) return E;
  }
  if (!Number.isFinite(E)) throw new Error("Kepler equation did not converge.");
  return E;
}

export function orbitalElementsAt(body, date = new Date()) {
  const source = JPL_PLANET_ELEMENTS[body];
  if (!source) throw new RangeError(`Unsupported JPL planet: ${body}`);
  const jd = julianDayUTC(date);
  const T = (jd - EPHEMERIS_VALIDITY.referenceJulianDay) /
    EPHEMERIS_VALIDITY.daysPerJulianCentury;
  const rates = source.rates;
  const a = source.a + rates.a * T;
  const e = source.e + rates.e * T;
  const inclination = source.inclination + rates.inclination * T;
  const meanLongitude = source.meanLongitude + rates.meanLongitude * T;
  const longitudePerihelion = source.longitudePerihelion + rates.longitudePerihelion * T;
  const longitudeNode = source.longitudeNode + rates.longitudeNode * T;
  const argumentPerihelion = longitudePerihelion - longitudeNode;
  const meanAnomalyDeg = wrapSignedDegrees(meanLongitude - longitudePerihelion);

  if (!(a > 0) || !(e >= 0 && e < 1)) throw new RangeError("Invalid orbital elements.");
  return {
    body, jd, centuriesSinceJ2000: T, a, e, inclinationDeg: inclination,
    meanLongitudeDeg: normalizeDegrees(meanLongitude),
    longitudePerihelionDeg: normalizeDegrees(longitudePerihelion),
    longitudeNodeDeg: normalizeDegrees(longitudeNode),
    argumentPerihelionDeg: argumentPerihelion,
    meanAnomalyDeg,
    validForDate: new Date(date).getUTCFullYear() >= EPHEMERIS_VALIDITY.startYear &&
      new Date(date).getUTCFullYear() <= EPHEMERIS_VALIDITY.endYear
  };
}

function positionFromElements(elements, meanAnomalyDeg) {
  const { a, e } = elements;
  const M = wrapSignedDegrees(meanAnomalyDeg) * DEG;
  const E = solveEccentricAnomaly(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const omega = elements.argumentPerihelionDeg * DEG;
  const node = elements.longitudeNodeDeg * DEG;
  const inc = elements.inclinationDeg * DEG;
  const cw = Math.cos(omega), sw = Math.sin(omega);
  const cn = Math.cos(node), sn = Math.sin(node);
  const ci = Math.cos(inc), si = Math.sin(inc);

  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: (sw * si) * xp + (cw * si) * yp
  };
}

export function heliocentricPosition(body, date = new Date()) {
  const elements = orbitalElementsAt(body, date);
  const positionAU = positionFromElements(elements, elements.meanAnomalyDeg);
  const distanceAU = Math.hypot(positionAU.x, positionAU.y, positionAU.z);
  const longitudeDeg = normalizeDegrees(Math.atan2(positionAU.y, positionAU.x) / DEG);
  const latitudeDeg = Math.atan2(positionAU.z, Math.hypot(positionAU.x, positionAU.y)) / DEG;
  return { ...elements, positionAU, distanceAU, longitudeDeg, latitudeDeg };
}

export function orbitalPath(body, date = new Date(), samples = 240) {
  if (!Number.isInteger(samples) || samples < 24 || samples > 2000) {
    throw new RangeError("Orbit path samples must be an integer from 24 to 2000.");
  }
  const elements = orbitalElementsAt(body, date);
  const points = [];
  for (let i = 0; i < samples; i++) {
    const M = i / samples * 360;
    points.push(positionFromElements(elements, M));
  }
  return points;
}

export function calculatePlanetStates(date = new Date()) {
  const states = {};
  for (const body of Object.keys(JPL_PLANET_ELEMENTS)) {
    const current = heliocentricPosition(body, date);
    const before = heliocentricPosition(body, new Date(new Date(date).getTime() - 0.5 * DAY_SECONDS * 1000));
    const after = heliocentricPosition(body, new Date(new Date(date).getTime() + 0.5 * DAY_SECONDS * 1000));
    const vx = after.positionAU.x - before.positionAU.x;
    const vy = after.positionAU.y - before.positionAU.y;
    const vz = after.positionAU.z - before.positionAU.z;
    const speedKmSec = Math.hypot(vx, vy, vz) * AU_KM / DAY_SECONDS;
    states[body] = { ...current, speedKmSec };
  }
  return states;
}

/**
 * Observer ephemeris from the JPL approximate heliocentric elements.
 * Earth is represented by the JPL Earth–Moon barycentre element.
 */
export function observerEphemeris(body, date, latitudeDeg, longitudeDeg) {
  const earth = heliocentricPosition("Earth", date);
  let geocentric;
  if (body === "Sun") {
    geocentric = { x: -earth.positionAU.x, y: -earth.positionAU.y, z: -earth.positionAU.z };
  } else {
    const target = heliocentricPosition(body, date);
    geocentric = {
      x: target.positionAU.x - earth.positionAU.x,
      y: target.positionAU.y - earth.positionAU.y,
      z: target.positionAU.z - earth.positionAU.z
    };
  }
  const equatorial = eclipticJ2000ToEquatorial(geocentric);
  const horizontal = equatorialToHorizontal(
    equatorial.rightAscensionDeg, equatorial.declinationDeg,
    date, latitudeDeg, longitudeDeg
  );
  return {
    body, distanceAU: equatorial.distance,
    rightAscensionDeg: equatorial.rightAscensionDeg,
    declinationDeg: equatorial.declinationDeg,
    ...horizontal
  };
}

export { EPHEMERIS_VALIDITY, JPL_PLANET_ELEMENTS, julianDayUTC };
