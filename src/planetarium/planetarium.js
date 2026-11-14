import {
  julianDayUTC,
  greenwichMeanSiderealTime,
  precessJ2000EquatorialToDate,
  precessEquatorialBetweenEpochs
} from "../astronomy/index.js";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000_JD = 2451545.0;
// Besselian epoch 1875.0 expressed as a Julian Day (IAU/USNO epoch formula).
const B1875_JD = 2415020.31352 + (1875 - 1900) * 365.242198781;

let sharedDataPromise = null;

async function loadCatalogues() {
  if (!sharedDataPromise) {
    sharedDataPromise = Promise.all([
      fetch(new URL("./data/stars.json", import.meta.url)).then(response => {
        if (!response.ok) throw new Error("Star catalogue could not be loaded.");
        return response.json();
      }),
      fetch(new URL("./data/constellations.json", import.meta.url)).then(response => {
        if (!response.ok) throw new Error("Constellation geometry could not be loaded.");
        return response.json();
      })
    ]).then(([starCatalogue, constellationCatalogue]) => {
      if (!Array.isArray(starCatalogue.stars) || !Array.isArray(constellationCatalogue.constellations) ||
          constellationCatalogue.constellations.length !== 88 || !Array.isArray(constellationCatalogue.edges)) {
        throw new Error("ORBIT received an incomplete sky catalogue.");
      }
      return { starCatalogue, constellationCatalogue };
    }).catch(error => {
      sharedDataPromise = null;
      throw error;
    });
  }
  return sharedDataPromise;
}

export function horizontalCoordinates(raDeg, decDeg, localSiderealDeg, latitudeDeg) {
  const ra = Number(raDeg) * DEG;
  const dec = Number(decDeg) * DEG;
  const lst = Number(localSiderealDeg) * DEG;
  const lat = Number(latitudeDeg) * DEG;
  const hourAngle = lst - ra;

  const east = -Math.cos(dec) * Math.sin(hourAngle);
  const north = Math.sin(dec) * Math.cos(lat) -
    Math.cos(dec) * Math.cos(hourAngle) * Math.sin(lat);
  const up = Math.sin(dec) * Math.sin(lat) +
    Math.cos(dec) * Math.cos(hourAngle) * Math.cos(lat);

  return {
    altitudeDeg: Math.asin(Math.max(-1, Math.min(1, up))) * RAD,
    azimuthDeg: ((Math.atan2(east, north) * RAD) % 360 + 360) % 360,
    aboveHorizon: up > 0
  };
}

export function stereographicProject(altitudeDeg, azimuthDeg, cx, cy, radius) {
  if (!Number.isFinite(altitudeDeg) || altitudeDeg < 0 || altitudeDeg > 90) return null;
  const rho = Math.tan((90 - altitudeDeg) * DEG / 2) / Math.tan(45 * DEG);
  const az = azimuthDeg * DEG;
  return {
    x: cx + radius * rho * Math.sin(az),
    y: cy - radius * rho * Math.cos(az)
  };
}

function bayerLabel(value) {
  if (!value) return "";
  const prefix = String(value).split("-")[0];
  const greek = {
    Alp:"α", Bet:"β", Gam:"γ", Del:"δ", Eps:"ε", Zet:"ζ", Eta:"η", The:"θ",
    Iot:"ι", Kap:"κ", Lam:"λ", Mu:"μ", Nu:"ν", Xi:"ξ", Omi:"ο", Pi:"π",
    Rho:"ρ", Sig:"σ", Tau:"τ", Ups:"υ", Phi:"φ", Chi:"χ", Psi:"ψ", Ome:"ω"
  };
  return greek[prefix] || prefix;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function starColour(bv) {
  if (!Number.isFinite(bv)) return "#e5efff";
  // Smooth blue-white-yellow-orange approximation from measured B-V colour.
  const t = clamp((bv + 0.35) / 2.25, 0, 1);
  const stops = [
    [0.00, [155, 190, 255]],
    [0.22, [202, 220, 255]],
    [0.43, [244, 247, 255]],
    [0.62, [255, 239, 205]],
    [0.82, [255, 196, 137]],
    [1.00, [255, 151, 101]]
  ];
  let left = stops[0], right = stops[stops.length - 1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      left = stops[i - 1];
      right = stops[i];
      break;
    }
  }
  const u = (t - left[0]) / (right[0] - left[0]);
  const rgb = left[1].map((v, i) => Math.round(v + (right[1][i] - v) * u));
  return "rgb(" + rgb.join(",") + ")";
}

