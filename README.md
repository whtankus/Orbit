# ORBIT — Interactive Universe Explorer

ORBIT is a browser-based 3D Solar System observatory built with Three.js and a small set of browser-native modules.

## Run locally

Because the site uses ES modules, serve the repository root over HTTP rather than opening `index.html` as a local file.

For example:

```bash
npx serve .
```

Then open the local URL printed by the server.

## Project layout

- `index.html` — page structure and import map
- `styles.css` — observatory UI and responsive layouts
- `src/app/main.js` — Three.js scene, controls, pages and audio
- `src/astronomy/` — JPL planetary element model and coordinate transforms
- `tests/` — Node.js tests for astronomy calculations and site integration
- `docs/ASTRONOMY-MODEL.md` — calculation methods, assumptions and accuracy limits

## Validation

Node.js 22 or later:

```bash
npm run check
npm test
```

GitHub Actions runs both checks before publishing to GitHub Pages.

## Astronomy model limits

Planet positions use JPL's approximate Keplerian elements fitted for 1800–2050 CE. This is appropriate for educational visualization, not precision observation planning or spacecraft navigation. The scene compresses distances and enlarges planet sizes. The Night Sky star patterns remain schematic; planet altitude/azimuth readouts are separate approximate calculations. See [the astronomy model notes](docs/ASTRONOMY-MODEL.md).
