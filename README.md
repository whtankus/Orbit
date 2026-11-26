# ORBIT — Interactive Space Observatory

[![Deploy to GitHub Pages](https://github.com/whtankus/Orbit/actions/workflows/deploy.yml/badge.svg)](https://github.com/whtankus/Orbit/actions/workflows/deploy.yml)
[![Quality checks](https://github.com/whtankus/Orbit/actions/workflows/quality.yml/badge.svg)](https://github.com/whtankus/Orbit/actions/workflows/quality.yml)

**Explore nearby worlds. Read the night sky. Travel through cosmic time.**

ORBIT is a browser-based astronomy observatory built with Three.js and native JavaScript modules. It combines an interactive 3D Solar System, a date-aware planetarium, a six-object deep-sky atlas, a twelve-stage cosmic-history experience, comparative planetology and an original generative sound studio.

- **Live observatory:** https://whtankus.github.io/Orbit/
- **Source repository:** https://github.com/whtankus/Orbit

## Observatory experiences

### 3D Solar System
- Explore the Sun and all eight planets in a rotatable, zoomable 3D scene.
- Inspect mapped planetary surfaces, atmospheric limb effects, Earth's cloud and night-light layers, Saturn's textured rings and selected natural satellites.
- Follow orbital paths, labels and a date-driven simulation.
- Adjust simulation time, playback speed, camera focus and cinematic mode.
- The scene compresses orbital distances and enlarges planet radii for legibility; it is not a scale model.

### Night Sky planetarium
- Explore a stereographic sky chart with star search and constellation figures.
- Inspect the selected observer's horizon and approximate Solar System body altitude/azimuth.
- Adjust date and time, zoom and observer location.
- Browse the planet gallery and deep-sky atlas from the same section.

### Deep-sky atlas
The atlas contains six objects: Andromeda Galaxy (M31), Whirlpool Galaxy (M51), Sombrero Galaxy (M104), Pinwheel Galaxy (M101), barred spiral NGC 1300 and Cigar Galaxy (M82). NASA telescope imagery is credited on the relevant objects. The Pinwheel, NGC 1300 and M82 cards use original procedural ORBIT illustrations, not telescope photographs or observational data. Selecting an object links to its constellation in the sky chart.

### Planet comparison
Compare any two planets side by side. Review diameter, rotation period, orbital period, moon count, current heliocentric distance and approximate orbital speed. Date-dependent orbital values update with the selected simulation date.

### Cosmic history
Move through twelve illustrated milestones, from the cosmic microwave background and first structures to galaxy formation, the Solar System, early life, oxygenation, complex life and modern astronomy. The timeline is an educational narrative with rounded dates, not a numerical cosmology simulation.

### Sound Studio
Six original, browser-generated soundtracks:
1. **Event Horizon** — slow orbital ambient
2. **Solar Wind** — bright planetary pulse
3. **Deep Field** — shimmering deep-space tones
4. **Galactic Tides** — slowly evolving harmonics
5. **Deep Time** — long-form history score
6. **Stellar Night** — quiet planetarium ambience

When a soundtrack is already playing, moving between Explore, Compare, History, Night Sky and Research selects the corresponding score. Audio never starts automatically; the visitor must enable sound and press Play. Master volume, soundtrack level, spatial ambience and interaction effects are independent controls.

### Research library
Curated NASA, JPL and IAU references introduce planetary science, cosmology, observing and robotic exploration. Model assumptions and known limitations are documented in the repository.

## Run locally

ORBIT uses ES modules and an import map. Serve the project over HTTP; do not open `index.html` directly from the filesystem.

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

The project uses Node's built-in test runner. GitHub Actions runs syntax checks and the test suite before GitHub Pages deployment.

## Project structure

```text
.
├── index.html                  # Application structure and import map
├── styles.css                  # Observatory interface and responsive layouts
├── src/
│   ├── app/main.js             # Three.js scene, interface, atlas, history and audio
│   ├── astronomy/              # Planetary elements and coordinate transforms
│   └── planetarium/            # Night Sky chart, catalogue and observer tools
├── docs/
│   └── ASTRONOMY-MODEL.md      # Scientific methods, sources and limitations
├── tests/                      # Astronomy and site integration tests
└── .github/workflows/          # Quality checks and Pages deployment
```

## Scientific scope and accuracy

ORBIT is an educational visualization, not a precision observing, navigation or scientific data service.

- Planet positions use NASA/JPL approximate Keplerian elements fitted for **1800–2050 CE**.
- Earth coefficients represent the Earth–Moon barycentre and are used as an educational proxy for Earth's heliocentric position.
- Orbital distances are compressed and planet radii exaggerated in the 3D scene.
- Moon orbits and some atmospheric effects are illustrative.
- The Night Sky catalogue has documented limitations, including no stellar proper-motion propagation in the current catalogue view.
- Cosmic-history scenes and three additional galaxy artworks are illustrations, not physical simulations or telescope observations.

Read [Astronomical model and accuracy notes](docs/ASTRONOMY-MODEL.md) before interpreting visualization outputs. Use [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) for precision ephemerides.

## Contributing

Bug reports, focused feature proposals, documentation improvements and tested code contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), search existing issues, document reproduction steps, preserve scientific limitations and attributions, then run `npm run check` and `npm test`.

## Data, imagery and attribution

Planetary texture maps are attributed in the application to Solar System Scope (CC BY 4.0). Deep-sky telescope imagery retains its NASA/ESA/CSA/STScI credits in the atlas. Original procedural illustrations are labelled as ORBIT artwork. Catalogue and constellation data sources and licences are described in [ASTRONOMY-MODEL.md](docs/ASTRONOMY-MODEL.md).

## License

No project-wide open-source license is currently included. Unless a license is added by the repository owner, do not assume that the source code is licensed for reuse or redistribution beyond permissions granted by applicable law.