function sexagesimalBoundarySamples(edge) {
  const [ra1Hours, dec1, ra2Hours, dec2, type, direction] = edge;
  const ra1 = Number(ra1Hours) * 15;
  let ra2 = Number(ra2Hours) * 15;
  if (direction > 0 && ra2 < ra1) ra2 += 360;
  if (direction < 0 && ra2 > ra1) ra2 -= 360;

  const span = type === 0 ? Math.abs(dec2 - dec1) : Math.abs(ra2 - ra1);
  const steps = Math.max(2, Math.ceil(span / 2.0));
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ra = type === 0 ? ra1 : ra1 + (ra2 - ra1) * t;
    const dec = type === 0 ? dec1 + (dec2 - dec1) * t : dec1;
    const raNormalized = ((ra % 360) + 360) % 360;
    samples.push([raNormalized, dec]);
  }
  return samples;
}

function buildStarMaps(starRows) {
  const byId = new Map();
  const byName = new Map();
  const rows = starRows.map(row => {
    const star = {
      id: row[0],
      ra: row[1],
      dec: row[2],
      magnitude: row[3],
      bv: row[4],
      name: row[5] || "",
      bayer: row[6] || "",
      constellation: row[7] || ""
    };
    byId.set(star.id, star);
    const searchText = (star.name + " " + bayerLabel(star.bayer) + " " +
      star.constellation + " HIP " + star.id).toLowerCase();
    byName.set(star.id, searchText);
    return star;
  });
  return { rows, byId, byName };
}

