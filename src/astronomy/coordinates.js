import { EPHEMERIS_VALIDITY } from "./jpl-elements.js";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function julianDayUTC(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) throw new TypeError("A valid date is required.");
  return value.getTime() / 86400000 + 2440587.5;
}

export function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export function eclipticJ2000ToEquatorial(vector) {
  const epsilon = EPHEMERIS_VALIDITY.obliquityJ2000Degrees * DEG;
  const cosE = Math.cos(epsilon);
  const sinE = Math.sin(epsilon);
  const x = Number(vector.x);
  const y = Number(vector.y);
  const z = Number(vector.z);
  const eqY = y * cosE - z * sinE;
  const eqZ = y * sinE + z * cosE;
  const length = Math.hypot(x, eqY, eqZ);
  if (!Number.isFinite(length) || length === 0) {
    throw new RangeError("Cannot calculate coordinates for a zero-length vector.");
  }
  return {
    x, y: eqY, z: eqZ,
    rightAscensionDeg: normalizeDegrees(Math.atan2(eqY, x) * RAD),
    declinationDeg: Math.asin(Math.max(-1, Math.min(1, eqZ / length))) * RAD,
    distance: length
  };
}

/**
 * Greenwich mean sidereal time approximation.
 * Suitable for this educational observer display; not a precision timing standard.
 */
/**
 * Precess J2000 mean-equatorial coordinates to the mean equator/equinox of date.
 * IAU 1976 precession angles; appropriate as an educational approximation
 * over the JPL element model's 1800–2050 interval.
 */
export function precessJ2000EquatorialToDate(raDeg, decDeg, date) {
  const jd = julianDayUTC(date);
  const T = (jd - 2451545.0) / 36525;
  const arcsecToRad = Math.PI / (180 * 3600);
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * arcsecToRad;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * arcsecToRad;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * arcsecToRad;
  const alpha = Number(raDeg) * DEG;
  const delta = Number(decDeg) * DEG;
  if (!Number.isFinite(alpha) || !Number.isFinite(delta) || Math.abs(decDeg) > 90) {
    throw new RangeError("Invalid J2000 equatorial coordinates.");
  }
  const A = Math.cos(delta) * Math.sin(alpha + zeta);
  const B = Math.cos(theta) * Math.cos(delta) * Math.cos(alpha + zeta) - Math.sin(theta) * Math.sin(delta);
  const C = Math.sin(theta) * Math.cos(delta) * Math.cos(alpha + zeta) + Math.cos(theta) * Math.sin(delta);
  return {
    rightAscensionDeg: normalizeDegrees(Math.atan2(A, B) + z) * RAD,
    declinationDeg: Math.asin(Math.max(-1, Math.min(1, C))) * RAD
  };
}

export function greenwichMeanSiderealTime(date = new Date()) {
  const jd = julianDayUTC(date);
  const t = (jd - 2451545.0) / 36525;
  return normalizeDegrees(
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000
  );
}

/**
 * Convert J2000 equatorial coordinates to local horizontal coordinates.
 * Azimuth is measured clockwise from true north; altitude is degrees above horizon.
 */
export function equatorialToHorizontal(raDeg, decDeg, date, latitudeDeg, longitudeDeg) {
  const values = [raDeg, decDeg, latitudeDeg, longitudeDeg].map(Number);
  if (!values.every(Number.isFinite) || values[1] < -90 || values[1] > 90 ||
      values[2] < -90 || values[2] > 90 || values[3] < -180 || values[3] > 180) {
    throw new RangeError("Invalid equatorial coordinates or observer location.");
  }

  const [ra, dec, lat, lon] = values.map(v => v * DEG);
  const lst = normalizeDegrees(greenwichMeanSiderealTime(date) + longitudeDeg) * DEG;
  const hourAngle = lst - ra;

  const east = -Math.cos(dec) * Math.sin(hourAngle);
  const north = Math.sin(dec) * Math.cos(lat) -
    Math.cos(dec) * Math.cos(hourAngle) * Math.sin(lat);
  const up = Math.sin(dec) * Math.sin(lat) +
    Math.cos(dec) * Math.cos(hourAngle) * Math.cos(lat);

  return {
    altitudeDeg: Math.asin(Math.max(-1, Math.min(1, up))) * RAD,
    azimuthDeg: normalizeDegrees(Math.atan2(east, north) * RAD),
    hourAngleDeg: ((hourAngle * RAD + 540) % 360) - 180,
    aboveHorizon: up > 0
  };
}
