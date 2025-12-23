// js/render.js
export function createRenderer({ canvas, ctx, state, assets }) {
  const TILE = 32; // Pixel-Grid (kannst du später hoch/runter drehen)
  const bg = document.createElement("canvas");
  const bgCtx = bg.getContext("2d");

  const setCrisp = (c) => { c.imageSmoothingEnabled = false; };

  function worldToCell(x, y) {
    return { cx: Math.floor(x / TILE), cy: Math.floor(y / TILE) };
  }

  function buildPathGrid() {
    // Rasterisieren der Polyline in Grid-Zellen
    const cols = Math.ceil(state.w / TILE);
    const rows = Math.ceil(state.h / TILE);
    const grid = Array.from({length: rows}, () => Array(cols).fill(0)); // 0=grass, 1=path

    const pts = state.path;
    const step = TILE / 2;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i+1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const n = Math.ceil(dist / step);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        const {cx, cy} = worldToCell(x, y);
        if (cy>=0 && cy<rows && cx>=0 && cx<cols) grid[cy][cx] = 1;
      }
    }
    state._grid = { grid, cols, rows };
  }

  function neighborMask(grid, x, y) {
    const up = (y>0 && grid[y-1][x]===1) ? 1 : 0;
    const rt = (x<grid[0].length-1 && grid[y][x+1]===1) ? 1 : 0;
    const dn = (y<grid.length-1 && grid[y+1][x]===1) ? 1 : 0;
    const lf = (x>0 && grid[y][x-1]===1) ? 1 : 0;
    return {up, rt, dn, lf, sum: up+rt+dn+lf};
  }

  function choosePathTile(mask) {
    // returns {img, rot}
    const S = assets.tiles.pathStraight;
    const C = assets.tiles.pathCorner;
    const E = assets.tiles.pathEnd;

    // End: genau 1 Nachbar
    if (mask.sum === 1) {
      let rot = 0;
      if (mask.rt) rot = 0;
      else if (mask.dn) rot = 90;
      else if (mask.lf) rot = 180;
      else if (mask.up) rot = 270;
      return { img: E, rot };
    }

    // Gerade: 2 Nachbarn gegenüber
    if (mask.sum === 2 && ((mask.up && mask.dn) || (mask.lf && mask.rt))) {
      const rot = (mask.up && mask.dn) ? 90 : 0;
      return { img: S, rot };
    }

    // Corner: 2 Nachbarn im 90°-Winkel
    if (mask.sum >= 2) {
      // 4-Wege behandeln wir als "straight" (optisch ok) – sonst Corner
      if (mask.sum === 4) return { img: S, rot: 0 };

      let rot = 0;
      // Corner tile ist definiert als Verbindung RIGHT + DOWN (0°)
      if (mask.rt && mask.dn) rot = 0;
      else if (mask.dn && mask.lf) rot = 90;
      else if (mask.lf && mask.up) rot = 180;
      else if (mask.up && mask.rt) rot = 270;
      else rot = 0;
      return { img: C, rot };
    }
    return { img: null, rot: 0 };
  }

  function rotateDraw(ctx2, img, x, y, w, h, rotDeg) {
    if (!img) return;
    ctx2.save();
    ctx2.translate(x + w/2, y + h/2);
    ctx2.rotate(rotDeg * Math.PI / 180);
    setCrisp(ctx2);
    ctx2.drawImage(img, -w/2, -h/2, w, h);
    ctx2.restore();
  }

  function buildProps() {
    // Props einmalig / bei resize neu
    const { grid, cols, rows } = state._grid;
    const blocked = new Set();

    // path cells blocken
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        if (grid[y][x]===1) blocked.add(`${x},${y}`);
      }
    }

    // slots blocken (Radius um Slot)
    const slotPad = 1; // 1 tile radius
    for (const s of state.slots) {
      const {cx, cy} = worldToCell(s.x, s.y);
      for (let dy=-slotPad; dy<=slotPad; dy++){
        for (let dx=-slotPad; dx<=slotPad; dx++){
          const xx=cx+dx, yy=cy+dy;
          if (xx>=0 && yy>=0 && xx<cols && yy<rows) blocked.add(`${xx},${yy}`);
        }
      }
    }

    // Start/End Bereich etwas frei lassen
    for (let i=0;i<3;i++){
      const {cx, cy} = worldToCell(state.path[i].x, state.path[i].y);
      for (let dy=-1; dy<=1; dy++){
        for (let dx=-1; dx<=1; dx++){
          blocked.add(`${cx+dx},${cy+dy}`);
        }
      }
    }

    const props = [];

    function tryPlace(kind, tries, sizeTiles=1) {
      for (let t=0;t<tries;t++){
        const x = Math.floor(Math.random()*cols);
        const y = Math.floor(Math.random()*rows);
        // footprint
        let ok = true;
        for (let yy=0; yy<sizeTiles; yy++){
          for (let xx=0; xx<sizeTiles; xx++){
            if (blocked.has(`${x+xx},${y+yy}`)) ok=false;
          }
        }
        if (!ok) continue;

        // reserve
        for (let yy=0; yy<sizeTiles; yy++){
          for (let xx=0; xx<sizeTiles; xx++){
            blocked.add(`${x+xx},${y+yy}`);
          }
        }
        props.push({ kind, x: x*TILE, y: y*TILE, w: TILE*sizeTiles, h: TILE*sizeTiles });
        return true;
      }
      return false;
    }

    // 2 Schatzkisten (wenn möglich)
    tryPlace("chest", 400, 1);
    tryPlace("chest", 400, 1);

    // Bäume/Büsche/Steine (dunkel / cyber-forest)
    const treeCount = Math.floor((cols*rows) * 0.03); // ~3%
    const bushCount = Math.floor((cols*rows) * 0.02);
    const rockCount = Math.floor((cols*rows) * 0.015);

    for (let i=0;i<treeCount;i++) tryPlace("tree", 10, 1);
    for (let i=0;i<bushCount;i++) tryPlace("bush", 10, 1);
    for (let i=0;i<rockCount;i++) tryPlace("rock", 10, 1);

    state._props = props;
  }

  function buildBackground() {
    bg.width = Math.ceil(state.w);
    bg.height = Math.ceil(state.h);
    setCrisp(bgCtx);

    const { grid, cols, rows } = state._grid;

    // Grass base
    for (let y=0; y<rows; y++){
      for (let x=0; x<cols; x++){
        const gx = x*TILE, gy = y*TILE;
        if (assets.tiles.grass) bgCtx.drawImage(assets.tiles.grass, gx, gy, TILE, TILE);
        else {
          bgCtx.fillStyle = ((x+y)&1) ? "rgba(2,6,23,0.92)" : "rgba(2,6,23,0.85)";
          bgCtx.fillRect(gx, gy, TILE, TILE);
        }
      }
    }

    // Path tiles
    for (let y=0; y<rows; y++){
      for (let x=0; x<cols; x++){
        if (grid[y][x] !== 1) continue;
        const mask = neighborMask(grid, x, y);
        const { img, rot } = choosePathTile(mask);
        const px = x*TILE, py = y*TILE;
        if (img) rotateDraw(bgCtx, img, px, py, TILE, TILE, rot);
        else {
          bgCtx.fillStyle = "rgba(148,163,184,0.12)";
          bgCtx.fillRect(px, py, TILE, TILE);
        }
      }
    }

    // Props + shadow
    for (const p of (state._props || [])) {
      // Shadow blob (leicht)
      bgCtx.save();
      bgCtx.globalAlpha = 0.25;
      bgCtx.fillStyle = "black";
      bgCtx.beginPath();
      bgCtx.ellipse(p.x + p.w*0.55, p.y + p.h*0.80, p.w*0.35, p.h*0.18, 0, 0, Math.PI*2);
      bgCtx.fill();
      bgCtx.restore();

      const img = assets.props[p.kind];
      if (img) {
        bgCtx.drawImage(img, p.x, p.y, p.w, p.h);
      } else {
        bgCtx.fillStyle = "rgba(148,163,184,0.25)";
        bgCtx.fillRect(p.x+6, p.y+6, p.w-12, p.h-12);
      }
    }
  }

  function rebuild() {
    buildPathGrid();
    buildProps();
    buildBackground();
  }

  function drawBackground() {
    setCrisp(ctx);
    ctx.drawImage(bg, 0, 0);
  }

  function drawSlots() {
    for (const s of state.slots) {
      const isHovered = state.selectedType && !s.occupied;
      ctx.fillStyle = s.occupied ? 'rgba(15,23,42,0.70)' : (isHovered ? 'rgba(34,211,238,0.12)' : 'rgba(30,41,59,0.10)');
      ctx.strokeStyle = isHovered ? 'rgba(34,211,238,0.45)' : 'rgba(148,163,184,0.10)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(s.x-20, s.y-20, 40, 40, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawEnemies(now) {
    for (const e of state.enemies) {
      const img = assets.enemies[e.type];
      const isSlowed = e.slowEnd > now;

      const w = Math.max(24, e.size*2.6);
      const h = w;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, e.x - w/2, e.y - h/2, w, h);
      } else {
        const color = isSlowed ? '#a78bfa' : (e.isBoss ? '#f43f5e' : (e.type === 'fast' ? '#22d3ee' : '#fb7185'));
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        if (e.shape === 'circle') { ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill(); }
        else { ctx.beginPath(); ctx.roundRect(e.x-e.size, e.y-e.size, e.size*2, e.size*2, 4); ctx.fill(); }
        ctx.shadowBlur = 0;
      }

      // HP bar
      const hpPct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(e.x-16, e.y-(h/2)-10, 32, 4);
      ctx.fillStyle = hpPct > 0.5 ? '#10b981' : (hpPct > 0.2 ? '#f59e0b' : '#ef4444');
      ctx.fillRect(e.x-16, e.y-(h/2)-10, 32*hpPct, 4);
    }
  }

  function drawTowers() {
    for (const t of state.towers) {
      const img = assets.towers[t.id];
      const w = 40;
      const h = 40;

      if (img) {
        setCrisp(ctx);
        ctx.drawImage(img, t.x - w/2, t.y - h/2, w, h);
      } else {
        // fallback: alte Box + Emoji
        ctx.save(); ctx.translate(t.x, t.y);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 32, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = t.color;
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(t.icon, 0, 6);
        ctx.restore();
      }

      // Level pips (klein, unkritisch für Pixelart)
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = "rgba(226,232,240,0.8)";
      for (let i = 0; i < Math.min(t.level, 10); i++) {
        ctx.beginPath();
        ctx.arc(-14 + (i*3.3), 18, 1.2, 0, Math.PI*2);
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
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.fill();
    ctx.setLineDash([]);
  }

  function drawFrame() {
    ctx.clearRect(0,0,state.w,state.h);
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

