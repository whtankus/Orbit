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
  let zoomFactor = 1;

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
      radius: Math.min(w, h) * 0.405 * zoomFactor,
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

    // Layered twilight-blue field with a subtle luminous centre.
    const bg = ctx.createRadialGradient(cx, cy * .82, 0, cx, cy, radius * 1.65);
    bg.addColorStop(0, "#1b456b");
    bg.addColorStop(.42, "#102b49");
    bg.addColorStop(.78, "#07182d");
    bg.addColorStop(1, "#020812");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // A restrained background star field makes the chart read as a sky dome.
    ctx.save();
    for (let i = 0; i < 130; i++) {
      const x = ((i * 197.3) % 997) / 997 * w;
      const y = ((i * 317.7 + 41) % 991) / 991 * h;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > radius * radius * .96) continue;
      const size = i % 17 === 0 ? 1.35 : i % 5 === 0 ? .8 : .45;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = i % 7 === 0 ? "rgba(255,222,174,.8)" : "rgba(206,231,255,.68)";
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    // Altitude rings: 60° close to zenith, then 30°, then the 0° horizon rim.
    const rings = [
      { altitude: 60, label: "60°", alpha: .28 },
      { altitude: 30, label: "30°", alpha: .34 }
    ];
    for (const ring of rings) {
      const rho = Math.tan((90 - ring.altitude) * DEG / 2) / Math.tan(45 * DEG);
      const r = radius * rho;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(177,218,248," + ring.alpha + ")";
      ctx.lineWidth = 1.1;
      ctx.setLineDash([5, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "600 12px Space Grotesk, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(213,235,255,.9)";
      ctx.fillText(ring.label, cx - r + 20, cy - 8);
    }

    // The outer circle is the local horizon, not the edge of the universe.
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(164,220,255,.78)";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.shadowColor = "#69caff";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Compass ticks and four cardinal directions.
    for (let degree = 0; degree < 360; degree += 5) {
      const angle = degree * DEG;
      const major = degree % 30 === 0;
      const inner = radius * (major ? .965 : .982);
      const outer = radius * .998;
      const x1 = cx + Math.sin(angle) * inner;
      const y1 = cy - Math.cos(angle) * inner;
      const x2 = cx + Math.sin(angle) * outer;
      const y2 = cy - Math.cos(angle) * outer;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = major ? "rgba(211,235,255,.72)" : "rgba(174,207,236,.28)";
      ctx.lineWidth = major ? 1.4 : .7;
      ctx.stroke();
    }

    ctx.font = "700 15px Space Grotesk, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cardinals = [
      ["N", 0, "#c6edff"], ["E", 90, "#d5e8ff"],
      ["S", 180, "#d5e8ff"], ["W", 270, "#d5e8ff"]
    ];
    for (const [label, az, colour] of cardinals) {
      const p = stereographicProject(0, az, cx, cy, radius * 1.065);
      ctx.fillStyle = colour;
      ctx.shadowColor = "#72cfff";
      ctx.shadowBlur = label === "N" ? 9 : 0;
      ctx.fillText(label, p.x, p.y);
    }
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";

    // The centre is the point directly above the observer.
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f5fbff";
    ctx.shadowColor = "#9edfff";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(222,241,255,.96)";
    ctx.fillText("STRAIGHT UP", cx, cy - 13);
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.fillStyle = "rgba(216,234,250,.82)";
    ctx.fillText("HORIZON · 0°", cx, cy + radius - 12);
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
      // Show only the active IAU region. Rendering all 88 borders at once
      // turns the local sky into a dense web that obscures the star figures.
      if (!selected) continue;
      ctx.strokeStyle = "rgba(246,204,139,.48)";
      ctx.lineWidth = 1.05;
      ctx.setLineDash([5, 5]);
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
    const selected = constellationByCode.get(selectedCode);
    if (!selected) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const segment of selected.lines) {
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
        ctx.strokeStyle = segment.thin ? "rgba(255,205,139,.82)" : "rgba(151,220,255,.96)";
        ctx.lineWidth = segment.thin ? 1.05 : 2.15;
        ctx.shadowColor = segment.thin ? "#f4bd78" : "#6bcfff";
        ctx.shadowBlur = segment.thin ? 5 : 9;
        ctx.setLineDash(segment.thin ? [3, 4] : []);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawStars(view, projectedById) {
    const limit = Number(magnitudeInput?.value ?? 6.5);
    const labelsOn = !!showLabelsInput?.checked;
    const selected = constellationByCode.get(selectedCode);
    const selectedIds = new Set(selected?.lines.flatMap(segment => segment.ids) || []);
    const visible = [];
    const labelAnchors = [];
    for (const star of starDrawOrder) {
      if (star.magnitude > limit) continue;
      const projected = projectedById.get(star.id);
      if (!projected?.point) continue;
      const point = projected.point;
      const size = clamp(5.2 - (star.magnitude + 1.4) * .53, 1.1, 5.7);
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fillStyle = starColour(star.bv);
      if (star.magnitude < 1.5) {
        ctx.shadowColor = starColour(star.bv);
        ctx.shadowBlur = star.magnitude < .5 ? 13 : 9;
      } else ctx.shadowBlur = 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      visible.push({ star, point, ...projected });

      // Labels are deliberately sparse: named bright stars, plus a few
      // brighter members of the selected figure. Avoid overlapping names.
      const eligible = labelsOn && (
        (star.name && star.magnitude <= 2.2) ||
        (selectedIds.has(star.id) && star.magnitude <= 2.8)
      );
      if (eligible) {
        const label = star.name || (bayerLabel(star.bayer) + " " + star.constellation).trim();
        const x = point.x + 9, y = point.y - 7;
        const width = Math.min(130, label.length * 6.8);
        const collides = labelAnchors.some(a => Math.abs(a.x - x) < (a.w + width) * .42 && Math.abs(a.y - y) < 17);
        if (label && !collides) {
          labelAnchors.push({ x, y, w: width });
          ctx.font = "600 11px Space Grotesk, sans-serif";
          ctx.textAlign = "left";
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = "rgba(2,8,18,.96)";
          ctx.strokeText(label, x, y);
          ctx.fillStyle = star.name ? "rgba(240,248,255,.98)" : "rgba(211,229,246,.9)";
          ctx.fillText(label, x, y);
        }
      }
    }
    if (selectedStarId !== null) {
      const selected = projectedById.get(selectedStarId);
      if (selected?.point) {
        ctx.beginPath();
        ctx.arc(selected.point.x, selected.point.y, 11, 0, Math.PI * 2);
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
    ctx.font = "600 12px Space Grotesk, sans-serif";
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
      label + "\n" + horizon + "\nAltitude: " + alt + " · Direction: " + az +
      "\nBrightness: magnitude " + star.magnitude.toFixed(2) +
      "\nCatalogue: HIP " + star.id + " · RA " + star.ra.toFixed(3) +
      "° · Dec " + star.dec.toFixed(3) + "°";
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
      chartStatus.textContent = "Showing stars above your horizon · North is at the top · Local sky rotation " + lst.toFixed(1) + "°";
    }

    if (selectedStarId !== null) {
      const star = stars.byId.get(selectedStarId);
      const position = projectedById.get(selectedStarId);
      renderStarDetail(star, position, view);
    }
    const selected = constellationByCode.get(selectedCode);
    if (selected && constellationSelect) constellationSelect.value = selectedCode;
    if (selected && constellationTitle) constellationTitle.textContent = selected.name + " · " + selected.iau;
    document.querySelectorAll("[data-sky-constellation]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.skyConstellation === selectedCode));
    });
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
    zoom(delta) {
      zoomFactor = clamp(zoomFactor + Number(delta || 0), 0.78, 1.34);
      render();
      return zoomFactor;
    },
    resetZoom() {
      zoomFactor = 1;
      render();
      return zoomFactor;
    },
    get zoomFactor() { return zoomFactor; },
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