export async function createPlanetarium({
  canvas,
  constellationSelect,
  constellationTitle,
  constellationText,
  dateInput,
  latitudeInput,
  longitudeInput,
  showBoundariesInput,
  showLinesInput,
  showLabelsInput,
  magnitudeInput,
  magnitudeValue,
  starSearchInput,
  starSearchResults,
  selectedStarOutput,
  chartStats,
  chartStatus,
  onObserverChange = () => {}
}) {
  if (!canvas) throw new Error("Night Sky canvas is missing.");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create a 2D sky chart.");

  const data = await loadCatalogues();
  const stars = buildStarMaps(data.starCatalogue.stars);
  const constellations = data.constellationCatalogue.constellations;
  const constellationByCode = new Map(constellations.map(item => [item.iau, item]));
  const edgeRows = data.constellationCatalogue.edges;
  const starDrawOrder = stars.rows.slice().sort((a, b) => b.magnitude - a.magnitude);

  let selectedCode = constellationSelect?.value || "Ori";
  if (!constellationByCode.has(selectedCode)) selectedCode = "Ori";
  let selectedStarId = null;
  let renderedStars = [];
  let cachedJD = NaN;
  let cachedStarEquatorial = [];
  let cachedBoundaries = [];
  let lastVisibleCount = 0;

  if (constellationSelect) {
    constellationSelect.replaceChildren();
    const sorted = constellations.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      const option = document.createElement("option");
      option.value = item.iau;
      option.textContent = item.name + (item.common ? " · " + item.common : "") + " (" + item.iau + ")";
      constellationSelect.append(option);
    }
    constellationSelect.value = selectedCode;
  }

  function buildEpochCache(date) {
    const jd = julianDayUTC(date);
    if (Math.abs(jd - cachedJD) < 1e-10) return;
    cachedJD = jd;
    cachedStarEquatorial = stars.rows.map(star => {
      const p = precessJ2000EquatorialToDate(star.ra, star.dec, date);
      return { star, ra: p.rightAscensionDeg, dec: p.declinationDeg };
    });
    cachedBoundaries = edgeRows.map(edge => ({
      edge,
      points: sexagesimalBoundarySamples(edge).map(([ra, dec]) =>
        precessEquatorialBetweenEpochs(ra, dec, B1875_JD, jd)
      )
    }));
  }

  function currentView(date) {
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 440;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, width);
    const h = Math.max(260, height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
      w, h, cx: w / 2, cy: h / 2,
      radius: Math.min(w, h) * 0.435,
      dpr, date,
      latitude: Number(latitudeInput?.value ?? 0),
      longitude: Number(longitudeInput?.value ?? 0)
    };
  }

  function validateObserver(view) {
    return Number.isFinite(view.latitude) && Number.isFinite(view.longitude) &&
      view.latitude >= -90 && view.latitude <= 90 &&
      view.longitude >= -180 && view.longitude <= 180 &&
      Number.isFinite(view.date.getTime());
  }

  function drawBackground(view) {
    const { w, h, cx, cy, radius } = view;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
    bg.addColorStop(0, "#112b4b");
    bg.addColorStop(.55, "#09182b");
    bg.addColorStop(1, "#030915");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Zenith-centred stereographic projection with altitude circles.
    ctx.save();
    ctx.strokeStyle = "rgba(151,194,232,.17)";
    ctx.lineWidth = 1;
    [0, 30, 60].forEach(alt => {
      const rho = Math.tan((90 - alt) * DEG / 2) / Math.tan(45 * DEG / 2);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * rho, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(170,211,245,.55)";
    ctx.lineWidth = 1.35;
    ctx.stroke();

    ctx.fillStyle = "rgba(186,211,238,.72)";
    ctx.font = "9px DM Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("ZENITH", cx, cy - 7);
    const cardinals = [
      ["N", 0], ["E", 90], ["S", 180], ["W", 270]
    ];
    for (const [label, az] of cardinals) {
      const p = stereographicProject(0, az, cx, cy, radius * 1.075);
      ctx.fillText(label, p.x, p.y + 3);
    }
    ctx.restore();
  }

  function positionFor(ra, dec, lst, view) {
    const h = horizontalCoordinates(ra, dec, lst, view.latitude);
    if (!h.aboveHorizon) return { ...h, point: null };
    return { ...h, point: stereographicProject(h.altitudeDeg, h.azimuthDeg, view.cx, view.cy, view.radius) };
  }

  function drawOfficialBoundaries(view, lst) {
    if (!showBoundariesInput?.checked) return;
    ctx.save();
    ctx.lineWidth = 0.65;
    ctx.setLineDash([3, 3]);
    for (const record of cachedBoundaries) {
      const edge = record.edge;
      const selected = edge[6] === selectedCode || edge[7] === selectedCode;
      ctx.strokeStyle = selected ? "rgba(246,204,139,.70)" : "rgba(126,165,204,.16)";
      ctx.beginPath();
      let penDown = false;
      for (const eq of record.points) {
        const p = positionFor(eq.rightAscensionDeg, eq.declinationDeg, lst, view);
        if (!p.point) {
          penDown = false;
          continue;
        }
        if (!penDown) ctx.moveTo(p.point.x, p.point.y);
        else ctx.lineTo(p.point.x, p.point.y);
        penDown = true;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawConstellationFigures(view, lst, projectedById) {
    if (!showLinesInput?.checked) return;
    ctx.save();
    for (const constellation of constellations) {
      const active = constellation.iau === selectedCode;
      for (const segment of constellation.lines) {
        ctx.beginPath();
        let penDown = false;
        let points = 0;
        for (const hip of segment.ids) {
          const p = projectedById.get(hip);
          if (!p?.point) {
            penDown = false;
            continue;
          }
          if (!penDown) ctx.moveTo(p.point.x, p.point.y);
          else ctx.lineTo(p.point.x, p.point.y);
          penDown = true;
          points++;
        }
        if (points > 1) {
          ctx.strokeStyle = active
            ? (segment.thin ? "rgba(255,213,151,.72)" : "rgba(159,224,255,.94)")
            : (segment.thin ? "rgba(124,162,196,.13)" : "rgba(137,183,219,.24)");
          ctx.lineWidth = active ? (segment.thin ? .75 : 1.55) : (segment.thin ? .45 : .75);
          ctx.setLineDash(segment.thin ? [2, 4] : []);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawStars(view, projectedById) {
    const limit = Number(magnitudeInput?.value ?? 6.5);
    const labelsOn = !!showLabelsInput?.checked;
    const visible = [];
    for (const star of starDrawOrder) {
      if (star.magnitude > limit) continue;
      const projected = projectedById.get(star.id);
      if (!projected?.point) continue;
      const point = projected.point;
      const size = clamp(2.8 - (star.magnitude + 1.4) * .29, .65, 3.5);
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fillStyle = starColour(star.bv);
      if (star.magnitude < 1.5) {
        ctx.shadowColor = starColour(star.bv);
        ctx.shadowBlur = 7;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      visible.push({ star, point, ...projected });

      if (labelsOn && (star.name && star.magnitude <= 3.2 || star.magnitude <= 1.15)) {
        const label = star.name || bayerLabel(star.bayer) + " " + star.constellation;
        if (label.trim()) {
          ctx.font = "8px DM Mono, monospace";
          ctx.textAlign = "left";
          ctx.fillStyle = star.name ? "rgba(220,237,255,.88)" : "rgba(182,205,230,.72)";
          ctx.fillText(label, point.x + 5, point.y - 4);
        }
      }
    }
    if (selectedStarId !== null) {
      const selected = projectedById.get(selectedStarId);
      if (selected?.point) {
        ctx.beginPath();
        ctx.arc(selected.point.x, selected.point.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffe2a7";
        ctx.lineWidth = 1.3;
        ctx.shadowColor = "#ffc86e";
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    renderedStars = visible;
    return visible.length;
  }

  function drawSelectedConstellation(view, projectedById) {
    const selected = constellationByCode.get(selectedCode);
    if (!selected) return;
    const ids = [...new Set(selected.lines.flatMap(segment => segment.ids))];
    const points = ids.map(id => projectedById.get(id)?.point).filter(Boolean);
    if (points.length < 2) {
      if (chartStatus) chartStatus.textContent = selected.name + " is below the local horizon at this date and time.";
      return;
    }
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    ctx.save();
    ctx.font = "600 10px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e4f5ff";
    ctx.shadowColor = "#4d9bce";
    ctx.shadowBlur = 12;
    ctx.fillText(selected.name.toUpperCase(), x, y - 13);
    ctx.restore();
    if (chartStatus) chartStatus.textContent = selected.name + " · " + selected.iau + " · selected constellation";
  }

  function renderStarDetail(star, position, view) {
    if (!selectedStarOutput) return;
    if (!star) {
      selectedStarOutput.textContent = "Select a catalogue star on the chart or search by name, Bayer designation or HIP number.";
      return;
    }
    const label = star.name || (bayerLabel(star.bayer) + " " + star.constellation).trim() || "HIP " + star.id;
    const alt = position ? position.altitudeDeg.toFixed(1) + "°" : "—";
    const az = position ? position.azimuthDeg.toFixed(1) + "°" : "—";
    const horizon = position?.aboveHorizon ? "ABOVE HORIZON" : "BELOW HORIZON";
    selectedStarOutput.textContent =
      label + " · HIP " + star.id + " · V " + star.magnitude.toFixed(2) +
      " · RA " + star.ra.toFixed(3) + "° · Dec " + star.dec.toFixed(3) +
      "° · Alt " + alt + " · Az " + az + " · " + horizon;
  }

  function searchStars(query) {
    if (!starSearchResults) return;
    starSearchResults.replaceChildren();
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) return;
    const matches = [];
    for (const star of stars.rows) {
      const haystack = stars.byName.get(star.id);
      if (haystack.includes(q)) matches.push(star);
      if (matches.length >= 10) break;
    }
    for (const star of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sky-search-result";
      const primary = star.name || (bayerLabel(star.bayer) + " " + star.constellation).trim() || "HIP " + star.id;
      button.textContent = primary + " · HIP " + star.id + " · V " + star.magnitude.toFixed(2);
      button.addEventListener("click", () => {
        selectedStarId = star.id;
        searchStars("");
        if (starSearchInput) starSearchInput.value = primary;
        render();
      });
      starSearchResults.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "sky-search-empty";
      empty.textContent = "No catalogue match. Try a Bayer name or HIP identifier.";
      starSearchResults.append(empty);
    }
  }

  function updateStarDetail() {
    if (selectedStarId === null) return;
    const star = stars.byId.get(selectedStarId);
    const projected = renderedStars.find(item => item.star.id === selectedStarId);
    renderStarDetail(star, projected, null);
  }

  function render() {
    const date = new Date(dateInput?.value || new Date());
    const view = currentView(date);
    if (!validateObserver(view)) {
      if (chartStatus) chartStatus.textContent = "Enter a valid date, latitude (−90 to 90) and longitude (−180 to 180).";
      return;
    }
    buildEpochCache(date);
    const lst = (greenwichMeanSiderealTime(date) + view.longitude + 360) % 360;
    drawBackground(view);

    const projectedById = new Map();
    for (const entry of cachedStarEquatorial) {
      const p = positionFor(entry.ra, entry.dec, lst, view);
      projectedById.set(entry.star.id, { ...p, star: entry.star });
    }

    drawOfficialBoundaries(view, lst);
    drawConstellationFigures(view, lst, projectedById);
    const visibleCount = drawStars(view, projectedById);
    drawSelectedConstellation(view, projectedById);

    if (chartStats) {
      chartStats.textContent = visibleCount.toLocaleString() + " visible stars · " +
        stars.rows.length.toLocaleString() + " catalogue entries · 88 IAU constellations";
    }
    if (magnitudeValue && magnitudeInput) magnitudeValue.textContent = Number(magnitudeInput.value).toFixed(1) + " mag";
    if (chartStatus && !chartStatus.textContent.includes("below the local horizon")) {
      chartStatus.textContent = "Stereographic zenith view · N " + lst.toFixed(1) + "° local sidereal angle";
    }

    if (selectedStarId !== null) {
      const star = stars.byId.get(selectedStarId);
      const position = projectedById.get(selectedStarId);
      renderStarDetail(star, position, view);
    }
    const selected = constellationByCode.get(selectedCode);
    if (selected && constellationSelect) constellationSelect.value = selectedCode;
    if (selected && constellationTitle) constellationTitle.textContent = selected.name + " · " + selected.iau;
    if (selected && constellationText) {
      constellationText.textContent =
        (selected.common ? selected.common + ". " : "") +
        "Official IAU sky region. Its boundary is based on Delporte's B1875.0 definition; the illustrated figure connects measured Hipparcos stars using the Stellarium Western sky culture.";
    }
    const local = date.toLocaleString();
    if (selectedStarOutput?.dataset?.placeholder !== "locked") {
      // Keep the selected-star field independent from the observing readout.
    }
    onObserverChange({ date, latitude: view.latitude, longitude: view.longitude, visibleCount, selectedConstellation: selected });
    if (chartStats) {
      chartStats.setAttribute("aria-label",
        local + "; " + visibleCount + " catalogue stars above horizon; " + selected?.name);
    }
  }

  if (constellationSelect) {
    constellationSelect.addEventListener("change", () => {
      selectedCode = constellationSelect.value;
      render();
    });
  }
  dateInput?.addEventListener("change", render);
  latitudeInput?.addEventListener("change", render);
  longitudeInput?.addEventListener("change", render);
  showBoundariesInput?.addEventListener("change", render);
  showLinesInput?.addEventListener("change", render);
  showLabelsInput?.addEventListener("change", render);
  magnitudeInput?.addEventListener("input", render);
  starSearchInput?.addEventListener("input", event => searchStars(event.target.value));
  canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.clientWidth / rect.width);
    const y = (event.clientY - rect.top) * (canvas.clientHeight / rect.height);
    let nearest = null, bestDistance = 14 * 14;
    for (const item of renderedStars) {
      const dx = item.point.x - x, dy = item.point.y - y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = item;
      }
    }
    if (nearest) {
      selectedStarId = nearest.star.id;
      render();
    }
  });

  if (chartStats) chartStats.textContent =
    stars.rows.length.toLocaleString() + " stars · " + constellations.length + " constellations · " +
    edgeRows.length + " IAU boundary edges";
  if (chartStatus) chartStatus.textContent =
    "HYG v4.4 measured stellar positions · J2000 catalogue epoch · loading observer view";
  render();

  return {
    render,
    selectConstellation(iau) {
      if (constellationByCode.has(iau)) {
        selectedCode = iau;
        if (constellationSelect) constellationSelect.value = iau;
        render();
      }
    },
    selectStar(id) {
      if (stars.byId.has(Number(id))) {
        selectedStarId = Number(id);
        render();
      }
    },
    get dataCounts() {
      return { stars: stars.rows.length, constellations: constellations.length, boundaries: edgeRows.length };
    }
  };
}
