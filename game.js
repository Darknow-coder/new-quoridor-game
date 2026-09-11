/* ============================================================
   QUORIDOR 4 — game.js
   Jeu de plateau 4 joueurs (1 humain + 3 bots) en solo.
   ============================================================ */

/* ============================================================
   1. CONFIG & RANGS
   ============================================================ */
const CONFIG = {
  BOARD_SIZE: 9,           
  CELL_SIZE: 40,           
  WALL_GAP: 10,            
  WALLS_PER_PLAYER: 5,     

  TROPHIES_START: 0,       
  TROPHIES_WIN: 30,        
  TROPHIES_LOSS: 15,       

  COINS_WIN: 50,
  COINS_LOSS: 15,

  BOT_MOVE_DELAY_MS: 550,  
  BOT_WALL_PROBABILITY: 0.3, 

  STORAGE_KEY: 'quoridor4_trophies',
  STATS_KEY: 'quoridor4_stats',
  COINS_KEY: 'quoridor4_coins',
  CLAIMED_REWARDS_KEY: 'quoridor4_claimed_rewards',
  SHOP_KEY: 'quoridor4_shop',
  DIFFICULTY_KEY: 'quoridor4_difficulty',
  ACHIEVEMENTS_KEY: 'quoridor4_achievements'
};

const N = CONFIG.BOARD_SIZE;

// Définition des rangs, ordonnés du plus haut au plus bas.
const RANKS = [
  { name: 'Maître', icon: '👑', min: 1200 },
  { name: 'Diamant', icon: '🔥', min: 800 },
  { name: 'Platine', icon: '💎', min: 500 },
  { name: 'Or', icon: '🥇', min: 250 },
  { name: 'Argent', icon: '🥈', min: 100 },
  { name: 'Bronze', icon: '🪨', min: 0 }
];

// Structure complète de la Route des Trophées
const TROPHY_ROAD = [
  { req: 0,    rank: 'Bronze',  icon: '🪨', reward: 0 },
  { req: 50,   rank: null,      icon: '',   reward: 100 },
  { req: 100,  rank: 'Argent',  icon: '🥈', reward: 250 },
  { req: 150,  rank: null,      icon: '',   reward: 150 },
  { req: 250,  rank: 'Or',      icon: '🥇', reward: 400 },
  { req: 350,  rank: null,      icon: '',   reward: 200 },
  { req: 500,  rank: 'Platine', icon: '💎', reward: 600 },
  { req: 650,  rank: null,      icon: '',   reward: 300 },
  { req: 800,  rank: 'Diamant', icon: '🔥', reward: 800 },
  { req: 1000, rank: null,      icon: '',   reward: 500 },
  { req: 1200, rank: 'Maître',  icon: '👑', reward: 1500 }
];

// Niveaux de difficulté. Les récompenses augmentent avec la difficulté pour
// éviter de simplement farmer la difficulté la plus facile.
const DIFFICULTIES = {
  easy: {
    name: 'Facile', icon: '🟢',
    description: 'Des bots plus détendus et moins agressifs.',
    trophiesWin: 20, trophiesLoss: 10, coinsWin: 20, coinsLoss: 5,
    wallProbability: 0.08, moveRandomness: 0.45, wallAttempts: 10, wallRadius: 1
  },
  normal: {
    name: 'Normale', icon: '🟡',
    description: 'Le niveau équilibré recommandé.',
    trophiesWin: 30, trophiesLoss: 15, coinsWin: 50, coinsLoss: 15,
    wallProbability: 0.30, moveRandomness: 0.08, wallAttempts: 25, wallRadius: 2
  },
  hard: {
    name: 'Difficile', icon: '🔴',
    description: 'Des bots plus précis et plus tactiques.',
    trophiesWin: 40, trophiesLoss: 15, coinsWin: 75, coinsLoss: 20,
    wallProbability: 0.55, moveRandomness: 0.02, wallAttempts: 50, wallRadius: 3
  },
  expert: {
    name: 'Expert', icon: '💀',
    description: 'Des bots très agressifs. Bonne chance. 😭',
    trophiesWin: 50, trophiesLoss: 20, coinsWin: 100, coinsLoss: 25,
    wallProbability: 0.72, moveRandomness: 0, wallAttempts: 90, wallRadius: 4
  }
};

function loadDifficulty() {
  const saved = localStorage.getItem(CONFIG.DIFFICULTY_KEY);
  return DIFFICULTIES[saved] ? saved : 'normal';
}

function getDifficultyInfo(id = null) {
  const key = id || (state && state.difficulty) || loadDifficulty();
  return DIFFICULTIES[key] || DIFFICULTIES.normal;
}

function getDifficultyKey() {
  const saved = localStorage.getItem(CONFIG.DIFFICULTY_KEY);
  return DIFFICULTIES[saved] ? saved : 'normal';
}

window.setDifficulty = function(key) {
  if (!DIFFICULTIES[key]) return;
  localStorage.setItem(CONFIG.DIFFICULTY_KEY, key);
  updateMenuDisplays();
  openMenuPanel('settings');
};


// Collection de skins de pions pour la Boutique. "background" et "glow" sont
// des valeurs CSS pures (aucune image externe). "classic" reste identique à
// l'apparence d'origine du pion du joueur (var(--player-0)).
const PAWN_SKINS = [
  { id: 'classic', name: 'Classique', price: 0,    background: 'var(--player-0)',                             glow: null },
  { id: 'ocean',   name: 'Océan',     price: 250,  background: 'linear-gradient(135deg, #6FD3FF, #1466C2)',   glow: '#4FA8FF' },
  { id: 'flame',   name: 'Flamme',    price: 500,  background: 'linear-gradient(135deg, #FFC96B, #E63946)',   glow: '#FF6B4A' },
  { id: 'neon',    name: 'Néon',      price: 750,  background: 'linear-gradient(135deg, #E29CFF, #8B2FE0)',   glow: '#C77DFF' },
  { id: 'gold',    name: 'Or',        price: 1200, background: 'linear-gradient(135deg, #FFF3C4, #FFC94D)',   glow: '#FFD166' },
  { id: 'shadow',  name: 'Ombre',     price: 1800, background: 'linear-gradient(135deg, #4B4B57, #0B0B10)',   glow: '#8B5CF6' },
];

function getSkin(id) {
  return PAWN_SKINS.find(s => s.id === id) || PAWN_SKINS[0];
}

/* ============================================================
   2. GÉOMÉTRIE
   ============================================================ */

function stepSize() { return CONFIG.CELL_SIZE + CONFIG.WALL_GAP; }
function cellPixelPos(r, c) { const step = stepSize(); return { x: c * step, y: r * step }; }
function boardPixelSize() { return N * CONFIG.CELL_SIZE + (N - 1) * CONFIG.WALL_GAP; }

function wallPixelRect(i, j, orientation) {
  const step = stepSize(); const gap = CONFIG.WALL_GAP; const cell = CONFIG.CELL_SIZE;
  if (orientation === 'H') { return { x: j * step, y: (i + 1) * step - gap, width: 2 * cell + gap, height: gap }; } 
  else { return { x: (j + 1) * step - gap, y: i * step, width: gap, height: 2 * cell + gap }; }
}

