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

## Deep-sky atlas and generated artwork

The atlas combines NASA telescope imagery with three original procedural illustrations: the Pinwheel Galaxy (M101), barred spiral NGC 1300 and starburst galaxy M82. These procedural images are generated in the browser for visual explanation; they are not telescope photographs, calibrated observations or data products. Each card identifies its image type and credit.

## Verification

The repository includes Node.js tests for:
- JPL element tables and validity bounds
- Keplerian position and orbit-path calculations
- Approximate orbital speeds
- J2000-to-date precession
- Sidereal time and local horizontal coordinates
- Observer ephemeris output

These tests validate the calculation code, not browser rendering or the full precision of the JPL model.

## Project layout

The application shell now loads a standalone stylesheet and an ES-module entry point. Astronomical calculations are isolated under `src/astronomy/`, with automated tests under `tests/`. The deployment workflow runs syntax checks and the test suite before publishing GitHub Pages.

## Fixed-star planetarium

The Night Sky page uses a compact 9,029-row HYG v4.4 subset (Hipparcos, Yale Bright Star Catalogue and Gliese) with J2000 right ascension/declination, visual magnitude, B−V colour, proper name, Bayer designation and constellation abbreviation where supplied. The source data are CC BY-SA 4.0; derived catalogue data remain CC BY-SA 4.0. Attribution is displayed in the Night Sky page.

Constellation stick figures and their HIP identifiers are taken from Stellarium's Western sky culture index. The 781 IAU/Delporte boundary edges are supplied in B1875.0 coordinates from the upstream boundary data cited in that index. The chart transforms star coordinates from J2000 and boundary coordinates from B1875.0 to the selected epoch using an IAU 1976 precession approximation, then calculates local geometric altitude/azimuth and projects objects above the horizon using a zenith-centred stereographic projection.

Limitations: this catalogue subset does not carry proper motions, so stellar motion is not propagated; no nutation, aberration, atmospheric refraction or terrain horizon is applied. The magnitude slider is limited to V=6.5; this is not a Gaia-depth survey. Star altitude/azimuth is geometric and is not the same as naked-eye visibility under real light-pollution or weather conditions.
