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

  // =========================
  // GAME CONSTANTS / BALANCE
  // =========================
  const MAX_LEVEL = 10;

  // Referenzgröße für Range-Scaling
  const REF_W = 900;
  const REF_H = 600;

  // --- ECONOMY ---
  const GOLD_PER_KILL = 4;
  const GOLD_KILL_GROWTH = 1.05;   // erst ab Wave 20 aktiv
  const BOSS_GOLD = 200;

  const WAVE_BONUS_BASE = 20;
  const WAVE_BONUS_GROWTH = 1.05;  // erst ab Wave 20 aktiv

  // --- WAVES ---
  const WAVE_COUNT_BASE = 10;
  const WAVE_COUNT_GROWTH = 1.15;
  const WAVE_COUNT_MAX = 50;

  const EXTRA_FROM_WAVE = 30;
  const EXTRA_MAX = 20;
  const EXTRA_SPAWN_MULT = 0.60;

  // --- STATUS EFFECTS ---
  const WEAKEN_MULT = 1.08;
  const WEAKEN_DUR_MS = 2000;

  // Burn: 3% MaxHP over 3s
  const BURN_DUR_MS = 3000;
  const BURN_MAXHP_PCT = 0.03;

  // --- BOSS ARMOR RULES ---
  const BOSS_ARMOR_CANNON_MAGE_MULT = 0.20; // solange Armor > 0
  const BOSS_ARMOR_ARCHER_MULT = 1.00;
  const BOSS_ARMOR_START_AT_BOSS_INDEX = 4; // Boss 1-3 ohne Armor, ab Boss 4 (Wave 20) mit Armor

  // Armor/HP Scaling: bewusst moderat, damit “Endless” nicht bei Boss hard-capped
  const BOSS_HP_SCALE = 1.10;       // pro Boss-Wave Schritt (bossIndex)
  const BOSS_ARMOR_SCALE = 1.14;    // Armor etwas stärker
  const BOSS_HP_BASE_MULT = 0.70;   // Boss base hp runter, weil Armor dazu kommt
  const BOSS_ARMOR_BASE = 1420;      // Basis-Armor (wird skaliert)

  // =========================
  // TOWERS (mit deinen Updates)
  // =========================
  // Hinweis: fireRate ist ms zwischen Schüssen. "2x schneller" = halbieren.
  const TOWER_DATA = {
    archer: {
      id: "archer", name: "Archer", icon: "🏹", color: "#22d3ee",
      cost: 30,
      range: Math.round(170 * 1.10),                 // +10%
      fireRate: Math.round(650 / 2),                 // 2× schneller
      damage: 14 * 0.75,                             // -25%
      projSpeed: 12,
      aoe: 0,
      upgradeBase: 24,
      mult: { damage: 1.35, range: 1.08, fireRate: 0.90, aoe: 1.00, projSpeed: 1.03 }
    },

    cannon: {
      id: "cannon", name: "Cannon", icon: "💣", color: "#ec4899",
      cost: 50,
      range: 125,
      fireRate: 1100,
      damage: 38 * 1.08,                             // +8%
      projSpeed: 8,
      aoe: 0,                                        // AOE entfernt
      upgradeBase: 55,
      mult: { damage: 1.40, range: 1.06, fireRate: 0.92, aoe: 1.00, projSpeed: 1.03 }
    },

    mage: {
      id: "mage", name: "Mage", icon: "✨", color: "#8b5cf6",
      cost: 40,
      range: 145 * 0.95,                             // -5%
      fireRate: 900,
      damage: 24 * 0.85,                             // -15%
      projSpeed: 10,
      aoe: 35,
      slow: 0.55,
      slowDur: 1400,
      upgradeBase: 45,
      mult: { damage: 1.38, range: 1.07, fireRate: 0.92, aoe: 1.12, projSpeed: 1.03 }
    }
  };

  // =========================
  // ENEMIES
  // =========================
  const ENEMY = {
    fast: { shape: "circle", baseHp: 30, baseSpeed: 2.1, size: 10, slowImmune: true },
    tank: { shape: "square", baseHp: 75, baseSpeed: 1.0, size: 12 },
    summoner: {
      shape: "triangle",
      baseHp: 92,               // > tank
      baseSpeed: 1.0,           // ~tank
      size: 13,
      summonEvery: 2000,        // ms
      summonCount: 5
    },
    boss: { shape: "square", baseHp: 800, baseSpeed: 0.7, size: 25, isBoss: true }
  };

  // =========================
  // STATE
  // =========================
 const state = {
  w: 0, h: 0, dpr: 1,
  rangeScale: 1,

  hp: 10,
  gold: 100,
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

  sellArmedTower: null,
  sellArmedUntil: 0,

  // Report / Wave stats
  reportOpen: false,
  waveStats: null,
  _lastReportText: "",

  spawn: { mainLeft: 0, extraLeft: 0, nextAt: 0, interval: 0, extraInterval: 0 }
};
  const renderer = createRenderer({ canvas, ctx, state, assets });

  // =========================
  // HELPERS: REPORT / UI
  // =========================
  function startWaveStats() {
    state.waveStats = {
      wave: state.wave,
      startAt: performance.now(),
      durationMs: 0,

      goldStart: Math.floor(state.gold),
      goldKills: 0,
      goldBonus: 0,
      goldSpent: 0,

      leaks: 0,

      damageByType: { archer: 0, cannon: 0, mage: 0 },
      killsByType: { archer: 0, cannon: 0, mage: 0 },

      totalDamage: 0,
      totalKills: 0,

      bossWave: (state.wave % 5 === 0),
      bossSpawnAt: null,
      bossKilledAt: null,
      bossTTKms: null,

      bossArmorStart: null,
      bossArmorEnd: null,
      bossBroken: null,

      summonerSpawned: 0,
      summonedFast: 0
    };
  }

  function pushGoldSpent(amount) {
    if (!state.waveStats) return;
    state.waveStats.goldSpent += Math.floor(amount);
  }

  function pushGoldKillIncome(amount) {
    if (!state.waveStats) return;
    state.waveStats.goldKills += Math.floor(amount);
  }

  function pushGoldWaveBonus(amount) {
    if (!state.waveStats) return;
    state.waveStats.goldBonus += Math.floor(amount);
  }

  function pushDamage(sourceType, amount) {
    if (!state.waveStats) return;
    const a = Math.max(0, amount || 0);
    state.waveStats.totalDamage += a;
    if (state.waveStats.damageByType[sourceType] != null) {
      state.waveStats.damageByType[sourceType] += a;
    }
  }

  function pushKill(sourceType) {
    if (!state.waveStats) return;
    state.waveStats.totalKills += 1;
    if (state.waveStats.killsByType[sourceType] != null) {
      state.waveStats.killsByType[sourceType] += 1;
    }
  }