function jointHitboxRect(i, j) {
  const step = stepSize(); const gap = CONFIG.WALL_GAP; const HIT = Math.max(gap + 14, 22);
  const centerX = (j + 1) * step - gap / 2; const centerY = (i + 1) * step - gap / 2;
  return { x: centerX - HIT / 2, y: centerY - HIT / 2, size: HIT };
}

/* ============================================================
   3. ÉTAT DU JEU
   ============================================================ */

const PLAYER_DEFS = [
  { id: 0, name: 'Toi',   color: 'var(--player-0)', side: 'bottom', isHuman: true  },
  { id: 1, name: 'Bot 1', color: 'var(--player-1)', side: 'top',    isHuman: false },
  { id: 2, name: 'Bot 2', color: 'var(--player-2)', side: 'left',   isHuman: false },
  { id: 3, name: 'Bot 3', color: 'var(--player-3)', side: 'right',  isHuman: false },
];

let state = null;
let uiLocked = false; 

function createNewGameState() {
  const mid = Math.floor(N / 2);
  const startPositions = {
    bottom: { row: N - 1, col: mid }, top: { row: 0, col: mid },
    left: { row: mid, col: 0 }, right: { row: mid, col: N - 1 },
  };

  const players = PLAYER_DEFS.map(def => ({
    ...def, row: startPositions[def.side].row, col: startPositions[def.side].col, wallsLeft: CONFIG.WALLS_PER_PLAYER,
  }));

  return {
    players, currentPlayerIndex: 0, walls: new Set(), jointOrientations: new Map(),
    mode: 'move', orientation: 'H', gameOver: false, difficulty: getDifficultyKey(), trophies: loadTrophies(), coins: loadCoins(),
    turnCount: 0
  };
}

function currentPlayer() { return state.players[state.currentPlayerIndex]; }

/* ============================================================
   4. RÈGLES / PATHFINDING
   ============================================================ */

function edgeKey(r1, c1, r2, c2) {
  const a = `${r1},${c1}`; const b = `${r2},${c2}`;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function isEdgeOpen(r1, c1, r2, c2) { return !state.walls.has(edgeKey(r1, c1, r2, c2)); }

function neighborsOpen(r, c) {
  const result = []; const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of deltas) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
    if (isEdgeOpen(r, c, nr, nc)) result.push([nr, nc]);
  }
  return result;
}

function isGoalCell(side, r, c) {
  if (side === 'bottom') return r === 0; if (side === 'top') return r === N - 1;
  if (side === 'left') return c === N - 1; if (side === 'right') return c === 0;
  return false;
}

function hasPathToGoal(player) {
  const visited = new Set([`${player.row},${player.col}`]);
  const queue = [[player.row, player.col]];
  let qi = 0;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    if (isGoalCell(player.side, r, c)) return true;
    for (const [nr, nc] of neighborsOpen(r, c)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key)) { visited.add(key); queue.push([nr, nc]); }
    }
  }
  return false;
}

function computeGoalDistances(side) {
  const dist = Array.from({ length: N }, () => new Array(N).fill(Infinity));
  const queue = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isGoalCell(side, r, c)) { dist[r][c] = 0; queue.push([r, c]); }
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    for (const [nr, nc] of neighborsOpen(r, c)) {
      if (dist[nr][nc] > dist[r][c] + 1) { dist[nr][nc] = dist[r][c] + 1; queue.push([nr, nc]); }
    }
  }
  return dist;
}

function isCellOccupied(r, c, excludePlayerId = null) {
  return state.players.some(p => p.id !== excludePlayerId && p.row === r && p.col === c);
}

function getValidMoveCells(player) {
  return neighborsOpen(player.row, player.col).filter(([r, c]) => !isCellOccupied(r, c, player.id));
}

function movePawn(player, r, c) { player.row = r; player.col = c; }

function getWallEdges(i, j, orientation) {
  if (orientation === 'H') { return [ edgeKey(i, j, i + 1, j), edgeKey(i, j + 1, i + 1, j + 1) ]; } 
  else { return [ edgeKey(i, j, i, j + 1), edgeKey(i + 1, j, i + 1, j + 1) ]; }
}

function canPlaceWall(player, i, j, orientation) {
  if (player.wallsLeft <= 0) return { ok: false, reason: 'Plus aucune barrière disponible.' };
  if (i < 0 || i > N - 2 || j < 0 || j > N - 2) return { ok: false, reason: 'Position invalide.' };
  if (state.jointOrientations.has(`${i},${j}`)) return { ok: false, reason: 'Il y a déjà une barrière ici.' };

  const edges = getWallEdges(i, j, orientation);
  for (const e of edges) { if (state.walls.has(e)) return { ok: false, reason: 'Emplacement occupé.' }; }

  edges.forEach(e => state.walls.add(e));
  const everyoneHasPath = state.players.every(p => hasPathToGoal(p));
  edges.forEach(e => state.walls.delete(e));

  if (!everyoneHasPath) return { ok: false, reason: "Cette barrière bloquerait complètement un joueur." };
  return { ok: true, edges };
}

function placeWall(player, i, j, orientation) {
  const check = canPlaceWall(player, i, j, orientation);
  if (!check.ok) return false;
  check.edges.forEach(e => state.walls.add(e));
  state.jointOrientations.set(`${i},${j}`, orientation);
  player.wallsLeft -= 1;
  renderWall(i, j, orientation);
  updatePlayersHUD();

  // Seules les barrières posées par le joueur humain comptent pour les succès.
  if (player.isHuman) {
    const achData = loadAchievementsData();
    achData.wallsPlaced += 1;
    saveAchievementsData(achData);
    checkThresholdAchievements();
  }

  return true;
}

/* ============================================================
   5. TOURS DE JEU & IA BOTS
   ============================================================ */

function startGame() {
  uiLocked = false;
  showScreen('game');
  state = createNewGameState();
  buildBoardDOM();
  document.getElementById('players-hud').innerHTML = ''; 
  renderPawns();
  updateTrophyDisplay();
  updateCoinDisplay();
  updatePlayersHUD();
  updateTurnIndicator();
  clearWallsFromDOM();
  setMode('move');
  hideEndModal();
  showMessage('');
  beginTurn();
}

function beginTurn() {
  if (state.gameOver) return;
  state.turnCount = (state.turnCount || 0) + 1;
  const player = currentPlayer();
  updateTurnIndicator();
  updatePlayersHUD();

  if (player.isHuman) { setMode('move'); refreshHighlights(); } 
  else { clearHighlights(); setTimeout(() => runBotTurn(player), CONFIG.BOT_MOVE_DELAY_MS); }
}

function endTurn() {
  if (state.gameOver) return;
  clearHighlights();
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  beginTurn();
}

function checkWinAfterMove(player) {
  if (isGoalCell(player.side, player.row, player.col)) {
    endGame(player.isHuman, player.name);
    return true;
  }
  return false;
}

