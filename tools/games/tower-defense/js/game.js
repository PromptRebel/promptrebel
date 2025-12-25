// js/game.js
import { loadAssets } from "./assets.js";
import { createRenderer } from "./render.js";

export async function startGame() {
  const canvas = document.getElementById("canvas");
  if (!canvas) throw new Error("Canvas #canvas fehlt in index.html");

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const stage = document.getElementById("gameStage");
  const ctxMenu = document.getElementById("ctxMenu");

  const assets = await loadAssets();

  // --- GAME CONSTANTS ---
  const MAX_LEVEL = 10;

  // Referenzgröße für Balancing der Range/AoE (Desktop-Basis)
  const REF_W = 900;
  const REF_H = 600;

  const TOWER_DATA = {
    archer: {
      id: "archer", name: "Archer", icon: "🏹", color: "#22d3ee",
      cost: 20, range: 170, fireRate: 650, damage: 14, projSpeed: 12, aoe: 0,
      upgradeBase: 24,
      mult: { damage: 1.35, range: 1.08, fireRate: 0.90, aoe: 1.00, projSpeed: 1.03 }
    },
    cannon: {
      id: "cannon", name: "Cannon", icon: "💣", color: "#ec4899",
      cost: 45, range: 125, fireRate: 1100, damage: 38, projSpeed: 8, aoe: 60,
      upgradeBase: 55,
      mult: { damage: 1.40, range: 1.06, fireRate: 0.92, aoe: 1.10, projSpeed: 1.03 }
    },
    mage: {
      id: "mage", name: "Mage", icon: "✨", color: "#8b5cf6",
      cost: 40, range: 145, fireRate: 900, damage: 24, projSpeed: 10, aoe: 35,
      slow: 0.55, slowDur: 1400,
      upgradeBase: 45,
      mult: { damage: 1.38, range: 1.07, fireRate: 0.92, aoe: 1.12, projSpeed: 1.03 }
    }
  };

  const ENEMY = {
    fast: { shape: "circle", baseHp: 30, baseSpeed: 2.1, size: 10 },
    tank: { shape: "square", baseHp: 75, baseSpeed: 1.0, size: 12 },
    boss: { shape: "square", baseHp: 600, baseSpeed: 0.7, size: 25, isBoss: true }
  };

  // --- ECONOMY ---
  const GOLD_PER_KILL = 5;
  const GOLD_KILL_GROWTH = 1.05;
  const BOSS_GOLD = 200;
  const WAVE_BONUS_BASE = 20;
  const WAVE_BONUS_GROWTH = 1.05;

  // --- WAVE SPAWN RULES ---
  const WAVE_COUNT_BASE = 10;
  const WAVE_COUNT_GROWTH = 1.15;
  const WAVE_COUNT_MAX = 50;

  const EXTRA_FROM_WAVE = 30;
  const EXTRA_MAX = 20;
  const EXTRA_SPAWN_MULT = 0.60;

  const state = {
    w: 0, h: 0, dpr: 1,

    // Range-Scaling
    rangeScale: 1,

    hp: 10,
    gold: 120,
    wave: 0,

    waveActive: false,
    waveTotal: 0,
    waveSpawned: 0,
    waveKilled: 0,

    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],

    selectedType: null,
    activeTower: null,

    speed: 1,
    lastFrame: 0,

    path: [],
    slots: [],
    autoStart: false,

    // Sell confirm
    sellArmedTower: null,
    sellArmedUntil: 0,

    // Report
    reportEnabled: true,
    reportOpen: false,

    // Per-wave metrics
    waveMetrics: null,

    spawn: { mainLeft: 0, extraLeft: 0, nextAt: 0, interval: 0, extraInterval: 0 }
  };

  const renderer = createRenderer({ canvas, ctx, state, assets });

  // ---------- Report UI (robust, no-crash) ----------
  function $(id) { return document.getElementById(id); }

  function ensureReportUI() {
    const overlay = $("reportOverlay");
    if (!overlay) {
      state.reportEnabled = false;
      return;
    }

    // make inner card scrollable on small screens
    const card = overlay.querySelector(".glass");
    if (card) {
      card.style.maxHeight = "90vh";
      card.style.overflow = "auto";
      card.style.webkitOverflowScrolling = "touch";
    }

    window.__closeReport = () => closeReport();

    const btn = $("btnCloseReport");
    if (btn) btn.onclick = () => closeReport();
  }

  function fmtMs(ms) {
    if (!isFinite(ms) || ms <= 0) return "—";
    const s = Math.round(ms / 100) / 10;
    return `${s.toFixed(1)}s`;
  }

  function showReport() {
    if (!state.reportEnabled) return;
    const overlay = $("reportOverlay");
    if (!overlay || !state.waveMetrics) return;

    const m = state.waveMetrics;

    const set = (id, val) => { const el = $(id); if (el) el.innerText = val; };

    set("repWave", String(state.wave));
    set("repDuration", fmtMs(m.durationMs));

    set("repGoldKills", Math.floor(m.goldIncomeKills));
    set("repGoldBonus", Math.floor(m.goldIncomeBonus));
    set("repGoldSpent", Math.floor(m.goldSpent));
    set("repGoldNet", Math.floor((m.goldIncomeKills + m.goldIncomeBonus) - m.goldSpent));

    set("repLeaks", Math.max(0, m.leaksHp));
    set("repBossTTK", m.isBossWave ? fmtMs(m.bossTTKms) : "—");
    set("repTotalKills", m.totalKills);
    set("repTotalDmg", Math.floor(m.totalDamage));

    set("repDmgArcher", Math.floor(m.byType.archer.damage));
    set("repKillsArcher", m.byType.archer.kills);
    set("repDmgCannon", Math.floor(m.byType.cannon.damage));
    set("repKillsCannon", m.byType.cannon.kills);
    set("repDmgMage", Math.floor(m.byType.mage.damage));
    set("repKillsMage", m.byType.mage.kills);

    overlay.classList.remove("hidden");
    state.reportOpen = true;
  }

  function closeReport() {
    const overlay = $("reportOverlay");
    overlay?.classList.add("hidden");
    state.reportOpen = false;

    // Auto: wenn an, direkt nächste Welle starten
    if (state.autoStart && state.hp > 0 && !state.waveActive) {
      spawnWave();
    }
  }

  function startWaveMetrics(isBossWave) {
    state.waveMetrics = {
      isBossWave,
      startedAt: performance.now(),
      durationMs: 0,

      hpStart: state.hp,
      hpEnd: state.hp,
      leaksHp: 0,

      goldSpent: 0,
      goldIncomeKills: 0,
      goldIncomeBonus: 0,

      totalDamage: 0,
      totalKills: 0,

      byType: {
        archer: { damage: 0, kills: 0 },
        cannon: { damage: 0, kills: 0 },
        mage: { damage: 0, kills: 0 }
      },

      bossSpawnAt: 0,
      bossKilledAt: 0,
      bossTTKms: 0
    };
  }

  function finalizeWaveMetricsAndReport(waveBonusAdded) {
    if (!state.waveMetrics) return;

    const m = state.waveMetrics;
    m.durationMs = performance.now() - m.startedAt;
    m.hpEnd = state.hp;
    m.leaksHp = Math.max(0, m.hpStart - m.hpEnd);
    m.goldIncomeBonus = waveBonusAdded || 0;

    if (m.isBossWave) {
      if (m.bossSpawnAt && m.bossKilledAt) {
        m.bossTTKms = m.bossKilledAt - m.bossSpawnAt;
      } else {
        m.bossTTKms = 0;
      }
    }

    showReport();
  }

  // ---------- Range scaling ----------
  function applyRangeScaleToExistingTowers() {
    for (const t of state.towers) {
      if (t.baseRange == null) continue;
      t.range = t.baseRange * state.rangeScale;
      if (t.baseAoe != null) t.aoe = t.baseAoe * state.rangeScale;
    }
    if (state.activeTower) refreshCtx(state.activeTower);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    state.w = rect.width;
    state.h = rect.height;
    state.dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(rect.width * state.dpr);
    canvas.height = Math.floor(rect.height * state.dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const raw = Math.min(state.w / REF_W, state.h / REF_H);
    state.rangeScale = Math.max(0.80, Math.min(1.60, raw));

    setupLevel(state.w, state.h);
    applyRangeScaleToExistingTowers();
    renderer.rebuild?.();
  }

  function setupLevel(w, h) {
    state.path = [
      { x: -60, y: h * 0.15 }, { x: w * 0.2, y: h * 0.15 }, { x: w * 0.5, y: h * 0.20 }, { x: w * 0.8, y: h * 0.25 },
      { x: w * 0.8, y: h * 0.40 }, { x: w * 0.4, y: h * 0.45 }, { x: w * 0.15, y: h * 0.50 }, { x: w * 0.15, y: h * 0.65 },
      { x: w * 0.5, y: h * 0.70 }, { x: w * 0.85, y: h * 0.75 }, { x: w * 0.85, y: h * 0.90 }, { x: w * 1.2, y: h * 0.92 }
    ];

    const rawSlots = [
      { x: w * 0.35, y: h * 0.08 }, { x: w * 0.65, y: h * 0.12 }, { x: w * 0.55, y: h * 0.30 }, { x: w * 0.92, y: h * 0.32 },
      { x: w * 0.35, y: h * 0.35 }, { x: w * 0.10, y: h * 0.40 }, { x: w * 0.45, y: h * 0.55 }, { x: w * 0.25, y: h * 0.75 },
      { x: w * 0.65, y: h * 0.60 }, { x: w * 0.95, y: h * 0.80 }, { x: w * 0.50, y: h * 0.82 }, { x: w * 0.15, y: h * 0.92 }
    ];

    const newSlots = rawSlots.map((s, i) => {
      const existing = state.slots[i]?.occupied;
      const slot = { ...s, occupied: existing || null, idx: i };
      if (existing) { existing.x = s.x; existing.y = s.y; existing.slot = slot; }
      return slot;
    });
    state.slots = newSlots;
  }

  function spawnEnemy(type) {
    const base = ENEMY[type];
    const hpScale = Math.pow(1.12, state.wave - 1);
    const hp = Math.round(base.baseHp * hpScale);
    const reward = base.isBoss
      ? BOSS_GOLD
      : Math.floor(GOLD_PER_KILL * Math.pow(GOLD_KILL_GROWTH, state.wave - 1));

    const e = {
      type, shape: base.shape,
      x: state.path[0].x, y: state.path[0].y,
      targetIdx: 1,
      hp, maxHp: hp,
      speed: base.baseSpeed,
      size: base.size,
      reward,
      isBoss: !!base.isBoss,
      slowFactor: 1, slowEnd: 0,
      traveled: 0,
      dead: false
    };

    state.enemies.push(e);

    // boss spawn timestamp for ttk
    if (e.isBoss && state.waveMetrics) {
      state.waveMetrics.bossSpawnAt = performance.now();
    }
  }

  function computeWaveCounts() {
    const isBossWave = (state.wave % 5 === 0);
    const baseCount = isBossWave
      ? 1
      : Math.min(WAVE_COUNT_MAX, Math.ceil(WAVE_COUNT_BASE * Math.pow(WAVE_COUNT_GROWTH, state.wave - 1)));

    let extra = 0;
    if (!isBossWave && state.wave >= EXTRA_FROM_WAVE) {
      extra = Math.min(EXTRA_MAX, Math.floor(5 + (state.wave - EXTRA_FROM_WAVE) * 0.75));
    }
    return { isBossWave, baseCount, extra };
  }

  function spawnWave() {
    if (state.waveActive || state.reportOpen) return;

    state.wave++;
    state.waveActive = true;
    state.waveSpawned = 0;
    state.waveKilled = 0;

    const { isBossWave, baseCount, extra } = computeWaveCounts();
    startWaveMetrics(isBossWave);

    state.waveTotal = baseCount + extra;

    const baseInterval = (isBossWave ? 1400 : 600) / state.speed;
    const extraInterval = Math.max(140, baseInterval * EXTRA_SPAWN_MULT);

    state.spawn.mainLeft = baseCount;
    state.spawn.extraLeft = extra;
    state.spawn.interval = baseInterval;
    state.spawn.extraInterval = extraInterval;
    state.spawn.nextAt = performance.now() + 250;

    updateUI();
  }

  function explode(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 0.4 + Math.random() * 0.4,
        color
      });
    }
  }

  function processImpact(p) {
    const now = performance.now();

    const hits = p.aoe > 0
      ? state.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= p.aoe)
      : state.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= 20).slice(0, 1);

    hits.forEach(e => {
      const before = e.hp;
      e.hp -= p.damage;

      // damage tracking (real damage, capped by remaining hp)
      const dealt = Math.max(0, Math.min(p.damage, before));
      if (state.waveMetrics) {
        state.waveMetrics.totalDamage += dealt;
        const bt = state.waveMetrics.byType[p.ownerType] || null;
        if (bt) bt.damage += dealt;
      }

      if (p.slow) { e.slowFactor = p.slow; e.slowEnd = now + p.slowDur; }

      if (e.hp <= 0 && !e.dead) {
        e.dead = true;

        // gold income from kills
        state.gold += e.reward;
        if (state.waveMetrics) state.waveMetrics.goldIncomeKills += e.reward;

        state.waveKilled++;

        // kill tracking
        if (state.waveMetrics) {
          state.waveMetrics.totalKills++;
          const bt = state.waveMetrics.byType[p.ownerType] || null;
          if (bt) bt.kills++;
          if (e.isBoss) state.waveMetrics.bossKilledAt = performance.now();
        }

        explode(e.x, e.y, e.isBoss ? "#f43f5e" : p.color, e.isBoss ? 40 : 15);
      }
    });

    state.enemies = state.enemies.filter(e => !e.dead);
    explode(p.x, p.y, p.color, p.aoe > 0 ? 12 : 5);

    updateUI();
    checkWaveEnd();
  }

  function checkWaveEnd() {
    if (state.waveActive && state.enemies.length === 0 && state.spawn.mainLeft <= 0 && state.spawn.extraLeft <= 0) {
      state.waveActive = false;

      const bonus = Math.round(WAVE_BONUS_BASE * Math.pow(WAVE_BONUS_GROWTH, state.wave - 1));
      state.gold += bonus;

      updateUI();

      // show report (pauses)
      finalizeWaveMetricsAndReport(bonus);
    }
  }

  function update(dt) {
    if (state.hp <= 0) return;
    if (state.reportOpen) return; // pause while report is visible

    // Spawn driver
    if (state.waveActive) {
      const now = performance.now();
      if (now >= state.spawn.nextAt) {
        const isBossWave = (state.wave % 5 === 0);

        if (isBossWave && state.spawn.mainLeft > 0) {
          spawnEnemy("boss");
          state.spawn.mainLeft--;
          state.waveSpawned++;
          state.spawn.nextAt = now + (state.spawn.interval / state.speed);
        } else {
          if (state.spawn.mainLeft > 0) {
            spawnEnemy(Math.random() < 0.3 ? "tank" : "fast");
            state.spawn.mainLeft--;
            state.waveSpawned++;
            state.spawn.nextAt = now + (state.spawn.interval / state.speed);
          } else if (state.spawn.extraLeft > 0) {
            spawnEnemy(Math.random() < 0.35 ? "tank" : "fast");
            state.spawn.extraLeft--;
            state.waveSpawned++;
            state.spawn.nextAt = now + (state.spawn.extraInterval / state.speed);
          }
        }
        updateUI();
      }
    }

    // Particles
    state.particles = state.particles.filter(p => {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.life -= dt;
      return p.life > 0;
    });

    // Enemies
    const now = performance.now();
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const target = state.path[e.targetIdx];
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (dist < 5) {
        e.targetIdx++;
        if (e.targetIdx >= state.path.length) {
          state.hp -= e.isBoss ? 5 : 1;
          stage?.classList.add("shake");
          setTimeout(() => stage?.classList.remove("shake"), 400);
          state.enemies.splice(i, 1);
          updateUI();
          checkWaveEnd();
          continue;
        }
      }

      const slow = (e.slowEnd > now) ? e.slowFactor : 1;
      const step = e.speed * slow * dt * 60;
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
      e.traveled += step;
    }

    // Towers
    for (const t of state.towers) {
      t.cooldown -= dt * 1000;
      if (t.cooldown <= 0) {
        const inRange = state.enemies.filter(e => Math.hypot(e.x - t.x, e.y - t.y) <= t.range);
        if (inRange.length > 0) {
          const target =
            t.targetPriority === "Strongest"
              ? inRange.reduce((a, b) => (b.hp > a.hp ? b : a))
              : inRange.reduce((a, b) => (b.traveled > a.traveled ? b : a));

          const d = Math.hypot(target.x - t.x, target.y - t.y) || 0.001;
          state.projectiles.push({
            x: t.x, y: t.y,
            vx: ((target.x - t.x) / d) * t.projSpeed,
            vy: ((target.y - t.y) / d) * t.projSpeed,
            damage: t.damage,
            aoe: t.aoe,
            color: t.color,
            slow: t.slow,
            slowDur: t.slowDur,
            ownerType: t.id // for metrics
          });
          t.cooldown = t.fireRate;
        }
      }
    }

    // Projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      const hit = state.enemies.find(e => Math.hypot(e.x - p.x, e.y - p.y) < e.size + 5);
      if (hit) {
        processImpact(p);
        state.projectiles.splice(i, 1);
      } else if (p.x < -50 || p.x > state.w + 50 || p.y < -50 || p.y > state.h + 50) {
        state.projectiles.splice(i, 1);
      }
    }
  }

  function updateUI() {
    const hpEl = $("hp");
    const goldEl = $("gold");
    const waveEl = $("wave");
    const progEl = $("waveProgress");
    const btnStart = $("btnStart");

    if (hpEl) hpEl.innerText = state.hp;
    if (goldEl) goldEl.innerText = Math.floor(state.gold);
    if (waveEl) waveEl.innerText = state.wave;
    if (btnStart) btnStart.disabled = state.waveActive || state.reportOpen;
    if (progEl) progEl.innerText = state.waveActive ? `${state.waveKilled}/${state.waveTotal}` : "Secure";

    document.querySelectorAll("[data-buy]").forEach(btn => {
      const type = btn.dataset.buy;
      btn.disabled = state.gold < TOWER_DATA[type].cost;
    });

    if (state.activeTower) refreshCtx(state.activeTower);
    if (state.hp <= 0) handleGameOver();
  }

  function handleGameOver() {
    state.hp = 0;
    const overlay = $("overlay");
    const overlayText = $("overlayText");
    if (overlayText) overlayText.innerText = `Your firewall collapsed at Wave ${state.wave}.`;
    overlay?.classList.remove("hidden");
  }

  function resetGame() {
    state.hp = 10;
    state.gold = 120;
    state.wave = 0;
    state.waveActive = false;
    state.enemies = [];
    state.towers = [];
    state.projectiles = [];
    state.particles = [];
    state.slots.forEach(s => (s.occupied = null));
    state.spawn.mainLeft = 0;
    state.spawn.extraLeft = 0;
    state.waveMetrics = null;
    resetSellConfirm();
    closeReport();
    updateUI();
  }

  function resetSellConfirm() {
    state.sellArmedTower = null;
    state.sellArmedUntil = 0;
    const btnSell = $("btnSell");
    if (btnSell) btnSell.innerText = "Sell";
  }

  function refreshCtx(t) {
    const nextLvl = t.level + 1;
    const cost = Math.ceil(t.upgradeBase * Math.pow(1.55, t.level - 1));
    const canUp = nextLvl <= MAX_LEVEL;

    const targetMode = $("targetMode");
    const upgradeLabel = $("upgradeLabel");
    const upgradeCost = $("upgradeCost");
    const sellValue = $("sellValue");
    const btnUpgrade = $("btnUpgrade");

    // Sell confirm label
    const btnSell = $("btnSell");
    const now = performance.now();
    const armed = (state.sellArmedTower === t && now <= state.sellArmedUntil);
    if (btnSell) btnSell.innerText = armed ? "Confirm" : "Sell";

    if (targetMode) targetMode.innerText = t.targetPriority;
    if (upgradeLabel) upgradeLabel.innerText = canUp ? `Lvl ${nextLvl}` : "Maxed";
    if (upgradeCost) upgradeCost.innerText = canUp ? `${cost}🪙` : "—";
    if (sellValue) sellValue.innerText = `${Math.floor(t.spent * 0.6)}🪙`;
    if (btnUpgrade) btnUpgrade.disabled = !canUp || state.gold < cost;
  }

  function cancelSelection() {
    state.selectedType = null;
    $("selectionBar")?.classList.add("translate-y-24");
  }

  // ====== EVENTS ======
  canvas.addEventListener("pointerdown", (e) => {
    if (state.reportOpen) return; // no interactions during report

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const tower = state.towers.find(t => Math.hypot(t.x - x, t.y - y) < 25);
    if (tower) {
      state.activeTower = tower;
      if (ctxMenu) {
        ctxMenu.style.left = `${Math.max(10, Math.min(x - 88, rect.width - 180))}px`;
        ctxMenu.style.top = `${Math.max(10, Math.min(y - 140, rect.height - 180))}px`;
        ctxMenu.classList.remove("hidden");
      }
      refreshCtx(tower);
      return;
    }

    if (state.selectedType) {
      const slot = state.slots.find(s => !s.occupied && Math.hypot(s.x - x, s.y - y) < 30);
      if (slot) {
        const base = TOWER_DATA[state.selectedType];
        if (state.gold >= base.cost) {
          const unit = {
            ...base,
            x: slot.x, y: slot.y,
            level: 1,
            cooldown: 0,
            slot,
            spent: base.cost,
            targetPriority: "First",

            // design values
            baseRange: base.range,
            baseAoe: base.aoe ?? 0,

            // scaled values
            range: base.range * state.rangeScale,
            aoe: (base.aoe ?? 0) * state.rangeScale
          };

          state.towers.push(unit);
          slot.occupied = unit;

          state.gold -= base.cost;
          if (state.waveMetrics) state.waveMetrics.goldSpent += base.cost;

          cancelSelection();
          updateUI();
          return;
        }
      }
    }

    ctxMenu?.classList.add("hidden");
    state.activeTower = null;
    resetSellConfirm();
  });

  document.querySelectorAll("[data-buy]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (state.reportOpen) return;

      state.selectedType = btn.dataset.buy;
      const data = TOWER_DATA[state.selectedType];
      const selIcon = $("selIcon");
      const selName = $("selName");
      if (selIcon) selIcon.innerText = data.icon;
      if (selName) selName.innerText = data.name;
      $("selectionBar")?.classList.remove("translate-y-24");
      ctxMenu?.classList.add("hidden");
      state.activeTower = null;
      resetSellConfirm();
    });
  });

  $("btnTarget")?.addEventListener("click", () => {
    if (!state.activeTower) return;
    state.activeTower.targetPriority = state.activeTower.targetPriority === "First" ? "Strongest" : "First";
    refreshCtx(state.activeTower);
  });

  $("btnUpgrade")?.addEventListener("click", () => {
    const t = state.activeTower;
    if (!t || t.level >= MAX_LEVEL) return;

    const cost = Math.ceil(t.upgradeBase * Math.pow(1.55, t.level - 1));
    if (state.gold < cost) return;

    state.gold -= cost;
    t.spent += cost;
    if (state.waveMetrics) state.waveMetrics.goldSpent += cost;

    const m = t.mult;
    t.damage *= m.damage;

    // upgrade base then rescale
    t.baseRange *= m.range;
    t.range = t.baseRange * state.rangeScale;

    if (t.baseAoe != null && t.baseAoe > 0) {
      t.baseAoe *= m.aoe;
      t.aoe = t.baseAoe * state.rangeScale;
    }

    t.fireRate *= m.fireRate;
    t.level++;

    updateUI();
  });

  $("btnSell")?.addEventListener("click", () => {
    const t = state.activeTower;
    if (!t) return;

    const now = performance.now();
    const armed = (state.sellArmedTower === t && now <= state.sellArmedUntil);

    // first click: arm
    if (!armed) {
      state.sellArmedTower = t;
      state.sellArmedUntil = now + 1600;
      refreshCtx(t);
      return;
    }

    // confirm: sell
    state.gold += Math.floor(t.spent * 0.6);
    t.slot.occupied = null;
    state.towers = state.towers.filter(x => x !== t);

    resetSellConfirm();
    ctxMenu?.classList.add("hidden");
    state.activeTower = null;
    updateUI();
  });

  $("btnStart")?.addEventListener("click", spawnWave);

  $("btnAuto")?.addEventListener("click", () => {
    state.autoStart = !state.autoStart;
    const btnAuto = $("btnAuto");
    if (btnAuto) btnAuto.innerText = state.autoStart ? "Auto: On" : "Auto: Off";
    if (state.autoStart && !state.waveActive && !state.reportOpen) spawnWave();
  });

  $("btnRestart")?.addEventListener("click", resetGame);

  $("btnSpeed")?.addEventListener("click", () => {
    state.speed = state.speed === 1 ? 2 : (state.speed === 2 ? 4 : 1);
    const btnSpeed = $("btnSpeed");
    if (btnSpeed) btnSpeed.innerText = `${state.speed}x`;
  });

  // Overlay schließen
  window.closeOverlay = () => $("overlay")?.classList.add("hidden");
  window.cancelSelection = cancelSelection;

  // ===== LOOP =====
  function loop(now) {
    const dt = Math.min((now - state.lastFrame) / 1000, 0.1) * state.speed;
    state.lastFrame = now;
    update(dt);
    renderer.drawFrame?.();
    requestAnimationFrame(loop);
  }

  // init
  ensureReportUI();
  window.addEventListener("resize", resize);
  resize();
  updateUI();
  requestAnimationFrame(loop);
}