function buildReportText(stats) {
  // kompakt, gut für Chat / Debug
  const o = {
    wave: stats.wave,
    duration_s: +(stats.durationMs / 1000).toFixed(2),

    gold: {
      start: stats.goldStart,
      kills: stats.goldKills,
      bonus: stats.goldBonus,
      spent: stats.goldSpent,
      net: (stats.goldKills + stats.goldBonus - stats.goldSpent)
    },

    leaks: stats.leaks,

    damage: {
      total: Math.round(stats.totalDamage),
      archer: Math.round(stats.damageByType.archer),
      cannon: Math.round(stats.damageByType.cannon),
      mage: Math.round(stats.damageByType.mage)
    },

    kills: {
      total: stats.totalKills,
      archer: stats.killsByType.archer,
      cannon: stats.killsByType.cannon,
      mage: stats.killsByType.mage
    },

    boss: stats.bossWave ? {
      spawnAt_ms: stats.bossSpawnAt ? Math.round(stats.bossSpawnAt) : null,
      ttk_s: stats.bossTTKms ? +(stats.bossTTKms / 1000).toFixed(3) : null,
      armorStart: stats.bossArmorStart,
      armorEnd: stats.bossArmorEnd,
      broken: stats.bossBroken
    } : null,

    summoner: {
      spawned: stats.summonerSpawned,
      summonedFast: stats.summonedFast
    }
  };

  return "```json\n" + JSON.stringify(o, null, 2) + "\n```";
}