function runBotTurn(player) {
  if (state.gameOver) return;
  const difficulty = getDifficultyInfo();
  let actionDone = false;

  if (player.wallsLeft > 0 && Math.random() < difficulty.wallProbability) {
    actionDone = botTryPlaceBlockingWall(player, difficulty);
  }
  if (!actionDone) actionDone = botTryMove(player, difficulty);
  if (!actionDone) showMessage(`${player.name} passe son tour.`);

  setTimeout(() => { if (!state.gameOver) endTurn(); }, 250);
}

function botTryMove(player, difficulty = getDifficultyInfo()) {
  const dist = computeGoalDistances(player.side);
  const candidates = getValidMoveCells(player);
  if (candidates.length === 0) return false;

  // Facile : le bot peut volontairement prendre un déplacement non optimal.
  if (difficulty.moveRandomness > 0 && Math.random() < difficulty.moveRandomness) {
    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    movePawn(player, r, c);
    renderPawns();
    checkWinAfterMove(player);
    return true;
  }

  candidates.sort((a, b) => dist[a[0]][a[1]] - dist[b[0]][b[1]]);
  const bestDistance = dist[candidates[0][0]][candidates[0][1]];
  const bestChoices = candidates.filter(([r, c]) => dist[r][c] === bestDistance);

  // Expert privilégie aussi les coups qui conservent plusieurs options ouvertes.
  let choice = bestChoices[Math.floor(Math.random() * bestChoices.length)];
  if (difficulty === DIFFICULTIES.expert && bestChoices.length > 1) {
    choice = bestChoices
      .slice()
      .sort((a, b) => neighborsOpen(b[0], b[1]).length - neighborsOpen(a[0], a[1]).length)[0];
  }

  movePawn(player, choice[0], choice[1]);
  renderPawns();
  checkWinAfterMove(player);
  return true;
}

function getBotTarget(player) {
  const opponents = state.players.filter(p => p.id !== player.id);
  let target = null;
  let bestDist = Infinity;
  for (const opp of opponents) {
    const d = computeGoalDistances(opp.side)[opp.row][opp.col];
    if (d < bestDist) {
      bestDist = d;
      target = opp;
    }
  }
  return target;
}

function botTryPlaceBlockingWall(player, difficulty = getDifficultyInfo()) {
  const target = getBotTarget(player);
  if (!target) return false;

  const targetDistBefore = computeGoalDistances(target.side)[target.row][target.col];
  const ownDistBefore = computeGoalDistances(player.side)[player.row][player.col];
  const candidates = [];
  const radius = difficulty.wallRadius;

  // Les niveaux élevés cherchent davantage autour du pion adverse le plus dangereux.
  // Expert élargit sa recherche pour trouver de meilleurs emplacements.
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      if (Math.abs(i - target.row) > radius + 1 || Math.abs(j - target.col) > radius + 1) continue;
      candidates.push([i, j, 'H']);
      candidates.push([i, j, 'V']);
    }
  }

  // Sur Expert, complète la liste avec des positions aléatoires si nécessaire.
  if (difficulty === DIFFICULTIES.expert) {
    for (let k = 0; k < 25; k++) {
      candidates.push([
        Math.floor(Math.random() * (N - 1)),
        Math.floor(Math.random() * (N - 1)),
        Math.random() < 0.5 ? 'H' : 'V'
      ]);
    }
  }

  // Mélange léger pour éviter que les bots choisissent toujours le même mur en cas d'égalité.
  candidates.sort(() => Math.random() - 0.5);

  let best = null;
  let bestScore = -Infinity;
  let checked = 0;

  for (const [i, j, orientation] of candidates) {
    if (checked >= difficulty.wallAttempts) break;
    checked++;

    const check = canPlaceWall(player, i, j, orientation);
    if (!check.ok) continue;

    check.edges.forEach(e => state.walls.add(e));
    const targetDistAfter = computeGoalDistances(target.side)[target.row][target.col];
    const ownDistAfter = computeGoalDistances(player.side)[player.row][player.col];
    check.edges.forEach(e => state.walls.delete(e));

    if (!Number.isFinite(targetDistAfter)) continue;

    const targetGain = targetDistAfter - targetDistBefore;
    const ownCost = ownDistAfter - ownDistBefore;

    // Le but est de ralentir l'adversaire sans créer un chemin catastrophique pour soi.
    let score = targetGain * 100 - Math.max(0, ownCost) * 18;

    if (difficulty === DIFFICULTIES.hard) score += targetDistAfter * 0.4;
    if (difficulty === DIFFICULTIES.expert) {
      score += targetDistAfter * 0.8;
      if (targetGain >= 2) score += 8;
    }

    if (score > bestScore) {
      bestScore = score;
      best = [i, j, orientation];
    }
  }

  // Ne pose pas un mur inutile juste pour utiliser une barrière.
  const minimumGain = difficulty === DIFFICULTIES.expert ? 0 : 0.5;
  if (!best || bestScore < minimumGain) return false;

  return placeWall(player, best[0], best[1], best[2]);
}

/* ============================================================
   6. RANGS, TROPHÉES, JETONS & STATS
   ============================================================ */

function loadStats() {
  const raw = localStorage.getItem(CONFIG.STATS_KEY);
  if (!raw) return { games: 0, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 };
  try {
    const stats = JSON.parse(raw);
    return {
      games: Number(stats.games) || 0, wins: Number(stats.wins) || 0, losses: Number(stats.losses) || 0,
      currentStreak: Number(stats.currentStreak) || 0, bestStreak: Number(stats.bestStreak) || 0
    };
  } catch { return { games: 0, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 }; }
}

function saveStats(stats) { localStorage.setItem(CONFIG.STATS_KEY, JSON.stringify(stats)); }

function recordResult(humanWon) {
  const stats = loadStats();
  stats.games += 1;
  if (humanWon) { stats.wins += 1; stats.currentStreak += 1; stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak); } 
  else { stats.losses += 1; stats.currentStreak = 0; }
  saveStats(stats);
}

function loadTrophies() {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
  const value = raw !== null ? parseInt(raw, 10) : CONFIG.TROPHIES_START;
  return Number.isFinite(value) ? value : CONFIG.TROPHIES_START;
}

function saveTrophies() { localStorage.setItem(CONFIG.STORAGE_KEY, String(state.trophies)); }

function loadCoins() {
  const raw = localStorage.getItem(CONFIG.COINS_KEY);
  const value = raw !== null ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) ? value : 0;
}

function saveCoins() { localStorage.setItem(CONFIG.COINS_KEY, String(state ? state.coins : loadCoins())); }

