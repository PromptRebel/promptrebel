// js/render.js
// Smooth path following state.path + tiled grass + props + start/end gates.
// Pixelart "crisp": imageSmoothingEnabled = false.

export function createRenderer({ canvas, ctx, state, assets }) {
  // Tilegröße fürs Grass-Pattern / Props-Placement (unabhängig vom Path)
  const TILE = 32;

  // Pfadbreite (px im Canvas-Koordinatensystem, NICHT dpr)
  const PATH_W = 28;

  // ---------- Deko Tuning ----------
  // Gesamt-Deko
  const DENSITY_MULT = 1.4;               // 1.0 = wie alt, 2.0 = deutlich mehr
  const PROP_SHADOW_ALPHA = 0.12;         // sehr dezent (0 => aus)

  // Bäume: nur 3x3 + 2x2
  const TREE3_SHARE = 0.70;               // Anteil der Baum-Placements, die 3x3 sind
  const TREE2_SHARE = 0.30;               // Rest 2x2

  // extra 1x1 near slots ("zwischen Slots")
  const NEAR_SLOT_RING_MIN = 1;           // Tiles Abstand vom Slot-Zentrum
  const NEAR_SLOT_RING_MAX = 3;           // Tiles Abstand
  const NEAR_SLOT_SPAWN_TRIES = 900;      // wie aggressiv gesucht wird

  // Pfad-Clearance für Props (damit nichts auf dem Weg steht)
  const PATH_CLEARANCE = (PATH_W * 0.6) + 10;

  // Start/End Gate Settings
  const START_FOG = {
    enabled: true,
    spawnRate: 28,       // Partikel / Sekunde
    max: 160,
    spread: 22,          // Spawn-Radius
    drift: 18,           // seitliches Driften
    rise: 28,            // nach oben
    alpha: 0.10,         // Grundalpha
    sizeMin: 1.0,
    sizeMax: 2.6,
  };

  const END_GLOW = {
    enabled: true,
    radius: 90,
    alpha: 0.28,
  };

  // Offscreen Background (grass + path + props + gates) wird bei rebuild neu gemalt
  const bg = document.createElement("canvas");
  const bgCtx = bg.getContext("2d");

  const setCrisp = (c) => { c.imageSmoothingEnabled = false; };

  // Fog particles state (renderer-local)
  let fog = [];
  let lastFogTs = performance.now();

  // ---------- Geometry helpers ----------
  function distPointToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const abLen2 = abx * abx + aby * aby || 1e-9;
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t, cy = ay + aby * t;
    const dx = px - cx, dy = py - cy;
    return Math.hypot(dx, dy);
  }

  function distToPolyline(px, py, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const d = distPointToSegment(px, py, a.x, a.y, b.x, b.y);
      if (d < best) best = d;
    }
    return best;
  }

  function buildSmoothPath() {
    const pts = state.path;
    if (!pts || pts.length < 2) return null;

    const path = new Path2D();
    path.moveTo(pts[0].x, pts[0].y);

    // Quadratic smoothing (midpoint technique)
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    state._smoothPath = path;
    return path;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- Start / End gate placement helpers ----------
  function getStartAnchor() {
    const pts = state.path || [];
    if (pts.length < 2) return { x: 0, y: 0 };
    // Start kann offscreen liegen; wir ziehen es leicht ins Bild
    const p0 = pts[0], p1 = pts[1];
    const x = clamp(p0.x + 128, 20, state.w - 20);
    const y = clamp(p0.y, 20, state.h - 20);

    // Richtung (für Fog-Drift grob)
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, dir: { x: dx / len, y: dy / len } };
  }

  function getEndAnchor() {
    const pts = state.path || [];
    if (pts.length < 2) return { x: state.w, y: state.h };
    const pn = pts[pts.length - 1];
    const pm = pts[pts.length - 2];

    // End kann offscreen liegen; wir ziehen es leicht ins Bild
    const x = clamp(pn.x + 76, 0, state.w - 30);
    const y = clamp(pn.y, 30, state.h - 30);

    const dx = pn.x - pm.x;
    const dy = pn.y - pm.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, dir: { x: dx / len, y: dy / len } };
  }

  // ---------- Props ----------
  function buildProps() {
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);

    const blocked = new Set();

    // Slot-Sperrzone (kleiner als vorher, damit "zwischen Slots" mehr geht)
    // Wichtig: mindestens der Slot-Tile selbst bleibt gesperrt.
    const slotPadTiles = 0;
    for (const s of state.slots) {
      const cx = Math.floor(s.x / TILE);
      const cy = Math.floor(s.y / TILE);

      // Slot selbst blocken
      blocked.add(`${cx},${cy}`);

      // optional minimal padding (0 => nix)
      for (let dy = -slotPadTiles; dy <= slotPadTiles; dy++) {
        for (let dx = -slotPadTiles; dx <= slotPadTiles; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    }

    // Start/Endbereich frei halten
    const pts = state.path || [];
    const start = pts[0];
    const end = pts[pts.length - 1];
    const protect = (p, r) => {
      if (!p) return;
      const cx = Math.floor(p.x / TILE);
      const cy = Math.floor(p.y / TILE);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    };
    protect(start, 2);
    protect(end, 2);

    const props = [];

    function reserve(x, y, sizeTiles) {
      for (let yy = 0; yy < sizeTiles; yy++) {
        for (let xx = 0; xx < sizeTiles; xx++) {
          blocked.add(`${x + xx},${y + yy}`);
        }
      }
    }

    function canPlace(x, y, sizeTiles) {
      for (let yy = 0; yy < sizeTiles; yy++) {
        for (let xx = 0; xx < sizeTiles; xx++) {
          const xx2 = x + xx, yy2 = y + yy;
          if (xx2 < 0 || yy2 < 0 || xx2 >= cols || yy2 >= rows) return false;
          if (blocked.has(`${xx2},${yy2}`)) return false;
        }
      }
      // Pfad-Abstand Check (Center)
      const wx = (x + sizeTiles / 2) * TILE;
      const wy = (y + sizeTiles / 2) * TILE;
      if (distToPolyline(wx, wy, state.path) < PATH_CLEARANCE) return false;

      return true;
    }

    function placeAt(kind, x, y, sizeTiles) {
      reserve(x, y, sizeTiles);
      props.push({
        kind,
        x: x * TILE,
        y: y * TILE,
        w: TILE * sizeTiles,
        h: TILE * sizeTiles
      });
    }

    function tryPlace(kind, tries, sizeTiles = 1) {
      for (let t = 0; t < tries; t++) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        if (!canPlace(x, y, sizeTiles)) continue;
        placeAt(kind, x, y, sizeTiles);
        return true;
      }
      return false;
    }

    // --- 1) gezielte Deko "zwischen Slots" (Ring um Slots) ---
    // Hier packen wir *nur* 1x1 Steine + 1x1 Büsche rein.
    const nearSlotCandidates = [];
    for (const s of state.slots) {
      const cx = Math.floor(s.x / TILE);
      const cy = Math.floor(s.y / TILE);

      for (let dy = -NEAR_SLOT_RING_MAX; dy <= NEAR_SLOT_RING_MAX; dy++) {
        for (let dx = -NEAR_SLOT_RING_MAX; dx <= NEAR_SLOT_RING_MAX; dx++) {
          const rr = Math.max(Math.abs(dx), Math.abs(dy));
          if (rr < NEAR_SLOT_RING_MIN || rr > NEAR_SLOT_RING_MAX) continue;

          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          nearSlotCandidates.push({ x, y });
        }
      }
    }

    // shuffle
    for (let i = nearSlotCandidates.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [nearSlotCandidates[i], nearSlotCandidates[j]] = [nearSlotCandidates[j], nearSlotCandidates[i]];
    }

    const nearCountBase = Math.floor((state.slots.length * 2.2) * DENSITY_MULT);
    let nearPlaced = 0;

    for (let i = 0; i < nearSlotCandidates.length && nearPlaced < nearCountBase; i++) {
      const { x, y } = nearSlotCandidates[i];

      // wir blocken Slot selbst schon, also ok.
      if (!canPlace(x, y, 1)) continue;

      // 60% bush, 40% rock
      const kind = (Math.random() < 0.60) ? "bush" : "rock";
      placeAt(kind, x, y, 1);
      nearPlaced++;
    }

    // --- 2) allgemeine Deko (random) ---
    // Schatzkisten 1x1
    const chestCount = Math.max(2, Math.floor(2 * DENSITY_MULT));
    for (let i = 0; i < chestCount; i++) tryPlace("chest", 900, 1);

    // Counts
    const total = cols * rows;

    // Bäume (nur 3x3 & 2x2)
    const treePlacements = Math.floor(total * 0.012 * DENSITY_MULT);
    const tree3Count = Math.floor(treePlacements * TREE3_SHARE);
    const tree2Count = Math.floor(treePlacements * TREE2_SHARE);

    // Büsche 1x1 allgemein
    const bushCount = Math.floor(total * 0.015 * DENSITY_MULT);

    // Steine: 2x2 plus 1x1 allgemein
    const rock2Count = Math.floor(total * 0.007 * DENSITY_MULT);
    const rock1Count = Math.floor(total * 0.010 * DENSITY_MULT);

    for (let i = 0; i < tree3Count; i++) tryPlace("tree", 1200, 3);
    for (let i = 0; i < tree2Count; i++) tryPlace("tree", 1000, 2);

    for (let i = 0; i < bushCount; i++) tryPlace("bush", 800, 1);

    for (let i = 0; i < rock2Count; i++) tryPlace("rock", 1200, 2);
    for (let i = 0; i < rock1Count; i++) tryPlace("rock", 900, 1);

    state._props = props;
  }

  // ---------- Background draw ----------
  function drawGrass(ctx2) {
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const gx = x * TILE, gy = y * TILE;
        if (assets?.tiles?.grass) {
          setCrisp(ctx2);
          ctx2.drawImage(assets.tiles.grass, gx, gy, TILE, TILE);
        } else {
          // fallback dark checker
          ctx2.fillStyle = ((x + y) & 1) ? "rgba(2,6,23,0.92)" : "rgba(2,6,23,0.86)";
          ctx2.fillRect(gx, gy, TILE, TILE);
        }
      }
    }
  }

  function drawSmoothRoad(ctx2) {
    const path = state._smoothPath || buildSmoothPath();
    if (!path) return;

    ctx2.save();
    ctx2.lineJoin = "round";
    ctx2.lineCap = "round";

    // body
    ctx2.strokeStyle = "rgba(148,163,184,0.16)";
    ctx2.lineWidth = PATH_W;
    ctx2.stroke(path);

    // inner highlight
    ctx2.strokeStyle = "rgba(226,232,240,0.08)";
    ctx2.lineWidth = Math.max(6, PATH_W * 0.55);
    ctx2.stroke(path);

    // edge hint
    ctx2.strokeStyle = "rgba(34,211,238,0.08)";
    ctx2.lineWidth = Math.max(2, PATH_W * 0.10);
    ctx2.stroke(path);

    ctx2.restore();
  }

  function drawStartEndGates(ctx2) {
    const startImg = assets?.props?.startCave;
    const endImg = assets?.props?.endGate;

    const s = getStartAnchor();
    const e = getEndAnchor();

    // Start cave: leicht links versetzen (weil Pfad oft offscreen links beginnt)
    if (startImg) {
      const w = 96;   // 3x3 tiles (optisch)
      const h = 96;
      const x = clamp(s.x - 40, 0, state.w - w);
      const y = clamp(s.y - h / 2, 0, state.h - h);

      setCrisp(ctx2);
      ctx2.drawImage(startImg, x, y, w, h);

      state._startCaveAnchor = { x: x + w * 0.62, y: y + h * 0.55, dir: s.dir };
    } else {
      state._startCaveAnchor = { x: s.x, y: s.y, dir: s.dir };
    }

    // End gate: platzieren am Ende (unten/rechts) und Glow danach im FG zeichnen
    if (endImg) {
      const w = 110;
      const h = 110;
      const x = clamp(e.x - w * 0.55, 0, state.w - w);
      const y = clamp(e.y - h * 0.60, 0, state.h - h);

      setCrisp(ctx2);
      ctx2.drawImage(endImg, x, y, w, h);

      state._endGateAnchor = { x: x + w * 0.52, y: y + h * 0.55 };
    } else {
      state._endGateAnchor = { x: e.x, y: e.y };
    }
  }

  function drawProps(ctx2) {
    for (const p of (state._props || [])) {
      const img = assets?.props?.[p.kind];

      // optional subtle shadow
      if (PROP_SHADOW_ALPHA > 0) {
        ctx2.save();
        ctx2.globalAlpha = PROP_SHADOW_ALPHA;
        ctx2.fillStyle = "black";
        ctx2.beginPath();
        ctx2.ellipse(
          p.x + p.w * 0.55,
          p.y + p.h * 0.82,
          p.w * 0.34,
          p.h * 0.16,
          0, 0, Math.PI * 2
        );
        ctx2.fill();
        ctx2.restore();
      }

      if (img) {
        setCrisp(ctx2);
        ctx2.drawImage(img, p.x, p.y, p.w, p.h);
      } else {
        ctx2.fillStyle = "rgba(148,163,184,0.22)";
        ctx2.fillRect(p.x + 6, p.y + 6, p.w - 12, p.h - 12);
      }
    }
  }

  function buildBackground() {
    bg.width = Math.ceil(state.w);
    bg.height = Math.ceil(state.h);
    setCrisp(bgCtx);

    bgCtx.clearRect(0, 0, bg.width, bg.height);

    drawGrass(bgCtx);
    buildSmoothPath();
    drawSmoothRoad(bgCtx);

    // Gates werden ins Background gebacken (statisch)
    drawStartEndGates(bgCtx);

    // Props
    drawProps(bgCtx);
  }

  function rebuild() {
    buildSmoothPath();
    buildProps();
    buildBackground();

    // Fog reset (optional)
    fog = [];
    lastFogTs = performance.now();
  }

  // ---------- Foreground draw ----------
  function drawBackground() {
    setCrisp(ctx);
    ctx.drawImage(bg, 0, 0);
  }

  function drawSlots() {
    for (const s of state.slots) {
      const isHovered = state.selectedType && !s.occupied;

      ctx.save();
      ctx.lineWidth = isHovered ? 2.5 : 2;

      if (s.occupied) {
        ctx.strokeStyle = "rgba(148,163,184,0.18)";
        ctx.fillStyle = "rgba(0,0,0,0)";
      } else if (isHovered) {
        ctx.strokeStyle = "rgba(34,211,238,0.55)";
        ctx.fillStyle = "rgba(34,211,238,0.06)";
      } else {
        ctx.strokeStyle = "rgba(148,163,184,0.10)";
        ctx.fillStyle = "rgba(148,163,184,0.03)";
      }

      ctx.beginPath();
      ctx.roundRect(s.x - 20, s.y - 20, 40, 40, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemies(now) {
    for (const e of state.enemies) {
      const img = assets?.enemies?.[e.type];
      const isSlowed = e.slowEnd > now;

      const w = Math.max(24, e.size * 2.6);
      const h = w;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, e.x - w / 2, e.y - h / 2, w, h);
      } else {
        const color = isSlowed ? "#a78bfa" : (e.isBoss ? "#f43f5e" : (e.type === "fast" ? "#22d3ee" : "#fb7185"));
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        if (e.shape === "circle") {
          ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.roundRect(e.x - e.size, e.y - e.size, e.size * 2, e.size * 2, 4); ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // HP bar (nur für echte Enemies aus state.enemies!)
      const hpPct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(e.x - 16, e.y - (h / 2) - 10, 32, 4);
      ctx.fillStyle = hpPct > 0.5 ? "#10b981" : (hpPct > 0.2 ? "#f59e0b" : "#ef4444");
      ctx.fillRect(e.x - 16, e.y - (h / 2) - 10, 32 * hpPct, 4);
    }
  }

  function drawTowers() {
    for (const t of state.towers) {
      const img = assets?.towers?.[t.id];

      // deine großen Tower-PNGs
      const w = 96, h = 120;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, t.x - w / 2, t.y - h / 2, w, h);
      } else {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = t.color;
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(t.icon, 0, 6);
        ctx.restore();
      }

      // Level pips
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = "rgba(226,232,240,0.8)";
      for (let i = 0; i < Math.min(t.level, 10); i++) {
        ctx.beginPath();
        ctx.arc(-14 + (i * 3.3), 18, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const p of state.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Start fog + End glow (foreground overlay) ----------
  function spawnFog(dt) {
    if (!START_FOG.enabled) return;
    const a = state._startCaveAnchor || getStartAnchor();
    const want = START_FOG.spawnRate * dt;
    let n = want;
    while (n > 0) {
      if (fog.length >= START_FOG.max) break;
      if (Math.random() < n) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * START_FOG.spread;
        const x = a.x + Math.cos(ang) * r;
        const y = a.y + Math.sin(ang) * r;

        fog.push({
          x, y,
          vx: (Math.random() - 0.5) * START_FOG.drift + (a.dir?.x || 1) * 8,
          vy: -Math.random() * START_FOG.rise + (a.dir?.y || 0) * 6,
          life: 0.8 + Math.random() * 1.3,
          size: START_FOG.sizeMin + Math.random() * (START_FOG.sizeMax - START_FOG.sizeMin),
          a: START_FOG.alpha + Math.random() * 0.10
        });
      }
      n -= 1;
    }
  }

  function updateFog(dt) {
    for (let i = fog.length - 1; i >= 0; i--) {
      const p = fog[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - dt * 0.8);
      p.vy *= (1 - dt * 0.3);

      if (p.life <= 0) fog.splice(i, 1);
    }
  }

  function drawFog(now) {
    if (!START_FOG.enabled) return;
    // soft dots
    for (const p of fog) {
      const t = Math.max(0, Math.min(1, p.life));
      ctx.globalAlpha = p.a * t;

      // leicht "milchig" statt knallweiß
      ctx.fillStyle = "rgba(226,232,240,1)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEndGlow() {
    if (!END_GLOW.enabled) return;
    const g = state._endGateAnchor;
    if (!g) return;

    const r = END_GLOW.radius;
    const grd = ctx.createRadialGradient(g.x, g.y, 6, g.x, g.y, r);
    grd.addColorStop(0, `rgba(167,139,250,${END_GLOW.alpha})`);     // violet
    grd.addColorStop(0.55, `rgba(34,211,238,${END_GLOW.alpha * 0.35})`); // cyan hint
    grd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRange() {
    if (!state.activeTower) return;
    ctx.beginPath();
    ctx.arc(state.activeTower.x, state.activeTower.y, state.activeTower.range, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.fill();
    ctx.setLineDash([]);
  }

  function drawFrame() {
    // dt für Fog aus Zeit ableiten
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFogTs) / 1000);
    lastFogTs = now;

    spawnFog(dt);
    updateFog(dt);

    ctx.clearRect(0, 0, state.w, state.h);
    drawBackground();
    drawSlots();

    drawEnemies(now);
    drawTowers();
    drawProjectiles();
    drawParticles();

    // overlays
    drawEndGlow();
    drawFog(now);

    drawRange();
  }

  return { rebuild, drawFrame, TILE };
}
