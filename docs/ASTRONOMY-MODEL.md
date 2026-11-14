# ORBIT — Astronomical model and accuracy notes

## Planetary positions

The interactive Solar System uses the NASA/JPL Solar System Dynamics **Approximate Positions of the Planets** element set. It evaluates the six fitted Keplerian elements and their rates at the selected date, solves Kepler's equation for eccentric anomaly, and rotates the orbital-plane position into the mean ecliptic/equinox of J2000.

Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html

The element set used by ORBIT is specified for **1800–2050 CE**. ORBIT constrains the date picker to this interval and reports when a date falls outside it. The coefficients are a fitted approximation, not a numerical integration of the full Solar System. JPL publishes nominal error estimates; the outer-planet longitude errors are larger than those for the inner planets. Use JPL Horizons for precision work, observation planning, navigation, or mission analysis.

JPL Horizons documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html

## Reference frame and time

- Positions are heliocentric vectors in the J2000 mean ecliptic frame.
- The Earth coefficients represent the **Earth–Moon barycentre**, used here as a close educational proxy for Earth's heliocentric position.
- Browser dates are interpreted as UTC instants and converted to Julian Day. The published formula is expressed in JDTDB; ORBIT does not apply a full UTC-to-TDB conversion.
- No light-time, aberration, nutation, or relativistic corrections are applied to the Solar System positions.
- Observer coordinates convert the J2000 vectors to equatorial coordinates, apply an IAU 1976 precession approximation, and calculate geometric altitude/azimuth using an approximate Greenwich mean sidereal time.
- Atmospheric refraction and topocentric parallax are not applied to the current planet altitude/azimuth panel.

## Visual scale

The displayed Solar System compresses orbital distances and enlarges planet radii so the system fits in the available viewport. The orbital path shapes and orbital directions come from the JPL element model, but the scene is **not a size-and-distance scale model**. The Moon and other displayed natural satellites still use simplified, illustrative circular paths in this release.

## Night Sky chart

The plotted star field and the 12 constellation line figures are still illustrative. They are not a measured stellar catalogue, do not define the official IAU constellation boundaries, and do not provide an all-sky observing chart. The observer console now calculates approximate Solar System body altitudes and azimuths separately from that schematic star illustration.

## Verification

The repository includes Node.js tests for:
- JPL element tables and validity bounds
- Keplerian position and orbit-path calculations
- Approximate orbital speeds
- J2000-to-date precession
- Sidereal time and local horizontal coordinates
- Observer ephemeris output

These tests validate the calculation code, not browser rendering or the full precision of the JPL model.