function loadClaimedRewards() {
  const raw = localStorage.getItem(CONFIG.CLAIMED_REWARDS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function getRankInfo(trophiesCount) {
  let currentRank = RANKS[RANKS.length - 1]; // Bronze
  let nextRank = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (trophiesCount >= RANKS[i].min) {
      currentRank = RANKS[i];
      if (i > 0) nextRank = RANKS[i - 1];
      break;
    }
  }
  return { currentRank, nextRank };
}

function addTrophies(delta) {
  const oldTrophies = state.trophies;
  const { currentRank: oldRank } = getRankInfo(oldTrophies);
  
  state.trophies = Math.max(0, state.trophies + delta);
  saveTrophies();
  
  const { currentRank: newRank } = getRankInfo(state.trophies);
  
  updateTrophyDisplay();
  updateMenuDisplays();

  if (newRank.min > oldRank.min) {
    showRankUpNotification(newRank);
  }

  checkThresholdAchievements();
}

function addCoins(delta) {
  if(state) {
    state.coins = Math.max(0, state.coins + delta);
  } else {
    // Cas où le jeu n'est pas lancé, mise à jour directe (Menu)
    const current = loadCoins();
    localStorage.setItem(CONFIG.COINS_KEY, String(Math.max(0, current + delta)));
  }
  saveCoins();
  updateCoinDisplay();
  updateMenuDisplays();
}

// Fonction globale pour récupérer une récompense depuis la route
window.claimTrophyReward = function(req, amount, btnEl) {
  let claimed = loadClaimedRewards();
  if (claimed.includes(req)) return; // Sécurité double clic
  
  claimed.push(req);
  localStorage.setItem(CONFIG.CLAIMED_REWARDS_KEY, JSON.stringify(claimed));
  
  // Ajout des pièces
  addCoins(amount);
  
  // Animation visuelle de la route
  const trCoinEl = document.getElementById('tr-coin-count');
  if(trCoinEl) {
    trCoinEl.textContent = `🪙 ${loadCoins()}`;
    trCoinEl.classList.remove('pop-anim');
    void trCoinEl.offsetWidth; // Force le reflow pour relancer l'animation
    trCoinEl.classList.add('pop-anim');
  }
  
  const parent = btnEl.parentElement;
  parent.innerHTML = `<div class="tr-claimed pop-anim">✅ Récupérée</div>`;
};


/* ============================================================
   6bis. BOUTIQUE (SKINS DE PIONS)
   ============================================================
   Système entièrement séparé du reste : il ne touche ni aux
   règles, ni à l'IA, ni aux trophées/rangs. Il réutilise
   uniquement la monnaie 🪙 Jetons déjà existante (CONFIG.COINS_KEY,
   loadCoins/addCoins définis plus haut).
   ============================================================ */

// Charge l'état de la boutique (skins possédés + skin équipé).
// Si aucune sauvegarde n'existe encore, crée l'état initial :
// Classique possédé et équipé par défaut.
function loadShop() {
  const raw = localStorage.getItem(CONFIG.SHOP_KEY);
  let shop;
  if (!raw) {
    shop = { owned: ['classic'], equipped: 'classic' };
  } else {
    try {
      const parsed = JSON.parse(raw);
      shop = {
        owned: Array.isArray(parsed.owned) ? parsed.owned.slice() : ['classic'],
        equipped: typeof parsed.equipped === 'string' ? parsed.equipped : 'classic',
      };
    } catch {
      shop = { owned: ['classic'], equipped: 'classic' };
    }
  }
  // Le skin Classique doit toujours être possédé, quoi qu'il arrive.
  if (!shop.owned.includes('classic')) shop.owned.unshift('classic');
  // Sécurité : si le skin équipé sauvegardé n'est plus valide/possédé, on revient au Classique.
  if (!shop.owned.includes(shop.equipped)) shop.equipped = 'classic';
  return shop;
}

function saveShop(shop) {
  localStorage.setItem(CONFIG.SHOP_KEY, JSON.stringify(shop));
}

function getEquippedSkin() {
  return getSkin(loadShop().equipped);
}

// Applique visuellement un skin sur l'élément DOM d'un pion.
// N'est utilisé QUE pour le pion du joueur humain (voir renderPawns) :
// les bots ne sont jamais concernés par cette fonction.
function applyPawnSkin(pawnEl, skin) {
  pawnEl.style.background = skin.background;
  pawnEl.style.setProperty('--pawn-glow', skin.glow ? `0 0 14px ${skin.glow}` : '0 0 0 rgba(0,0,0,0)');
}

let shopFeedbackTimeout = null;
function showShopFeedback(text, isError) {
  const el = document.getElementById('shop-feedback');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  if (shopFeedbackTimeout) clearTimeout(shopFeedbackTimeout);
  if (text) shopFeedbackTimeout = setTimeout(() => { el.textContent = ''; }, 2200);
}

// Achat d'un skin — appelée depuis le bouton "ACHETER" (voir buildShopCardHTML).
window.buySkinFromShop = function(skinId) {
  const skin = getSkin(skinId);
  const shop = loadShop();

  if (shop.owned.includes(skinId)) return; // déjà possédé : jamais un double achat

  const coins = loadCoins();
  if (coins < skin.price) {
    showShopFeedback('🪙 Jetons insuffisants', true);
    return;
  }

  addCoins(-skin.price); // retire le prix du solde existant (même système que les récompenses)
  shop.owned.push(skinId);
  saveShop(shop);

  showShopFeedback(`🛍️ ${skin.name} acheté !`, false);
  renderShopPanel();

  const card = document.getElementById('shop-card-' + skinId);
  if (card) {
    card.classList.remove('just-bought');
    void card.offsetWidth; // force le reflow pour rejouer l'animation d'achat
    card.classList.add('just-bought');
  }
};

// Équiper un skin déjà possédé — appelée depuis le bouton "ÉQUIPER".
window.equipSkinFromShop = function(skinId) {
  const shop = loadShop();
  if (!shop.owned.includes(skinId)) return;

  shop.equipped = skinId;
  saveShop(shop);
  renderShopPanel();

  // Si une partie est déjà en cours, on applique le nouveau skin immédiatement
  // sur le pion du joueur (sans rien changer à sa position ni au tour en cours).
  if (state && !state.gameOver) renderPawns();
};

function buildShopCardHTML(skin, shop) {
  const isOwned = shop.owned.includes(skin.id);
  const isEquipped = shop.equipped === skin.id;
  const priceLabel = skin.price === 0 ? 'Gratuit' : `🪙 ${skin.price}`;
  const glowStyle = skin.glow ? ` box-shadow:0 0 14px ${skin.glow}, 0 3px 6px rgba(0,0,0,0.35);` : '';

  let actionHTML;
  if (isEquipped) {
    actionHTML = `<div class="shop-badge equipped">✓ ÉQUIPÉ</div>`;
  } else if (isOwned) {
    actionHTML = `<button class="shop-action-btn equip-btn" onclick="equipSkinFromShop('${skin.id}')">ÉQUIPER</button>`;
  } else {
    actionHTML = `<button class="shop-action-btn buy-btn" onclick="buySkinFromShop('${skin.id}')">ACHETER</button>`;
  }

  return `
    <div class="shop-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}" id="shop-card-${skin.id}">
      <div class="shop-pawn-preview" style="background:${skin.background};${glowStyle}"></div>
      <div class="shop-card-name">${skin.name.toUpperCase()}</div>
      <div class="shop-card-price">${priceLabel}</div>
      ${actionHTML}
    </div>
  `;
}

function buildShopHTML() {
  const shop = loadShop();
  const coins = loadCoins();
  const cardsHTML = PAWN_SKINS.map(skin => buildShopCardHTML(skin, shop)).join('');

  return `
    <div class="shop-header">
      <button class="shop-back-btn" onclick="closeMenuPanel()">← Retour</button>
      <h2>🛍️ Boutique</h2>
      <div class="shop-balance">🪙 <span id="shop-coin-count">${coins}</span></div>
    </div>
    <div id="shop-feedback" class="shop-feedback"></div>
    <div class="shop-grid">${cardsHTML}</div>
  `;
}

function renderShopPanel() {
  const body = document.getElementById('menu-panel-body');
  if (body) body.innerHTML = buildShopHTML();
}


/* ============================================================
   6ter. SUCCÈS / DÉFIS
   ============================================================
   Système entièrement séparé : il ne modifie ni les règles du
   jeu, ni l'IA, ni les trophées/rangs/Route des trophées. Il ne
   fait que LIRE ces systèmes (loadTrophies, loadStats) pour
   détecter des conditions, et réutilise uniquement la monnaie
   🪙 Jetons déjà existante (addCoins) pour les récompenses.
   ============================================================ */

// Définition des 10 succès de la V1.
// - "goal" est l'objectif numérique utilisé pour la barre de progression.
// - "getProgress" calcule la progression actuelle à partir des données de
//   succès (walls posées), des statistiques de parties et des trophées.
// - "noProgress" désigne les succès binaires (verrouillé / débloqué) qui ne
//   se prêtent pas à une barre de progression classique : ils sont
//   débloqués directement au moment de l'évènement qui les déclenche.
const ACHIEVEMENTS = [
  {
    id: 'first_wall', icon: '🧱', name: 'PREMIÈRE BARRIÈRE',
    desc: 'Placer sa première barrière.', reward: 50, goal: 1,
    getProgress: (data) => data.wallsPlaced
  },
  {
    id: 'architect', icon: '🧱', name: 'ARCHITECTE',
    desc: 'Placer 50 barrières au total.', reward: 150, goal: 50,
    getProgress: (data) => data.wallsPlaced
  },
  {
    id: 'first_win', icon: '🎮', name: 'PREMIÈRE VICTOIRE',
    desc: 'Gagner sa première partie.', reward: 100, goal: 1,
    getProgress: (data, stats) => stats.wins
  },
  {
    id: 'win_streak', icon: '🔥', name: 'EN SÉRIE',
    desc: 'Gagner 3 parties consécutives.', reward: 200, goal: 3,
    getProgress: (data, stats) => stats.currentStreak
  },
  {
    id: 'trophy_250', icon: '🏆', name: 'PETIT CHAMPION',
    desc: 'Atteindre 250 trophées.', reward: 250, goal: 250,
    getProgress: (data, stats, trophies) => trophies
  },
  {
    id: 'trophy_500', icon: '💎', name: 'GRIMPEUR',
    desc: 'Atteindre 500 trophées.', reward: 400, goal: 500,
    getProgress: (data, stats, trophies) => trophies
  },
  {
    id: 'beat_hard', icon: '🤖', name: 'SANS PEUR',
    desc: "Battre l'IA en difficulté Difficile au moins une fois.", reward: 300, goal: 1,
    noProgress: true
  },
  {
    id: 'beat_expert', icon: '💀', name: 'CAUCHEMAR',
    desc: "Battre l'IA en difficulté Expert au moins une fois.", reward: 500, goal: 1,
    noProgress: true
  },
  {
    id: 'fast_win', icon: '⚡', name: 'VICTOIRE RAPIDE',
    desc: 'Gagner une partie en 20 tours ou moins.', reward: 300, goal: 1,
    noProgress: true
  },
  {
    id: 'trophy_1200', icon: '👑', name: 'MAÎTRE',
    desc: 'Atteindre 1200 trophées.', reward: 1000, goal: 1200,
    getProgress: (data, stats, trophies) => trophies
  },
];

function getAchievementDef(id) { return ACHIEVEMENTS.find(a => a.id === id); }

// Charge la progression sauvegardée des succès (succès débloqués +
// compteur de barrières posées par le joueur). Toujours renvoie une
// structure valide, même si rien n'a encore été sauvegardé.
function loadAchievementsData() {
  const raw = localStorage.getItem(CONFIG.ACHIEVEMENTS_KEY);
  if (!raw) return { unlocked: [], wallsPlaced: 0 };
  try {
    const parsed = JSON.parse(raw);
    return {
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked.slice() : [],
      wallsPlaced: Number(parsed.wallsPlaced) || 0
    };
  } catch {
    return { unlocked: [], wallsPlaced: 0 };
  }
}

function saveAchievementsData(data) {
  localStorage.setItem(CONFIG.ACHIEVEMENTS_KEY, JSON.stringify(data));
}

// Débloque un succès une seule fois : donne la récompense, sauvegarde
// l'état "débloqué" et met en file d'attente la notification visuelle.
// Toute tentative de rappel sur un succès déjà débloqué est ignorée,
// ce qui empêche d'obtenir plusieurs fois la même récompense (y compris
// après un rechargement de la page).
function unlockAchievement(id) {
  const data = loadAchievementsData();
  if (data.unlocked.includes(id)) return false;

  const def = getAchievementDef(id);
  if (!def) return false;

  data.unlocked.push(id);
  saveAchievementsData(data);

  addCoins(def.reward);
  queueAchievementNotification(def);

  // Si le panneau des succès est actuellement ouvert, on le rafraîchit.
  const panel = document.getElementById('menu-panel');
  const body = document.getElementById('menu-panel-body');
  if (panel && body && !panel.classList.contains('hidden') && body.querySelector('.ach-list')) {
    body.innerHTML = buildAchievementsHTML();
  }

  return true;
}

// Parcourt tous les succès à progression numérique et débloque ceux dont
// la condition est atteinte. Les succès binaires (noProgress) sont
// débloqués directement au moment de leur évènement déclencheur (victoire
// contre l'IA Difficile/Expert, victoire rapide), pas ici.
function checkThresholdAchievements() {
  const data = loadAchievementsData();
  const stats = loadStats();
  const trophies = loadTrophies();

  ACHIEVEMENTS.forEach(a => {
    if (a.noProgress) return;
    if (data.unlocked.includes(a.id)) return;
    const progress = a.getProgress(data, stats, trophies);
    if (progress >= a.goal) unlockAchievement(a.id);
  });
}

// File d'attente des notifications de succès, pour n'afficher qu'une
// notification à la fois même si plusieurs succès se débloquent au même
// moment (ex : une victoire qui fait franchir un palier de trophées).
let achievementNotificationQueue = [];
let achievementNotificationShowing = false;

function queueAchievementNotification(def) {
  achievementNotificationQueue.push(def);
  processAchievementNotificationQueue();
}

function processAchievementNotificationQueue() {
  if (achievementNotificationShowing) return;
  const next = achievementNotificationQueue.shift();
  if (!next) return;
  achievementNotificationShowing = true;
  showAchievementToast(next);
}

function showAchievementToast(def) {
  const container = document.getElementById('achievement-toast-container');
  if (!container) { achievementNotificationShowing = false; processAchievementNotificationQueue(); return; }

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="achievement-toast-header">🏅 SUCCÈS DÉBLOQUÉ !</div>
    <div class="achievement-toast-body">
      <div class="achievement-toast-icon">${def.icon}</div>
      <div class="achievement-toast-info">
        <div class="achievement-toast-name">${def.name}</div>
        <div class="achievement-toast-reward">+${def.reward} 🪙</div>
      </div>
    </div>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
      achievementNotificationShowing = false;
      processAchievementNotificationQueue();
    }, 350);
  }, 2800);
}

