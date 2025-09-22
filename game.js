(() => {
  const $ = (sel) => document.querySelector(sel);
  const storageKey = "thegame_save_v1";

  // ---- Game data definitions ----
  const SKILLS = {
    Spear: { attack: 5, acc: 0.5, price: 0, default: true, infinite: true, desc: "Attack 5, 50% accuracy." },
    Knife: { attack: 2, acc: 0.8, price: 0, default: true, infinite: true, desc: "Attack 2, 80% accuracy." },
    Multiknife: { attack: 10, acc: 0.8, price: 2, desc: "Attack 10, 80% accuracy." },
    Multispear: { attack: 20, acc: 0.8, price: 4, desc: "Attack 20, 80% accuracy." },
    "Stone Sword": { attack: 30, acc: 1, price: 6, desc: "Attack 30, 100% accuracy." },
    Kick: { attack: 50, acc: 0.8, price: 9, desc: "Attack 50, 80% accuracy." },
    Minibomb: { attack: 60, acc: 1, price: 11, desc: "Attack 60, 100% accuracy." },
    Flame: { attack: 80, acc: 1, price: 15, desc: "Attack 80, 100% accuracy." },
    Oneskill: { attack: 100, acc: 0.8, price: 25, desc: "Attack 100, 80% accuracy." },
    Minitrident: { attack: 120, acc: 1, price: 24, desc: "Attack 120, 100% accuracy. +30 attack if used in water." },
    Fireball: { attack: 150, acc: 1, price: 28, desc: "Attack 150, 100% accuracy." },
    "Iron Sword": { attack: 200, acc: 1, price: 38, desc: "Attack 200, 100% accuracy." }
  };

  const TACTICS = {
    Dizzydizzy: { price: 12, desc: "Gives user two extra turns." },
    Pushie: { price: 17, desc: "Pushes opponent toward nearest edge." },
    Speed: { price: 10, desc: "Speed +50% for 10s." }
  };

  // ---- Persistent storage ----
  function loadSave() {
    let s = localStorage.getItem(storageKey);
    if (!s) {
      return {
        diamonds: 0,
        maxHealth: 10,
        ownedSkills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, SKILLS[k].default ? Infinity : 0])),
        ownedTactics: Object.fromEntries(Object.keys(TACTICS).map(k => [k, 0])),
        skillOrder: Object.keys(SKILLS),
        tacticOrder: Object.keys(TACTICS)
      };
    }
    try {
      const parsed = JSON.parse(s);

      const ownedSkills = { ...(parsed.ownedSkills || {}) };
      // Add any missing or null/default skills
      Object.keys(SKILLS).forEach(k => {
        const val = ownedSkills[k];
        if (val == null) {
          if (SKILLS[k].default) ownedSkills[k] = Infinity;
          else ownedSkills[k] = 0;
        }
      });

      // Same approach for tactics
      const ownedTactics = { ...(parsed.ownedTactics || {}) };
      Object.keys(TACTICS).forEach(k => {
        const val = ownedTactics[k];
        if (val == null) ownedTactics[k] = 0;
      });

      return {
        diamonds: parsed.diamonds || 0,
        maxHealth: parsed.maxHealth || 10,
        ownedSkills,
        ownedTactics,
        skillOrder: parsed.skillOrder || Object.keys(SKILLS),
        tacticOrder: parsed.tacticOrder || Object.keys(TACTICS)
      };
    } catch (e) {
      console.error("Load fail", e);
      return {
        diamonds: 0,
        maxHealth: 10,
        ownedSkills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, SKILLS[k].default ? Infinity : 0])),
        ownedTactics: Object.fromEntries(Object.keys(TACTICS).map(k => [k, 0])),
        skillOrder: Object.keys(SKILLS),
        tacticOrder: Object.keys(TACTICS)
      };
    }
  }
  function save(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }
  let saveState = loadSave();

  // ---- UI references ----
  const startScreen = $("#start-screen");
  const battleScreen = $("#battle-screen");
  const shopScreen = $("#shop-screen");
  const tooltip = $("#tooltip");
  const messagesContainer = $("#messages");

  const startHealthEl = $("#start-health");
  const startDiamondsEl = $("#start-diamonds");
  const startSkillsEl = $("#start-skills");
  const startTacticsEl = $("#start-tactics");

  const battleSkillsEl = $("#battle-skills");
  const battleTacticsEl = $("#battle-tactics");
  const playerHpFill = $("#player-hp-fill");
  const opponentHpFill = $("#opponent-hp-fill");
  const playerHealthText = $("#player-health-text");
  const opponentHealthText = $("#opponent-health-text");
  const hudDiamondsEl = $("#hud-diamonds");
  const turnIndicatorEl = $("#turn-indicator");
  const btnBattle = $("#btn-battle");
  const btnShop = $("#btn-shop");
  const btnSurrender = $("#btn-surrender");
  const btnReset = $("#btn-reset");

  const shopDiamondsEl = $("#shop-diamonds");
  const shopSkillsEl = $("#shop-skills");
  const shopTacticsEl = $("#shop-tactics");
  const btnBuyHealth = $("#btn-buy-health");
  const btnShopBack = $("#btn-shop-back");

  // Canvas
  const canvas = $("#game-canvas");
  const ctx = canvas.getContext("2d");

  // Game constants
  const TILE = 40;
  const MAP_W = Math.floor(canvas.width / TILE);
  const MAP_H = Math.floor(canvas.height / TILE);
  const PLAYER_SPEED = 140; // px/s
  const OPP_SPEED = 120;
  const LAVA_DAMAGE = 10;
  const CACTUS_DPS = 5;
  const LAVA_TICK_INTERVAL = 500;
  const CACTUS_TICK_INTERVAL = 250;

  // Map generation
  function generateMap() {
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
    // make island a bit larger relative to map
    const ox = 1;
    const oy = 1;
    const islandW = Math.max(1, MAP_W - 2 * ox);
    const islandH = Math.max(1, MAP_H - 2 * oy);

    for (let r = oy; r < oy + islandH; r++) {
      for (let c = ox; c < ox + islandW; c++) {
        grid[r][c] = 1;
      }
    }

    // keep spawn corners valid
    grid[oy + 1][ox + 1] = 1;
    grid[oy + islandH - 2][ox + islandW - 2] = 1;

    // walls (obstacles)
    for (let i = 0; i < 60; i++) {
      const r = oy + 1 + Math.floor(Math.random() * (islandH - 2));
      const c = ox + 1 + Math.floor(Math.random() * (islandW - 2));
      if (Math.random() < 0.28) grid[r][c] = 2;
    }
    // water
    for (let i = 0; i < 18; i++) {
      const r = oy + 2 + Math.floor(Math.random() * (islandH - 4));
      const c = ox + 2 + Math.floor(Math.random() * (islandW - 4));
      if (grid[r][c] === 1 && Math.random() < 0.5) grid[r][c] = 3;
    }
    // lava
    for (let i = 0; i < 12; i++) {
      const r = oy + 2 + Math.floor(Math.random() * (islandH - 4));
      const c = ox + 2 + Math.floor(Math.random() * (islandW - 4));
      if (grid[r][c] === 1 && Math.random() < 0.35) grid[r][c] = 4;
    }
    // cactus
    for (let i = 0; i < 16; i++) {
      const r = oy + 2 + Math.floor(Math.random() * (islandH - 4));
      const c = ox + 2 + Math.floor(Math.random() * (islandW - 4));
      if (grid[r][c] === 1 && Math.random() < 0.4) grid[r][c] = 5;
    }
    // cobweb
    for (let i = 0; i < 12; i++) {
      const r = oy + 2 + Math.floor(Math.random() * (islandH - 4));
      const c = ox + 2 + Math.floor(Math.random() * (islandW - 4));
      if (grid[r][c] === 1 && Math.random() < 0.3) grid[r][c] = 6;
    }
    // holes
    for (let i = 0; i < 18; i++) {
      const r = oy + 2 + Math.floor(Math.random() * (islandH - 4));
      const c = ox + 2 + Math.floor(Math.random() * (islandW - 4));
      if (grid[r][c] === 1 && Math.random() < 0.35) grid[r][c] = 0;
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
    return t !== 0 && t !== 2; // 0 = void, 2 = wall are blocked
  }

  function tileCenter(c, r) {
    return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
  }

  function tileCost(r, c) {
    if (!inBounds(r, c)) return 9999;
    const t = grid[r][c];
    switch (t) {
      case 1: return 1.0;   // land
      case 3: return 1.2;   // water (slightly slower)
      case 4: return 8.0;   // lava (avoid unless necessary)
      case 5: return 4.0;   // cactus (costly but less than lava)
      case 6: return 1.5;   // cobweb (slower)
      default: return 9999; // void / wall (not walkable)
    }
  }

  // Octile heuristic for 8-neighbour grid (admissible when multiplied by minimum tile cost)
  function octileHeuristic(r, c, tr, tc, minTileCost = 1.0) {
    const dx = Math.abs(c - tc);
    const dy = Math.abs(r - tr);
    const D = 1.0;
    const D2 = Math.SQRT2;
    return minTileCost * (D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy));
  }

  function getSkillAttackValue(name, actor) {
    const s = SKILLS[name];
    if (!s) return 0;
    let attack = s.attack || 0;
    if (name === 'Minitrident' && actor && tileAt(actor.x, actor.y) === 3) attack += 30;
    return attack;
  }

  function findPath(startX, startY, targetX, targetY, maxNodes = 4000) {
    const sc = Math.floor(startX / TILE), sr = Math.floor(startY / TILE);
    const tc = Math.floor(targetX / TILE), tr = Math.floor(targetY / TILE);
    if (!walkableTile(sr, sc) || !walkableTile(tr, tc)) return null;
    const startKey = sr + ',' + sc;
    const targetKey = tr + ',' + tc;

    // Precompute minimal possible tile cost (used for admissible heuristic)
    let minTile = Infinity;
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const t = grid[r][c];
        if (t === 1 || t === 3 || t === 6) minTile = Math.min(minTile, tileCost(r, c));
      }
    }
    if (!isFinite(minTile)) minTile = 1.0;

    // A* structures
    const open = new Map(); // key -> node
    const closed = new Set();

    function neighborsOf(r, c) {
      // 8-directional neighbors with movement multiplier (1 for straight, sqrt2 for diagonal)
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
      // find node with smallest f
      let bestKey = null; let bestF = Infinity;
      for (const [k, v] of open) {
        if (v.f < bestF) { bestF = v.f; bestKey = k; }
      }
      const current = open.get(bestKey);
      open.delete(bestKey);
      const curKey = current.r + ',' + current.c;
      closed.add(curKey);

      if (curKey === targetKey) {
        // reconstruct path (list of {r,c,x,y})
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

        // Additional check for cutting corners: disallow diagonal movement through two adjacent walls
        if (nb.moveCost === Math.SQRT2) {
          const cut1 = current.r + (nb.r - current.r), cut1c = current.c;
          const cut2 = current.r, cut2c = current.c + (nb.c - current.c);
          if (!walkableTile(cut1, cut1c) || !walkableTile(cut2, cut2c)) continue;
        }

        // g cost: current.g + movementCost * average tileCost of current and neighbour
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

    return null; // failed to find path
  }

  function followPath(actor, path) {
    if (!path || path.length < 2) return false;
    // find which path node the actor is currently closest to
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < Math.min(path.length, 4); i++) { // only check first few nodes
      const dx = actor.x - path[i].x, dy = actor.y - path[i].y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; idx = i; }
    }
    // choose next node
    const nextIndex = Math.min(path.length - 1, idx + 1);
    const next = path[nextIndex];
    const dx = next.x - actor.x, dy = next.y - actor.y;
    const mag = Math.hypot(dx, dy) || 1;
    actor.vx = (dx / mag) * actor.speed;
    actor.vy = (dy / mag) * actor.speed;
    return true;
  }

  // Entities
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
      this.effects = {}; this.extraTurns = 0; this.lastLavaTick = 0; this.lastCactusTick = 0;
    }
    applyDamage(d) {
      this.hp -= d; if (this.hp < 0) this.hp = 0;
    }
    isDead() { return this.hp <= 0; }
    applyEffect(name, val) { this.effects[name] = val; }
    hasEffect(name) { return this.effects[name] && this.effects[name] > Date.now(); }
  }

  // State
  let grid = generateMap();
  let spawns = spawnPositions(grid);

  let player = null, opponent = null;
  let battlePlayerSkills = {}, battlePlayerTactics = {};
  let battleOppSkills = {}, battleOppTactics = {};
  let state = { phase: "pre", battle: null };

  // keyboard movement + shortcuts
  const keysDown = {};
  let expectSkillNumber = false;
  let expectTacticNumber = false;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'tab') e.preventDefault();

    keysDown[k] = true; // movement keys state

    if (k === 'e') {
      expectSkillNumber = true;
      expectTacticNumber = false;
      battleSkillsEl.style.border = "1.5px solid #2263ad";
      battleTacticsEl.style.border = "none";
    }
    if (k === 'f') {
      expectTacticNumber = true;
      expectSkillNumber = false;
      battleTacticsEl.style.border = "1.5px solid #2263ad";
      battleSkillsEl.style.border = "none";
    }
    if (expectSkillNumber && /^[1-9]$/.test(e.key)) {
      const i = parseInt(e.key) - 1;
      const shown = getShownBattleSkills();
      if (shown[i]) useSkillByName(shown[i]);
      expectSkillNumber = false;
    }
    if (expectTacticNumber && /^[1-9]$/.test(e.key)) {
      const i = parseInt(e.key) - 1;
      const shown = getShownBattleTactics();
      if (shown[i]) useTacticByName(shown[i]);
      expectTacticNumber = false;
    }
  });
  window.addEventListener('keyup', (e) => { keysDown[e.key.toLowerCase()] = false; });

  // ---- Messages ----
  function showMessage(htmlText, type = 'info', timeout = 3000) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = htmlText;
    messagesContainer.appendChild(msg);

    // remove after timeout with animation
    setTimeout(() => {
      msg.style.animation = 'msgOut 300ms forwards';
      setTimeout(() => msg.remove(), 320);
    }, timeout);
    return msg;
  }

  // ---- UI helpers ----

  function renderStartUI() {
    startHealthEl.textContent = saveState.maxHealth;
    startDiamondsEl.textContent = saveState.diamonds;
    startSkillsEl.innerHTML = "";
    startTacticsEl.innerHTML = "";

    // skills
    const skillOrder = saveState.skillOrder || Object.keys(SKILLS);
    const ownedSkills = skillOrder.filter(k => saveState.ownedSkills[k] && saveState.ownedSkills[k] !== 0);
    ownedSkills.forEach((k, idx) => {
      const s = SKILLS[k];
      const count = saveState.ownedSkills[k] === Infinity ? "∞" : saveState.ownedSkills[k];
      const btn = document.createElement('div');
      btn.className = 'skill-btn';
      btn.draggable = true;
      btn.dataset.name = k;
      // numeric badge for first 9 shown
      const badge = (idx < 9) ? `<div class="num-badge">${idx + 1}</div>` : '';
      btn.innerHTML = `${badge}<div>${k}</div><div class="skill-count">${count}</div>`;
      attachTooltip(btn, `${k}<br>${s.desc}<br>Price: ${s.price || '—'}`);
      addDragHandlers(btn, saveState.skillOrder, renderStartUI, () => renderStartUI());
      startSkillsEl.appendChild(btn);
    });

    // tactics
    const tacticOrder = saveState.tacticOrder || Object.keys(TACTICS);
    const ownedTactics = tacticOrder.filter(k => saveState.ownedTactics[k] && saveState.ownedTactics[k] !== 0);
    ownedTactics.forEach((k, idx) => {
      const t = TACTICS[k];
      const count = saveState.ownedTactics[k] || 0;
      const btn = document.createElement('div');
      btn.className = 'tactic-btn';
      btn.draggable = true;
      btn.dataset.name = k;
      const badge = (idx < 9) ? `<div class="num-badge">${idx + 1}</div>` : '';
      btn.innerHTML = `${badge}<div>${k}</div><div class="skill-count">${count}</div>`;
      attachTooltip(btn, `${k}<br>${t.desc}<br>Price: ${t.price}`);
      addDragHandlers(btn, saveState.tacticOrder, renderStartUI, () => renderStartUI());
      startTacticsEl.appendChild(btn);
    });
  }

  function getShownBattleSkills() {
    // maintain original order but filter to what is available this battle
    return saveState.skillOrder.filter(k => (battlePlayerSkills[k] && battlePlayerSkills[k] !== 0) || battlePlayerSkills[k] === Infinity);
  }
  function getShownBattleTactics() {
    return saveState.tacticOrder.filter(k => (battlePlayerTactics[k] && battlePlayerTactics[k] !== 0));
  }

  function renderBattleUI() {
    hudDiamondsEl.textContent = saveState.diamonds;
    playerHpFill.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    opponentHpFill.style.width = `${Math.max(0, (opponent.hp / opponent.maxHp) * 100)}%`;

    if (playerHealthText) playerHealthText.textContent = `${Math.max(0, Math.floor(player.hp))}/${player.maxHp}`;
    if (opponentHealthText) opponentHealthText.textContent = `${Math.max(0, Math.floor(opponent.hp))}/${opponent.maxHp}`;

    battleSkillsEl.innerHTML = "";
    const shownSkills = getShownBattleSkills();
    shownSkills.forEach((k, idx) => {
      const s = SKILLS[k];
      const count = battlePlayerSkills[k] === Infinity ? "∞" : (battlePlayerSkills[k] || 0);
      const btn = document.createElement('div');
      btn.className = 'skill-btn';
      btn.dataset.name = k;
      btn.dataset.index = idx;
      const badge = (idx < 9) ? `<div class="num-badge">${idx + 1}</div>` : '';
      btn.innerHTML = `${badge}<div>${k}</div><div class="skill-count">${count}</div>`;
      btn.addEventListener('click', () => useSkillByName(k));
      attachTooltip(btn, `${k}<br>${s.desc}<br>Count this battle: ${count}`);
      addDragHandlers(btn, saveState.skillOrder, () => { renderBattleUI(); }, () => { renderBattleUI(); });
      battleSkillsEl.appendChild(btn);
    });

    battleTacticsEl.innerHTML = "";
    const shownTactics = getShownBattleTactics();
    shownTactics.forEach((k, idx) => {
      const t = TACTICS[k];
      const count = battlePlayerTactics[k] || 0;
      const btn = document.createElement('div');
      btn.className = 'tactic-btn';
      btn.dataset.name = k;
      btn.dataset.index = idx;
      const badge = (idx < 9) ? `<div class="num-badge">${idx + 1}</div>` : '';
      btn.innerHTML = `${badge}<div>${k}</div><div class="skill-count">${count}</div>`;
      btn.addEventListener('click', () => useTacticByName(k));
      attachTooltip(btn, `${k}<br>${t.desc}<br>Count this battle: ${count}`);
      addDragHandlers(btn, saveState.tacticOrder, () => { renderBattleUI(); }, () => { renderBattleUI(); });
      battleTacticsEl.appendChild(btn);
    });
  }

  function renderShopUI() {
    shopDiamondsEl.textContent = saveState.diamonds;
    shopSkillsEl.innerHTML = "";
    shopTacticsEl.innerHTML = "";
    Object.keys(SKILLS).forEach(k => {
      const s = SKILLS[k];
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div><strong>${k}</strong><div style="font-size:13px;color:var(--muted)">${s.desc}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
        <div style="color:var(--muted);font-weight:600">${s.price ? s.price : '—'}</div>
        <button class="btn" data-name="${k}">Buy</button>
        </div>`;
      row.querySelector('button').addEventListener('click', () => {
        buySkill(k);
      });
      shopSkillsEl.appendChild(row);
    });
    Object.keys(TACTICS).forEach(k => {
      const t = TACTICS[k];
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div><strong>${k}</strong><div style="font-size:13px;color:var(--muted)">${t.desc}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
        <div style="color:var(--muted);font-weight:600">${t.price}</div>
        <button class="btn" data-name="${k}">Buy</button>
        </div>`;
      row.querySelector('button').addEventListener('click', () => {
        buyTactic(k);
      });
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
    node.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  }
  function positionTooltip(x, y) {
    tooltip.style.left = (x + 12) + 'px';
    tooltip.style.top = (y + 12) + 'px';
  }

  // Drag reorder
  function addDragHandlers(node, orderArray, onChange, onEnd) {
    node.addEventListener('dragstart', (ev) => {
      node.classList.add('dragging');
      ev.dataTransfer.setData('text/plain', node.dataset.name);
      setTimeout(() => node.classList.add('invisible'), 0);
    });
    node.addEventListener('dragend', (ev) => {
      node.classList.remove('dragging', 'invisible');
      if (onEnd) onEnd();
      save(saveState);
    });
    node.addEventListener('dragover', (ev) => ev.preventDefault());
    node.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const from = ev.dataTransfer.getData('text/plain');
      const to = node.dataset.name;
      const fi = orderArray.indexOf(from);
      const ti = orderArray.indexOf(to);
      if (fi >= 0 && ti >= 0) {
        orderArray.splice(fi, 1);
        orderArray.splice(ti, 0, from);
        if (onChange) onChange();
      }
    });
  }

  // ---- Shop actions ----
  function buySkill(name) {
    const s = SKILLS[name];
    if (!s.price) {
      showMessage(`<strong>${name}</strong> cannot be purchased.`, 'warn');
      return;
    }
    if (saveState.diamonds < s.price) { showMessage("Not enough diamonds.", 'error'); return; }
    saveState.diamonds -= s.price;
    saveState.ownedSkills[name] = (saveState.ownedSkills[name] || 0) + 1;
    save(saveState);
    renderShopUI(); renderStartUI();
    showMessage(`Bought <strong>${name}</strong>.`, 'success');
  }
  function buyTactic(name) {
    const t = TACTICS[name];
    if (saveState.diamonds < t.price) { showMessage("Not enough diamonds.", 'error'); return; }
    saveState.diamonds -= t.price;
    saveState.ownedTactics[name] = (saveState.ownedTactics[name] || 0) + 1;
    save(saveState);
    renderShopUI(); renderStartUI();
    showMessage(`Bought <strong>${name}</strong>.`, 'success');
  }
  btnBuyHealth.addEventListener('click', () => {
    if (saveState.diamonds < 1) { showMessage("Not enough diamonds.", 'error'); return; }
    saveState.diamonds -= 1;
    saveState.maxHealth += 5;
    save(saveState);
    renderShopUI(); renderStartUI();
    showMessage(`Bought 5 health. You have ${saveState.maxHealth} health now.`, 'success');
  });

  // ---- Battle lifecycle ----
  function prepareBattle() {
    grid = generateMap();
    spawns = spawnPositions(grid);
    const startHp = saveState.maxHealth;
    player = new Actor(spawns.first[0], spawns.first[1], startHp, PLAYER_SPEED, '#10b981');
    opponent = new Actor(spawns.second[0], spawns.second[1], Math.max(8, Math.floor(startHp * (0.9 + Math.random() * 0.2))), OPP_SPEED, '#ef4444');
    // opponent AI chase tracking
    opponent.isChasing = false;
    opponent.lastPostChase = 0;

    // prepare battle owned counts per battle
    battlePlayerSkills = {}; battlePlayerTactics = {};
    battleOppSkills = {}; battleOppTactics = {};
    Object.keys(SKILLS).forEach(k => {
      const owned = saveState.ownedSkills[k];
      if (owned === Infinity) battlePlayerSkills[k] = Infinity;
      else battlePlayerSkills[k] = owned || 0;
      if (owned === Infinity) battleOppSkills[k] = Infinity;
      else battleOppSkills[k] = owned || 0;
    });
    Object.keys(TACTICS).forEach(k => {
      battlePlayerTactics[k] = saveState.ownedTactics[k] || 0;
      battleOppTactics[k] = saveState.ownedTactics[k] || 0;
    });

    renderBattleUI();

    // turn init
    const startPeriodMs = 5000;
    state.battle = {
      startTime: Date.now(),
      startPeriodEnd: Date.now() + startPeriodMs,
      currentActor: null,
      awaitingAction: false,
      turnEndTime: null,
      turnTimeout: 10000,
      lastActionTime: 0,
      battleOver: false,
      poolMap: grid
    };

    setTimeout(() => {
      state.battle.currentActor = (Math.random() < 0.5) ? 'player' : 'opponent';
      state.battle.turnEndTime = Date.now() + state.battle.turnTimeout;
      updateTurnIndicator();
      if (state.battle.currentActor === 'opponent') opponentAIChoose();
    }, startPeriodMs + 50);

    state.phase = 'inBattle';
    startLoop();
  }

  btnBattle.addEventListener('click', () => {
    showBattle();
    prepareBattle();
  });
  btnShop.addEventListener('click', () => {
    showShop();
    renderShopUI();
  });
  btnSurrender.addEventListener('click', () => {
    if (!state.battle) return;
    finalizeEndBattle(false, "You surrendered.");
  });
  btnReset.addEventListener('click', () => {
    if (!confirm("Reset all progress?")) return;
    localStorage.removeItem(storageKey);
    saveState = loadSave();
    renderStartUI();
    showMessage("Progress reset.", 'info');
  });
  btnShopBack.addEventListener('click', () => {
    showStart();
  });

  // UI screens
  function showStart() {
    state.phase = 'startScreen';
    startScreen.classList.remove('hidden');
    battleScreen.classList.add('hidden');
    shopScreen.classList.add('hidden');
    renderStartUI();
  }
  function showBattle() {
    startScreen.classList.add('hidden');
    battleScreen.classList.remove('hidden');
    shopScreen.classList.add('hidden');
  }
  function showShop() {
    startScreen.classList.add('hidden');
    battleScreen.classList.add('hidden');
    shopScreen.classList.remove('hidden');
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
    state.phase = 'startScreen';
  }

  function loop(ts) {
    const dt = Math.min(50, ts - lastTime) / 1000;
    lastTime = ts;
    update(dt);
    draw();
    if (!state.battle || state.battle.battleOver) { stopBattle(); return; }
    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (!state.battle) return;
    const now = Date.now();

    // movement: player via keys
    let spd = player.speed;
    if (player.hasEffect && player.hasEffect('speed')) { spd *= 1.5; }
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
        // move away if too close
        if (dist < 260) moveAway(opponent, player.x, player.y);
        else { opponent.vx *= 0.85; opponent.vy *= 0.85; }
        if (opponent.isChasing) {
          opponent.isChasing = false;
          opponentAIChoose();
        }
      } else {
        // Chase if far or hiding
        if (dist > 220 || !hasLineOfSight(opponent, player)) {
          const path = findPath(opponent.x, opponent.y, player.x, player.y);
          if (path) {
            followPath(opponent, path);
          } else {
            moveTowards(opponent, player.x, player.y);
          }
          opponent.isChasing = true;
        } else {
          opponent.vx *= 0.85; opponent.vy *= 0.85;
          if (opponent.isChasing) {
            opponent.isChasing = false;
            opponentAIChoose();
          }
        }
      }
    }

    applyMovement(player, dt);
    applyMovement(opponent, dt);

    handleHazards(player, dt);
    handleHazards(opponent, dt);

    // check falling into void
    if (isVoidAt(player.x, player.y)) {
      // animate player hp bar empty then finalize
      player.hp = 0;
      animateHPChange(playerHpFill, 0);
      setTimeout(() => finalizeEndBattle(false, "You fell into the void."), 700);
      return;
    }
    if (isVoidAt(opponent.x, opponent.y)) {
      opponent.hp = 0;
      animateHPChange(opponentHpFill, 0);
      setTimeout(() => finalizeEndBattle(true, "Opponent fell into the void."), 700);
      return;
    }

    // check death and allow bar to animate before finalizing
    if (player.isDead()) {
      animateHPChange(playerHpFill, 0);
      setTimeout(() => finalizeEndBattle(false, "You died."), 700);
      return;
    }
    if (opponent.isDead()) {
      animateHPChange(opponentHpFill, 0);
      setTimeout(() => finalizeEndBattle(true, "Opponent died."), 700);
      return;
    }

    // turn timer checks
    if (now < state.battle.startPeriodEnd) {
      turnIndicatorEl.textContent = `Starting... ${Math.ceil((state.battle.startPeriodEnd - now) / 1000)}s`;
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
    if (playerHealthText) playerHealthText.textContent = `${Math.max(0, Math.floor(player.hp))}/${player.maxHp}`;
    if (opponentHealthText) opponentHealthText.textContent = `${Math.max(0, Math.floor(opponent.hp))}/${opponent.maxHp}`;
  }

  function applyMovement(actor, dt) {
    const tileUnder = tileAt(actor.x, actor.y);
    let factor = 1;
    if (tileUnder === 3) factor = 0.6;
    if (tileUnder === 6) factor = 0.5;

    // Original position
    const originalX = actor.x;
    const originalY = actor.y;

    actor.x += actor.vx * dt * factor;
    actor.y += actor.vy * dt * factor;

    // Check if we moved into a wall
    const newTile = tileAt(actor.x, actor.y);
    if (newTile === 2) {
      // Revert position
      actor.x = originalX;
      actor.y = originalY;

      // Try X movement only
      actor.x += actor.vx * dt * factor;
      if (tileAt(actor.x, actor.y) === 2) {
        actor.x = originalX;
      }
      // Try Y movement only  
      actor.y += actor.vy * dt * factor;
      if (tileAt(actor.x, actor.y) === 2) {
        actor.y = originalY;
      }
      // Stop if still blocked
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
      if (now - actor.lastLavaTick >= LAVA_TICK_INTERVAL) {
        actor.applyDamage(LAVA_DAMAGE);
        actor.lastLavaTick = now;
        if (actor === player) showMessage("Sizzling in lava!", 'warn');
      }
    } else {
      actor.lastLavaTick = 0;
    }
    if (tile === 5) {
      if (!actor.lastCactusTick) actor.lastCactusTick = now;
      if (now - actor.lastCactusTick >= CACTUS_TICK_INTERVAL) {
        actor.applyDamage(Math.round(CACTUS_DPS * (CACTUS_TICK_INTERVAL / 1000)));
        actor.lastCactusTick = now;
        if (actor === player) showMessage("Pricked by cactus!", 'warn');
      }
    } else {
      actor.lastCactusTick = 0;
    }
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
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const t = grid[r][c];
        const x = c * TILE, y = r * TILE;
        if (t === 0) {
          ctx.fillStyle = '#7fbfff'; ctx.fillRect(x, y, TILE, TILE);
          drawDownArrow(ctx, c * TILE + TILE / 2, r * TILE + TILE / 2, TILE * 0.4);
        } else if (t === 1) {
          ctx.fillStyle = '#6b8f5a'; ctx.fillRect(x, y, TILE, TILE);
        } else if (t === 2) {
          ctx.fillStyle = '#5b5b5b'; ctx.fillRect(x, y, TILE, TILE);
        } else if (t === 3) {
          ctx.fillStyle = '#4ea0ff'; ctx.fillRect(x, y, TILE, TILE);
        } else if (t === 4) {
          ctx.fillStyle = '#ff7a4d'; ctx.fillRect(x, y, TILE, TILE);
        } else if (t === 5) {
          ctx.fillStyle = '#7ad17a'; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#2a7a2a'; ctx.fillRect(x + TILE * 0.45, y + TILE * 0.2, TILE * 0.1, TILE * 0.6);
        } else if (t === 6) {
          ctx.fillStyle = '#8fb8c6'; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#ffffff';
          ctx.font = `${TILE}px Inter`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('*', x + TILE / 2, y + TILE / 2 + 10);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.strokeRect(x, y, TILE, TILE);
      }
    }

    drawActor(player, 'P');
    drawActor(opponent, 'O');
  }

  function drawActor(a, letter) {
    ctx.save();
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

    ctx.restore();
  }

  function drawDownArrow(ctx, x, y, size) {
    ctx.save();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    // vertical line
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x, y + size / 4);
    ctx.stroke();
    // arrow head
    ctx.beginPath();
    ctx.moveTo(x - size / 4, y);
    ctx.lineTo(x, y + size / 2);
    ctx.lineTo(x + size / 4, y);
    ctx.stroke();

    ctx.restore();
  }

  // ---- Skill & tactic usage ----
  function useSkillByName(name) {
    if (!state.battle) return;
    if (Date.now() < state.battle.startPeriodEnd) return;
    if (state.battle.currentActor !== 'player') return;
    if (!battlePlayerSkills[name] || (battlePlayerSkills[name] <= 0 && battlePlayerSkills[name] !== Infinity)) {
      showMessage(`No <strong>${name}</strong> left!`, 'warn');
      return;
    }

    const attackVal = getSkillAttackValue(name, player);
    if (inRangeAndLOS(player, opponent) && (Math.random() < (SKILLS[name].acc || 1))) {
      opponent.applyDamage(attackVal);
      showMessage(`You used <strong>${name}</strong>! Opponent loses ${attackVal} HP.`, 'info');
      animateHPChange(opponentHpFill, (opponent.hp / opponent.maxHp) * 100);
    } else if (!inRangeAndLOS(player, opponent)) {
      showMessage(`You used <strong>${name}</strong>! Too far or blocked by wall.`, 'warn');
    } else {
      showMessage(`You used <strong>${name}</strong>! Missed!`, 'warn');
    }

    if (battlePlayerSkills[name] !== Infinity) {
      battlePlayerSkills[name] = Math.max(0, (battlePlayerSkills[name] || 0) - 1);
      if (battlePlayerSkills[name] === 0) showMessage(`You have no <strong>${name}</strong> left.`, 'warn');
    }
    renderBattleUI(); // refresh UI skill counts

    nextTurnAfterAction('player');
  }

  function useTacticByName(name) {
    if (!state.battle) return;
    if (Date.now() < state.battle.startPeriodEnd) return;
    if (state.battle.currentActor !== 'player') return;
    if (!battlePlayerTactics[name] || battlePlayerTactics[name] <= 0) return;

    if (name === "Dizzydizzy") {
      player.extraTurns += 2;
      if (state.battle) state.battle.turnEndTime = Date.now() + (state.battle.turnTimeout || 10000);
      showMessage(`You used <strong>${name}</strong>! 2 extra turns.`, 'info');
    } else if (name === "Pushie") {
      applyPush(opponent);
      showMessage(`You used <strong>${name}</strong>! Opponent was pushed.`, 'info');
    } else if (name === "Speed") {
      player.applyEffect('speed', Date.now() + 10000);
      showMessage(`You used <strong>${name}</strong>! Speed up 10s.`, 'info');
    }

    battlePlayerTactics[name] = Math.max(0, battlePlayerTactics[name] - 1);
    if (battlePlayerTactics[name] === 0) showMessage(`You have no <strong>${name}</strong> left.`, 'warn');
    renderBattleUI(); // refresh UI tactic counts

    nextTurnAfterAction('player');
  }

  function nextTurnAfterAction(byActor) {
    if (byActor === 'player') {
      if (player.extraTurns > 0) { player.extraTurns--; showMessage("Extra turn!", 'info'); return; }
      switchTurn();
    } else {
      if (opponent.extraTurns > 0) { opponent.extraTurns--; opponentAIChoose(); return; }
      switchTurn();
    }
  }

  function switchTurn() {
    if (!state.battle) return;
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
      turnIndicatorEl.textContent = `Starting... ${Math.ceil((state.battle.startPeriodEnd - now) / 1000)}s`;
      return;
    }
    const actor = state.battle.currentActor;
    if (actor === 'player') {
      const remain = Math.max(0, Math.ceil((state.battle.turnEndTime - now) / 1000));
      turnIndicatorEl.textContent = `Your turn — ${remain}s`;
    } else if (actor === 'opponent') {
      const remain = Math.max(0, Math.ceil((state.battle.turnEndTime - now) / 1000));
      turnIndicatorEl.textContent = `Opponent's turn — ${remain}s`;
    } else {
      turnIndicatorEl.textContent = 'Waiting...';
    }
  }

  function animateHPChange(el, pct) {
    if (pct === 0)
      el.style.transition = 'width 700ms ease';
    else
      el.style.transition = 'width 400ms ease';
    el.style.width = `${pct}%`;
  }

  // ---- Opponent AI ----
  function opponentAIChoose() {
    if (!state.battle) return;
    if (state.battle.currentActor !== 'opponent') return;

    const delay = 1000 + Math.random() * 800;
    opponent.aiTimer = Date.now() + delay;

    setTimeout(() => {
      if (!state.battle || state.battle.currentActor !== 'opponent') return;

      // if standing on hazard, try to move away first
      const tileHere = tileAt(opponent.x, opponent.y);
      if (tileHere === 4 || tileHere === 5) {
        const safe = findNearbySafePosition(opponent);
        if (safe) {
          moveTowards(opponent, safe.x, safe.y);
          setTimeout(() => {
            if (state.battle.currentActor === 'opponent') switchTurn();
          }, 600);
          return;
        }
      }

      const candidates = Object.keys(SKILLS).filter(k => (battleOppSkills[k] && battleOppSkills[k] !== 0) || battleOppSkills[k] === Infinity);
      const tacticCandidates = Object.keys(TACTICS).filter(k => (battleOppTactics[k] && battleOppTactics[k] > 0));

      // try to find instant finisher
      for (const k of candidates) {
        const s = SKILLS[k];
        let attack = s.attack;
        if (k === "Minitrident" && tileAt(opponent.x, opponent.y) === 3) attack += 30;
        if (attack >= player.hp && Math.random() < (s.acc || 1)) {
          resolveOpponentSkill(k);
          return;
        }
      }

      // tactics
      if (tacticCandidates.includes("Pushie")) {
        const distToEdge = distanceToNearestEdge(player.x, player.y);
        if (distToEdge < 180 && Math.random() < 0.8) {
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

      // pick best expected damage skill
      let bestSkill = null, bestVal = -Infinity;
      for (const k of candidates) {
        const s = SKILLS[k];
        let attack = s.attack;
        if (k === "Minitrident" && tileAt(opponent.x, opponent.y) === 3) attack += 30;
        const expected = attack * (s.acc || 1);
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
    const maxRange = 380;
    if (dist > maxRange) return false;
    const steps = Math.ceil(dist / 8);
    for (let i = 1; i < steps; i++) {
      const sx = actorA.x + (dx * (i / steps));
      const sy = actorA.y + (dy * (i / steps));
      if (tileAt(sx, sy) === 2) return false;
    }
    return true;
  }

  function hasLineOfSight(actorA, actorB) {
    const dx = actorB.x - actorA.x;
    const dy = actorB.y - actorA.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 8) || 1;
    for (let i = 1; i < steps; i++) {
      const sx = actorA.x + (dx * (i / steps));
      const sy = actorA.y + (dy * (i / steps));
      if (tileAt(sx, sy) === 2) return false;
    }
    return true;
  }

  function resolveOpponentSkill(name) {
    if (!state.battle || state.battle.currentActor !== 'opponent') return;
    if (!battleOppSkills[name] || (battleOppSkills[name] <= 0 && battleOppSkills[name] !== Infinity)) {
      switchTurn();
      return;
    }
    const attackVal = getSkillAttackValue(name, opponent);
    if (Math.random() < (SKILLS[name].acc || 1)) {
      player.applyDamage(attackVal);
      showMessage(`Opponent used <strong>${name}</strong>! You lose ${attackVal} HP.`, 'error');
      animateHPChange(playerHpFill, (player.hp / player.maxHp) * 100);
    } else {
      showMessage(`Opponent used <strong>${name}</strong>! Missed!`, 'info');
    }
    if (battleOppSkills[name] !== Infinity) battleOppSkills[name] = Math.max(0, battleOppSkills[name] - 1);
    nextTurnAfterAction('opponent');
  }

  function applyTacticOpponent(name) {
    if (!state.battle || state.battle.currentActor !== 'opponent') return;
    // check opponent-specific tactic counts
    if (!battleOppTactics[name] || battleOppTactics[name] <= 0) { switchTurn(); return; }
    if (name === "Dizzydizzy") {
      opponent.extraTurns += 2;
      if (state.battle) state.battle.turnEndTime = Date.now() + (state.battle.turnTimeout || 10000);
      showMessage("Opponent used <strong>Dizzydizzy</strong>! They gain 2 extra turns.", 'warn');
    } else if (name === "Pushie") {
      applyPush(player);
      showMessage("Opponent used <strong>Pushie</strong>! You were pushed.", 'warn');
    } else if (name === "Speed") {
      opponent.applyEffect('speed', Date.now() + 10000);
      showMessage("Opponent used <strong>Speed</strong>! Opponent speed +50% for 10s.", 'warn');
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

  function distanceToNearestEdge(x, y) {
    const d1 = x; const d2 = canvas.width - x; const d3 = y; const d4 = canvas.height - y;
    return Math.min(d1, d2, d3, d4);
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
    const pushDist = Math.min(110, bd);
    const ang = Math.atan2(best.y - target.y, best.x - target.x);
    target.x += Math.cos(ang) * pushDist;
    target.y += Math.sin(ang) * pushDist;
  }

  function moveTowards(actor, tx, ty) {
    const path = findPath(actor.x, actor.y, tx, ty);
    if (path && path.length > 1) {
      followPath(actor, path);
      return;
    }
    // fallback: direct chase if no path
    const dx = tx - actor.x; const dy = ty - actor.y;
    const mag = Math.hypot(dx, dy) || 1;
    actor.vx = (dx / mag) * actor.speed;
    actor.vy = (dy / mag) * actor.speed;
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
      if (path && path.length > 1) { followPath(actor, path); return; }
      // fallback: direct away vector
      const dx = actor.x - fromX; const dy = actor.y - fromY;
      const mag = Math.hypot(dx, dy) || 1;
      actor.vx = (dx / mag) * actor.speed;
      actor.vy = (dy / mag) * actor.speed;
    } else {
      // wander: final fallback
      const ang = Math.random() * Math.PI * 2;
      actor.vx = Math.cos(ang) * (actor.speed * 0.6);
      actor.vy = Math.sin(ang) * (actor.speed * 0.6);
    }
  }

  // End battle
  function finalizeEndBattle(playerWon, message) {
    if (!state.battle || state.battle.battleOver) return;
    state.battle.battleOver = true;
    let awarded = 0;
    if (playerWon) {
      // calculate reward
      let totalAttack = 0;
      Object.keys(SKILLS).forEach(k => {
        const s = SKILLS[k];
        if (saveState.ownedSkills[k] && saveState.ownedSkills[k] !== 0)
          totalAttack += s.attack;
      });
      awarded = 2 + Math.floor((totalAttack + saveState.maxHealth) / 40);
      saveState.diamonds = (saveState.diamonds || 0) + awarded;
      save(saveState);
    }
    showMessage((playerWon ? "You win! " : "You lose. ") + message + (playerWon ? ` Diamonds earned: ${awarded}` : ""), playerWon ? 'success' : 'error');
    showStart();
    renderStartUI();
  }

  // ---- UI / interactions ----
  function setupUI() {
    renderStartUI();
    btnShop.addEventListener('click', () => { showShop(); renderShopUI(); });
  }
  setupUI();

  window.useSkillByName = useSkillByName;
  window.useTacticByName = useTacticByName;

  showStart();
})();