async function copyTextToClipboard(text) {
  // Standard Clipboard API
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  // Fallback (falls Clipboard API geblockt ist)
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}
  function openReportOverlay() {
  const stats = state.waveStats;
  if (!stats) return;

  stats.durationMs = performance.now() - stats.startAt;

  // Boss armor end: bleibt wie bisher "best effort"
  if (stats.bossWave && stats.bossArmorEnd == null) {
    // kein Boss gespawnt / nicht erfasst -> lassen wir es bei null
  }

  // Reporttext vorbereiten (für Copy-Button)
  state._lastReportText = buildReportText(stats);

  document.getElementById("reportOverlay")?.classList.remove("hidden");
  state.reportOpen = true;
}

  function closeReportOverlay() {
  document.getElementById("reportOverlay")?.classList.add("hidden");
  state.reportOpen = false;

  // wenn Auto an ist, Wave danach starten
  if (state.autoStart && state.hp > 0 && !state.waveActive) {
    setTimeout(() => {
      if (!state.waveActive && !state.reportOpen) spawnWave();
    }, 250);
  }
}

  function resetSellConfirm() {
    state.sellArmedTower = null;
    state.sellArmedUntil = 0;
    const btnSell = document.getElementById("btnSell");
    if (btnSell) btnSell.innerText = "Sell";
  }

  // =========================
  // RANGE SCALING
  // =========================
  function applyRangeScaleToExistingTowers() {
    for (const t of state.towers) {
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

  // =========================
  // LEVEL LAYOUT
  // =========================
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

  // =========================
  // ECONOMY CURVE (Wave<20 flach)
  // =========================
  function killGoldForWave(wave) {
    if (wave < 20) return GOLD_PER_KILL;
    const k = wave - 20;
    return Math.floor(GOLD_PER_KILL * Math.pow(GOLD_KILL_GROWTH, k));
  }

  function waveBonusForWave(wave) {
    if (wave < 20) return WAVE_BONUS_BASE;
    const k = wave - 20;
    return Math.round(WAVE_BONUS_BASE * Math.pow(WAVE_BONUS_GROWTH, k));
  }

  // =========================
  // ENEMY SPAWN
  // =========================
  function makeEnemy(type, x, y, targetIdx = 1, traveled = 0) {
    const base = ENEMY[type];

    // HP Scaling
    // - Normal enemies: wie vorher (leicht)
    // - Boss: eigene Skalierung pro BossIndex (nicht über wave-1 exponent, sonst ab 60 unspielbar)
    let hp = base.baseHp;
    let hpScale = Math.pow(1.12, state.wave - 1);

    let armorHp = 0;
    let armorMax = 0;

    const isBoss = !!base.isBoss;
if (isBoss) {
  const bossIndex = Math.max(1, Math.floor(state.wave / 5));

  hp = Math.round(base.baseHp * BOSS_HP_BASE_MULT * Math.pow(BOSS_HP_SCALE, bossIndex - 1));

  // Armor erst ab bestimmtem Boss aktivieren
  if (bossIndex >= BOSS_ARMOR_START_AT_BOSS_INDEX) {
    armorMax = Math.round(BOSS_ARMOR_BASE * Math.pow(BOSS_ARMOR_SCALE, bossIndex - 1));
    armorHp = armorMax;
  } else {
    armorMax = 0;
    armorHp = 0;
  }
} else {
  hp = Math.round(base.baseHp * hpScale);
}

    const reward = isBoss ? BOSS_GOLD : killGoldForWave(state.wave);

    const e = {
      type,
      shape: base.shape,
      x, y,
      targetIdx,
      hp, maxHp: hp,
      speed: base.baseSpeed,
      size: base.size,
      reward,
      isBoss,

           // Boss armor
      armorHp,
      armorMax,
      maxArmorHp: armorMax,   // <-- HINZUFÜGEN (Alias für render.js)
      broken: false,

      // Status effects
      slowFactor: 1,
      slowEnd: 0,

      weakenEnd: 0,       // damage taken increased
      burnEnd: 0,         // dot active until
      burnDps: 0,         // hp per second

      // Summoner
      nextSummonAt: base.summonEvery ? (performance.now() + base.summonEvery) : 0,

      traveled,
      dead: false
    };

    return e;
  }

  function spawnEnemy(type) {
    const e = makeEnemy(type, state.path[0].x, state.path[0].y, 1, 0);

    if (e.isBoss && state.waveStats) {
      state.waveStats.bossSpawnAt = performance.now();
      state.waveStats.bossArmorStart = e.armorHp;
    }
    if (type === "summoner" && state.waveStats) state.waveStats.summonerSpawned += 1;

    state.enemies.push(e);
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

  function pickNonBossEnemyType() {
    // Summoner ab Wave 15 gelegentlich
    if (state.wave >= 15 && Math.random() < 0.12) return "summoner";
    return Math.random() < 0.30 ? "tank" : "fast";
  }

  function spawnWave() {
    if (state.waveActive || state.reportOpen) return;

    state.wave++;
    state.waveActive = true;
    state.waveSpawned = 0;
    state.waveKilled = 0;

    startWaveStats();

    const { isBossWave, baseCount, extra } = computeWaveCounts();
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

  // =========================
  // PARTICLES
  // =========================
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

  // =========================
  // DAMAGE / HIT PROCESSING
  // =========================
  function damageMultiplierVsBossArmor(sourceType) {
    if (sourceType === "archer") return BOSS_ARMOR_ARCHER_MULT;
    if (sourceType === "mage" || sourceType === "cannon") return BOSS_ARMOR_CANNON_MAGE_MULT;
    return 1;
  }

  function applyWeakenIfAny(e, now) {
    // Weaken: +8% dmg taken, refreshable, not stackable
    e.weakenEnd = now + WEAKEN_DUR_MS;
  }

  function applyBurnIfAny(e, now) {
    // Burn: 3% max hp over 3s (refresh)
    e.burnEnd = now + BURN_DUR_MS;
    e.burnDps = (e.maxHp * BURN_MAXHP_PCT) / (BURN_DUR_MS / 1000);
  }

  function effectiveIncomingDamage(e, raw, now) {
    // Weaken increases damage taken (+8%)
    const weakened = e.weakenEnd > now;
    const mult = weakened ? WEAKEN_MULT : 1;
    return raw * mult;
  }

  function processImpact(p) {
    const now = performance.now();

    const hits = p.aoe > 0
      ? state.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= p.aoe)
      : state.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= 20).slice(0, 1);

    for (const e of hits) {
      let dmg = p.damage;

      // Boss Armor Rules
      if (e.isBoss && e.armorHp > 0) {
        dmg *= damageMultiplierVsBossArmor(p.sourceType);
      }

      // Weaken affects damage taken
      dmg = effectiveIncomingDamage(e, dmg, now);

      // Apply to Armor first if Boss has Armor
      let applied = 0;

      if (e.isBoss && e.armorHp > 0) {
        const take = Math.min(e.armorHp, dmg);
        e.armorHp -= take;
        applied += take;

        if (e.armorHp <= 0) {
          e.armorHp = 0;
          e.broken = true;

          if (state.waveStats) {
            state.waveStats.bossArmorEnd = 0;
            state.waveStats.bossBroken = true;
          }
        }
      } else {
        e.hp -= dmg;
        applied += dmg;
      }

      // Record damage (wir zählen Armor-Damage mit, sonst wirkt Boss “unsterblich” in den Zahlen)
      pushDamage(p.sourceType, applied);

      // Status Effects:
      // Slow: fast ist immun
      if (p.slow && !ENEMY[e.type]?.slowImmune) {
        e.slowFactor = p.slow;
        e.slowEnd = now + p.slowDur;
      }

      // Weaken: Mage ab Level 6
      if (p.applyWeaken) {
        applyWeakenIfAny(e, now);
      }

      // Burn: Mage ab Level 10
      if (p.applyBurn) {
        applyBurnIfAny(e, now);
      }

      // Kill check (Boss: HP kann erst sinken, wenn Armor weg ist – außer Archer/Mage/Cannon können danach normal)
      if (!e.dead && e.hp <= 0) {
        e.dead = true;

        state.gold += e.reward;
        pushGoldKillIncome(e.reward);

        state.waveKilled++;

        explode(e.x, e.y, e.isBoss ? "#f43f5e" : p.color, e.isBoss ? 40 : 15);

        pushKill(p.sourceType);

        if (e.isBoss && state.waveStats) {
          state.waveStats.bossKilledAt = now;
          if (state.waveStats.bossSpawnAt) {
            state.waveStats.bossTTKms = now - state.waveStats.bossSpawnAt;
          }
          state.waveStats.bossArmorEnd = e.armorHp;
          if (state.waveStats.bossBroken == null) state.waveStats.bossBroken = (e.armorHp <= 0);
        }
      }
    }

    state.enemies = state.enemies.filter(e => !e.dead);

    explode(p.x, p.y, p.color, p.aoe > 0 ? 12 : 5);

    updateUI();
    checkWaveEnd();
  }

  // =========================
  // WAVE END
  // =========================
  function checkWaveEnd() {
    if (state.waveActive && state.enemies.length === 0 && state.spawn.mainLeft <= 0 && state.spawn.extraLeft <= 0) {
      state.waveActive = false;

      const bonus = waveBonusForWave(state.wave);
      state.gold += bonus;
      pushGoldWaveBonus(bonus);

      updateUI();

      // Report nach jeder Wave öffnen
      openReportOverlay();
    }
  }

  // =========================
  // GAME OVER
  // =========================
  function handleGameOver() {
    state.hp = 0;
    const overlay = document.getElementById("overlay");
    const overlayText = document.getElementById("overlayText");
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

    state.waveStats = null;
    state._lastReportText = "";
    state.reportOpen = false;
    document.getElementById("reportOverlay")?.classList.add("hidden");

    resetSellConfirm();
    updateUI();
  }

  // =========================
  // UI
  // =========================
  function refreshCtx(t) {
    const nextLvl = t.level + 1;
    const cost = Math.ceil(t.upgradeBase * Math.pow(1.55, t.level - 1));
    const canUp = nextLvl <= MAX_LEVEL;

    const targetMode = document.getElementById("targetMode");
    const upgradeLabel = document.getElementById("upgradeLabel");
    const upgradeCost = document.getElementById("upgradeCost");
    const sellValue = document.getElementById("sellValue");
    const btnUpgrade = document.getElementById("btnUpgrade");

    const btnSell = document.getElementById("btnSell");
    const now = performance.now();
    const armed = (state.sellArmedTower === t && now <= state.sellArmedUntil);
    if (btnSell) btnSell.innerText = armed ? "Confirm" : "Sell";

    if (targetMode) targetMode.innerText = t.targetPriority;
    if (upgradeLabel) upgradeLabel.innerText = canUp ? `Lvl ${nextLvl}` : "Maxed";
    if (upgradeCost) upgradeCost.innerText = canUp ? `${cost}🪙` : "—";
    if (sellValue) sellValue.innerText = `${Math.floor(t.spent * 0.6)}🪙`;
    if (btnUpgrade) btnUpgrade.disabled = !canUp || state.gold < cost;
  }

  function updateUI() {
    const hpEl = document.getElementById("hp");
    const goldEl = document.getElementById("gold");
    const waveEl = document.getElementById("wave");
    const progEl = document.getElementById("waveProgress");
    const btnStart = document.getElementById("btnStart");

    if (hpEl) hpEl.innerText = state.hp;
    if (goldEl) goldEl.innerText = Math.floor(state.gold);
    if (waveEl) waveEl.innerText = state.wave;
    if (btnStart) btnStart.disabled = state.waveActive || state.reportOpen;
    if (progEl) progEl.innerText = state.waveActive ? `${state.waveKilled}/${state.waveTotal}` : (state.reportOpen ? "Report" : "Secure");

    document.querySelectorAll("[data-buy]").forEach(btn => {
      const type = btn.dataset.buy;
      btn.disabled = state.gold < TOWER_DATA[type].cost || state.reportOpen;
    });

    if (state.activeTower) refreshCtx(state.activeTower);
    if (state.hp <= 0) handleGameOver();
  }

  function cancelSelection() {
    state.selectedType = null;
    document.getElementById("selectionBar")?.classList.add("translate-y-24");
  }

  // =========================
  // MAIN UPDATE LOOP
  // =========================
  function update(dt) {
    if (state.hp <= 0) return;
    if (state.reportOpen) return; // pausieren, solange Report offen

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
            spawnEnemy(pickNonBossEnemyType());
            state.spawn.mainLeft--;
            state.waveSpawned++;
            state.spawn.nextAt = now + (state.spawn.interval / state.speed);
          } else if (state.spawn.extraLeft > 0) {
            spawnEnemy(pickNonBossEnemyType());
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

    const now = performance.now();

    // Status ticking (Burn DOT)
    for (const e of state.enemies) {
      if (e.burnEnd > now) {
        const dmg = e.burnDps * dt; // hp per second * seconds
        if (e.isBoss && e.armorHp > 0) {
          // Burn geht auf HP (nicht Armor) – aber solange Armor an ist, bleibt HP geschützt.
          // Wir lassen Burn trotzdem "laufen", aber HP sinkt effektiv erst wenn armor weg ist:
          // => hier bewusst: Burn wirkt nur auf HP, wenn armor==0.
          if (e.armorHp <= 0) e.hp -= dmg;
        } else {
          e.hp -= dmg;
        }
        // Burn zählt als Mage-Damage (weil Mage ihn appliziert)
        pushDamage("mage", dmg);
      }
    }

    // Enemies movement + Summoner
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];

      // Summoner spawn
      if (e.type === "summoner" && e.nextSummonAt && now >= e.nextSummonAt) {
        const cfg = ENEMY.summoner;
        e.nextSummonAt = now + cfg.summonEvery;

        for (let k = 0; k < cfg.summonCount; k++) {
          const child = makeEnemy("fast", e.x, e.y, e.targetIdx, e.traveled);
          state.enemies.push(child);
          if (state.waveStats) state.waveStats.summonedFast += 1;
        }
      }

      // Death by burn
      if (!e.dead && e.hp <= 0) {
        e.dead = true;

        state.gold += e.reward;
        pushGoldKillIncome(e.reward);

        state.waveKilled++;
        explode(e.x, e.y, e.isBoss ? "#f43f5e" : "#94a3b8", e.isBoss ? 40 : 12);

        // Burn-Kill zählt als Mage-Kill
        pushKill("mage");

        if (e.isBoss && state.waveStats) {
          state.waveStats.bossKilledAt = now;
          if (state.waveStats.bossSpawnAt) state.waveStats.bossTTKms = now - state.waveStats.bossSpawnAt;
          state.waveStats.bossArmorEnd = e.armorHp;
          if (state.waveStats.bossBroken == null) state.waveStats.bossBroken = (e.armorHp <= 0);
        }

        continue;
      }

      const target = state.path[e.targetIdx];
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (dist < 5) {
        e.targetIdx++;
        if (e.targetIdx >= state.path.length) {
          // leak
          const leak = e.isBoss ? 5 : 1;
          state.hp -= leak;
          if (state.waveStats) state.waveStats.leaks += leak;

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

    // Cleanup dead enemies (falls burn kill etc.)
    state.enemies = state.enemies.filter(e => !e.dead);

    // Towers fire
    for (const t of state.towers) {
      t.cooldown -= dt * 1000;
      if (t.cooldown > 0) continue;

      const inRange = state.enemies.filter(e => Math.hypot(e.x - t.x, e.y - t.y) <= t.range);
      if (inRange.length === 0) continue;

      const target =
        t.targetPriority === "Strongest"
          ? inRange.reduce((a, b) => (b.hp > a.hp ? b : a))
          : inRange.reduce((a, b) => (b.traveled > a.traveled ? b : a));

      const d = Math.hypot(target.x - t.x, target.y - t.y) || 0.001;

      const isMage = (t.id === "mage");
      const isArcher = (t.id === "archer");

      const applyWeaken = isMage && t.level >= 6;
      const applyBurn = isMage && t.level >= 10;

      state.projectiles.push({
        x: t.x, y: t.y,
        vx: ((target.x - t.x) / d) * t.projSpeed,
        vy: ((target.y - t.y) / d) * t.projSpeed,

        damage: t.damage,
        aoe: t.aoe,
        color: t.color,

        slow: t.slow,
        slowDur: t.slowDur,

        sourceType: t.id,                 // archer/cannon/mage
        applyWeaken,
        applyBurn,

        // Archer Armor Break ab Level 5 (Rule)
        canBreakArmor: isArcher && t.level >= 5
      });

      t.cooldown = t.fireRate;
    }

    // Projectiles move & collide
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

  // =========================
  // EVENTS
  // =========================
  canvas.addEventListener("pointerdown", (e) => {
    if (state.reportOpen) return;

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

            // Designwerte
            baseRange: base.range,
            baseAoe: base.aoe ?? 0,

            // skaliert
            range: base.range * state.rangeScale,
            aoe: (base.aoe ?? 0) * state.rangeScale
          };

          state.towers.push(unit);
          slot.occupied = unit;
          state.gold -= base.cost;
          pushGoldSpent(base.cost);

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
      const selIcon = document.getElementById("selIcon");
      const selName = document.getElementById("selName");
      if (selIcon) selIcon.innerText = data.icon;
      if (selName) selName.innerText = data.name;
      document.getElementById("selectionBar")?.classList.remove("translate-y-24");
      ctxMenu?.classList.add("hidden");
      state.activeTower = null;
      resetSellConfirm();
    });
  });

  document.getElementById("btnTarget")?.addEventListener("click", () => {
    if (!state.activeTower) return;
    state.activeTower.targetPriority = state.activeTower.targetPriority === "First" ? "Strongest" : "First";
    refreshCtx(state.activeTower);
  });

  document.getElementById("btnUpgrade")?.addEventListener("click", () => {
    const t = state.activeTower;
    if (!t || t.level >= MAX_LEVEL) return;

    const cost = Math.ceil(t.upgradeBase * Math.pow(1.55, t.level - 1));
    if (state.gold < cost) return;

    state.gold -= cost;
    t.spent += cost;
    pushGoldSpent(cost);

    const m = t.mult;
    t.damage *= m.damage;

    // BaseRange/BaseAoe upgraden, dann skalieren
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

  document.getElementById("btnSell")?.addEventListener("click", () => {
    const t = state.activeTower;
    if (!t) return;

    const now = performance.now();
    const armed = (state.sellArmedTower === t && now <= state.sellArmedUntil);

    if (!armed) {
      state.sellArmedTower = t;
      state.sellArmedUntil = now + 1600;
      refreshCtx(t);
      return;
    }

    state.gold += Math.floor(t.spent * 0.6);
    t.slot.occupied = null;
    state.towers = state.towers.filter(x => x !== t);

    resetSellConfirm();
    ctxMenu?.classList.add("hidden");
    state.activeTower = null;
    updateUI();
  });

  document.getElementById("btnStart")?.addEventListener("click", spawnWave);

  document.getElementById("btnAuto")?.addEventListener("click", () => {
    state.autoStart = !state.autoStart;
    const btnAuto = document.getElementById("btnAuto");
    if (btnAuto) btnAuto.innerText = state.autoStart ? "Auto: On" : "Auto: Off";
    if (state.autoStart && !state.waveActive && !state.reportOpen) spawnWave();
  });

  document.getElementById("btnRestart")?.addEventListener("click", resetGame);

  document.getElementById("btnSpeed")?.addEventListener("click", () => {
    state.speed = state.speed === 1 ? 2 : (state.speed === 2 ? 4 : 1);
    const btnSpeed = document.getElementById("btnSpeed");
    if (btnSpeed) btnSpeed.innerText = `${state.speed}x`;
  });

  // Overlay schließen
  window.closeOverlay = () => document.getElementById("overlay")?.classList.add("hidden");
  window.cancelSelection = cancelSelection;

  // Report Close Button (falls du lieber Listener statt onclick willst)
  document.getElementById("btnCloseReport")?.addEventListener("click", closeReportOverlay);
  document.getElementById("btnCopyReport")?.addEventListener("click", async () => {
  if (!state.waveStats) return;

  // Sicherheit: falls Overlay offen ist, ist durationMs evtl. noch frisch aktualisieren
  state.waveStats.durationMs = performance.now() - state.waveStats.startAt;
  state._lastReportText = buildReportText(state.waveStats);

  const ok = await copyTextToClipboard(state._lastReportText);

  // optionales Mini-Feedback am Button (kein UI-Overkill)
  const btn = document.getElementById("btnCopyReport");
  if (btn) {
    const old = btn.innerText;
    btn.innerText = ok ? "✅ Kopiert!" : "Copy (blocked)";
    setTimeout(() => (btn.innerText = old), 1200);
  }
});

  // =========================
  // LOOP
  // =========================
  function loop(now) {
    const dt = Math.min((now - state.lastFrame) / 1000, 0.1) * state.speed;
    state.lastFrame = now;
    update(dt);
    renderer.drawFrame?.();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  updateUI();
  requestAnimationFrame(loop);
}
