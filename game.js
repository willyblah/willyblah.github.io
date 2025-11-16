(async () => {
  const supabase = window.supabase.createClient(
    'https://kpubyiygmclpduyqsmkj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdWJ5aXlnbWNscGR1eXFzbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0Mzk1MTYsImV4cCI6MjA3NjAxNTUxNn0.ukWPhs7dWZ2FJv9rYZO5YvSpthFIy5IbMVy0mBkl8Tk'
  );

  const $ = (sel) => document.querySelector(sel);
  const loading = $("#loading-indicator");
  function showLoading() { loading.classList.remove('hidden'); }
  function hideLoading() { loading.classList.add('hidden'); }

  // ---- Game data ----
  const SKILLS = {
    Spear: { attack: 5, acc: 0.5, price: 0, default: true, infinite: true, desc: "Attack 5, 50% accuracy." },
    Knife: { attack: 2, acc: 0.8, price: 0, default: true, infinite: true, desc: "Attack 2, 80% accuracy." },
    Multiknife: { attack: 10, acc: 0.8, price: 2, desc: "Attack 10, 80% accuracy." },
    Multispear: { attack: 20, acc: 0.8, price: 4, desc: "Attack 20, 80% accuracy." },
    "Stone Sword": { attack: 30, acc: 1, price: 6, desc: "Attack 30, 100% accuracy." },
    Kick: { attack: 50, acc: 0.8, price: 9, desc: "Attack 50, 80% accuracy." },
    Minibomb: { attack: 60, acc: 1, price: 11, desc: "Attack 60, 100% accuracy." },
    Flame: { attack: 80, acc: 1, price: 15, desc: "Attack 80, 100% accuracy." },
    Oneskill: { attack: 100, acc: 0.8, price: 18, desc: "Attack 100, 80% accuracy." },
    Minitrident: { attack: 120, acc: 1, price: 23, desc: "Attack 120, 100% accuracy. +30 attack if used in water." },
    Fireball: { attack: 150, acc: 1, price: 28, desc: "Attack 150, 100% accuracy." },
    "Iron Sword": { attack: 200, acc: 1, price: 38, desc: "Attack 200, 100% accuracy." },
    Bombie: { attack: 250, acc: 1, price: 48, desc: "Attack 250, 100% accuracy." },
    Punchie: { attack: 300, acc: 1, price: 57, desc: "Attack 300, 100% accuracy." },
    Rage: { attack: 350, acc: 1, price: 74, desc: "Attack 350, 100% accuracy. Requires Living of the Dark!" },
    Blast: { attack: 400, acc: 0.8, price: 77, desc: "Attack 400, 80% accuracy." },
    MillionSkills: { attack: 500, acc: 1, price: 96, desc: "Attack 500, 100% accuracy." }
  };

  const TACTICS = {
    Dizzydizzy: { price: 15, desc: "Gives you two extra turns." },
    Pushie: { price: 17, desc: "Pushes opponent toward nearest edge." },
    Speed: { price: 8, desc: "Speed +50% for 10s." },
    "Emergency Platform": { price: 15, desc: "Automatically saves you from falling into the void." },
    "Math": { price: 16, desc: "Solve math to build up attack. One mistake flips it on you." }
  };

  const LEVELS = {
    normal: {
      minHealth: 5,
      maxHealth: 150,
      minSkills: ['Spear', 'Knife'],
      maxSkills: ['Spear', 'Knife', 'Multiknife', 'Multispear', 'Stone Sword', 'Kick', 'Minibomb', 'Flame', 'Oneskill']
    },
    underworld: {
      minHealth: 150,
      maxHealth: 1050,
      minSkills: ['Spear', 'Knife', 'Multiknife', 'Multispear', 'Stone Sword', 'Kick', 'Minibomb', 'Flame', 'Oneskill'],
      maxSkills: ['Spear', 'Knife', 'Multiknife', 'Multispear', 'Stone Sword', 'Kick', 'Minibomb', 'Flame', 'Oneskill',
        'Minitrident', 'Fireball', 'Iron Sword', 'Bombie', 'Punchie', 'Rage', 'Blast', 'MillionSkills']
    }
  };
  let currentLevel = 'normal';

  let loadError = null;
  async function loadSave() {
    showLoading();
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || !user.email_confirmed_at) return getDefaultSave();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        const defaults = getDefaultSave();
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          username: user.user_metadata.username || 'Anonymous',
          diamonds: defaults.diamonds,
          max_health: defaults.maxHealth,
          owned_skills: defaults.ownedSkills,
          owned_tactics: defaults.ownedTactics,
          profile: defaults.profile
        });
        if (insertError) throw insertError;
        return defaults;
      }

      const loadedSkills = profile.owned_skills || {};
      const ownedSkills = Object.fromEntries(Object.keys(SKILLS).map(k => [k, SKILLS[k].infinite ? Infinity : (loadedSkills[k] ?? 0)]));
      const loadedTactics = profile.owned_tactics || {};
      const ownedTactics = Object.fromEntries(Object.keys(TACTICS).map(k => [k, loadedTactics[k] ?? 0]));

      return {
        diamonds: profile.diamonds || 0,
        maxHealth: profile.max_health || 10,
        ownedSkills,
        ownedTactics,
        profile: profile.profile || null
      };
    } catch (e) {
      loadError = `Load fail: ${e.message}`;
      return getDefaultSave();
    } finally {
      hideLoading();
    }
  }

  function getDefaultSave() {
    return {
      diamonds: 0,
      maxHealth: 10,
      ownedSkills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, SKILLS[k].default ? Infinity : 0])),
      ownedTactics: Object.fromEntries(Object.keys(TACTICS).map(k => [k, 0])),
      profile: null
    };
  }

  async function save(state) {
    showLoading();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email_confirmed_at) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          diamonds: state.diamonds,
          max_health: state.maxHealth,
          owned_skills: state.ownedSkills,
          owned_tactics: state.ownedTactics,
          profile: state.profile
        })
        .eq('id', user.id);
      if (error) throw error;
    } catch (e) {
      showMessage(`Failed to save progress: ${e.message}`, 'error');
    } finally {
      hideLoading();
    }
  }
  let userData = null;

  let imageLoaded = false;
  const TILE_IMAGES = {};
  const SKILL_IMAGES = {};
  const tileTypes = {
    0: 'void.png',
    1: 'grass.png',
    2: 'wall.png',
    3: 'water.png',
    4: 'lava.png',
    5: 'cactus.png',
    6: 'cobweb.png',
    7: 'mist.png',
    8: 'slime.png'
  };

  async function loadTileImages() {
    showLoading();
    const promises = Object.keys(tileTypes).map(async (type) => {
      const img = new Image();
      img.src = `assets/${tileTypes[type]}`;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      TILE_IMAGES[type] = img;
    });
    await Promise.all(promises);
    hideLoading();
  }
  async function loadSkillImages() {
    showLoading();
    const promises = Object.keys(SKILLS).map(async (k) => {
      const img = new Image();
      img.src = `assets/${k.toLowerCase().replace(/ /g, '_')}.png`;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      SKILL_IMAGES[k] = img;
    });
    await Promise.all(promises);
    hideLoading();
  }

  // ---- UI references ----
  const screens = {
    start: $("#start-screen"),
    battle: $("#battle-screen"),
    shop: $("#shop-screen"),
    scale: $("#scale-screen"),
    signup: $("#signup-screen"),
    login: $("#login-screen"),
    verify: $("#verify-screen"),
    profile: $("#profile-screen"),
    prize: $("#prize-screen"),
    math: $("#math-screen")
  };

  const tooltip = $("#tooltip");
  const messagesContainer = $("#messages");

  const startHealthEl = $("#start-health");
  const startDiamondsEl = $("#start-diamonds");
  const startProfileEl = $("#start-profile");
  const startSkillsEl = $("#start-skills");
  const startTacticsEl = $("#start-tactics");

  const battleSkillsEl = $("#battle-skills");
  const battleTacticsEl = $("#battle-tactics");
  const playerHpFill = $("#player-hp-fill");
  const opponentHpFill = $("#opponent-hp-fill");
  const playerHealthText = $("#player-health-text");
  const opponentHealthText = $("#opponent-health-text");
  const turnIndicatorEl = $("#turn-indicator");

  const scaleDot = $("#scale-dot");
  const btnStopScale = $("#btn-stop-scale");
  const btnStartBattle = $("#btn-start-battle");
  const btnScaleBack = $("#btn-scale-back");
  const opponentPreview = $("#opponent-preview");
  const previewHealthEl = $("#preview-health");
  const previewSkillsEl = $("#preview-skills");
  const previewTacticsEl = $("#preview-tactics");
  const levelSelect = $("#level-select");

  const shopDiamondsEl = $("#shop-diamonds");
  const shopSkillsEl = $("#shop-skills");
  const shopTacticsEl = $("#shop-tactics");
  const healthAmountInput = $("#health-amount");
  const diamondAmountInput = $("#diamond-amount");

  const signupForm = $("#signup-form");
  const loginForm = $("#login-form");
  const btnSignup = $("#btn-signup");
  const btnLogin = $("#btn-login");
  const btnLogout = $("#btn-logout");
  const signupUsername = $("#signup-username");
  const signupEmail = $("#signup-email");
  const signupPassword = $("#signup-password");
  const loginIdentifier = $("#login-identifier");
  const loginPassword = $("#login-password");
  const userGreeting = $("#user-greeting");

  const prizeDot = $("#prize-dot");
  const btnStopPrize = $("#btn-stop-prize");
  const prizeResult = $("#prize-result p");

  const mathTypeEl = $("#math-problem-type");
  const mathCountdownEl = $("#math-countdown");
  const mathQuestionEl = $("#math-question");
  const btnMathQuit = $("#btn-math-quit");
  const btnChoiceA = $("#math-choice-a");
  const btnChoiceB = $("#math-choice-b");
  const btnChoiceC = $("#math-choice-c");
  const mathAttackEl = $("#math-attack");
  const mathDiffEl = $("#math-difficulty");

  const canvas = $("#game-canvas");
  const ctx = canvas.getContext("2d");
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = canvas.width; fogCanvas.height = canvas.height;
  const fogCtx = fogCanvas.getContext('2d');

  // Game constants
  const TILE = 40;
  const MAP_W = Math.floor(canvas.width / TILE);
  const MAP_H = Math.floor(canvas.height / TILE);
  function generateMap() {
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
    const ox = 1;
    const oy = 1;
    const islandW = Math.max(1, MAP_W - 2 * ox);
    const islandH = Math.max(1, MAP_H - 2 * oy);

    for (let r = oy; r < oy + islandH; r++)
      for (let c = ox; c < ox + islandW; c++)
        grid[r][c] = 1;

    // mist tiles
    grid[islandH / 2][0] = 7;
    grid[islandH / 2][MAP_W - 1] = 7;

    const hazards = [
      { type: 2, count: 60, prob: 0.28 },
      { type: 3, count: 18, prob: 0.50 },
      { type: 4, count: 12, prob: 0.35 },
      { type: 5, count: 16, prob: 0.40 },
      { type: 6, count: 12, prob: 0.30 },
      { type: 0, count: 18, prob: 0.35 }
    ];
    for (const { type, count, prob } of hazards) {
      for (let i = 0; i < count; i++) {
        const r = oy + 2 + Math.floor(Math.random() * (islandH - 4));
        const c = ox + 2 + Math.floor(Math.random() * (islandW - 4));
        if (grid[r][c] === 1 && Math.random() < prob)
          grid[r][c] = type;
      }
    }

    return grid;
  }

  // ---- Pathfinding helpers ----
  function inBounds(r, c) {
    return r >= 0 && r < MAP_H && c >= 0 && c < MAP_W;
  }
  function walkableTile(r, c) {
    if (!inBounds(r, c)) return false;
    const t = grid[r][c];
    return t !== 0 && t !== 2;
  }
  function tileCenter(c, r) {
    return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
  }
  function tileCost(r, c) {
    if (!inBounds(r, c)) return 9999;
    const t = grid[r][c];
    switch (t) {
      case 1: return 1.0;
      case 3: return 1.2;
      case 4: return 8.0;
      case 5: return 4.0;
      case 6: return 1.5;
      default: return 9999;
    }
  }
  function octileHeuristic(r, c, tr, tc, minTileCost = 1.0) {
    const dx = Math.abs(c - tc);
    const dy = Math.abs(r - tr);
    return minTileCost * ((dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy));
  }

  function getSkillAttackValue(name, actor) {
    const s = SKILLS[name];
    if (!s) return 0;
    let attack = s.attack || 0;
    const tile = tileAt(actor.x, actor.y);
    if (name === 'Minitrident' && tile === 3) attack += 30;
    else if (name === 'Rage' && actor.fogMode) attack *= 2;
    return attack;
  }

  function findPath(startX, startY, targetX, targetY, maxNodes = 4000) {
    const sc = Math.floor(startX / TILE), sr = Math.floor(startY / TILE);
    const tc = Math.floor(targetX / TILE), tr = Math.floor(targetY / TILE);
    if (!walkableTile(sr, sc) || !walkableTile(tr, tc)) return null;
    const startKey = sr + ',' + sc;
    const targetKey = tr + ',' + tc;

    let minTile = Infinity;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const t = grid[r][c];
        if (t === 1 || t === 3 || t === 6) minTile = Math.min(minTile, tileCost(r, c));
      }
    }
    if (!isFinite(minTile)) minTile = 1.0;

    const open = new Map();
    const closed = new Set();

    function neighborsOf(r, c) {
      return [
        { r: r - 1, c: c, moveCost: 1 },
        { r: r + 1, c: c, moveCost: 1 },
        { r: r, c: c - 1, moveCost: 1 },
        { r: r, c: c + 1, moveCost: 1 },
        { r: r - 1, c: c - 1, moveCost: Math.SQRT2 },
        { r: r - 1, c: c + 1, moveCost: Math.SQRT2 },
        { r: r + 1, c: c - 1, moveCost: Math.SQRT2 },
        { r: r + 1, c: c + 1, moveCost: Math.SQRT2 }
      ];
    }

    open.set(startKey, { r: sr, c: sc, g: 0, f: octileHeuristic(sr, sc, tr, tc, minTile), parent: null });
    let iterations = 0;

    while (open.size && iterations++ < maxNodes) {
      let bestKey = null; let bestF = Infinity;
      for (const [k, v] of open) {
        if (v.f < bestF) { bestF = v.f; bestKey = k; }
      }
      const current = open.get(bestKey);
      open.delete(bestKey);
      const curKey = current.r + ',' + current.c;
      closed.add(curKey);

      if (curKey === targetKey) {
        const path = [];
        let cur = current;
        while (cur) {
          path.push({ r: cur.r, c: cur.c, x: tileCenter(cur.c, cur.r).x, y: tileCenter(cur.c, cur.r).y });
          cur = cur.parent;
        }
        return path.reverse();
      }

      const neighs = neighborsOf(current.r, current.c);
      for (const nb of neighs) {
        const key = nb.r + ',' + nb.c;
        if (!inBounds(nb.r, nb.c)) continue;
        if (closed.has(key)) continue;
        if (!walkableTile(nb.r, nb.c)) continue;

        if (nb.moveCost === Math.SQRT2) {
          const cut1 = current.r + (nb.r - current.r), cut1c = current.c;
          const cut2 = current.r, cut2c = current.c + (nb.c - current.c);
          if (!walkableTile(cut1, cut1c) || !walkableTile(cut2, cut2c)) continue;
        }

        const moveBase = nb.moveCost;
        const stepCost = (tileCost(current.r, current.c) + tileCost(nb.r, nb.c)) * 0.5;
        const gScore = current.g + moveBase * stepCost;

        const existing = open.get(key);
        if (!existing || gScore < existing.g) {
          const h = octileHeuristic(nb.r, nb.c, tr, tc, minTile);
          open.set(key, { r: nb.r, c: nb.c, g: gScore, f: gScore + h, parent: current });
        }
      }
    }

    return null;
  }

  function followPath(actor, path) {
    if (!path || path.length < 2) return false;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < Math.min(path.length, 4); i++) {
      const dx = actor.x - path[i].x, dy = actor.y - path[i].y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; idx = i; }
    }
    const nextIndex = Math.min(path.length - 1, idx + 1);
    const next = path[nextIndex];
    const dx = next.x - actor.x, dy = next.y - actor.y;
    const mag = Math.hypot(dx, dy) || 1;
    actor.vx = (dx / mag) * actor.getSpeed();
    actor.vy = (dy / mag) * actor.getSpeed();
    return true;
  }

  function spawnPositions(grid) {
    let first = null, second = null;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        if (grid[r][c] === 1) { first = [c * TILE + TILE / 2, r * TILE + TILE / 2]; break; }
      }
      if (first) break;
    }
    for (let r = MAP_H - 1; r >= 0; r--) {
      for (let c = MAP_W - 1; c >= 0; c--) {
        if (grid[r][c] === 1) { second = [c * TILE + TILE / 2, r * TILE + TILE / 2]; break; }
      }
      if (second) break;
    }
    return { first, second };
  }

  class Actor {
    constructor(x, y, hp, speed, color) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.hp = hp; this.maxHp = hp; this.speed = speed; this.color = color;
      this.extraTurns = 0; this.lastLavaTick = 0; this.lastCactusTick = 0; this.speedEffectEnd = 0;
    }
    applyDamage(d) { this.hp -= d; if (this.hp < 0) this.hp = 0; }
    isDead() { return this.hp <= 0; }
    toggleFogMode() { this.fogMode = !this.fogMode; }
    applySpeedBoost(durationMs) { this.speedEffectEnd = Date.now() + durationMs; }
    getSpeed() { return this.speedEffectEnd > Date.now() ? this.speed * 1.5 : this.speed; }
  }

  let projectile = null;

  class Projectile {
    constructor(fromActor, toActor, skillName, outcome, onDeactivate) {
      this.x = fromActor.x;
      this.y = fromActor.y;
      this.targetX = toActor.x;
      this.targetY = toActor.y;
      this.speed = 500;
      this.traveled = 0;
      this.active = true;
      this.image = SKILL_IMAGES[skillName];
      this.outcome = outcome;
      this.onDeactivate = onDeactivate;
      this.originalDist = Math.hypot(toActor.x - this.x, toActor.y - this.y);

      const dx = toActor.x - this.x;
      const dy = toActor.y - this.y;

      this.angle = Math.atan2(dy, dx);
      this.x += Math.cos(this.angle) * 20;
      this.y += Math.sin(this.angle) * 20;

      const mag = Math.hypot(dx, dy) || 1;
      this.vx = (dx / mag) * this.speed;
      this.vy = (dy / mag) * this.speed;

      if (outcome === 'miss') {
        const deviate = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 18);
        const cos = Math.cos(deviate);
        const sin = Math.sin(deviate);
        this.vx = this.vx * cos - this.vy * sin;
        this.vy = this.vx * sin + this.vy * cos;
        this.angle = Math.atan2(this.vy, this.vx);
      }
    }

    update(dt) {
      if (!this.active) return;

      this.traveled += this.speed * dt;
      if (this.outcome === 'toofar' && this.traveled >= 400) {
        this.active = false;
        this.onDeactivate(this.outcome);
        return;
      }

      const nextX = this.x + this.vx * dt;
      const nextY = this.y + this.vy * dt;
      if (this.outcome !== 'miss' && tileAt(nextX, nextY) === 2) {
        this.active = false;
        this.onDeactivate('blocked');
        return;
      }
      this.x = nextX;
      this.y = nextY;

      if (this.outcome === 'hit' && Math.hypot(this.targetX - this.x, this.targetY - this.y) < 15) {
        this.active = false;
        this.onDeactivate(this.outcome);
        return;
      }
      if (this.outcome === 'miss' && this.traveled > this.originalDist * 1.1) {
        this.active = false;
        this.onDeactivate(this.outcome);
        return;
      }
    }

    draw(ctx) {
      if (!this.active) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle + Math.PI / 4);
      ctx.drawImage(this.image, -16, -16, 32, 32);
      ctx.restore();
    }
  }

  // State
  let grid, spawns;

  let player = null, opponent = null;
  let battlePlayerSkills = {}, battlePlayerTactics = {};
  let battleOppSkills = {}, battleOppTactics = {};
  let opponentHealth = 0, opponentSkills = [], opponentTactics = {};
  let state = { battle: null };

  let scaleInterval = null;
  let scaleDirection = 1;
  let scalePosition = 0;
  let scaleStopped = false;
  let opponentStrength = 0.5;

  let prizeInterval = null;
  let prizeDirection = 1;
  let prizePosition = 0;
  let prizeStopped = false;

  // ---- Math problems ----
  let mathProblems = null;
  async function loadMathProblems() {
    if (mathProblems) return mathProblems;
    showLoading();
    try {
      const res = await fetch('math.txt', { cache: 'no-cache' });
      mathProblems = parseMathText(await res.text());
      return mathProblems;
    } catch (e) {
      showMessage(`Failed to load math problems: ${e.message}`, 'error', 3000);
      return [];
    } finally {
      hideLoading();
    }
  }
  function parseMathText(text) {
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let cur = [];
    for (const line of lines) {
      if (line.trim() === '') {
        if (cur.length) { blocks.push(cur); cur = []; }
      } else {
        cur.push(line);
      }
    }
    if (cur.length) blocks.push(cur);
    const items = [];
    for (const blk of blocks) {
      const m = blk[0].match(/^(\d+)\s*,\s*(\d+)\s*:\s*(.+)$/);
      const type = parseInt(m[1], 10);
      const difficulty = parseInt(m[2], 10);
      const question = m[3].trim();
      const choices = {};
      let correct = null;
      for (let i = 1; i < Math.min(4, blk.length); i++) {
        const cm = blk[i].match(/^([a-cA-C])\s*:\s*(.+)$/);
        const rawKey = cm[1];
        const key = rawKey.toUpperCase();
        const val = cm[2].trim();
        choices[key] = val;
        if (rawKey === rawKey.toUpperCase()) correct = key;
      }
      const timeLimit = 5000 + difficulty * 5000;
      items.push({ type, difficulty, question, choices, correct, timeLimit });
    }
    const byDiff = {};
    for (const it of items) {
      byDiff[it.difficulty] = byDiff[it.difficulty] || [];
      byDiff[it.difficulty].push(it);
    }
    const diffs = Object.keys(byDiff).map(x => parseInt(x, 10)).sort((a, b) => a - b);
    const out = [];
    for (const d of diffs) {
      const arr = byDiff[d];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      out.push(...arr);
    }
    return out;
  }
  function renderMathHtml(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '^' && i + 1 < str.length) {
        let supContent = '';
        i++;
        if (str[i] === '{') {
          i++;
          while (i < str.length && str[i] !== '}') {
            supContent += str[i];
            i++;
          }
          if (i >= str.length || str[i] !== '}') {
            result += '^{' + supContent;
            if (i < str.length) result += str[i];
            continue;
          }
        } else {
          supContent = str[i];
        }
        result += `<sup>${supContent}</sup>`;
      } else {
        result += str[i];
      }
    }
    return result;
  }
  let mathSession = null;

  // keyboard
  const keysDown = {};
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'tab' && screens.login.classList.contains('hidden') && screens.signup.classList.contains('hidden'))
      e.preventDefault();
    keysDown[k] = true;
  });
  window.addEventListener('keyup', (e) => { keysDown[e.key.toLowerCase()] = false; });

  function showMessage(htmlText, type = 'info', timeout = 2000) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = htmlText;
    messagesContainer.appendChild(msg);

    setTimeout(() => {
      msg.style.animation = 'msgOut 300ms forwards';
      setTimeout(() => msg.remove(), 320);
    }, timeout);
    return msg;
  }

  async function renderStartUI() {
    startHealthEl.textContent = userData.maxHealth;
    startDiamondsEl.textContent = userData.diamonds;
    if (userData.profile) startProfileEl.textContent = userData.profile;
    else startProfileEl.textContent = 'None';
    startSkillsEl.innerHTML = "";
    startTacticsEl.innerHTML = "";

    // skills
    const ownedSkills = Object.keys(SKILLS).filter(k => userData.ownedSkills[k] && userData.ownedSkills[k] !== 0);
    ownedSkills.forEach((k) => {
      const s = SKILLS[k];
      const count = userData.ownedSkills[k] === Infinity ? "∞" : userData.ownedSkills[k];
      const btn = document.createElement('div');
      btn.className = 'skill-btn';
      btn.dataset.name = k;
      btn.innerHTML = `<div>${k}</div><div class="skill-count">${count}</div>`;
      attachTooltip(btn, s.desc);
      startSkillsEl.appendChild(btn);
    });
    // tactics
    const ownedTactics = Object.keys(TACTICS).filter(k => userData.ownedTactics[k] && userData.ownedTactics[k] !== 0);
    ownedTactics.forEach((k) => {
      const t = TACTICS[k];
      const count = userData.ownedTactics[k] || 0;
      const btn = document.createElement('div');
      btn.className = 'tactic-btn';
      if (k === 'Math') btn.style.border = '2px solid green';
      btn.dataset.name = k;
      btn.innerHTML = `<div>${k}</div><div class="skill-count">${count}</div>`;
      attachTooltip(btn, t.desc);
      startTacticsEl.appendChild(btn);
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      btnSignup.classList.add('hidden');
      btnLogin.classList.add('hidden');
      btnLogout.classList.remove('hidden');
      userGreeting.classList.remove('hidden');
      userGreeting.textContent = user.user_metadata.username;
    } else {
      btnSignup.classList.remove('hidden');
      btnLogin.classList.remove('hidden');
      btnLogout.classList.add('hidden');
      userGreeting.classList.add('hidden');
      showMessage('Log in to save your progress and get a profile!', 'info', 3000);
    }
  }

  function getShownBattleSkills() {
    return Object.keys(SKILLS).filter(k => (battlePlayerSkills[k] && battlePlayerSkills[k] !== 0) || battlePlayerSkills[k] === Infinity);
  }
  function getShownBattleTactics() {
    return Object.keys(TACTICS).filter(k => (battlePlayerTactics[k] && battlePlayerTactics[k] !== 0));
  }

  function renderBattleUI() {
    playerHpFill.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    opponentHpFill.style.width = `${Math.max(0, (opponent.hp / opponent.maxHp) * 100)}%`;
    playerHealthText.textContent = `${Math.max(0, Math.floor(player.hp))}/${player.maxHp}`;
    opponentHealthText.textContent = `${Math.max(0, Math.floor(opponent.hp))}/${opponent.maxHp}`;

    battleSkillsEl.innerHTML = "";
    const shownSkills = getShownBattleSkills();
    shownSkills.forEach((k) => {
      const s = SKILLS[k];
      const count = battlePlayerSkills[k] === Infinity ? "∞" : (battlePlayerSkills[k] || 0);
      const btn = document.createElement('div');
      btn.className = 'skill-btn';
      btn.dataset.name = k;
      btn.innerHTML = `<div>${k}</div><div class="skill-count">${count}</div>`;
      btn.addEventListener('click', () => useSkillByName(k));
      attachTooltip(btn, s.desc);
      battleSkillsEl.appendChild(btn);
    });

    battleTacticsEl.innerHTML = "";
    const shownTactics = getShownBattleTactics();
    shownTactics.forEach((k) => {
      const t = TACTICS[k];
      const count = battlePlayerTactics[k] || 0;
      const btn = document.createElement('div');
      btn.className = 'tactic-btn';
      if (k === 'Math') btn.style.border = '2px solid green';
      btn.dataset.name = k;
      btn.innerHTML = `<div>${k}</div><div class="skill-count">${count}</div>`;
      if (k !== "Emergency Platform") btn.addEventListener('click', () => useTacticByName(k));
      attachTooltip(btn, `${k}<br>${t.desc}`);
      battleTacticsEl.appendChild(btn);
    });
  }

  function renderShopUI() {
    shopDiamondsEl.textContent = userData.diamonds + (userData.profile === 'Villager' ? ' (50% off!)' : '');
    shopSkillsEl.innerHTML = "";
    shopTacticsEl.innerHTML = "";
    Object.keys(SKILLS).forEach(k => {
      const s = SKILLS[k];
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div><b>${k}</b><div style="font-size:13px;color:var(--muted)">${s.desc}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
        <div style="color:var(--muted);font-weight:600">${s.price ? s.price : '—'}</div>
        <button class="btn" data-name="${k}">Buy</button>
        </div>`;
      row.querySelector('button').addEventListener('click', () => { buySkill(k); });
      shopSkillsEl.appendChild(row);
    });
    Object.keys(TACTICS).forEach(k => {
      const t = TACTICS[k];
      const row = document.createElement('div');
      row.className = 'shop-item';
      if (k === 'Math') row.style.border = '2px solid green';
      row.innerHTML = `<div><b>${k}</b><div style="font-size:13px;color:var(--muted)">${t.desc}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
        <div style="color:var(--muted);font-weight:600">${t.price}</div>
        <button class="btn" data-name="${k}">Buy</button>
        </div>`;
      row.querySelector('button').addEventListener('click', () => { buyTactic(k); });
      shopTacticsEl.appendChild(row);
    });
  }

  // tooltips
  function attachTooltip(node, html) {
    node.addEventListener('mouseenter', (e) => {
      tooltip.innerHTML = html;
      tooltip.classList.remove('hidden');
      positionTooltip(e.pageX, e.pageY);
    });
    node.addEventListener('mousemove', (e) => positionTooltip(e.pageX, e.pageY));
    node.addEventListener('mouseleave', () => { tooltip.classList.add('hidden'); });
  }
  function positionTooltip(x, y) {
    tooltip.style.left = (x + 12) + 'px';
    tooltip.style.top = (y + 12) + 'px';
  }

  // ---- Shop actions ----
  async function buySkill(name) {
    showLoading();
    try {
      const s = SKILLS[name];
      if (!s.price) {
        showMessage(`<b>${name}</b> cannot be purchased.`, 'warn');
        return;
      }
      let price = s.price;
      if (userData.profile === 'Villager') price = Math.ceil(price / 2);
      if (userData.diamonds < price) { showMessage("Not enough diamonds.", 'error'); return; }
      userData.diamonds -= price;
      userData.ownedSkills[name] = (userData.ownedSkills[name] || 0) + 1;
      await save(userData);
      renderShopUI();
      showMessage(`Bought <b>${name}</b>.`, 'success');
    } finally {
      hideLoading();
    }
  }
  async function buyTactic(name) {
    showLoading();
    try {
      let price = TACTICS[name].price;
      if (userData.profile === 'Villager') price = Math.ceil(price / 2);
      if (userData.diamonds < price) { showMessage("Not enough diamonds.", 'error'); return; }
      userData.diamonds -= price;
      userData.ownedTactics[name] = (userData.ownedTactics[name] || 0) + 1;
      await save(userData);
      renderShopUI();
      showMessage(`Bought <b>${name}</b>.`, 'success');
    } finally {
      hideLoading();
    }
  }
  async function buyHealth(amount) {
    showLoading();
    try {
      let price = amount / 5;
      if (userData.profile === 'Villager')
        price = Math.ceil(price / 2);
      if (userData.diamonds < price) {
        showMessage("Not enough diamonds.", 'error');
        return;
      }
      userData.diamonds -= price;
      userData.maxHealth += amount;
      await save(userData);
      renderShopUI();
      showMessage(`Bought ${amount} health. You have ${userData.maxHealth} health now.`, 'success');
    } finally {
      hideLoading();
    }
  }
  $("#btn-buy-health").addEventListener('click', () => {
    const amount = parseInt(healthAmountInput.value, 10);
    if (isNaN(amount) || amount < 5 || amount % 5 !== 0) {
      showMessage("Enter a multiple of 5 (minimum 5).", 'error');
      return;
    }
    buyHealth(amount);
  });
  $("#btn-buy-health-2").addEventListener('click', () => {
    const diamonds = parseInt(diamondAmountInput.value, 10);
    if (isNaN(diamonds) || diamonds < 1) {
      showMessage("Enter a number that is greater than 1.", 'error');
      return;
    }
    buyHealth(userData.profile === 'Villager' ? diamonds * 10 : diamonds * 5);
  });
  healthAmountInput.addEventListener('click', (e) => { e.stopPropagation(); });
  diamondAmountInput.addEventListener('click', (e) => { e.stopPropagation(); });
  $("#btn-change-profile").addEventListener('click', async () => {
    if (userData.diamonds < 5) {
      showMessage("Not enough diamonds.", 'error');
      return;
    }
    userData.diamonds -= 5;
    await save(userData);
    showProfileSelect();
  });

  // ---- Battle lifecycle ----
  function prepareBattle() {
    grid = generateMap();
    spawns = spawnPositions(grid);

    player = new Actor(spawns.first[0], spawns.first[1], userData.maxHealth, 140, '#10b981');
    player.fogMode = false;
    opponent = new Actor(spawns.second[0], spawns.second[1], opponentHealth, 140, '#ef4444');
    opponent.isChasing = false;

    battlePlayerSkills = {}; battlePlayerTactics = {};
    battleOppSkills = {};
    battleOppTactics = opponentTactics || {};

    Object.keys(SKILLS).forEach(k => {
      const owned = userData.ownedSkills[k];
      if (owned === Infinity) battlePlayerSkills[k] = Infinity;
      else battlePlayerSkills[k] = owned || 0;
    });

    const sortedSkills = Object.keys(SKILLS).sort((a, b) => {
      return SKILLS[b].attack - SKILLS[a].attack;
    });
    let count = 1;
    sortedSkills.forEach(k => {
      battleOppSkills[k] = opponentSkills.includes(k) ? count++ : 0;
      if (k === 'Spear' || k === 'Knife') battleOppSkills[k] = Infinity;
    });

    Object.keys(TACTICS).forEach(k => { battlePlayerTactics[k] = userData.ownedTactics[k] || 0; });

    renderBattleUI();
    document.querySelector('.sidepanel').scrollTop = 0;

    // turn init
    const startPeriodMs = 5000;
    state.battle = {
      startPeriodEnd: Date.now() + startPeriodMs,
      currentActor: null,
      turnEndTime: null,
      turnTimeout: 10000,
      over: false,
      startTime: Date.now()
    };

    setTimeout(() => {
      state.battle.currentActor = (Math.random() < 0.5) ? 'player' : 'opponent';
      state.battle.turnEndTime = Date.now() + state.battle.turnTimeout;
      updateTurnIndicator();
      if (state.battle.currentActor === 'opponent') opponentAIChoose();
    }, startPeriodMs + 50);
    startLoop();
  }

  function calculateOppHealth() {
    const level = LEVELS[currentLevel];
    const healthRange = level.maxHealth - level.minHealth;
    return Math.floor(level.minHealth + opponentStrength * healthRange);
  }

  function calculateOppSkills() {
    const level = LEVELS[currentLevel];
    const count = Math.floor(level.minSkills.length + opponentStrength * (level.maxSkills.length - level.minSkills.length));
    return level.maxSkills.slice(0, Math.max(level.minSkills.length, count));
  }

  function generateOppTactics() {
    const allTactics = Object.keys(TACTICS).filter(t => t !== 'Math');
    const tactics = {};
    allTactics.forEach(tactic => { tactics[tactic] = 0; });

    if (currentLevel === 'normal') {
      if (opponentStrength >= 0.25 && opponentStrength < 0.5) {
        const randomTactic = allTactics[Math.floor(Math.random() * allTactics.length)];
        tactics[randomTactic] = 1;
      } else if (opponentStrength >= 0.5 && opponentStrength < 0.75) {
        const randomTactic = allTactics[Math.floor(Math.random() * allTactics.length)];
        tactics[randomTactic] = 2;
      } else if (opponentStrength >= 0.75 && opponentStrength <= 1.0) {
        const shuffled = [...allTactics].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);
        tactics[selected[0]] = 1;
        tactics[selected[1]] = 2;
      }
    } else {
      if (opponentStrength >= 0 && opponentStrength < 0.25) {
        const shuffled = [...allTactics].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);
        selected.forEach(tactic => { tactics[tactic] = 2; });
      } else if (opponentStrength >= 0.25 && opponentStrength < 0.5) {
        const shuffled = [...allTactics].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        tactics[selected[0]] = 2;
        tactics[selected[1]] = 2;
        tactics[selected[2]] = 1;
      } else if (opponentStrength >= 0.5 && opponentStrength < 0.75) {
        const shuffled = [...allTactics].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        tactics[selected[0]] = 3;
        tactics[selected[1]] = 2;
        tactics[selected[2]] = 2;
      } else if (opponentStrength >= 0.75 && opponentStrength <= 1.0) {
        allTactics.forEach(tactic => { tactics[tactic] = 2; });
      }
    }

    return tactics;
  }

  $("#btn-battle").addEventListener('click', () => { showScale(); });
  $("#btn-shop").addEventListener('click', () => {
    showShop();
    renderShopUI();
  });
  $("#btn-surrender").addEventListener('click', () => {
    if (!state.battle) return;
    finalizeEndBattle(false, "You surrendered.");
  });
  $("#btn-shop-back").addEventListener('click', () => { showStart(); });
  btnStopScale.addEventListener('click', () => {
    if (!scaleStopped) {
      stopScale();
      btnStopScale.disabled = true;
      btnStopScale.textContent = 'Stopped';
    }
  });
  btnStartBattle.addEventListener('click', () => {
    showBattle();
    prepareBattle();
  });
  btnScaleBack.addEventListener('click', () => {
    if (!scaleStopped) stopScale();
    showStart();
  });
  levelSelect.addEventListener('change', () => { currentLevel = levelSelect.value; });
  btnSignup.addEventListener('click', () => showSignup());
  btnLogin.addEventListener('click', () => showLogin());
  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    userData = getDefaultSave();
    showStart();
  });
  $("#btn-signup-back").addEventListener('click', () => showStart());
  $("#btn-login-back").addEventListener('click', () => showStart());
  $("#btn-verify-back").addEventListener('click', () => showStart());
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = signupUsername.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value.trim();
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    if (!username || !email || !password) {
      showMessage("All fields required.", 'error');
      return;
    }
    submitBtn.disabled = true;
    showLoading();
    try {
      const { data: { user }, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
      if (error) throw error;
      if (user) showVerify();
    } catch (err) {
      showMessage(`Sign up failed: ${err.message}`, 'error', 3000);
    } finally {
      submitBtn.disabled = false;
      hideLoading();
    }
  });
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginIdentifier.value.trim();
    const password = loginPassword.value.trim();
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (!email || !password) {
      showMessage("All fields required.", 'error');
      return;
    }
    submitBtn.disabled = true;
    showLoading();
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      userData = await loadSave();
      if (!userData.profile) showProfileSelect();
      else showStart();
    } catch (err) {
      showMessage(`Log in failed: ${err.message}`, 'error', 3000);
    } finally {
      submitBtn.disabled = false;
      hideLoading();
    }
  });
  async function selectProfile(profileName) {
    showLoading();
    try {
      userData.profile = profileName;
      await save(userData);
      showStart();
    } finally { hideLoading(); }
  }
  $("#btn-warrior").addEventListener('click', () => selectProfile('Warrior'));
  $("#btn-miner").addEventListener('click', () => selectProfile('Miner'));
  $("#btn-trickster").addEventListener('click', () => selectProfile('Trickster'));
  $("#btn-villager").addEventListener('click', () => selectProfile('Villager'));
  btnStopPrize.addEventListener('click', () => {
    if (prizeStopped) return;
    clearInterval(prizeInterval);
    prizeStopped = true;
    btnStopPrize.disabled = true;
    prizeResult.parentNode.classList.remove('hidden');
    if (prizePosition > 50) {
      const diamondGain = 1 + Math.floor(Math.random() * 5);
      if (Math.random() < 0.5) {
        const healthGain = diamondGain * 5;
        userData.maxHealth += healthGain;
        prizeResult.innerHTML = `Prize: <b>${healthGain} health</b>!`;
      } else {
        userData.diamonds += diamondGain;
        prizeResult.innerHTML = `Prize: <b>${diamondGain} diamond(s)</b>!`;
      }
      save(userData);
    } else {
      prizeResult.textContent = 'Sorry, no prize.';
    }
  });
  $("#btn-prize-back").addEventListener('click', () => { showStart(); });
  btnMathQuit.addEventListener('click', () => {
    if (!mathSession) return;
    finalizeMathSession(false);
  });
  [btnChoiceA, btnChoiceB, btnChoiceC].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!mathSession) return;
      const pick = btn.dataset.choice;
      handleMathChoice(pick);
    });
  });

  // UI screens
  function showScreen(name) {
    Object.keys(screens).forEach(screen => {
      screens[screen].classList.toggle('hidden', screen !== name);
    });
    tooltip.classList.add('hidden');
    tooltip.innerHTML = '';
    if (name === 'math') document.body.classList.add('math-active');
    else document.body.classList.remove('math-active');
  }
  async function showStart() {
    userData = await loadSave();
    if (!imageLoaded) {
      await loadTileImages();
      await loadSkillImages();
      imageLoaded = true;
    }
    showScreen('start');
    renderStartUI();
    if (loadError) showMessage(loadError, 'error', 3000);
  }
  function showBattle() { showScreen('battle'); }
  function showShop() { showScreen('shop'); }
  function showScale() {
    showScreen('scale');
    opponentPreview.classList.add('hidden');
    btnStartBattle.disabled = true;
    btnStopScale.disabled = false;
    btnStopScale.textContent = 'Stop';
    startScale();
  }
  function showPrize() {
    showScreen('prize');
    prizeResult.parentNode.classList.add('hidden');
    btnStopPrize.disabled = false;
    btnStopPrize.textContent = 'Stop';
    prizePosition = 0;
    prizeDirection = 1;
    prizeDot.style.left = '0%';
    prizeStopped = false;
    prizeInterval = setInterval(() => {
      prizePosition += prizeDirection * 5;
      if (prizePosition >= 100) { prizePosition = 100; prizeDirection = -1; }
      else if (prizePosition <= 0) { prizePosition = 0; prizeDirection = 1; }
      prizeDot.style.left = prizePosition + '%';
    }, 30);
  }
  function showSignup() { showScreen('signup'); }
  function showLogin() { showScreen('login'); }
  function showVerify() { showScreen('verify'); }
  function showProfileSelect() { showScreen('profile'); }
  function showMath() { showScreen('math'); }

  async function startMathSession() {
    const problems = await loadMathProblems();
    if (!problems) {
      showMessage('No math problems.', 'error', 3000);
      return false;
    }
    mathSession = {
      problems,
      index: 0,
      accAttack: 0,
      prevDiff: 1,
      anyFailure: false,
      timerId: null,
      deadline: 0
    };
    if (state.battle) state.battle.paused = true;
    mathAttackEl.textContent = 'Attack: 0';
    mathDiffEl.textContent = 'Difficulty: 1';
    showMath();
    nextMathProblem();
    return true;
  }
  function nextMathProblem() {
    if (!mathSession) return;
    if (mathSession.index >= mathSession.problems.length) {
      finalizeMathSession(false);
      return;
    }
    const p = mathSession.problems[mathSession.index];
    if (p.difficulty > mathSession.prevDiff) {
      mathDiffEl.textContent = `Difficulty: ${p.difficulty}`;
      mathDiffEl.classList.add('math-difficulty-update');
      setTimeout(() => {
        mathDiffEl.classList.remove('math-difficulty-update');
      }, 300);
      mathSession.prevDiff = p.difficulty;
    }
    renderMathProblem(p);
    startMathTimer();
  }
  function renderMathProblem(p) {
    if (p.type === 1) mathTypeEl.textContent = 'Simplify the polynomial';
    else if (p.type === 2) mathTypeEl.textContent = 'Factor the polynomial';
    else if (p.type === 3) mathTypeEl.textContent = 'Name the polynomial';
    else mathTypeEl.textContent = 'Solve the problem';
    mathQuestionEl.innerHTML = renderMathHtml(p.question);
    btnChoiceA.innerHTML = `<b>A:</b> ${renderMathHtml(p.choices.A)}`;
    btnChoiceB.innerHTML = `<b>B:</b> ${renderMathHtml(p.choices.B)}`;
    btnChoiceC.innerHTML = `<b>C:</b> ${renderMathHtml(p.choices.C)}`;
  }
  function startMathTimer() {
    if (!mathSession) return;
    if (mathSession.timerId) clearInterval(mathSession.timerId);
    const timeLimit = mathSession.problems[mathSession.index].timeLimit;
    mathSession.deadline = Date.now() + timeLimit;
    updateMathCountdown();
    mathSession.timerId = setInterval(() => {
      updateMathCountdown();
      if (Date.now() >= mathSession.deadline) {
        clearInterval(mathSession.timerId);
        mathSession.timerId = null;
        mathSession.anyFailure = true;
        finalizeMathSession(true);
      }
    }, 200);
  }
  function updateMathCountdown() {
    const now = Date.now();
    const remainMs = Math.max(0, (mathSession?.deadline || now) - now);
    mathCountdownEl.textContent = `${Math.ceil(remainMs / 1000)}s`;
  }
  function handleMathChoice(choice) {
    if (!mathSession) return;
    const correct = mathSession.problems[mathSession.index].correct === choice;
    clearInterval(mathSession.timerId);
    mathSession.timerId = null;
    if (correct) {
      mathSession.accAttack += 20;
      mathAttackEl.textContent = `Attack: ${mathSession.accAttack}`;
      mathAttackEl.classList.add('math-attack-update');
      setTimeout(() => {
        mathAttackEl.classList.remove('math-attack-update');
      }, 300);
      const btn = document.querySelector(`#math-choice-${choice.toLowerCase()}`);
      btn.classList.add('correct');
      setTimeout(() => {
        btn.classList.remove('correct')
        mathSession.index += 1;
        nextMathProblem();
      }, 500);
    } else {
      mathSession.anyFailure = true;
      finalizeMathSession(false);
    }
  }
  function finalizeMathSession(timedOut) {
    if (!mathSession) return;
    clearInterval(mathSession.timerId);
    mathSession.timerId = null;
    const attack = mathSession.accAttack;
    const failed = mathSession.anyFailure || timedOut;
    mathSession = null;
    if (state.battle) showBattle();
    else showStart();
    if (!state.battle || !player || !opponent) return;
    if (state.battle) {
      state.battle.paused = false;
      state.battle.turnEndTime = Date.now() + (state.battle.turnTimeout || 10000);
    }
    if (attack <= 0) {
      showMessage('No attack accumulated.', 'warn');
      nextTurnAfterAction('player');
      return;
    }
    if (failed) {
      player.applyDamage(attack);
      animateHPChange(playerHpFill, (player.hp / player.maxHp) * 100);
      showMessage(`Math backfires! You take ${attack} damage.`, 'error');
    } else {
      opponent.applyDamage(attack);
      animateHPChange(opponentHpFill, (opponent.hp / opponent.maxHp) * 100);
      showMessage(`Math succeeds! Opponent takes ${attack} damage.`, 'success');
    }
    renderBattleUI();
    nextTurnAfterAction('player');
  }

  function startScale() {
    scaleStopped = false;
    scalePosition = 50;
    scaleDirection = 1;
    scaleDot.style.left = '50%';

    scaleInterval = setInterval(() => {
      scalePosition += scaleDirection * 2;
      if (scalePosition >= 100) {
        scalePosition = 100;
        scaleDirection = -1;
      } else if (scalePosition <= 0) {
        scalePosition = 0;
        scaleDirection = 1;
      }

      scaleDot.style.left = scalePosition + '%';
    }, 30);
  }

  function stopScale() {
    if (scaleInterval) {
      clearInterval(scaleInterval);
      scaleInterval = null;
    }
    scaleStopped = true;
    opponentStrength = scalePosition / 100;
    opponentPreview.classList.remove('hidden');
    btnStartBattle.disabled = false;

    opponentHealth = calculateOppHealth();
    opponentSkills = calculateOppSkills();
    opponentTactics = generateOppTactics();

    previewHealthEl.textContent = opponentHealth;
    previewSkillsEl.textContent = opponentSkills.join(', ');
    const tacticsText = Object.entries(opponentTactics)
      .filter(([tactic, count]) => count > 0)
      .map(([tactic, count]) => `${tactic}`)
      .join(', ');
    previewTacticsEl.textContent = tacticsText || 'None';
  }

  // ---- Battle loop & drawing ----
  let rafId = null;
  let lastTime = performance.now();
  function startLoop() {
    lastTime = performance.now();
    if (!rafId) rafId = requestAnimationFrame(loop);
  }
  function stopBattle() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    state.battle = null;
  }

  function loop(ts) {
    const dt = Math.min(50, ts - lastTime) / 1000;
    lastTime = ts;
    update(dt);
    draw();
    if (!state.battle || state.battle.over) { stopBattle(); return; }
    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (!state.battle) return;
    if (state.battle.paused) return;
    const now = Date.now();

    // movement
    let spd = player.getSpeed();
    if (keysDown['w'] || keysDown['a'] || keysDown['s'] || keysDown['d']) {
      let dx = 0, dy = 0;
      if (keysDown['w']) dy -= 1;
      if (keysDown['s']) dy += 1;
      if (keysDown['a']) dx -= 1;
      if (keysDown['d']) dx += 1;
      const mag = Math.hypot(dx, dy) || 1;
      dx /= mag; dy /= mag;
      player.vx = dx * spd;
      player.vy = dy * spd;
    } else {
      player.vx *= 0.8;
      player.vy *= 0.8;
    }

    // AI movement
    const currentActor = state.battle && state.battle.currentActor;
    if (currentActor === 'opponent' || !opponent.hasOwnProperty('aiTimer') || opponent.aiTimer < Date.now()) {
      const dist = Math.hypot(player.x - opponent.x, player.y - opponent.y);
      if (currentActor === 'player') {
        if (dist < 260) moveAway(opponent, player.x, player.y);
        else { opponent.vx *= 0.85; opponent.vy *= 0.85; }
        if (opponent.isChasing)
          opponent.isChasing = false;
      } else {
        if (!inRangeAndLOS(opponent, player)) {
          const path = findPath(opponent.x, opponent.y, player.x, player.y);
          if (path) followPath(opponent, path);
          else moveTowards(opponent, player.x, player.y);
          opponent.isChasing = true;
        } else {
          opponent.vx *= 0.85; opponent.vy *= 0.85;
          if (opponent.isChasing) {
            opponent.isChasing = false;
            if (!opponent.aiTimer || opponent.aiTimer < Date.now())
              opponentAIChoose();
          }
        }
      }
    }

    applyMovement(player, dt);
    applyMovement(opponent, dt);

    handleHazards(player, dt);
    handleHazards(opponent, dt);

    if (projectile) {
      projectile.update(dt);
      if (projectile?.active === false) projectile = null;
    }

    if (isVoidAt(player.x, player.y)) {
      if (battlePlayerTactics["Emergency Platform"] && battlePlayerTactics["Emergency Platform"] > 0) {
        if (useEmergencyPlatform(player.x, player.y)) {
          battlePlayerTactics["Emergency Platform"]--;
          renderBattleUI();
        }
      } else {
        player.hp = 0;
        animateHPChange(playerHpFill, 0);
        setTimeout(() => finalizeEndBattle(false, "You fell into the void."), 600);
        return;
      }
    }
    if (isVoidAt(opponent.x, opponent.y)) {
      if (battleOppTactics["Emergency Platform"] && battleOppTactics["Emergency Platform"] > 0) {
        if (useEmergencyPlatform(opponent.x, opponent.y)) {
          battleOppTactics["Emergency Platform"]--;
          renderBattleUI();
        }
      } else {
        opponent.hp = 0;
        animateHPChange(opponentHpFill, 0);
        setTimeout(() => finalizeEndBattle(true, "Opponent fell into the void."), 600);
        return;
      }
    }

    if (player.isDead()) {
      animateHPChange(playerHpFill, 0);
      setTimeout(() => finalizeEndBattle(false, "You died."), 600);
      return;
    }
    if (opponent.isDead()) {
      animateHPChange(opponentHpFill, 0);
      setTimeout(() => finalizeEndBattle(true, "Opponent died."), 600);
      return;
    }

    // turn timer checks
    if (now < state.battle.startPeriodEnd) {
      turnIndicatorEl.textContent = `Starting in ${Math.ceil((state.battle.startPeriodEnd - now) / 1000)}s`;
    } else {
      if (!state.battle.currentActor) {
        state.battle.currentActor = (Math.random() < 0.5) ? 'player' : 'opponent';
        state.battle.turnEndTime = now + state.battle.turnTimeout;
        updateTurnIndicator();
      } else {
        if (state.battle.turnEndTime && now > state.battle.turnEndTime) switchTurn();
      }
      updateTurnIndicator();
    }

    // update hp bars
    playerHpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    opponentHpFill.style.width = `${(opponent.hp / opponent.maxHp) * 100}%`;
    playerHealthText.textContent = `${Math.max(0, Math.floor(player.hp))}/${player.maxHp}`;
    opponentHealthText.textContent = `${Math.max(0, Math.floor(opponent.hp))}/${opponent.maxHp}`;
  }

  function applyMovement(actor, dt) {
    const tileUnder = tileAt(actor.x, actor.y);
    let factor = 1;
    if (tileUnder === 3) factor = 0.6;
    if (tileUnder === 6) factor = 0.5;

    const originalX = actor.x, originalY = actor.y;

    actor.x += actor.vx * dt * factor;
    actor.y += actor.vy * dt * factor;

    // Prevent corner-cutting
    const oldC = Math.floor(originalX / TILE), oldR = Math.floor(originalY / TILE);
    const newC = Math.floor(actor.x / TILE), newR = Math.floor(actor.y / TILE);
    if (newR !== oldR && newC !== oldC) {
      if ((!inBounds(oldR, newC) || grid[oldR][newC] === 2) && (!inBounds(newR, oldC) || grid[newR][oldC] === 2)) {
        actor.x = originalX;
        actor.y = originalY;
        actor.vx = 0;
        actor.vy = 0;
        return;
      }
    }

    if (tileAt(actor.x, actor.y) === 2) {
      actor.x = originalX;
      actor.y = originalY;

      actor.x += actor.vx * dt * factor;
      if (tileAt(actor.x, actor.y) === 2)
        actor.x = originalX;

      actor.y += actor.vy * dt * factor;
      if (tileAt(actor.x, actor.y) === 2)
        actor.y = originalY;

      if (tileAt(actor.x, actor.y) === 2) {
        actor.x = originalX;
        actor.y = originalY;
        actor.vx = 0;
        actor.vy = 0;
      }
    }

    actor.x = Math.max(10, Math.min(canvas.width - 10, actor.x));
    actor.y = Math.max(10, Math.min(canvas.height - 10, actor.y));
  }

  function handleHazards(actor, dt) {
    const now = Date.now();
    const tile = tileAt(actor.x, actor.y);
    if (tile === 4) {
      if (!actor.lastLavaTick) actor.lastLavaTick = now;
      if (now - actor.lastLavaTick >= 250) {
        actor.applyDamage(20);
        actor.lastLavaTick = now;
        if (actor === player) showMessage("Sizzling in lava!", 'warn');
      }
    } else {
      actor.lastLavaTick = 0;
    }
    if (tile === 5) {
      if (!actor.lastCactusTick) actor.lastCactusTick = now;
      if (now - actor.lastCactusTick >= 250) {
        actor.applyDamage(5);
        actor.lastCactusTick = now;
        if (actor === player) showMessage("Pricked by cactus!", 'warn');
      }
    } else {
      actor.lastCactusTick = 0;
    }
    if (tile === 7) {
      if (!actor.lastMistToggle || now - actor.lastMistToggle >= 3000) {
        actor.toggleFogMode();
        showMessage(actor.fogMode ? "Mist obscures your vision!" : "Vision restored!", 'info');
        actor.lastMistToggle = now;
      }
    } else {
      actor.lastMistToggle = 0;
    }
  }

  function useEmergencyPlatform(x, y) {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    if (inBounds(r, c) && grid[r][c] === 0) {
      grid[r][c] = 8;
      showMessage("Emergency Platform activated!", 'success');
      return true;
    }
    return false;
  }

  function tileAt(x, y) {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    if (r < 0 || r >= MAP_H || c < 0 || c >= MAP_W) return 0;
    return grid[r][c];
  }
  function isVoidAt(x, y) {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    if (r < 0 || r >= MAP_H || c < 0 || c >= MAP_W) return true;
    return grid[r][c] === 0;
  }

  // ---- Drawing ----
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const t = grid[r][c];
        const x = c * TILE, y = r * TILE;
        if (TILE_IMAGES[t]) ctx.drawImage(TILE_IMAGES[t], x, y, TILE, TILE);
        ctx.strokeRect(x, y, TILE, TILE);
      }
    }

    drawActor(player, 'P');
    if (!player.fogMode || Math.hypot(opponent.x - player.x, opponent.y - player.y) <= 80)
      drawActor(opponent, 'O');

    if (projectile) projectile.draw(ctx);

    if (player && player.fogMode) {
      fogCtx.fillStyle = '#707070';
      fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
      fogCtx.globalCompositeOperation = 'destination-out';
      fogCtx.beginPath();
      fogCtx.arc(player.x, player.y, 80, 0, Math.PI * 2);
      fogCtx.fill();
      fogCtx.globalCompositeOperation = 'source-over';
      ctx.drawImage(fogCanvas, 0, 0);
    }
  }

  function drawActor(a, letter) {
    ctx.beginPath();
    ctx.fillStyle = a.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.arc(a.x, a.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();

    // draw letter centered
    ctx.fillStyle = '#fff';
    ctx.font = "bold 14px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, a.x, a.y);
  }

  // ---- Skill & tactic usage ----
  function useSkillByName(name) {
    if (!state.battle) return;
    if (Date.now() < state.battle.startPeriodEnd) return;
    if (state.battle.currentActor !== 'player') return;
    if (!battlePlayerSkills[name] || (battlePlayerSkills[name] <= 0 && battlePlayerSkills[name] !== Infinity)) {
      showMessage(`No <b>${name}</b> left!`, 'warn');
      return;
    }
    if (projectile) return;

    let outcome;
    if (!inRangeAndLOS(player, opponent))
      outcome = Math.hypot(opponent.x - player.x, opponent.y - player.y) > 400 ? 'toofar' : 'blocked';
    else
      outcome = Math.random() < (SKILLS[name].acc || 1) ? 'hit' : 'miss';

    projectile = new Projectile(player, opponent, name, outcome, (resolvedOutcome) => {
      projectile = null;
      const attackVal = getSkillAttackValue(name, player);
      if (resolvedOutcome === 'hit') {
        opponent.applyDamage(attackVal);
        showMessage(`You used <b>${name}</b>! Opponent loses ${attackVal} HP.`, 'info');
        animateHPChange(opponentHpFill, (opponent.hp / opponent.maxHp) * 100);
      } else if (resolvedOutcome === 'miss') {
        showMessage(`You used <b>${name}</b>! Missed!`, 'warn');
      } else if (resolvedOutcome === 'blocked') {
        showMessage(`You used <b>${name}</b>! Blocked by wall.`, 'warn');
      } else if (resolvedOutcome === 'toofar') {
        showMessage(`You used <b>${name}</b>! Too far.`, 'warn');
      }

      if (battlePlayerSkills[name] !== Infinity) {
        battlePlayerSkills[name] = Math.max(0, (battlePlayerSkills[name] || 0) - 1);
        if (battlePlayerSkills[name] === 0) showMessage(`You have no <b>${name}</b> left.`, 'warn');
      }
      renderBattleUI();
      nextTurnAfterAction('player');
    });
  }

  function useTacticByName(name) {
    if (!state.battle) return;
    if (Date.now() < state.battle.startPeriodEnd) return;
    if (state.battle.currentActor !== 'player') return;
    if (!battlePlayerTactics[name] || battlePlayerTactics[name] <= 0) return;

    if (name === "Dizzydizzy") {
      player.extraTurns += 2;
      if (state.battle) state.battle.turnEndTime = Date.now() + (state.battle.turnTimeout || 10000);
      showMessage(`You used <b>${name}</b>! 2 extra turns.`, 'info');
    } else if (name === "Pushie") {
      applyPush(opponent);
      showMessage(`You used <b>${name}</b>! Opponent was pushed.`, 'info');
    } else if (name === "Speed") {
      player.applySpeedBoost(10000);
      showMessage(`You used <b>${name}</b>! Speed up 10s.`, 'info');
    } else if (name === "Math") {
      showMessage(`You used <b>${name}</b>! Solve the math problems.`, 'info');
      battlePlayerTactics[name] = Math.max(0, battlePlayerTactics[name] - 1);
      renderBattleUI();
      startMathSession();
      return;
    }

    battlePlayerTactics[name] = Math.max(0, battlePlayerTactics[name] - 1);
    if (battlePlayerTactics[name] === 0) showMessage(`You have no <b>${name}</b> left.`, 'warn');
    renderBattleUI(); // refresh UI tactic counts

    nextTurnAfterAction('player');
  }

  function nextTurnAfterAction(byActor) {
    if (byActor === 'player') {
      if (player.extraTurns > 0) { player.extraTurns--; return; }
      switchTurn();
    } else {
      if (opponent.extraTurns > 0) { opponent.extraTurns--; opponentAIChoose(); return; }
      switchTurn();
    }
  }

  function switchTurn() {
    if (!state.battle || projectile) return;
    if (state.battle.currentActor === 'player') {
      state.battle.currentActor = 'opponent';
      state.battle.turnEndTime = Date.now() + state.battle.turnTimeout;
      opponentAIChoose();
    } else {
      state.battle.currentActor = 'player';
      state.battle.turnEndTime = Date.now() + state.battle.turnTimeout;
    }
    updateTurnIndicator();
  }

  function updateTurnIndicator() {
    if (!state.battle) return;
    const now = Date.now();
    if (now < state.battle.startPeriodEnd) {
      turnIndicatorEl.textContent = `Starting in ${Math.ceil((state.battle.startPeriodEnd - now) / 1000)}s`;
      return;
    }
    const actor = state.battle.currentActor;
    if (actor === 'player') {
      const remain = Math.max(0, Math.ceil((state.battle.turnEndTime - now) / 1000));
      turnIndicatorEl.textContent = `Your turn — ${remain}s`;
    } else {
      const remain = Math.max(0, Math.ceil((state.battle.turnEndTime - now) / 1000));
      turnIndicatorEl.textContent = `Opponent's turn — ${remain}s`;
    }
  }

  function animateHPChange(el, pct) { el.style.width = `${pct}%`; }

  // ---- Opponent AI ----
  function opponentAIChoose() {
    if (state.battle?.currentActor !== 'opponent' || projectile || Date.now() < state.battle.startPeriodEnd) return;
    if (!inRangeAndLOS(opponent, player)) {
      opponent.isChasing = true;
      return;
    }

    const delay = 500 + Math.random() * 1000;
    opponent.aiTimer = Date.now() + delay;

    setTimeout(() => {
      if (state.battle?.currentActor !== 'opponent') return;

      if (!inRangeAndLOS(opponent, player)) {
        opponent.isChasing = true;
        return;
      }

      // move away from hazard
      const tileHere = tileAt(opponent.x, opponent.y);
      if (tileHere === 4 || tileHere === 5) {
        const safe = findNearbySafePosition(opponent);
        if (safe) moveTowards(opponent, safe.x, safe.y);
      }

      const candidates = Object.keys(SKILLS).filter(k => battleOppSkills[k] > 0 || battleOppSkills[k] === Infinity);
      const tacticCandidates = Object.keys(TACTICS).filter(k => battleOppTactics[k] > 0);

      // try to find instant finisher
      for (const k of candidates) {
        const s = SKILLS[k];
        let attack = s.attack;
        const tile = tileAt(opponent.x, opponent.y);
        if (k === "Minitrident" && tile === 3) attack += 30;
        if (attack >= player.hp && Math.random() < (s.acc || 1)) {
          resolveOpponentSkill(k);
          return;
        }
      }

      // tactics
      if (tacticCandidates.includes("Pushie")) {
        const d1 = player.x;
        const d2 = canvas.width - player.x;
        const d3 = player.y;
        const d4 = canvas.height - player.y;
        if (Math.min(d1, d2, d3, d4) < 140 && Math.random() < 0.6) {
          applyTacticOpponent("Pushie");
          return;
        }
      }
      if (tacticCandidates.includes("Dizzydizzy") && Math.random() < 0.6) {
        applyTacticOpponent("Dizzydizzy");
        return;
      }
      if (tacticCandidates.includes("Speed") && opponent.hp <= opponent.maxHp * 0.6 && Math.random() < 0.5) {
        applyTacticOpponent("Speed");
        return;
      }

      // pick best skill
      let bestSkill = null, bestVal = -Infinity;
      for (const k of candidates) {
        const s = SKILLS[k];
        let attack = s.attack;
        const tile = tileAt(opponent.x, opponent.y);
        if (k === "Minitrident" && tile === 3) attack += 30;
        let expectedAcc = s.acc || 1;
        if (userData.profile === 'Warrior') expectedAcc = 0.5;
        const expected = attack * expectedAcc;
        if (expected > bestVal) { bestVal = expected; bestSkill = k; }
      }

      if (bestSkill) resolveOpponentSkill(bestSkill);

      setTimeout(() => {
        if (state.battle.currentActor === 'opponent') switchTurn();
      }, 800 + Math.random() * 600);
    }, delay);
  }

  function inRangeAndLOS(actorA, actorB) {
    const dx = actorB.x - actorA.x;
    const dy = actorB.y - actorA.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 400) return false;
    const steps = Math.ceil(dist / 8);
    for (let i = 1; i < steps; i++) {
      const sx = actorA.x + (dx * (i / steps));
      const sy = actorA.y + (dy * (i / steps));
      if (tileAt(sx, sy) === 2) return false;
    }
    return true;
  }

  function resolveOpponentSkill(name) {
    if (state.battle?.currentActor !== 'opponent') return;
    if (!battleOppSkills[name] || (battleOppSkills[name] <= 0 && battleOppSkills[name] !== Infinity)) {
      switchTurn();
      return;
    }
    if (projectile) return;

    let acc = SKILLS[name].acc || 1;
    if (userData.profile === 'Warrior') acc = 0.5;

    let outcome;
    if (!inRangeAndLOS(opponent, player))
      outcome = Math.hypot(player.x - opponent.x, player.y - opponent.y) > 400 ? 'toofar' : 'blocked';
    else
      outcome = Math.random() < acc ? 'hit' : 'miss';

    projectile = new Projectile(opponent, player, name, outcome, (resolvedOutcome) => {
      projectile = null;
      const attackVal = getSkillAttackValue(name, opponent);
      if (resolvedOutcome === 'hit') {
        player.applyDamage(attackVal);
        showMessage(`Opponent used <b>${name}</b>! You lose ${attackVal} HP.`, 'error');
        animateHPChange(playerHpFill, (player.hp / player.maxHp) * 100);
      } else if (resolvedOutcome === 'miss') {
        showMessage(`Opponent used <b>${name}</b>! Missed!`, 'info');
      } else if (resolvedOutcome === 'blocked') {
        showMessage(`Opponent used <b>${name}</b>! Blocked by wall.`, 'info');
      } else if (resolvedOutcome === 'toofar') {
        showMessage(`Opponent used <b>${name}</b>! Too far.`, 'info');
      }

      if (battleOppSkills[name] !== Infinity) battleOppSkills[name] = Math.max(0, battleOppSkills[name] - 1);
      nextTurnAfterAction('opponent');
    });
  }

  function applyTacticOpponent(name) {
    if (state.battle?.currentActor !== 'opponent') return;
    if (!battleOppTactics[name] || battleOppTactics[name] <= 0) { switchTurn(); return; }
    if (name === "Dizzydizzy") {
      opponent.extraTurns += 2;
      if (state.battle) state.battle.turnEndTime = Date.now() + (state.battle.turnTimeout || 10000);
      showMessage("Opponent used <b>Dizzydizzy</b>! They gain 2 extra turns.", 'warn');
    } else if (name === "Pushie") {
      applyPush(player);
      showMessage("Opponent used <b>Pushie</b>! You were pushed.", 'warn');
    } else if (name === "Speed") {
      opponent.applySpeedBoost(10000);
      showMessage("Opponent used <b>Speed</b>! Opponent speed +50% for 10s.", 'warn');
    }
    battleOppTactics[name] = Math.max(0, battleOppTactics[name] - 1);
    nextTurnAfterAction('opponent');
  }

  function findNearbySafePosition(actor) {
    const steps = 6;
    for (let r = -steps; r <= steps; r++) {
      for (let c = -steps; c <= steps; c++) {
        const tx = actor.x + c * TILE;
        const ty = actor.y + r * TILE;
        if (tx <= 10 || ty <= 10 || tx >= canvas.width - 10 || ty >= canvas.height - 10) continue;
        const t = tileAt(tx, ty);
        if (t === 1 || t === 6) return { x: tx, y: ty };
      }
    }
    return null;
  }

  function applyPush(target) {
    const edges = [
      { x: 10, y: target.y },
      { x: canvas.width - 10, y: target.y },
      { x: target.x, y: 10 },
      { x: target.x, y: canvas.height - 10 }
    ];
    let best = null, bd = Infinity;
    for (const e of edges) {
      const d = Math.hypot(e.x - target.x, e.y - target.y);
      if (d < bd) { bd = d; best = e; }
    }
    const pushDist = Math.min(100, bd);
    const ang = Math.atan2(best.y - target.y, best.x - target.x);
    target.x += Math.cos(ang) * pushDist;
    target.y += Math.sin(ang) * pushDist;
  }

  function moveTowards(actor, tx, ty) {
    const path = findPath(actor.x, actor.y, tx, ty);
    if (path && path.length > 1)
      followPath(actor, path);
  }

  function moveAway(actor, fromX, fromY) {
    // sample candidate targets in a circle
    let best = null; let bestDist = -Infinity;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      const tx = actor.x + Math.cos(angle) * TILE * 3;
      const ty = actor.y + Math.sin(angle) * TILE * 3;
      if (tx < 10 || ty < 10 || tx > canvas.width - 10 || ty > canvas.height - 10) continue;
      const t = tileAt(tx, ty);
      if (t === 0 || t === 2 || t === 4) continue;
      const d = Math.hypot(tx - fromX, ty - fromY);
      if (d > bestDist) { bestDist = d; best = { x: tx, y: ty }; }
    }
    if (best) {
      const path = findPath(actor.x, actor.y, best.x, best.y);
      if (path && path.length > 1) followPath(actor, path);
    }
  }

  async function finalizeEndBattle(playerWon, message) {
    if (state.battle?.over) return;
    const battle = state.battle;
    state.battle.over = true;
    stopBattle();

    let awarded = Math.floor(opponentStrength * 15) + (currentLevel === 'normal' ? 2 : 12);
    if (playerWon) {
      if (userData.profile === 'Miner') awarded *= 2;
      userData.diamonds = (userData.diamonds || 0) + awarded;
      await save(userData);
      showMessage(`You win! ${message} Diamonds earned: ${awarded}`, 'success');
    } else {
      showMessage(`You lose. ${message}`, 'error');
    }
    if (userData.profile === 'Trickster') {
      if (Date.now() - battle.startTime < 11000 && !playerWon) {
        showMessage('Sorry, no cheating the prize!', 'warn', 3000);
      } else {
        showPrize();
        return;
      }
    }
    showStart();
  }

  showStart();
})();