// Construit le HTML de l'écran des succès (liste + progression).
function buildAchievementsHTML() {
  const data = loadAchievementsData();
  const stats = loadStats();
  const trophies = loadTrophies();
  const unlockedCount = ACHIEVEMENTS.filter(a => data.unlocked.includes(a.id)).length;

  const cardsHTML = ACHIEVEMENTS.map(a => {
    const isUnlocked = data.unlocked.includes(a.id);

    let progressHTML = '';
    if (!a.noProgress) {
      const rawProgress = a.getProgress(data, stats, trophies);
      const progress = Math.max(0, Math.min(rawProgress, a.goal));
      const pct = (progress / a.goal) * 100;
      progressHTML = `
        <div class="ach-progress-text">${progress} / ${a.goal}</div>
        <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%;"></div></div>
      `;
    }

    const statusHTML = isUnlocked
      ? `<div class="ach-status unlocked">✅ Débloqué</div>`
      : `<div class="ach-status locked">🔒 Non débloqué</div>`;

    return `
      <div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="ach-card-icon">${a.icon}</div>
        <div class="ach-card-content">
          <div class="ach-card-name">${a.name}</div>
          <div class="ach-card-desc">${a.desc}</div>
          ${progressHTML}
          ${statusHTML}
        </div>
        <div class="ach-card-reward">+${a.reward} 🪙</div>
      </div>
    `;
  }).join('');

  return `
    <div class="ach-header"><h2>🏅 Succès</h2></div>
    <div class="ach-summary">${unlockedCount} / ${ACHIEVEMENTS.length} débloqués</div>
    <div class="ach-list">${cardsHTML}</div>
  `;
}


