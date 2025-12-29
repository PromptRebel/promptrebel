// js/game.js
import { createRenderer } from "./render.js";

/**
 * startGame is called from main.js like:
 *   const game = await startGame({ canvas, assets });
 */
export async function startGame({ canvas, assets }) {
  if (!canvas) throw new Error("canvas missing");

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context missing");
  ctx.imageSmoothingEnabled = false;

  const stage = document.getElementById("gameStage");
  if (!stage) throw new Error("#gameStage missing in DOM");

  const ctxMenu = document.getElementById("ctxMenu");

  // =========================
  // GAME CONSTANTS / BALANCE
  // =========================
  const MAX_LEVEL = 10;

  // Reference size for range scaling
  const REF_W = 900;
  const REF_H = 600;

  // --- ECONOMY ---
  const GOLD_PER_KILL = 4;
  const GOLD_KILL_GROWTH = 1.05; // active from wave 20
  const BOSS_GOLD = 200;

  const WAVE_BONUS_BASE = 20;
  const WAVE_BONUS_GROWTH = 1.05; // active from wave 20

  // --- WAVES ---
  const WAVE_COUNT_BASE = 10;
  const WAVE_COUNT_GROWTH = 1.15;
  const WAVE_COUNT_MAX = 50;

  const EXTRA_FROM_WAVE = 30;
  const EXTRA_MAX = 20;
  const EXTRA_SPAWN_MULT = 0.6;

  // --- STATUS EFFECTS ---
  const WEAKEN_MULT = 1.08;
  const WEAKEN_DUR_MS = 2000;

  // Burn: 3% MaxHP over 3s
  const BURN_DUR_MS = 3000;
  const BURN_MAXHP_PCT = 0.03;

  // --- BOSS ARMOR RULES ---
  const BOSS_ARMOR_CANNON_MAGE_MULT = 0.2; // while armor > 0
  const BOSS_ARMOR_ARCHER_MULT = 1.0;
  const BOSS_ARMOR_START_AT_BOSS_INDEX = 4; // boss 1-3 no armor, boss 4+ (wave 20+) has armor

  // Armor/HP Scaling
  const BOSS_HP_SCALE = 1.1; // per bossIndex
  const BOSS_ARMOR_SCALE = 1.14;
  const BOSS_HP_BASE_MULT = 0.7;
  const BOSS_ARMOR_BASE = 1420;

  // =========================
  // TOWERS
  // =========================
  const TOWER_DATA = {
    archer: {
      id: "archer",
      name: "Archer",
      icon: "🏹",
      color: "#22d3ee",
      cost: 30,
      range: Math.round(170 * 1.1), // +10%
      fireRate: Math.round(650 / 2), // 2× faster
      damage: 14 * 0.75, // -25%
      projSpeed: 12,
      aoe: 0,
      upgradeBase: 24,
      mult: { damage: 1.35, range: 1.08, fireRate: 0.9, aoe: 1.0, projSpeed: 1.03 },
    },

    cannon: {
      id: "cannon",
      name: "Cannon",
      icon: "💣",
      color: "#ec4899",
      cost: 50,
      range: 125,
      fireRate: 1100,
      damage: 43,
      projSpeed: 8,
      aoe: 0,
      upgradeBase: 50,
      mult: { damage: 1.4, range: 1.06, fireRate: 0.92, aoe: 1.0, projSpeed: 1.03 },
    },

    mage: {
      id: "mage",
      name: "Mage",
      icon: "✨",
      color: "#8b5cf6",
      cost: 40,
      range: 145 * 0.95, // -5%
      fireRate: 900,
      damage: 24 * 0.85, // -15%
      projSpeed: 10,
      aoe: 35,
      slow: 0.55,
      slowDur: 1400,
      upgradeBase: 45,
      mult: { damage: 1.38, range: 1.07, fireRate: 0.92, aoe: 1.12, projSpeed: 1.03 },
    },
  };

  // =========================
  // ENEMIES
  // =========================
  const ENEMY = {
    fast: { shape: "circle", baseHp: 30, baseSpeed: 2.1, size: 10, slowImmune: true },
    tank: { shape: "square", baseHp: 75, baseSpeed: 1.0, size: 12 },
    summoner: {
      shape: "triangle",
      baseHp: 92,
      baseSpeed: 1.0,
      size: 13,
      summonEvery: 2000,
      summonCount: 5,
    },
    minion: {
      shape: "hex",
      baseHp: 18,
      baseSpeed: 1.7,
      size: 8,
      slowImmune: false,
    },
    boss: { shape: "square", baseHp: 800, baseSpeed: 0.7, size: 25, isBoss: true },
  };

  // =========================
  // STATE
  // =========================
  const state = {
    w: 0,
    h: 0,
    dpr: 1,
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

    effects: {
      overdriveUntil: 0,
    },

    // Report / Wave stats
    reportOpen: false,
    waveStats: null,
    _lastReportText: "",

    spawn: { mainLeft: 0, extraLeft: 0, nextAt: 0, interval: 0, extraInterval: 0 },
  };

  // simple unique id generator for towers
  let _towerUid = 0;
  const nextTowerUid = () => ++_towerUid;

  const renderer = createRenderer({ canvas, ctx, state, assets });

  // =========================
  // SPELLS
  // =========================
  function castOverdrive() {
    const now = performance.now();
    const COST = 500;
    const DUR_MS = 8000;

    if (state.reportOpen || state.hp <= 0) return false;
    if (state.gold < COST) return false;

    state.gold -= COST;
    state.effects.overdriveUntil = now + DUR_MS;

    updateUI();
    return true;
  }

  // =========================
  // HELPERS: REPORT / UI
  // =========================
  function towerExport(t) {
    return {
      uid: t.uid,
      type: t.id,
      name: t.name,
      level: t.level,
      slotIdx: t.slot?.idx ?? null,
      x: Math.round(t.x),
      y: Math.round(t.y),
      damage: +t.damage.toFixed(3),
      range: +t.range.toFixed(3),
      fireRate_ms: +t.fireRate.toFixed(3),
      aoe: +t.aoe.toFixed(3),
      spent: Math.floor(t.spent || 0),
      target: t.targetPriority,
    };
  }

  function ensureTowerStats(towerUid, towerType) {
    if (!state.waveStats) return null;
    if (!state.waveStats.towersById[towerUid]) {
      state.waveStats.towersById[towerUid] = {
        uid: towerUid,
        type: towerType,
        damage: 0,
        kills: { fast: 0, tank: 0, summoner: 0, boss: 0 },
      };
    }
    return state.waveStats.towersById[towerUid];
  }

  function classifyEnemyForStats(e) {
    return e.isBoss ? "boss" : e.type;
  }

  function computeEnemySpawnStatsForWave(wave) {
    const hpScale = Math.pow(1.12, wave - 1);
    const bossIndex = Math.max(1, Math.floor(wave / 5));

    const fastHp = Math.round(ENEMY.fast.baseHp * hpScale);
    const tankHp = Math.round(ENEMY.tank.baseHp * hpScale);
    const summonerHp = Math.round(ENEMY.summoner.baseHp * hpScale);

    const bossHp = Math.round(ENEMY.boss.baseHp * BOSS_HP_BASE_MULT * Math.pow(BOSS_HP_SCALE, bossIndex - 1));
    const bossArmor =
      bossIndex >= BOSS_ARMOR_START_AT_BOSS_INDEX
        ? Math.round(BOSS_ARMOR_BASE * Math.pow(BOSS_ARMOR_SCALE, bossIndex - 1))
        : 0;

    return {
      wave,
      hpScale: +hpScale.toFixed(6),
      fast: { hp: fastHp },
      tank: { hp: tankHp },
      summoner: { hp: summonerHp, summonEvery_ms: ENEMY.summoner.summonEvery, summonCount: ENEMY.summoner.summonCount },
      boss: { hp: bossHp, armor: bossArmor, bossIndex },
    };
  }

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

      bossWave: state.wave % 5 === 0,
      bossSpawnAt: null,
      bossKilledAt: null,
      bossTTKms: null,

      bossArmorStart: null,
      bossArmorEnd: null,
      bossBroken: null,

      summonerSpawned: 0,
      summonedFast: 0,

      enemySpawn: computeEnemySpawnStatsForWave(state.wave),

      events: { placed: [], upgraded: [], sold: [] },

      towersStart: state.towers.map(towerExport),
      towersEnd: [],

      towersById: {},
      killsByEnemyType: { fast: 0, tank: 0, summoner: 0, boss: 0 },
    };

    for (const t of state.towers) ensureTowerStats(t.uid, t.id);
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
    if (state.waveStats.damageByType[sourceType] != null) state.waveStats.damageByType[sourceType] += a;
  }

  function pushDamageTower(towerUid, towerType, amount) {
    if (!state.waveStats) return;
    const a = Math.max(0, amount || 0);
    const rec = ensureTowerStats(towerUid, towerType);
    if (rec) rec.damage += a;
  }

  function pushKill(sourceType) {
    if (!state.waveStats) return;
    state.waveStats.totalKills += 1;
    if (state.waveStats.killsByType[sourceType] != null) state.waveStats.killsByType[sourceType] += 1;
  }

  function pushKillTower(towerUid, towerType, enemyKind) {
    if (!state.waveStats) return;
    const rec = ensureTowerStats(towerUid, towerType);
    if (rec && rec.kills[enemyKind] != null) rec.kills[enemyKind] += 1;
    if (state.waveStats.killsByEnemyType[enemyKind] != null) state.waveStats.killsByEnemyType[enemyKind] += 1;
  }

  function buildReportText(stats) {
    const o = {
      wave: stats.wave,
      duration_s: +(stats.durationMs / 1000).toFixed(2),

      gold: {
        start: stats.goldStart,
        kills: stats.goldKills,
        bonus: stats.goldBonus,
        spent: stats.goldSpent,
        net: stats.goldKills + stats.goldBonus - stats.goldSpent,
      },

      leaks: stats.leaks,
      enemy_spawn: stats.enemySpawn,

      damage: {
        total: Math.round(stats.totalDamage),
        archer: Math.round(stats.damageByType.archer),
        cannon: Math.round(stats.damageByType.cannon),
        mage: Math.round(stats.damageByType.mage),
      },

      kills: {
        total: stats.totalKills,
        archer: stats.killsByType.archer,
        cannon: stats.killsByType.cannon,
        mage: stats.killsByType.mage,
      },

      kills_by_enemy: stats.killsByEnemyType,

      boss: stats.bossWave
        ? {
            spawnAt_ms: stats.bossSpawnAt ? Math.round(stats.bossSpawnAt) : null,
            ttk_s: stats.bossTTKms ? +(stats.bossTTKms / 1000).toFixed(3) : null,
            armorStart: stats.bossArmorStart,
            armorEnd: stats.bossArmorEnd,
            broken: stats.bossBroken,
          }
        : null,

      summoner: {
        spawned: stats.summonerSpawned,
        summonedFast: stats.summonedFast,
      },

      events: stats.events,
      towers_start: stats.towersStart,
      towers_end: stats.towersEnd,

      tower_perf: Object.values(stats.towersById).map((t) => ({
        uid: t.uid,
        type: t.type,
        damage: Math.round(t.damage),
        kills: t.kills,
      })),
    };

    return "```json\n" + JSON.stringify(o, null, 2) + "\n```";
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
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
    stats.towersEnd = state.towers.map(towerExport);
    state._lastReportText = buildReportText(stats);

    document.getElementById("reportOverlay")?.classList.remove("hidden");
    state.reportOpen = true;
  }

  function closeReportOverlay() {
    document.getElementById("reportOverlay")?.classList.add("hidden");
    state.reportOpen = false;

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
    state.rangeScale = Math.max(0.8, Math.min(1.6, raw));

    setupLevel(state.w, state.h);
    applyRangeScaleToExistingTowers();
    renderer.rebuild?.();
  }

  // =========================
  // LEVEL LAYOUT
  // =========================
  function setupLevel(w, h) {
    state.path = [
      { x: -60, y: h * 0.15 },
      { x: w * 0.2, y: h * 0.15 },
      { x: w * 0.5, y: h * 0.2 },
      { x: w * 0.8, y: h * 0.25 },
      { x: w * 0.8, y: h * 0.4 },
      { x: w * 0.4, y: h * 0.45 },
      { x: w * 0.15, y: h * 0.5 },
      { x: w * 0.15, y: h * 0.65 },
      { x: w * 0.5, y: h * 0.7 },
      { x: w * 0.85, y: h * 0.75 },
      { x: w * 0.85, y: h * 0.9 },
      { x: w * 1.2, y: h * 0.92 },
    ];

    const rawSlots = [
      { x: w * 0.35, y: h * 0.08 },
      { x: w * 0.65, y: h * 0.12 },
      { x: w * 0.55, y: h * 0.3 },
      { x: w * 0.92, y: h * 0.32 },
      { x: w * 0.35, y: h * 0.35 },
      { x: w * 0.1, y: h * 0.4 },
      { x: w * 0.45, y: h * 0.55 },
      { x: w * 0.25, y: h * 0.75 },
      { x: w * 0.65, y: h * 0.6 },
      { x: w * 0.95, y: h * 0.8 },
      { x: w * 0.5, y: h * 0.82 },
      { x: w * 0.15, y: h * 0.92 },
    ];

    const newSlots = rawSlots.map((s, i) => {
      const existing = state.slots[i]?.occupied;
      const slot = { ...s, occupied: existing || null, idx: i };
      if (existing) {
        existing.x = s.x;
        existing.y = s.y;
        existing.slot = slot;
      }
      return slot;
    });

    state.slots = newSlots;
  }

  // =========================
  // ECONOMY CURVE
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

    let hp = base.baseHp;
    const hpScale = Math.pow(1.12, state.wave - 1);

    let armorHp = 0;
    let armorMax = 0;

    const isBoss = !!base.isBoss;

    if (isBoss) {
      const bossIndex = Math.max(1, Math.floor(state.wave / 5));
      hp = Math.round(base.baseHp * BOSS_HP_BASE_MULT * Math.pow(BOSS_HP_SCALE, bossIndex - 1));

      if (bossIndex >= BOSS_ARMOR_START_AT_BOSS_INDEX) {
        armorMax = Math.round(BOSS_ARMOR_BASE * Math.pow(BOSS_ARMOR_SCALE, bossIndex - 1));
        armorHp = armorMax;
      }
    } else {
      hp = Math.round(base.baseHp * hpScale);
    }

    const reward = isBoss ? BOSS_GOLD : killGoldForWave(state.wave);

    return {
      type,
      shape: base.shape,
      x,
      y,
      targetIdx,
      hp,
      maxHp: hp,
      speed: base.baseSpeed,
      size: base.size,
      reward,
      isBoss,

      // Boss armor
      armorHp,
      armorMax,
      maxArmorHp: armorMax, // alias for render.js
      broken: false,

      // Status effects
      slowFactor: 1,
      slowEnd: 0,

      weakenEnd: 0,
      burnEnd: 0,
      burnDps: 0,

      // Summoner
      nextSummonAt: base.summonEvery ? performance.now() + base.summonEvery : 0,

      traveled,
      dead: false,
    };
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
    const isBossWave = state.wave % 5 === 0;
    const baseCount = isBossWave ? 1 : Math.min(WAVE_COUNT_MAX, Math.ceil(WAVE_COUNT_BASE * Math.pow(WAVE_COUNT_GROWTH, state.wave - 1)));

    let extra = 0;
    if (!isBossWave && state.wave >= EXTRA_FROM_WAVE) {
      extra = Math.min(EXTRA_MAX, Math.floor(5 + (state.wave - EXTRA_FROM_WAVE) * 0.75));
    }
    return { isBossWave, baseCount, extra };
  }

  function pickNonBossEnemyType() {
    if (state.wave >= 15 && Math.random() < 0.12) return "summoner";
    return Math.random() < 0.3 ? "tank" : "fast";
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
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 0.4 + Math.random() * 0.4,
        color,
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
    e.weakenEnd = now + WEAKEN_DUR_MS;
  }

  function applyBurnIfAny(e, now) {
    e.burnEnd = now + BURN_DUR_MS;
    e.burnDps = (e.maxHp * BURN_MAXHP_PCT) / (BURN_DUR_MS / 1000);
  }

  function effectiveIncomingDamage(e, raw, now) {
    const weakened = e.weakenEnd > now;
    const mult = weakened ? WEAKEN_MULT : 1;
    return raw * mult;
  }

  function processImpact(p) {
    const now = performance.now();

    const hits =
      p.aoe > 0
        ? state.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= p.aoe)
        : state.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= 20).slice(0, 1);

    for (const e of hits) {
      let dmg = p.damage;

      // Boss armor rules
      if (e.isBoss && e.armorHp > 0) {
        dmg *= damageMultiplierVsBossArmor(p.sourceType);
      }

      // Weaken affects damage taken
      dmg = effectiveIncomingDamage(e, dmg, now);

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

      // Record damage (type + per tower)
      pushDamage(p.sourceType, applied);
      if (p.towerUid != null) pushDamageTower(p.towerUid, p.sourceType, applied);

      // Status effects
      if (p.slow && !ENEMY[e.type]?.slowImmune) {
        e.slowFactor = p.slow;
        e.slowEnd = now + p.slowDur;
      }

      if (p.applyWeaken) applyWeakenIfAny(e, now);
      if (p.applyBurn) applyBurnIfAny(e, now);

      // Kill check
      if (!e.dead && e.hp <= 0) {
        e.dead = true;

        state.gold += e.reward;
        pushGoldKillIncome(e.reward);

        state.waveKilled++;

        explode(e.x, e.y, e.isBoss ? "#f43f5e" : p.color, e.isBoss ? 40 : 15);

        pushKill(p.sourceType);

        const kind = classifyEnemyForStats(e);
        if (p.towerUid != null) pushKillTower(p.towerUid, p.sourceType, kind);

        if (e.isBoss && state.waveStats) {
          state.waveStats.bossKilledAt = now;
          if (state.waveStats.bossSpawnAt) state.waveStats.bossTTKms = now - state.waveStats.bossSpawnAt;
          state.waveStats.bossArmorEnd = e.armorHp;
          if (state.waveStats.bossBroken == null) state.waveStats.bossBroken = e.armorHp <= 0;
        }
      }
    }

    state.enemies = state.enemies.filter((e) => !e.dead);

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
    state.slots.forEach((s) => (s.occupied = null));

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
    const armed = state.sellArmedTower === t && now <= state.sellArmedUntil;
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
    if (progEl) progEl.innerText = state.waveActive ? `${state.waveKilled}/${state.waveTotal}` : state.reportOpen ? "Report" : "Secure";

    document.querySelectorAll("[data-buy]").forEach((btn) => {
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
    if (state.reportOpen) return;

    // Spawn driver
    if (state.waveActive) {
      const now = performance.now();
      if (now >= state.spawn.nextAt) {
        const isBossWave = state.wave % 5 === 0;

        if (isBossWave && state.spawn.mainLeft > 0) {
          spawnEnemy("boss");
          state.spawn.mainLeft--;
          state.waveSpawned++;
          state.spawn.nextAt = now + state.spawn.interval / state.speed;
        } else {
          if (state.spawn.mainLeft > 0) {
            spawnEnemy(pickNonBossEnemyType());
            state.spawn.mainLeft--;
            state.waveSpawned++;
            state.spawn.nextAt = now + state.spawn.interval / state.speed;
          } else if (state.spawn.extraLeft > 0) {
            spawnEnemy(pickNonBossEnemyType());
            state.spawn.extraLeft--;
            state.waveSpawned++;
            state.spawn.nextAt = now + state.spawn.extraInterval / state.speed;
          }
        }
        updateUI();
      }
    }

    // Particles
    state.particles = state.particles.filter((p) => {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt;
      return p.life > 0;
    });

    const now = performance.now();

    // Status ticking (Burn DOT)
    for (const e of state.enemies) {
      if (e.burnEnd > now) {
        const dmg = e.burnDps * dt;

        if (e.isBoss && e.armorHp > 0) {
          if (e.armorHp <= 0) e.hp -= dmg;
        } else {
          e.hp -= dmg;
        }

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
          const child = makeEnemy("minion", e.x, e.y, e.targetIdx, e.traveled);
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

        pushKill("mage");
        const kind = classifyEnemyForStats(e);
        if (state.waveStats && state.waveStats.killsByEnemyType[kind] != null) state.waveStats.killsByEnemyType[kind] += 1;

        if (e.isBoss && state.waveStats) {
          state.waveStats.bossKilledAt = now;
          if (state.waveStats.bossSpawnAt) state.waveStats.bossTTKms = now - state.waveStats.bossSpawnAt;
          state.waveStats.bossArmorEnd = e.armorHp;
          if (state.waveStats.bossBroken == null) state.waveStats.bossBroken = e.armorHp <= 0;
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
          const leak = e.isBoss ? 5 : 1;
          state.hp -= leak;
          if (state.waveStats) state.waveStats.leaks += leak;

          stage.classList.add("shake");
          setTimeout(() => stage.classList.remove("shake"), 400);

          state.enemies.splice(i, 1);
          updateUI();
          checkWaveEnd();
          continue;
        }
      }

      const slow = e.slowEnd > now ? e.slowFactor : 1;
      const step = e.speed * slow * dt * 60;

      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
      e.traveled += step;
    }

    // Cleanup dead enemies
    state.enemies = state.enemies.filter((e) => !e.dead);

    // ---- Overdrive multiplier (affects tower fire rate + projectile speed)
    const overdriveOn = state.effects.overdriveUntil > now;
    const OD_FIRE_MULT = 0.55; // lower = faster shots (cooldown set to fireRate)
    const OD_PROJ_MULT = 1.35;

    // Towers fire
    for (const t of state.towers) {
      t.cooldown -= dt * 1000;
      if (t.cooldown > 0) continue;

      const inRange = state.enemies.filter((e) => Math.hypot(e.x - t.x, e.y - t.y) <= t.range);
      if (inRange.length === 0) continue;

      const target =
        t.targetPriority === "Strongest"
          ? inRange.reduce((a, b) => (b.hp > a.hp ? b : a))
          : inRange.reduce((a, b) => (b.traveled > a.traveled ? b : a));

      const d = Math.hypot(target.x - t.x, target.y - t.y) || 0.001;

      const isMage = t.id === "mage";
      const isArcher = t.id === "archer";

      const applyWeaken = isMage && t.level >= 6;
      const applyBurn = isMage && t.level >= 10;

      const projSpeed = t.projSpeed * (overdriveOn ? OD_PROJ_MULT : 1);

      state.projectiles.push({
        x: t.x,
        y: t.y,
        vx: ((target.x - t.x) / d) * projSpeed,
        vy: ((target.y - t.y) / d) * projSpeed,

        damage: t.damage,
        aoe: t.aoe,
        color: t.color,

        slow: t.slow,
        slowDur: t.slowDur,

        sourceType: t.id,
        towerUid: t.uid,
        applyWeaken,
        applyBurn,

        canBreakArmor: isArcher && t.level >= 5,
      });

      // cooldown reset (fireRate)
      t.cooldown = t.fireRate * (overdriveOn ? OD_FIRE_MULT : 1);
    }

    // Projectiles move & collide
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      const hit = state.enemies.find((e) => Math.hypot(e.x - p.x, e.y - p.y) < e.size + 5);
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

    const tower = state.towers.find((t) => Math.hypot(t.x - x, t.y - y) < 25);
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
      const slot = state.slots.find((s) => !s.occupied && Math.hypot(s.x - x, s.y - y) < 30);
      if (slot) {
        const base = TOWER_DATA[state.selectedType];
        if (state.gold >= base.cost) {
          const uid = nextTowerUid();

          const unit = {
            ...base,
            uid,

            x: slot.x,
            y: slot.y,
            level: 1,
            cooldown: 0,
            slot,
            spent: base.cost,
            targetPriority: "First",

            baseRange: base.range,
            baseAoe: base.aoe ?? 0,

            range: base.range * state.rangeScale,
            aoe: (base.aoe ?? 0) * state.rangeScale,
          };

          state.towers.push(unit);
          slot.occupied = unit;
          state.gold -= base.cost;
          pushGoldSpent(base.cost);

          if (state.waveStats && state.waveActive) {
            state.waveStats.events.placed.push({
              at_ms: Math.round(performance.now()),
              uid: unit.uid,
              type: unit.id,
              level: unit.level,
              slotIdx: slot.idx,
              x: Math.round(unit.x),
              y: Math.round(unit.y),
              cost: base.cost,
            });
            ensureTowerStats(unit.uid, unit.id);
          }

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

  document.querySelectorAll("[data-buy]").forEach((btn) => {
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

    const oldLevel = t.level;

    state.gold -= cost;
    t.spent += cost;
    pushGoldSpent(cost);

    const m = t.mult;
    t.damage *= m.damage;

    t.baseRange *= m.range;
    t.range = t.baseRange * state.rangeScale;

    if (t.baseAoe != null && t.baseAoe > 0) {
      t.baseAoe *= m.aoe;
      t.aoe = t.baseAoe * state.rangeScale;
    }

    t.fireRate *= m.fireRate;
    t.level++;

    if (state.waveStats && state.waveActive) {
      state.waveStats.events.upgraded.push({
        at_ms: Math.round(performance.now()),
        uid: t.uid,
        type: t.id,
        fromLevel: oldLevel,
        toLevel: t.level,
        cost,
        slotIdx: t.slot?.idx ?? null,
        x: Math.round(t.x),
        y: Math.round(t.y),
        newDamage: +t.damage.toFixed(3),
        newRange: +t.range.toFixed(3),
        newFireRate_ms: +t.fireRate.toFixed(3),
        newAoe: +t.aoe.toFixed(3),
      });
      ensureTowerStats(t.uid, t.id);
    }

    updateUI();
  });

  document.getElementById("btnSell")?.addEventListener("click", () => {
    const t = state.activeTower;
    if (!t) return;

    const now = performance.now();
    const armed = state.sellArmedTower === t && now <= state.sellArmedUntil;

    if (!armed) {
      state.sellArmedTower = t;
      state.sellArmedUntil = now + 1600;
      refreshCtx(t);
      return;
    }

    const refund = Math.floor(t.spent * 0.6);
    state.gold += refund;

    if (state.waveStats && state.waveActive) {
      state.waveStats.events.sold.push({
        at_ms: Math.round(performance.now()),
        uid: t.uid,
        type: t.id,
        level: t.level,
        slotIdx: t.slot?.idx ?? null,
        x: Math.round(t.x),
        y: Math.round(t.y),
        refund,
        spent: Math.floor(t.spent || 0),
      });
    }

    t.slot.occupied = null;
    state.towers = state.towers.filter((x) => x !== t);

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
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
    const btnSpeed = document.getElementById("btnSpeed");
    if (btnSpeed) btnSpeed.innerText = `${state.speed}x`;
  });

  // Overlay schließen
  window.closeOverlay = () => document.getElementById("overlay")?.classList.add("hidden");
  window.cancelSelection = cancelSelection;

  // Report buttons
  document.getElementById("btnCloseReport")?.addEventListener("click", closeReportOverlay);

  document.getElementById("btnCopyReport")?.addEventListener("click", async () => {
    if (!state.waveStats) return;

    state.waveStats.durationMs = performance.now() - state.waveStats.startAt;
    state.waveStats.towersEnd = state.towers.map(towerExport);

    state._lastReportText = buildReportText(state.waveStats);
    const ok = await copyTextToClipboard(state._lastReportText);

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

  // Public API for main.js (Variant A / clean)
  return {
  castSpell(name) {
    if (name === "overdrive") return castOverdrive();
    return false;
  },
  getGold() {
    return Math.floor(state.gold);
  }
};
}
