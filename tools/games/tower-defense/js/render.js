// js/render.js
export function createRenderer({ canvas, ctx, state, assets }) {
  // ====== SETTINGS ======
  const TILE = 32;

  // Smooth path look (passt du bei Bedarf an)
  const PATH_OUTER = 44;   // äußere Breite (gesamt) -> breiter
  const PATH_INNER = 28;   // innere Breite (gesamt) -> Kern
  const PATH_SOFT  = 18;   // weiche Glow-Schicht

  // Deko-Dichte
  const DENSITY = {
    trees: 0.050,   // 5% der Tiles
    bushes: 0.035,
    rocks: 0.020,
    crumbs: 0.010,  // kleine Deko (zufällige „Steinchen“ / squares)
    chests: 3
  };

  // Baumskalierung
  const TREE_SCALE_BASE = 2.0; // <- "doppelt so groß"
  const BUSH_SCALE_BASE = 1.4;
  const ROCK_SCALE_BASE = 1.3;
  const CHEST_SCALE_BASE = 1.2;

  // ====== OFFSCREEN BACKGROUND CACHE ======
  const bg = document.createElement("canvas");
  const bgCtx = bg.getContext("2d");

  const setCrisp = (c) => { c.imageSmoothingEnabled = false; };

  function worldToCell(x, y) {
    return { cx: Math.floor(x / TILE), cy: Math.floor(y / TILE) };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ====== PATH: Catmull-Rom -> Bezier ======
  // erzeugt eine glatte Kurve, die durch die Punkte läuft
  function drawSmoothPath(ctx2, pts) {
    if (!pts || pts.length < 2) return;

    // Catmull-Rom to Bezier helper
    const cr2bz = (p0, p1, p2, p3, t = 0.5) => {
      // t = tension (0.5 gut)
      const cp1 = {
        x: p1.x + (p2.x - p0.x) / 6 * t,
        y: p1.y + (p2.y - p0.y) / 6 * t
      };
      const cp2 = {
        x: p2.x - (p3.x - p1.x) / 6 * t,
        y: p2.y - (p3.y - p1.y) / 6 * t
      };
      return [cp1, cp2];
    };

    ctx2.save();
    ctx2.lineCap = "round";
    ctx2.lineJoin = "round";

    // --- Build a single bezier path
    ctx2.beginPath();
    ctx2.moveTo(pts[0].x, pts[0].y);

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const [cp1, cp2] = cr2bz(p0, p1, p2, p3, 0.9);
      ctx2.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    }

    // --- Layer 1: soft glow (breit)
    ctx2.globalAlpha = 0.22;
    ctx2.strokeStyle = "rgba(56,189,248,0.35)";
    ctx2.lineWidth = PATH_OUTER + PATH_SOFT;
    ctx2.stroke();

    // --- Layer 2: outer body
    ctx2.globalAlpha = 0.26;
    ctx2.strokeStyle = "rgba(148,163,184,0.55)";
    ctx2.lineWidth = PATH_OUTER;
    ctx2.stroke();

    // --- Layer 3: inner core
    ctx2.globalAlpha = 0.35;
    ctx2.strokeStyle = "rgba(226,232,240,0.35)";
    ctx2.lineWidth = PATH_INNER;
    ctx2.stroke();

    // --- Optional: subtle center highlight
    ctx2.globalAlpha = 0.18;
    ctx2.strokeStyle = "rgba(255,255,255,0.35)";
    ctx2.lineWidth = 6;
    ctx2.stroke();

    ctx2.restore();
  }

  // ====== GRID + BLOCKING ======
  function buildBlockingGrid() {
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);

    // blocked cells
    const blocked = new Set();

    // 1) Block around the smooth path by sampling points
    const pts = state.path || [];
    if (pts.length >= 2) {
      const step = TILE / 3;
      const radiusTiles = 2; // block radius around path in tiles

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const n = Math.ceil(dist / step);
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          const { cx, cy } = worldToCell(x, y);

          for (let yy = -radiusTiles; yy <= radiusTiles; yy++) {
            for (let xx = -radiusTiles; xx <= radiusTiles; xx++) {
              const X = cx + xx, Y = cy + yy;
              if (X >= 0 && Y >= 0 && X < cols && Y < rows) blocked.add(`${X},${Y}`);
            }
          }
        }
      }
    }

    // 2) Block tower slots (bigger padding)
    const slotPad = 2; // tiles
    for (const s of (state.slots || [])) {
      const { cx, cy } = worldToCell(s.x, s.y);
      for (let dy = -slotPad; dy <= slotPad; dy++) {
        for (let dx = -slotPad; dx <= slotPad; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    }

    // 3) Start/End area freihalten
    const keep = 4;
    for (let i = 0; i < Math.min(3, (state.path || []).length); i++) {
      const { cx, cy } = worldToCell(state.path[i].x, state.path[i].y);
      for (let dy = -keep; dy <= keep; dy++) {
        for (let dx = -keep; dx <= keep; dx++) blocked.add(`${cx + dx},${cy + dy}`);
      }
    }
    for (let i = Math.max(0, (state.path || []).length - 3); i < (state.path || []).length; i++) {
      const { cx, cy } = worldToCell(state.path[i].x, state.path[i].y);
      for (let dy = -keep; dy <= keep; dy++) {
        for (let dx = -keep; dx <= keep; dx++) blocked.add(`${cx + dx},${cy + dy}`);
      }
    }

    state._grid = { cols, rows, blocked };
  }

  // ====== PROPS ======
  function buildProps() {
    const { cols, rows, blocked } = state._grid;

    const props = [];

    function tryPlace(kind, tries, footprintTiles = 1, scaleBase = 1.0) {
      for (let t = 0; t < tries; t++) {
        const x = Math.floor(Math.random() * cols);
        const y = Math.floor(Math.random() * rows);

        // footprint check
        let ok = true;
        for (let yy = 0; yy < footprintTiles; yy++) {
          for (let xx = 0; xx < footprintTiles; xx++) {
            const key = `${x + xx},${y + yy}`;
            if (blocked.has(key)) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (!ok) continue;

        // reserve + small buffer ring
        const buffer = 0; // setze 1 wenn du mehr Abstand willst
        for (let yy = -buffer; yy < footprintTiles + buffer; yy++) {
          for (let xx = -buffer; xx < footprintTiles + buffer; xx++) {
            const X = x + xx, Y = y + yy;
            if (X >= 0 && Y >= 0 && X < cols && Y < rows) blocked.add(`${X},${Y}`);
          }
        }

        // scale with slight variation
        const scale = scaleBase * (0.90 + Math.random() * 0.20);

        props.push({
          kind,
          x: x * TILE,
          y: y * TILE,
          w: TILE * footprintTiles * scale,
          h: TILE * footprintTiles * scale,
          // anchor bottom-center nicer for trees
          anchor: (kind === "tree") ? "bottom" : "center"
        });
        return true;
      }
      return false;
    }

    // counts based on map size
    const total = cols * rows;
    const treeCount  = Math.floor(total * DENSITY.trees);
    const bushCount  = Math.floor(total * DENSITY.bushes);
    const rockCount  = Math.floor(total * DENSITY.rocks);
    const crumbCount = Math.floor(total * DENSITY.crumbs);

    // chests
    for (let i = 0; i < DENSITY.chests; i++) tryPlace("chest", 600, 1, CHEST_SCALE_BASE);

    // BIG trees (2x, footprint 1 tile, aber groß gezeichnet)
    for (let i = 0; i < treeCount; i++) tryPlace("tree", 12, 1, TREE_SCALE_BASE);

    // bushes / rocks
    for (let i = 0; i < bushCount; i++) tryPlace("bush", 10, 1, BUSH_SCALE_BASE);
    for (let i = 0; i < rockCount; i++) tryPlace("rock", 10, 1, ROCK_SCALE_BASE);

    // crumbs: kleine graue squares als Extra-Deko (optional)
    for (let i = 0; i < crumbCount; i++) {
      // place as "crumb" without image
      const placed = tryPlace("crumb", 6, 1, 1.0);
      if (!placed) break;
    }

    state._props = props;
  }

  // ====== BACKGROUND ======
  function buildBackground() {
    bg.width = Math.ceil(state.w);
    bg.height = Math.ceil(state.h);
    setCrisp(bgCtx);

    // --- Grass tile base
    const { cols, rows } = state._grid;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const gx = x * TILE, gy = y * TILE;
        if (assets?.tiles?.grass) bgCtx.drawImage(assets.tiles.grass, gx, gy, TILE, TILE);
        else {
          bgCtx.fillStyle = ((x + y) & 1) ? "rgba(2,6,23,0.92)" : "rgba(2,6,23,0.86)";
          bgCtx.fillRect(gx, gy, TILE, TILE);
        }
      }
    }

    // --- Smooth path drawn ON TOP of grass
    drawSmoothPath(bgCtx, state.path);

    // --- Props + shadow
    for (const p of (state._props || [])) {
      // shadow
      bgCtx.save();
      bgCtx.globalAlpha = 0.22;
      bgCtx.fillStyle = "black";
      bgCtx.beginPath();
      const sx = p.x + p.w * 0.55;
      const sy = p.y + p.h * 0.80;
      bgCtx.ellipse(sx, sy, p.w * 0.32, p.h * 0.14, 0, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.restore();

      if (p.kind === "crumb") {
        bgCtx.fillStyle = "rgba(148,163,184,0.18)";
        bgCtx.fillRect(p.x + 10, p.y + 10, 8, 8);
        continue;
      }

      const img = assets?.props?.[p.kind];

      // anchor correction: trees bottom-anchored
      let drawX = p.x;
      let drawY = p.y;
      if (p.anchor === "bottom") {
        drawX = p.x - (p.w - TILE) * 0.25;
        drawY = p.y - (p.h - TILE) * 0.55;
      }

      if (img) bgCtx.drawImage(img, drawX, drawY, p.w, p.h);
      else {
        bgCtx.fillStyle = "rgba(148,163,184,0.25)";
        bgCtx.fillRect(drawX + 6, drawY + 6, p.w - 12, p.h - 12);
      }
    }
  }

  // ====== REBUILD ======
  function rebuild() {
    buildBlockingGrid();
    buildProps();
    buildBackground();
  }

  // ====== FOREGROUND DRAWS ======
  function drawBackground() {
    setCrisp(ctx);
    ctx.drawImage(bg, 0, 0);
  }

  function drawSlots() {
    for (const s of (state.slots || [])) {
      const isHovered = state.selectedType && !s.occupied;
      ctx.fillStyle = s.occupied
        ? "rgba(15,23,42,0.70)"
        : (isHovered ? "rgba(34,211,238,0.12)" : "rgba(30,41,59,0.10)");
      ctx.strokeStyle = isHovered ? "rgba(34,211,238,0.45)" : "rgba(148,163,184,0.10)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(s.x - 22, s.y - 22, 44, 44, 10);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawEnemies(now) {
    for (const e of (state.enemies || [])) {
      const img = assets?.enemies?.[e.type];
      const isSlowed = e.slowEnd > now;

      const w = Math.max(26, e.size * 2.8);
      const h = w;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, e.x - w / 2, e.y - h / 2, w, h);
      } else {
        const color = isSlowed ? "#a78bfa" : (e.isBoss ? "#f43f5e" : (e.type === "fast" ? "#22d3ee" : "#fb7185"));
        ctx.shadowBlur = 6;
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
      const hpPct = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(e.x - 18, e.y - (h / 2) - 11, 36, 5);
      ctx.fillStyle = hpPct > 0.5 ? "#10b981" : (hpPct > 0.2 ? "#f59e0b" : "#ef4444");
      ctx.fillRect(e.x - 18, e.y - (h / 2) - 11, 36 * hpPct, 5);
    }
  }

  function drawTowers() {
    for (const t of (state.towers || [])) {
      const img = assets?.towers?.[t.id];

      // towers in deiner render.js wurden fix mit 40 gezeichnet.
      // Wenn du jetzt 64x80 Sprites nutzt, zeichnen wir die passend:
      const w = 64;
      const h = 80;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, t.x - w / 2, t.y - h * 0.78, w, h); // bottom-ish anchor
      } else {
        ctx.save(); ctx.translate(t.x, t.y);
        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-18, -18, 36, 36, 10);
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
        ctx.arc(-16 + (i * 3.6), 20, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const p of (state.projectiles || [])) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of (state.particles || [])) {
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