/* ============================================================
   7. INTERFACE DU MENU
   ============================================================ */

function updateMenuDisplays() {
  const trophiesCount = loadTrophies();
  const coinsCount = loadCoins();
  
  const trophyEl = document.getElementById('menu-trophy-count');
  const coinEl = document.getElementById('menu-coin-count');
  const rankEl = document.getElementById('menu-profile-rank');
  const difficultyEl = document.getElementById('menu-profile-difficulty');
  
  if (trophyEl) trophyEl.textContent = trophiesCount;
  if (coinEl) coinEl.textContent = coinsCount;
  
  if (rankEl) {
    const { currentRank } = getRankInfo(trophiesCount);
    rankEl.textContent = `${currentRank.icon} ${currentRank.name}`;
  }
  if (difficultyEl) {
    const d = getDifficultyInfo(getDifficultyKey());
    difficultyEl.textContent = `${d.icon} ${d.name}`;
  }
}

function showScreen(screen) {
  const menu = document.getElementById('main-menu');
  const app = document.getElementById('app');
  if (screen === 'game') {
    menu.classList.add('hidden'); app.classList.remove('hidden');
  } else {
    app.classList.add('hidden'); menu.classList.remove('hidden');
    updateMenuDisplays();
  }
}

function openMenuPanel(type) {
  const panel = document.getElementById('menu-panel');
  const body = document.getElementById('menu-panel-body');
  
  if (type === 'trophies') {
    const trophies = loadTrophies();
    const coins = loadCoins();
    const claimed = loadClaimedRewards();
    
    // Détermination de la progression
    let prevReq = 0;
    let nextReq = null;
    for (const m of TROPHY_ROAD) {
      if (trophies >= m.req) prevReq = m.req;
      else if (nextReq === null) nextReq = m.req;
    }
    
    let headerHTML = `
      <div class="tr-header">
        <h2>Route des Trophées</h2>
        <div class="tr-stats">
          <span class="tr-stat-trophy">🏆 ${trophies}</span>
          <span class="tr-stat-coin" id="tr-coin-count">🪙 ${coins}</span>
        </div>
      </div>
    `;

    let progressHTML = '';
    if (nextReq !== null) {
      const progress = trophies - prevReq;
      const range = nextReq - prevReq;
      const pct = Math.max(0, Math.min(100, (progress / range) * 100));
      progressHTML = `
        <div class="tr-progress-info">
          <span>Prochain objectif : ${nextReq} 🏆</span>
          <span>Encore ${nextReq - trophies} 🏆</span>
        </div>
        <div class="rank-progress-container">
          <div class="rank-progress-fill" style="width: ${pct}%;"></div>
        </div>
      `;
    } else {
      progressHTML = `<div class="tr-progress-info" style="justify-content:center; color:var(--accent-gold); font-size:1rem;">👑 Rang maximum atteint !</div>`;
    }

    let listHTML = `<div class="tr-list">`;
    TROPHY_ROAD.forEach(m => {
      const isUnlocked = trophies >= m.req;
      const isClaimed = claimed.includes(m.req);
      const isTarget = m.req === nextReq;
      
      let statusClass = isUnlocked ? 'unlocked' : 'locked';
      if (isTarget) statusClass += ' target';
      
      let actionHTML = '';
      if (!isUnlocked) {
        actionHTML = `<div class="tr-lock">🔒 Encore ${m.req - trophies}</div>`;
      } else {
        if (m.reward > 0) {
          if (isClaimed) actionHTML = `<div class="tr-claimed">✅ Récupérée</div>`;
          else actionHTML = `<button class="tr-claim-btn" onclick="claimTrophyReward(${m.req}, ${m.reward}, this)">RÉCUPÉRER</button>`;
        } else {
          actionHTML = `<div class="tr-reached">Atteint</div>`;
        }
      }
      
      listHTML += `
        <div class="tr-card ${statusClass}">
          <div class="tr-card-req">🏆 ${m.req}</div>
          <div class="tr-card-content">
            ${m.rank ? `<div class="tr-rank">${m.icon} ${m.rank}</div>` : ''}
            ${m.reward > 0 ? `<div class="tr-reward">+${m.reward} 🪙</div>` : ''}
          </div>
          <div class="tr-card-action">${actionHTML}</div>
        </div>
      `;
    });
    listHTML += `</div>`;

    body.innerHTML = headerHTML + progressHTML + listHTML;
    
  } else if (type === 'stats') {
    const stats = loadStats();
    const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
    body.innerHTML = `
      <h2>📊 Statistiques</h2>
      <div class="panel-stat-grid">
        <div class="panel-stat"><span class="panel-stat-value">${stats.games}</span><span class="panel-stat-label">Parties</span></div>
        <div class="panel-stat"><span class="panel-stat-value">${stats.wins}</span><span class="panel-stat-label">Victoires</span></div>
        <div class="panel-stat"><span class="panel-stat-value">${stats.losses}</span><span class="panel-stat-label">Défaites</span></div>
        <div class="panel-stat"><span class="panel-stat-value">${winRate}%</span><span class="panel-stat-label">Taux de victoire</span></div>
        <div class="panel-stat"><span class="panel-stat-value">${stats.currentStreak}</span><span class="panel-stat-label">Série actuelle</span></div>
        <div class="panel-stat"><span class="panel-stat-value">${stats.bestStreak}</span><span class="panel-stat-label">Meilleure série</span></div>
      </div>
    `;
  } else if (type === 'tutorial') {
    body.innerHTML = `
      <h2>❓ Comment jouer</h2>
      <div class="tutorial-step"><span class="tutorial-step-number">1</span><p>Tu pars en bas du plateau. Ton objectif est la zone verte en haut.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">2</span><p>À ton tour, déplace ton pion d'une case ou pose une <strong>Barrière</strong>.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">3</span><p>Les barrières rallongent le chemin des adversaires, mais ne peuvent pas bloquer complètement leur route.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">4</span><p>Le premier joueur à atteindre son côté opposé gagne la partie.</p></div>
    `;
  } else if (type === 'shop') {
    body.innerHTML = buildShopHTML();
  } else if (type === 'achievements') {
    body.innerHTML = buildAchievementsHTML();
  } else {
    const currentDifficulty = getDifficultyKey();
    const cards = Object.entries(DIFFICULTIES).map(([key, d]) => `
      <button class="difficulty-card ${key === currentDifficulty ? 'selected' : ''}" onclick="setDifficulty('${key}')">
        <div class="difficulty-icon">${d.icon}</div>
        <div class="difficulty-main">
          <div class="difficulty-name">${d.name}</div>
          <div class="difficulty-desc">${d.description}</div>
          <div class="difficulty-rewards">🏆 Victoire +${d.trophiesWin} · Défaite -${d.trophiesLoss} &nbsp;|&nbsp; 🪙 +${d.coinsWin}/+${d.coinsLoss}</div>
        </div>
        <div class="difficulty-check">${key === currentDifficulty ? '✓' : ''}</div>
      </button>
    `).join('');
    body.innerHTML = `
      <h2>⚙️ Difficulté</h2>
      <p class="difficulty-note">La difficulté change les bots et les récompenses. Le choix s'applique à la prochaine partie.</p>
      <div class="difficulty-list">${cards}</div>
    `;
  }
  panel.classList.remove('hidden');
}

