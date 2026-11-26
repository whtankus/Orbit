# ORBIT — Interactive Universe Explorer

[![Deploy to GitHub Pages](https://github.com/whtankus/Orbit/actions/workflows/deploy.yml/badge.svg)](https://github.com/whtankus/Orbit/actions/workflows/deploy.yml)
[![Quality checks](https://github.com/whtankus/Orbit/actions/workflows/quality.yml/badge.svg)](https://github.com/whtankus/Orbit/actions/workflows/quality.yml)

**Explore the Solar System, inspect the night sky, and travel through cosmic history.**

ORBIT is a browser-based astronomy observatory built with Three.js and browser-native JavaScript modules. It combines an interactive 3D Solar System with a star-chart experience, a deep-sky atlas, and an illustrated timeline of cosmic evolution.

- **Live observatory:** [whtankus.github.io/Orbit](https://whtankus.github.io/Orbit/)
- **Source code:** [github.com/whtankus/Orbit](https://github.com/whtankus/Orbit)

## Explore ORBIT

### Interactive Solar System
- Navigate a 3D model of the Sun and eight planets.
- Select worlds, inspect their appearance, and adjust the simulation date and speed.
- Explore planet textures, atmospheric effects, Saturn's rings, and orbital guides.

### Night Sky planetarium
- Explore a stereographic sky chart with stars above the selected horizon.
- Select constellation figures and IAU constellation boundaries.
- Search the stellar catalogue by name, designation, or HIP identifier.
- Adjust observing location and time, and inspect approximate planetary altitude and azimuth.

### Deep-sky atlas
- Browse selected galaxies, including Andromeda, the Whirlpool Galaxy, and the Sombrero Galaxy.
- Connect an atlas object to its constellation in the sky chart.

### Planet comparison
- Compare any two planets side by side.
- Review diameter, rotation period and orbital period.
- Compare current heliocentric distance and orbital speed for the selected simulation date.
- See paired visual bars normalized to the larger of the two selected values.

### Appearance
- The observatory opens with a clean white interface.
- Switch to the original dark observatory theme at any time; the preference is saved in the browser.

### Cosmic history
- Scrub or play an illustrated journey through major stages of cosmic and planetary evolution.
- Explore the early universe, stars, galaxies, the Solar System, and the emergence of life on Earth.

### Research library
- Follow curated NASA, JPL, and IAU references.
- Read about the models and assumptions behind the visualizations.

## Run locally

ORBIT uses ES modules and an import map, so serve the project over HTTP. Do not open `index.html` directly from the filesystem.

**Requirements:** Node.js 22 or later.

```bash
git clone https://github.com/whtankus/Orbit.git
cd Orbit
npx serve .
```

Open the local URL printed by the server.

## Run checks

```bash
npm run check
npm test
```

The project uses Node's built-in test runner. GitHub Actions runs syntax checks and the test suite for pull requests and before GitHub Pages deployment.

## Project structure

```text
.
├── index.html                  # Application structure and import map
├── styles.css                  # Observatory interface and responsive layouts
├── src/
│   ├── app/main.js             # Three.js scene, interface, controls and audio
│   ├── astronomy/              # Planetary elements and coordinate transforms
│   └── planetarium/            # Night Sky chart, catalogue and observer tools
├── docs/
│   └── ASTRONOMY-MODEL.md      # Scientific methods, sources and limitations
├── tests/                      # Astronomy and site integration tests
└── .github/workflows/          # Quality checks and Pages deployment
```

## Scientific scope and accuracy

ORBIT is an educational visualization, not a precision observing, navigation, or scientific data service.

- Planet positions use NASA/JPL approximate Keplerian elements fitted for **1800–2050 CE**.
- The displayed Solar System compresses orbital distances and enlarges planet radii; it is not a scale model.
- The Night Sky catalogue and coordinate projection have documented limitations, including no stellar proper-motion propagation in the current catalogue view.
- Some cosmic-history scenes are explanatory illustrations, not physical simulations.

Read [Astronomical model and accuracy notes](docs/ASTRONOMY-MODEL.md) before using ORBIT's outputs for scientific interpretation. Use [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) for precision ephemerides.

## Contributing

Bug reports, carefully scoped feature proposals, documentation improvements, and tested code contributions are welcome.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md).
2. Search existing issues before opening a new one.
3. Explain the problem or proposed improvement, including steps to reproduce where relevant.
4. Keep pull requests focused and preserve the documented scientific limitations.
5. Run `npm run check` and `npm test` before submitting.

Please do not present illustrative graphics or approximate calculations as measured or precision scientific data.

## Data and attribution

ORBIT incorporates third-party astronomical data and imagery. Their sources and applicable terms are documented in the application and in [ASTRONOMY-MODEL.md](docs/ASTRONOMY-MODEL.md). Please retain those attributions when changing or redistributing the relevant assets.

## License

No project-wide open-source license is currently included. Unless a license is added by the repository owner, do not assume that the source code is licensed for reuse, redistribution, or modification outside the permissions granted by applicable law.
