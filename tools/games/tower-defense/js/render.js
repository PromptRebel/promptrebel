// js/render.js
// Smooth path following state.path + tiled grass + props (bigger trees), plus:
// - Start gate (cave) at first path point + fog/particles
// - End gate at last path point + subtle glow aura
// - Extra small bushes/rocks placed "between slots" (corridors), capped + sparse
// Pixelart crisp: imageSmoothingEnabled = false.

export function createRenderer({ canvas, ctx, state, assets }) {
  const TILE = 32;

  // Dein guter Stand
  const PATH_W = 28;

  // -------------------------
  // Deko-Tuning (sparsam!)
  // -------------------------
  // Bäume: bevorzugt 3x3, optional ein paar 2x2, KEINE 1x1 Trees
  const TREE_3_FACTOR = 0.008; // pro Zelle (cols*rows)
  const TREE_2_FACTOR = 0.004;

  // Base scatter (überall, aber wenig)
  const BUSH_BASE_FACTOR = 0.006; // 1x1
  const ROCK_BASE_FACTOR = 0.004; // 1x1

  // Zwischen Slots: gezielt aber gedeckelt
  const SLOT_PAD_CORE = 1;      // um Slot frei halten (Tiles)
  const SLOT_PAD_SOFT = 2;      // “Korridor”-Ring (hier dürfen 1x1 rein)
  const BETWEEN_MAX = 10;       // harte Obergrenze extra Props
  const BETWEEN_BUSH_RATIO = 0.6;

  // Abstand vom Weg
  const PATH_CLEARANCE = (PATH_W * 0.6) + 12;

  // Schatten Props sehr dezent (0 = aus)
  const PROP_SHADOW_ALPHA = 0.08;

  // Gates: Größe (du kannst hier easy tweaken)
  const START_GATE_W = 96;
  const START_GATE_H = 96;
  const END_GATE_W   = 96;
  const END_GATE_H   = 96;

  // Start-Nebel / Partikel
  const CAVE_PARTICLE_RATE = 22;      // pro Sekunde
  const CAVE_PARTICLE_MAX  = 110;
  const CAVE_PARTICLE_LIFE = [0.9, 1.6]; // Sekunden
  const CAVE_PARTICLE_SPEED = [16, 46];  // px/s
  const CAVE_PARTICLE_SPREAD = 14;       // px

  // End-Gate Glow
  const END_GLOW_RADIUS = 64;
  const END_GLOW_ALPHA  = 0.20;

  // Offscreen background cache
  const bg = document.createElement("canvas");
  const bgCtx = bg.getContext("2d");

  const setCrisp = (c) => { c.imageSmoothingEnabled = false; };

  // -------------------------
  // Helpers
  // -------------------------
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

    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    state._smoothPath = path;
    return path;
  }

  function dirFromTo(a, b) {
    const dx = (b.x - a.x), dy = (b.y - a.y);
    const d = Math.hypot(dx, dy) || 1;
    return { nx: dx / d, ny: dy / d, ang: Math.atan2(dy, dx) };
  }

  // Key-robust: akzeptiert startGate/start_gate/start_gate.png etc.
  function getPropImg(...keys) {
    const p = assets?.props;
    if (!p) return null;
    for (const k of keys) {
      if (p[k]) return p[k];
    }
    return null;
  }

  // -------------------------
  // Props placement
  // -------------------------
  function buildProps() {
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);

    const blocked = new Set();
    const props = [];

    const slotCells = state.slots.map(s => ({
      cx: Math.floor(s.x / TILE),
      cy: Math.floor(s.y / TILE),
      x: s.x, y: s.y
    }));

    // Core block um Slots
    for (const sc of slotCells) {
      for (let dy = -SLOT_PAD_CORE; dy <= SLOT_PAD_CORE; dy++) {
        for (let dx = -SLOT_PAD_CORE; dx <= SLOT_PAD_CORE; dx++) {
          const xx = sc.cx + dx, yy = sc.cy + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) blocked.add(`${xx},${yy}`);
        }
      }
    }

    // Start/End etwas freihalten
    const pts = state.path || [];
    for (let i = 0; i < Math.min(3, pts.length); i++) {
      const p = pts[i];
      const cx = Math.floor(p.x / TILE);
      const cy = Math.floor(p.y / TILE);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked.add(`${cx+dx},${cy+dy}`);
    }
    for (let i = Math.max(0, pts.length - 3); i < pts.length; i++) {
      const p = pts[i];
      const cx = Math.floor(p.x / TILE);
      const cy = Math.floor(p.y / TILE);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked.add(`${cx+dx},${cy+dy}`);
    }

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

    const total = cols * rows;

    // Chests: wenige
    const chestCount = Math.max(2, Math.floor(total * 0.002));
    for (let i = 0; i < chestCount; i++) tryPlace("chest", 800, 1);

    // Trees: 3x3 bevorzugt + ein paar 2x2
    const tree3Count = Math.min(10, Math.floor(total * TREE_3_FACTOR));
    const tree2Count = Math.min(8,  Math.floor(total * TREE_2_FACTOR));

    for (let i = 0; i < tree3Count; i++) tryPlace("tree", 1800, 3);
    for (let i = 0; i < tree2Count; i++) tryPlace("tree", 1400, 2);

    // Base bushes/rocks (1x1), wenig
    const bushBase = Math.min(14, Math.floor(total * BUSH_BASE_FACTOR));
    const rockBase = Math.min(10, Math.floor(total * ROCK_BASE_FACTOR));

    for (let i = 0; i < bushBase; i++) tryPlace("bush", 700, 1);
    for (let i = 0; i < rockBase; i++) tryPlace("rock", 700, 1);

    // “Between slots”: Kandidatenring + paar Midpoints – aber sparsamer
    const candidates = [];

    for (const sc of slotCells) {
      for (let dy = -SLOT_PAD_SOFT; dy <= SLOT_PAD_SOFT; dy++) {
        for (let dx = -SLOT_PAD_SOFT; dx <= SLOT_PAD_SOFT; dx++) {
          const man = Math.abs(dx) + Math.abs(dy);
          if (man <= SLOT_PAD_CORE) continue;
          const xx = sc.cx + dx, yy = sc.cy + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          candidates.push({ x: xx, y: yy });
        }
      }
    }

    for (let i = 0; i < slotCells.length; i++) {
      for (let j = i + 1; j < slotCells.length; j++) {
        const a = slotCells[i], b = slotCells[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120 || d > 260) continue;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const cx = Math.floor(mx / TILE);
        const cy = Math.floor(my / TILE);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          candidates.push({ x: xx, y: yy });
        }
      }
    }

    function tryPlaceFromCandidates(kind, maxCount) {
      let placed = 0;
      const tries = 650;
      for (let t = 0; t < tries && placed < maxCount; t++) {
        const c = candidates[Math.floor(Math.random() * candidates.length)];
        if (!c) break;
        const x = c.x, y = c.y;

        if (!footprintFree(x, y, 1)) continue;

        const wx = (x + 0.5) * TILE;
        const wy = (y + 0.5) * TILE;
        if (distToPolyline(wx, wy, state.path) < PATH_CLEARANCE) continue;

        reserve(x, y, 1);
        props.push({ kind, x: x*TILE, y: y*TILE, w: TILE, h: TILE });
        placed++;
      }
    }

    const betweenBush = Math.floor(BETWEEN_MAX * BETWEEN_BUSH_RATIO);
    const betweenRock = BETWEEN_MAX - betweenBush;

    tryPlaceFromCandidates("bush", betweenBush);
    tryPlaceFromCandidates("rock", betweenRock);

    state._props = props;
  }

  // -------------------------
  // Background draw
  // -------------------------
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

  function drawGatesToBackground(ctx2) {
    const pts = state.path;
    if (!pts || pts.length < 2) return;

    const start = pts[0];
    const startDir = dirFromTo(pts[0], pts[1]);

    const end = pts[pts.length - 1];
    const endDir = dirFromTo(pts[pts.length - 2], pts[pts.length - 1]);

    // Robust key lookup (dein Loader kann snake_case machen)
    const startImg = getPropImg(
      "startGate", "start_gate", "start_gate.png", "start_gate.webp", "start_gate.jpg"
    );
    const endImg = getPropImg(
      "endGate", "end_gate", "end_gate.png", "end_gate.webp", "end_gate.jpg"
    );

    // Start gate (leicht hinter dem ersten Punkt, damit es “aus der Höhle” kommt)
    if (startImg) {
      ctx2.save();
      setCrisp(ctx2);

      const ox = start.x - startDir.nx * 22;
      const oy = start.y - startDir.ny * 22;

      ctx2.translate(ox, oy);
      ctx2.drawImage(startImg, -START_GATE_W/2, -START_GATE_H/2, START_GATE_W, START_GATE_H);
      ctx2.restore();
    }

    // End gate (leicht vor den letzten Punkt)
    if (endImg) {
      ctx2.save();
      setCrisp(ctx2);

      const ox = end.x + endDir.nx * 18;
      const oy = end.y + endDir.ny * 18;

      ctx2.translate(ox, oy);
      ctx2.drawImage(endImg, -END_GATE_W/2, -END_GATE_H/2, END_GATE_W, END_GATE_H);
      ctx2.restore();
    }

    // Cache for FX
    state._gate = {
      start: { x: start.x, y: start.y, dx: startDir.nx, dy: startDir.ny },
      end:   { x: end.x,   y: end.y,   dx: endDir.nx,   dy: endDir.ny },
      hasStart: !!startImg,
      hasEnd: !!endImg
    };
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
          p.x + p.w*0.55,
          p.y + p.h*0.82,
          p.w*0.34,
          p.h*0.16,
          0, 0, Math.PI*2
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
    drawGatesToBackground(bgCtx);
    drawProps(bgCtx);
  }

  function rebuild() {
    if (!state._caveFx) state._caveFx = { particles: [], acc: 0, lastNow: null };
    buildSmoothPath();
    buildProps();
    buildBackground();
  }

  // -------------------------
  // Foreground draw
  // -------------------------
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

  // Start cave particles
  function updateAndDrawCaveParticles(now) {
    if (!state._gate?.hasStart) return;

    if (!state._caveFx) state._caveFx = { particles: [], acc: 0, lastNow: null };
    const fx = state._caveFx;

    if (fx.lastNow == null) fx.lastNow = now;
    const dt = Math.min((now - fx.lastNow) / 1000, 0.05);
    fx.lastNow = now;

    const gate = state._gate.start;

    fx.acc += dt * CAVE_PARTICLE_RATE;
    const emitCount = Math.floor(fx.acc);
    fx.acc -= emitCount;

    for (let i = 0; i < emitCount; i++) {
      if (fx.particles.length >= CAVE_PARTICLE_MAX) break;

      const life = CAVE_PARTICLE_LIFE[0] + Math.random() * (CAVE_PARTICLE_LIFE[1] - CAVE_PARTICLE_LIFE[0]);
      const spd  = CAVE_PARTICLE_SPEED[0] + Math.random() * (CAVE_PARTICLE_SPEED[1] - CAVE_PARTICLE_SPEED[0]);

      const sx = gate.x - gate.dx * 12 + (Math.random() - 0.5) * CAVE_PARTICLE_SPREAD;
      const sy = gate.y - gate.dy * 12 + (Math.random() - 0.5) * CAVE_PARTICLE_SPREAD;

      const sideX = -gate.dy;
      const sideY = gate.dx;
      const lateral = (Math.random() - 0.5) * 0.55;

      fx.particles.push({
        x: sx, y: sy,
        vx: (gate.dx + sideX * lateral) * spd,
        vy: (gate.dy + sideY * lateral) * spd,
        life, maxLife: life,
        r: 1.6 + Math.random() * 1.8
      });
    }

    ctx.save();
    setCrisp(ctx);
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.life -= dt;
      if (p.life <= 0) { fx.particles.splice(i, 1); continue; }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = 0.08 + a * 0.20;
      ctx.fillStyle = "rgba(226,232,240,1)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // End gate glow aura (over background)
  function drawEndGlow(now) {
    if (!state._gate?.hasEnd) return;

    const g = state._gate.end;
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.004);
    const radius = END_GLOW_RADIUS * (0.9 + 0.2 * pulse);

    const gx = g.x + g.dx * 18;
    const gy = g.y + g.dy * 18;

    ctx.save();
    const grad = ctx.createRadialGradient(gx, gy, 6, gx, gy, radius);
    grad.addColorStop(0, `rgba(34,211,238,${END_GLOW_ALPHA * 0.55})`);
    grad.addColorStop(0.45, `rgba(167,139,250,${END_GLOW_ALPHA * 0.28})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemies(now) {
    for (const e of state.enemies) {
      const img = assets?.enemies?.[e.type];
      const isSlowed = e.slowEnd > now;

      const w = Math.max(24, e.size * 2.6);
      const h = w;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, e.x - w/2, e.y - h/2, w, h);
      } else {
        const color = isSlowed ? "#a78bfa" : (e.isBoss ? "#f43f5e" : (e.type === "fast" ? "#22d3ee" : "#fb7185"));
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        if (e.shape === "circle") {
          ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.roundRect(e.x - e.size, e.y - e.size, e.size*2, e.size*2, 4); ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // HP bar (nur enemies)
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
        ctx.arc(-14 + (i * 3.3), 18, 1.2, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const p of state.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
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
    ctx.arc(state.activeTower.x, state.activeTower.y, state.activeTower.range, 0, Math.PI*2);
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

    const now = performance.now();
    drawEndGlow(now);
    updateAndDrawCaveParticles(now);

    drawSlots();
    drawEnemies(now);
    drawTowers();
    drawProjectiles();
    drawParticles();
    drawRange();
  }

  return { rebuild, drawFrame, TILE };
}