function closeMenuPanel() { document.getElementById('menu-panel').classList.add('hidden'); }

/* ============================================================
   8. AFFICHAGE JEU (rendu DOM)
   ============================================================ */

const boardEl = () => document.getElementById('board');

function buildBoardDOM() {
  const board = boardEl(); board.innerHTML = '';
  const size = boardPixelSize(); board.style.width = size + 'px'; board.style.height = size + 'px';

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const { x, y } = cellPixelPos(r, c);
      const cell = document.createElement('div');
      cell.className = 'cell' + ((r + c) % 2 === 1 ? ' cell-alt' : '');
      cell.style.left = x + 'px'; cell.style.top = y + 'px';
      cell.style.width = CONFIG.CELL_SIZE + 'px'; cell.style.height = CONFIG.CELL_SIZE + 'px';
      cell.dataset.row = r; cell.dataset.col = c;
      cell.addEventListener('click', () => onCellClick(r, c));
      board.appendChild(cell);
    }
  }

  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const rect = jointHitboxRect(i, j);
      const hit = document.createElement('div'); hit.className = 'joint-hitbox';
      hit.style.left = rect.x + 'px'; hit.style.top = rect.y + 'px';
      hit.style.width = rect.size + 'px'; hit.style.height = rect.size + 'px';
      hit.dataset.i = i; hit.dataset.j = j;
      hit.addEventListener('click', () => onJointClick(i, j));
      board.appendChild(hit);
    }
  }
}

function clearWallsFromDOM() { document.querySelectorAll('.wall-segment').forEach(el => el.remove()); }

function renderWall(i, j, orientation) {
  const rect = wallPixelRect(i, j, orientation);
  const el = document.createElement('div'); el.className = 'wall-segment';
  el.style.left = rect.x + 'px'; el.style.top = rect.y + 'px';
  el.style.width = rect.width + 'px'; el.style.height = rect.height + 'px';
  boardEl().appendChild(el);
}

function renderPawns() {
  for (const player of state.players) {
    let pawnEl = document.getElementById('pawn-' + player.id);
    if (!pawnEl) {
      pawnEl = document.createElement('div'); pawnEl.id = 'pawn-' + player.id; pawnEl.className = 'pawn';
      const pawnSize = CONFIG.CELL_SIZE * 0.72;
      pawnEl.style.width = pawnSize + 'px'; pawnEl.style.height = pawnSize + 'px';
      boardEl().appendChild(pawnEl);
    }

    // Le joueur humain affiche le skin actuellement équipé dans la Boutique.
    // Les bots gardent exactement leur couleur habituelle (jamais modifiée).
    if (player.isHuman) {
      applyPawnSkin(pawnEl, getEquippedSkin());
    } else {
      pawnEl.style.background = player.color;
    }

    const { x, y } = cellPixelPos(player.row, player.col);
    const margin = (CONFIG.CELL_SIZE - CONFIG.CELL_SIZE * 0.72) / 2;
    pawnEl.style.left = (x + margin) + 'px'; pawnEl.style.top = (y + margin) + 'px';
  }
}

function clearHighlights() { document.querySelectorAll('.cell.valid-move').forEach(el => el.classList.remove('valid-move')); }

function refreshHighlights() {
  clearHighlights(); if (state.mode !== 'move' || state.gameOver) return;
  const player = currentPlayer(); if (!player.isHuman) return;
  const moves = getValidMoveCells(player);
  for (const [r, c] of moves) {
    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) cell.classList.add('valid-move');
  }
}

function updateTrophyDisplay() { if(state) document.getElementById('trophy-count').textContent = state.trophies; }
function updateCoinDisplay() { if(state) document.getElementById('coin-count').textContent = state.coins; }

function updatePlayersHUD() {
  const container = document.getElementById('players-hud');
  if (container.children.length === 0) {
    state.players.forEach(player => {
      const chip = document.createElement('div'); chip.id = 'hud-chip-' + player.id; chip.className = 'player-chip';
      chip.style.setProperty('--chip-color', player.color);
      chip.innerHTML = `<div class="chip-dot"></div><div class="chip-name">${player.name}</div><div class="chip-walls" id="hud-walls-${player.id}">🧱 ${player.wallsLeft}</div>`;
      container.appendChild(chip);
    });
  }
  state.players.forEach((player, index) => {
    const chip = document.getElementById('hud-chip-' + player.id);
    const walls = document.getElementById('hud-walls-' + player.id);
    if (chip && walls) {
      walls.textContent = `🧱 ${player.wallsLeft}`;
      if (index === state.currentPlayerIndex) { chip.classList.add('current-turn'); chip.classList.remove('inactive'); } 
      else { chip.classList.remove('current-turn'); chip.classList.add('inactive'); }
    }
  });
}

