// js/render.js
// Smooth path + props + start/end gates (with fog + glow)
// Works with assets.js keys:
//   assets.props.startGate  -> "assets/props/start_gate.png"
//   assets.props.endGate    -> "assets/props/end_gate.png"

export function createRenderer({ canvas, ctx, state, assets }) {
  const TILE = 32;
  const PATH_W = 28;

  // ---- Deco tuning (reduziert!) ----
  const DENSITY = 0.75; // <— weniger als vorher
  const PROP_SHADOW_ALPHA = 0.10;

  // Trees (2x2/3x3), no 1x1 trees
  const TREE3_FACTOR = 0.007 * DENSITY;
  const TREE2_FACTOR = 0.004 * DENSITY;

  // Base scatter (few)
  const BUSH_BASE_FACTOR = 0.006 * DENSITY; // 1x1
  const ROCK_BASE_FACTOR = 0.004 * DENSITY; // 1x1
  const CHEST_FACTOR     = 0.002 * DENSITY;

  // “Between slots” props (very few)
  const BETWEEN_MAX = 8;               // absolute cap
  const BETWEEN_BUSH_RATIO = 0.55;     // rest rocks
  const SLOT_PAD_CORE = 1;             // tiles blocked around slot
  const SLOT_RING_MIN = 2;             // place near slot but not on it
  const SLOT_RING_MAX = 3;

  // Path clearance
  const PATH_CLEARANCE = (PATH_W * 0.6) + 12;

  // Gate size
  const START_GATE_W = 124;
  const START_GATE_H = 212;
  const END_GATE_W   = 110;
  const END_GATE_H   = 184;

  // Start fog particles
  const FOG = {
    enabled: true,
    spawnRate: 26,     // per second
    max: 140,
    spread: 18,        // spawn radius
    drift: 18,
    push: 12,          // push along path dir
    rise: 20,          // slight upward
    alpha: 0.10,
    sizeMin: 1.0,
    sizeMax: 2.4,
    lifeMin: 0.9,
    lifeMax: 1.8
  };

  // End glow aura
  const GLOW = {
    enabled: true,
    radius: 85,
    alpha: 0.26
  };

  // Offscreen background cache
  const bg = document.createElement("canvas");
  const bgCtx = bg.getContext("2d");

  const setCrisp = (c) => { c.imageSmoothingEnabled = false; };

  // fog state (renderer-local)
  let fog = [];
  let lastTs = performance.now();

  // ---------- Geometry helpers ----------
  function distPointToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const abLen2 = abx * abx + aby * aby || 1e-9;
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t, cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
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

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function dirFromTo(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, ang: Math.atan2(dy, dx) };
  }

  function buildSmoothPath() {
    const pts = state.path;
    if (!pts || pts.length < 2) return null;

    const path = new Path2D();
    path.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    state._smoothPath = path;
    return path;
  }

  // ---------- Gate anchors that NEVER go offscreen ----------
  function getStartAnchor() {
    const pts = state.path || [];
    if (pts.length < 2) return { x: 60, y: state.h * 0.5, dir: { x: 1, y: 0 } };

    const p0 = pts[0], p1 = pts[1];
    const dir = dirFromTo(p0, p1);

    // “pull into view”: put start gate near left side if path starts offscreen
    const x = clamp(p0.x - 170, - 60, state.w - 70);
    // deutlich höher
const y = clamp(p0.y + 20, 70, state.h - 70);

    return { x, y, dir };
  }

  function getEndAnchor() {
    const pts = state.path || [];
    if (pts.length < 2) return { x: state.w - 60, y: state.h - 60, dir: { x: 1, y: 0 } };

    const pn = pts[pts.length - 1];
    const pm = pts[pts.length - 2];
    const dir = dirFromTo(pm, pn);

    // “push into view”: move slightly to the right/down but clamp to canvas
    const x = clamp(pn.x + 140, 0, state.w - 80);
    const y = clamp(pn.y, 10, state.h - 10);

    return { x, y, dir };
  }

  // ---------- Props placement ----------
  function buildProps() {
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);

    const blocked = new Set();
    const props = [];

    const pts = state.path || [];
    const start = pts[0];
    const end = pts[pts.length - 1];

    // block around slots
    for (const s of state.slots) {
      const cx = Math.floor(s.x / TILE);
      const cy = Math.floor(s.y / TILE);
      for (let dy = -SLOT_PAD_CORE; dy <= SLOT_PAD_CORE; dy++) {
        for (let dx = -SLOT_PAD_CORE; dx <= SLOT_PAD_CORE; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    }

    // protect start/end zone
    function protectPoint(p, r) {
      if (!p) return;
      const cx = Math.floor(p.x / TILE);
      const cy = Math.floor(p.y / TILE);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
      }
    }
    protectPoint(start, 2);
    protectPoint(end, 2);

    function footprintFree(x, y, sizeTiles) {
      for (let yy = 0; yy < sizeTiles; yy++) {
        for (let xx = 0; xx < sizeTiles; xx++) {
          if (blocked.has(`${x+xx},${y+yy}`)) return false;
        }
      }
      return true;
    }

    function reserve(x, y, sizeTiles) {
      for (let yy = 0; yy < sizeTiles; yy++) {
        for (let xx = 0; xx < sizeTiles; xx++) blocked.add(`${x+xx},${y+yy}`);
      }
    }

    function farFromPath(x, y, sizeTiles) {
      const wx = (x + sizeTiles / 2) * TILE;
      const wy = (y + sizeTiles / 2) * TILE;
      return distToPolyline(wx, wy, state.path) >= PATH_CLEARANCE;
    }

    function tryPlace(kind, tries, sizeTiles) {
      for (let t = 0; t < tries; t++) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);
        if (!footprintFree(x, y, sizeTiles)) continue;
        if (!farFromPath(x, y, sizeTiles)) continue;

        reserve(x, y, sizeTiles);
        props.push({ kind, x: x*TILE, y: y*TILE, w: TILE*sizeTiles, h: TILE*sizeTiles });
        return true;
      }
      return false;
    }

    // base counts
    const total = cols * rows;

    const chestCount = Math.max(1, Math.floor(total * CHEST_FACTOR));
    for (let i = 0; i < chestCount; i++) tryPlace("chest", 900, 1);

    const tree3Count = Math.min(10, Math.floor(total * TREE3_FACTOR));
    const tree2Count = Math.min(8,  Math.floor(total * TREE2_FACTOR));
    for (let i = 0; i < tree3Count; i++) tryPlace("tree", 1600, 3);
    for (let i = 0; i < tree2Count; i++) tryPlace("tree", 1200, 2);

    const bushBase = Math.min(14, Math.floor(total * BUSH_BASE_FACTOR));
    const rockBase = Math.min(10, Math.floor(total * ROCK_BASE_FACTOR));
    for (let i = 0; i < bushBase; i++) tryPlace("bush", 800, 1);
    for (let i = 0; i < rockBase; i++) tryPlace("rock", 800, 1);

    // between slots: ring candidates (few)
    const candidates = [];
    for (const s of state.slots) {
      const cx = Math.floor(s.x / TILE);
      const cy = Math.floor(s.y / TILE);
      for (let dy = -SLOT_RING_MAX; dy <= SLOT_RING_MAX; dy++) {
        for (let dx = -SLOT_RING_MAX; dx <= SLOT_RING_MAX; dx++) {
          const rr = Math.max(Math.abs(dx), Math.abs(dy));
          if (rr < SLOT_RING_MIN || rr > SLOT_RING_MAX) continue;
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          candidates.push({ x, y });
        }
      }
    }

    // shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const betweenBush = Math.floor(BETWEEN_MAX * BETWEEN_BUSH_RATIO);
    const betweenRock = BETWEEN_MAX - betweenBush;

    function placeFromCandidates(kind, maxCount) {
      let placed = 0;
      for (let i = 0; i < candidates.length && placed < maxCount; i++) {
        const { x, y } = candidates[i];
        if (!footprintFree(x, y, 1)) continue;

        const wx = (x + 0.5) * TILE;
        const wy = (y + 0.5) * TILE;
        if (distToPolyline(wx, wy, state.path) < PATH_CLEARANCE) continue;

        reserve(x, y, 1);
        props.push({ kind, x: x*TILE, y: y*TILE, w: TILE, h: TILE });
        placed++;
      }
    }

    placeFromCandidates("bush", betweenBush);
    placeFromCandidates("rock", betweenRock);

    state._props = props;
  }

  // ---------- Background draw ----------
  function drawGrass(ctx2) {
  const cols = Math.ceil(state.w / TILE);
  const rows = Math.ceil(state.h / TILE);

  // 1) Base-fill: verhindert sichtbare "Lücken", falls Tile Transparenz hat
  ctx2.save();
  ctx2.fillStyle = "rgba(8, 20, 16, 1)"; // dunkles Grün als Untergrund
  ctx2.fillRect(0, 0, state.w, state.h);
  ctx2.restore();

  // 2) Tiles zeichnen – mit minimaler Überlappung gegen 1px-Seams
  const img = assets?.tiles?.grass;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const gx = Math.round(x * TILE);
      const gy = Math.round(y * TILE);

      if (img) {
        setCrisp(ctx2);
        // +1 Pixel Überlappung (rechts/unten), damit keine Hairline-Gaps entstehen
        ctx2.drawImage(img, gx, gy, TILE + 1, TILE + 1);
      } else {
        ctx2.fillStyle = ((x + y) & 1) ? "rgba(2,6,23,0.92)" : "rgba(2,6,23,0.86)";
        ctx2.fillRect(gx, gy, TILE + 30, TILE + 30);
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

    ctx2.strokeStyle = "rgba(148,163,184,0.16)";
    ctx2.lineWidth = PATH_W;
    ctx2.stroke(path);

    ctx2.strokeStyle = "rgba(226,232,240,0.08)";
    ctx2.lineWidth = Math.max(6, PATH_W * 0.55);
    ctx2.stroke(path);

    ctx2.strokeStyle = "rgba(34,211,238,0.08)";
    ctx2.lineWidth = Math.max(2, PATH_W * 0.10);
    ctx2.stroke(path);

    ctx2.restore();
  }

  function drawProps(ctx2) {
    for (const p of (state._props || [])) {
      const img = assets?.props?.[p.kind];

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

  function drawGatesToBackground(ctx2) {
    const startImg = assets?.props?.startGate;
    const endImg   = assets?.props?.endGate;

    const s = getStartAnchor();
    const e = getEndAnchor();

    // Start gate (in background)
    if (startImg) {
      const x = clamp(s.x - START_GATE_W * 0.55, -START_GATE_W * 0.40, state.w - START_GATE_W);
      const y = clamp(s.y - START_GATE_H * 0.55, -START_GATE_H * 0.6, state.h - START_GATE_H);
      setCrisp(ctx2);
      ctx2.drawImage(startImg, x, y, START_GATE_W, START_GATE_H);

      // anchor for fog (coming out of the opening)
      state._startGateAnchor = { x: x + START_GATE_W * 0.70, y: y + START_GATE_H * 0.58, dir: s.dir };
    } else {
      state._startGateAnchor = { x: s.x, y: s.y, dir: s.dir };
    }

    // End gate (in background)
    if (endImg) {
      const x = clamp(e.x - END_GATE_W * 0.55, 0, state.w - END_GATE_W);
      const y = clamp(s.y - START_GATE_H * 0.55, -START_GATE_H * 0.6, state.h - START_GATE_H);
      setCrisp(ctx2);
      ctx2.drawImage(endImg, x, y, END_GATE_W, END_GATE_H);

      state._endGateAnchor = { x: x + END_GATE_W * 0.52, y: y + END_GATE_H * 0.58 };
    } else {
      state._endGateAnchor = { x: e.x, y: e.y };
    }

    // flags for FX
    state._gateFlags = { hasStart: !!startImg, hasEnd: !!endImg };
  }

  function buildBackground() {
    bg.width = Math.ceil(state.w);
    bg.height = Math.ceil(state.h);
    setCrisp(bgCtx);

    bgCtx.clearRect(0, 0, bg.width, bg.height);

    drawGrass(bgCtx);
    buildSmoothPath();
    drawSmoothRoad(bgCtx);
    drawGatesToBackground(bgCtx); // IMPORTANT: before props, so props can overlap if needed
    drawProps(bgCtx);
  }

  function rebuild() {
    buildSmoothPath();
    buildProps();
    buildBackground();

    // reset fog
    fog = [];
    lastTs = performance.now();
  }

  // ---------- Foreground (fog + glow) ----------
  function spawnFog(dt) {
    if (!FOG.enabled) return;
    if (!state._gateFlags?.hasStart) return;

    const a = state._startGateAnchor || getStartAnchor();
    const want = FOG.spawnRate * dt;
    let n = want;

    while (n > 0) {
      if (fog.length >= FOG.max) break;
      if (Math.random() < n) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * FOG.spread;
        const x = a.x + Math.cos(ang) * r;
        const y = a.y + Math.sin(ang) * r;

        const life = FOG.lifeMin + Math.random() * (FOG.lifeMax - FOG.lifeMin);
        const size = FOG.sizeMin + Math.random() * (FOG.sizeMax - FOG.sizeMin);

        fog.push({
          x, y,
          vx: (Math.random() - 0.5) * FOG.drift + (a.dir?.x || 1) * FOG.push,
          vy: (Math.random() - 0.2) * 6 - FOG.rise + (a.dir?.y || 0) * 6,
          life,
          maxLife: life,
          size,
          a: FOG.alpha + Math.random() * 0.10
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

  function drawFog() {
    if (!FOG.enabled) return;
    if (!state._gateFlags?.hasStart) return;

    for (const p of fog) {
      const t = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = p.a * t;
      ctx.fillStyle = "rgba(226,232,240,1)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEndGlow(now) {
    if (!GLOW.enabled) return;
    if (!state._gateFlags?.hasEnd) return;

    const g = state._endGateAnchor;
    if (!g) return;

    const pulse = 0.65 + 0.35 * Math.sin(now * 0.004);
    const r = GLOW.radius * (0.92 + 0.18 * pulse);

    const grad = ctx.createRadialGradient(g.x, g.y, 6, g.x, g.y, r);
    grad.addColorStop(0, `rgba(167,139,250,${GLOW.alpha})`);
    grad.addColorStop(0.55, `rgba(34,211,238,${GLOW.alpha * 0.35})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- Existing draws ----------
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
      const w = Math.max(24, e.size * 2.6);
      const h = w;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, e.x - w / 2, e.y - h / 2, w, h);
      } else {
        ctx.fillStyle = "#fb7185";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const hpPct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(e.x - 16, e.y - (h/2) - 10, 32, 4);
      ctx.fillStyle = hpPct > 0.5 ? "#10b981" : (hpPct > 0.2 ? "#f59e0b" : "#ef4444");
      ctx.fillRect(e.x - 16, e.y - (h/2) - 10, 32 * hpPct, 4);
    }
  }

  function drawTowers() {
    for (const t of state.towers) {
      const img = assets?.towers?.[t.id];
      const w = 96, h = 120;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, t.x - w/2, t.y - h/2, w, h);
      }
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
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;

    spawnFog(dt);
    updateFog(dt);

    ctx.clearRect(0, 0, state.w, state.h);

    drawBackground();

    // FX overlays (below enemies is fine; looks good)
    drawEndGlow(now);
    drawFog();

    drawSlots();
    drawEnemies(now);
    drawTowers();
    drawProjectiles();
    drawParticles();
    drawRange();
  }

  return { rebuild, drawFrame, TILE };
}
