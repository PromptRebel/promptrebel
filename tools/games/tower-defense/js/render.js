// js/render.js
// Smooth path exactly following state.path (enemy route), plus tiled grass + props.
// Pixelart-Assets werden "crisp" gerendert über imageSmoothingEnabled=false.

export function createRenderer({ canvas, ctx, state, assets }) {
  // Tilegröße fürs Grass-Pattern / Props-Placement (unabhängig vom Path)
  const TILE = 32;

  // Pfadbreite (px im Canvas-Koordinatensystem, NICHT dpr)
  const PATH_W = 28;

  // ---------- Deko-Tuning ----------
  // Props-Schatten (sehr dezent). Wenn du KEINE Props-Schatten willst: 0.
  const PROP_SHADOW_ALPHA = 0.10;

  // Mindestabstand vom Pfad (damit nichts auf dem Weg steht)
  const PATH_CLEARANCE = (PATH_W * 0.6) + 10;

  // Deko-Dichte (anpassen nach Geschmack)
  // Werte sind "Anteil von total tiles" (cols*rows). 0.02 = 2% der Tiles als Objekte (über tries verteilt).
  const DENSITY = {
    chest: 0.006,     // 1x1
    tree3: 0.010,     // 3x3
    tree2: 0.014,     // 2x2
    bush:  0.020,     // 1x1
    rock2: 0.014      // 2x2
  };

  // Offscreen Background (grass + path + props) wird bei rebuild neu gemalt
  const bg = document.createElement("canvas");
  const bgCtx = bg.getContext("2d");

  const setCrisp = (c) => { c.imageSmoothingEnabled = false; };

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

  // ---------- Props ----------
  function buildProps() {
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);

    const blocked = new Set();

    // block slots (um Tower-Nodes herum Platz lassen)
    const slotPadTiles = 1;
    for (const s of state.slots) {
      const cx = Math.floor(s.x / TILE);
      const cy = Math.floor(s.y / TILE);
      for (let dy = -slotPadTiles; dy <= slotPadTiles; dy++) {
        for (let dx = -slotPadTiles; dx <= slotPadTiles; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    }

    // block start/end a bit (aber NICHT alle Path-Points blocken!)
    const keepClear = (p, pad) => {
      const cx = Math.floor(p.x / TILE);
      const cy = Math.floor(p.y / TILE);
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    };
    if (state.path?.length) {
      keepClear(state.path[0], 2);
      keepClear(state.path[1] || state.path[0], 2);
      keepClear(state.path[state.path.length - 1], 2);
      keepClear(state.path[state.path.length - 2] || state.path[state.path.length - 1], 2);
    }

    const props = [];

    function canPlace(x, y, sizeTiles) {
      // bounds (wichtig für 2x2/3x3!)
      if (x < 0 || y < 0 || (x + sizeTiles) > cols || (y + sizeTiles) > rows) return false;

      // footprint blocked?
      for (let yy = 0; yy < sizeTiles; yy++) {
        for (let xx = 0; xx < sizeTiles; xx++) {
          if (blocked.has(`${x + xx},${y + yy}`)) return false;
        }
      }

      // Abstand zum Pfad (center of footprint)
      const wx = (x + sizeTiles / 2) * TILE;
      const wy = (y + sizeTiles / 2) * TILE;
      if (distToPolyline(wx, wy, state.path) < PATH_CLEARANCE) return false;

      return true;
    }

    function reserve(x, y, sizeTiles) {
      for (let yy = 0; yy < sizeTiles; yy++) {
        for (let xx = 0; xx < sizeTiles; xx++) blocked.add(`${x + xx},${y + yy}`);
      }
    }

    function tryPlace(kind, tries, sizeTiles = 1) {
      for (let t = 0; t < tries; t++) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);

        if (!canPlace(x, y, sizeTiles)) continue;

        reserve(x, y, sizeTiles);
        props.push({
          kind,
          x: x * TILE,
          y: y * TILE,
          w: TILE * sizeTiles,
          h: TILE * sizeTiles
        });
        return true;
      }
      return false;
    }

    const total = cols * rows;

    // Counts (keine 1x1 Bäume)
    const chestCount = Math.floor(total * DENSITY.chest);

    const tree3Count = Math.floor(total * DENSITY.tree3);
    const tree2Count = Math.floor(total * DENSITY.tree2);

    const bushCount  = Math.floor(total * DENSITY.bush);

    const rock2Count = Math.floor(total * DENSITY.rock2);

    // Chests (1x1)
    for (let i = 0; i < chestCount; i++) tryPlace("chest", 900, 1);

    // Trees: erst die großen, dann 2x2
    for (let i = 0; i < tree3Count; i++) tryPlace("tree", 1200, 3);
    for (let i = 0; i < tree2Count; i++) tryPlace("tree", 900, 2);

    // Bushes (1x1)
    for (let i = 0; i < bushCount; i++) tryPlace("bush", 450, 1);

    // Rocks (2x2)
    for (let i = 0; i < rock2Count; i++) tryPlace("rock", 900, 2);

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
        // fallback
        ctx2.fillStyle = "rgba(148,163,184,0.25)";
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
    drawProps(bgCtx);
  }

  function rebuild() {
    buildSmoothPath();
    buildProps();
    buildBackground();
  }

  // ---------- Foreground draw ----------
  function drawBackground() {
    setCrisp(ctx);
    ctx.drawImage(bg, 0, 0);
  }

  // Slots: dezent, ohne "dicke Blöcke"
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
        const color = isSlowed
          ? "#a78bfa"
          : (e.isBoss ? "#f43f5e" : (e.type === "fast" ? "#22d3ee" : "#fb7185"));

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

      // HP bar
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

      // Tower-Rendergröße (passt zu deinen großen PNGs)
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
    ctx.clearRect(0, 0, state.w, state.h);
    drawBackground();
    drawSlots();
    const now = performance.now();
    drawEnemies(now);
    drawTowers();
    drawProjectiles();
    drawParticles();
    drawRange();
  }

  return { rebuild, drawFrame, TILE };
}