function updateTurnIndicator() {
  const player = currentPlayer();
  const dot = document.getElementById('turn-dot'); const text = document.getElementById('turn-text');
  const indicator = document.getElementById('turn-indicator');
  dot.style.background = player.color;
  if (player.isHuman) { text.innerHTML = '<strong>TON TOUR</strong>'; indicator.classList.add('human-turn'); } 
  else { text.textContent = `TOUR DE ${player.name.toUpperCase()}`; indicator.classList.remove('human-turn'); }
}

let messageTimeout = null;
function showMessage(text, duration = 2200) {
  const bar = document.getElementById('message-bar'); bar.textContent = text;
  if (messageTimeout) clearTimeout(messageTimeout);
  if (text) messageTimeout = setTimeout(() => { bar.textContent = ''; }, duration);
}

function setMode(mode) {
  state.mode = mode;
  document.getElementById('mode-move-btn').classList.toggle('active', mode === 'move');
  document.getElementById('mode-wall-btn').classList.toggle('active', mode === 'wall');
  document.getElementById('wall-orientation').classList.toggle('hidden', mode !== 'wall');
  document.querySelectorAll('.joint-hitbox').forEach(el => { el.classList.toggle('active-mode', mode === 'wall'); });
  refreshHighlights();
}

function setOrientation(orientation) {
  state.orientation = orientation;
  document.getElementById('orientation-h-btn').classList.toggle('active', orientation === 'H');
  document.getElementById('orientation-v-btn').classList.toggle('active', orientation === 'V');
}

function showEndModal(humanWon, deltaTrophies, deltaCoins) {
  const modal = document.getElementById('end-modal');
  document.getElementById('end-title').textContent = humanWon ? 'Victoire ! 🎉' : 'Défaite';
  document.getElementById('end-text').textContent = humanWon ? 'Tu as atteint le bord opposé avant tout le monde.' : 'Un adversaire a atteint son objectif avant toi.';
  
  const trophySign = deltaTrophies >= 0 ? '+' : '';
  document.getElementById('trophy-change').textContent = `${trophySign}${deltaTrophies} 🏆`;
  document.getElementById('coin-change').textContent = `+${deltaCoins} 🪙`;
  
  modal.classList.remove('hidden');
}

function hideEndModal() { document.getElementById('end-modal').classList.add('hidden'); }

function showRankUpNotification(rank) {
  const modal = document.getElementById('rank-up-modal');
  document.getElementById('rank-up-icon').textContent = rank.icon;
  document.getElementById('rank-up-name').textContent = rank.name.toUpperCase();
  modal.classList.remove('hidden');
}

function hideRankUpNotification() { document.getElementById('rank-up-modal').classList.add('hidden'); }


/* ============================================================
   9. ÉVÉNEMENTS UTILISATEUR
   ============================================================ */

function onCellClick(r, c) {
  if (state.gameOver || state.mode !== 'move' || uiLocked) return;
  const player = currentPlayer(); if (!player.isHuman) return;
  if (!getValidMoveCells(player).some(([vr, vc]) => vr === r && vc === c)) return;

  uiLocked = true; movePawn(player, r, c); renderPawns();
  setTimeout(() => { uiLocked = false; if (checkWinAfterMove(player)) return; endTurn(); }, 250);
}

function onJointClick(i, j) {
  if (state.gameOver || state.mode !== 'wall' || uiLocked) return;
  const player = currentPlayer(); if (!player.isHuman) return;

  const result = canPlaceWall(player, i, j, state.orientation);
  if (!result.ok) { showMessage(result.reason); return; }

  uiLocked = true; placeWall(player, i, j, state.orientation);
  setTimeout(() => { uiLocked = false; endTurn(); }, 250);
}

function endGame(humanWon, winnerName) {
  if (state.gameOver) return; // Sécurité pour empêcher plusieurs exécutions
  state.gameOver = true;
  recordResult(humanWon);
  
  const difficulty = getDifficultyInfo();
  const difficultyKey = getDifficultyKey();
  const deltaTrophies = humanWon ? difficulty.trophiesWin : -difficulty.trophiesLoss;
  const deltaCoins = humanWon ? difficulty.coinsWin : difficulty.coinsLoss;
  
  addTrophies(deltaTrophies); // met aussi à jour les succès liés aux trophées et aux stats
  addCoins(deltaCoins); 

  if (humanWon) {
    if (difficultyKey === 'hard') unlockAchievement('beat_hard');
    if (difficultyKey === 'expert') unlockAchievement('beat_expert');
    if (state.turnCount <= 20) unlockAchievement('fast_win');
  }
  
  showEndModal(humanWon, deltaTrophies, deltaCoins);
  clearHighlights();
}

function forfeitGame() { if (!state.gameOver) endGame(false, 'Abandon'); }

function setupEventListeners() {
  document.getElementById('menu-play-btn').addEventListener('click', startGame);
  document.getElementById('menu-shop-btn').addEventListener('click', () => openMenuPanel('shop'));
  document.getElementById('menu-trophies-btn').addEventListener('click', () => openMenuPanel('trophies'));
  document.getElementById('menu-profile-btn').addEventListener('click', () => openMenuPanel('trophies'));
  document.getElementById('menu-achievements-btn').addEventListener('click', () => openMenuPanel('achievements'));
  
  document.getElementById('menu-stats-btn').addEventListener('click', () => openMenuPanel('stats'));
  document.getElementById('menu-tutorial-btn').addEventListener('click', () => openMenuPanel('tutorial'));
  document.getElementById('menu-settings-btn').addEventListener('click', () => openMenuPanel('settings'));
  document.getElementById('menu-panel-close').addEventListener('click', closeMenuPanel);
  document.getElementById('main-menu-btn').addEventListener('click', () => { hideEndModal(); showScreen('menu'); });

  document.getElementById('menu-panel').addEventListener('click', (event) => { if (event.target.id === 'menu-panel') closeMenuPanel(); });

  document.getElementById('mode-move-btn').addEventListener('click', () => { if (currentPlayer().isHuman && !state.gameOver) setMode('move'); });
  document.getElementById('mode-wall-btn').addEventListener('click', () => { if (currentPlayer().isHuman && !state.gameOver) setMode('wall'); });
  document.getElementById('orientation-h-btn').addEventListener('click', () => setOrientation('H'));
  document.getElementById('orientation-v-btn').addEventListener('click', () => setOrientation('V'));

  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', startGame);
  document.getElementById('forfeit-btn').addEventListener('click', forfeitGame);
  
  document.getElementById('rank-up-close-btn').addEventListener('click', hideRankUpNotification);
}

/* ============================================================
   10. INITIALISATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateMenuDisplays(); // Charge l'affichage correct des monnaies sur l'écran d'accueil
  checkThresholdAchievements(); // Rattrape les succès déjà atteints par une sauvegarde existante
  showScreen('menu');
});