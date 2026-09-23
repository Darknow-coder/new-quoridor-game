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
  PROFILE_KEY: 'quoridor4_profile',
  XP_KEY: 'quoridor4_xp',
  XP_PER_LEVEL: 200,
  LEVEL_REWARDS_CLAIMED_KEY: 'quoridor4_level_rewards_claimed',
  MODE_KEY: 'quoridor4_selected_players_count',
  GAME_MODE_KEY: 'quoridor4_game_mode',
  CHAOS_UNLOCK_TROPHIES: 300,
  CHAOS_SPECIAL_COUNT: 8,
  ACHIEVEMENTS_KEY: 'quoridor4_achievements_v1'

};

// MODE TEST BOUTIQUE désactivé pour l’audit de persistance.
// La monnaie sauvegardée doit maintenant rester intacte entre deux lancements.

/* ============================================================
   PROFIL JOUEUR — PSEUDO + SAUVEGARDE
   ============================================================ */
const DEFAULT_PROFILE = { name: '' };

function sanitizeProfileName(value) {
  return String(value || '')
    .replace(/[<>"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(CONFIG.PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return { name: sanitizeProfileName(parsed?.name) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(profile) {
  const clean = { name: sanitizeProfileName(profile?.name) };
  localStorage.setItem(CONFIG.PROFILE_KEY, JSON.stringify(clean));
  return clean;
}

function getPlayerName() {
  const name = loadProfile().name;
  return name || 'Aventurier';
}

function loadXP() {
  const raw = localStorage.getItem(CONFIG.XP_KEY);
  const value = raw !== null ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function saveXP(value) {
  localStorage.setItem(CONFIG.XP_KEY, String(Math.max(0, Math.floor(Number(value) || 0))));
}

function getXPLevelInfo(xp = loadXP()) {
  const safeXP = Math.max(0, Math.floor(Number(xp) || 0));
  const level = Math.floor(safeXP / CONFIG.XP_PER_LEVEL) + 1;
  const currentLevelXP = (level - 1) * CONFIG.XP_PER_LEVEL;
  const nextLevelXP = level * CONFIG.XP_PER_LEVEL;
  const inLevel = safeXP - currentLevelXP;
  const needed = CONFIG.XP_PER_LEVEL;
  const pct = Math.max(0, Math.min(100, (inLevel / needed) * 100));
  return { level, xp: safeXP, currentLevelXP, nextLevelXP, inLevel, needed, pct };
}

function addXP(delta) {
  const before = getXPLevelInfo();
  const amount = Math.max(0, Math.floor(Number(delta) || 0));
  const afterXP = before.xp + amount;
  saveXP(afterXP);
  const after = getXPLevelInfo(afterXP);
  updateMenuDisplays();
  return { amount, before, after, leveledUp: after.level > before.level };
}

const LEVEL_REWARDS = [
  { level: 2, icon: '🪙', type: 'coins', amount: 100, label: '100 pièces' },
  { level: 3, icon: '🃏', type: 'card', rarity: 'Commune', amount: 1, label: '1 carte commune' },
  { level: 4, icon: '🪙', type: 'coins', amount: 150, label: '150 pièces' },
  { level: 5, icon: '🎁', type: 'coins', amount: 250, label: '250 pièces' },
  { level: 6, icon: '🃏', type: 'card', rarity: 'Commune', amount: 1, label: '1 carte commune' },
  { level: 7, icon: '🪙', type: 'coins', amount: 200, label: '200 pièces' },
  { level: 8, icon: '🃏', type: 'card', rarity: 'Rare', amount: 1, label: '1 carte rare' },
  { level: 10, icon: '🎁', type: 'coins', amount: 400, label: '400 pièces' },
  { level: 12, icon: '🪙', type: 'coins', amount: 250, label: '250 pièces' },
  { level: 15, icon: '🃏', type: 'card', rarity: 'Rare', amount: 2, label: '2 cartes rares' },
  { level: 20, icon: '🎁', type: 'coins', amount: 600, label: '600 pièces' },
  { level: 25, icon: '🃏', type: 'card', rarity: 'Épique', amount: 1, label: '1 carte épique' },
  { level: 30, icon: '👑', type: 'coins', amount: 1000, label: '1 000 pièces' }
];

function loadLevelRewardsClaimed() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.LEVEL_REWARDS_CLAIMED_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
  } catch { return []; }
}

function saveLevelRewardsClaimed(levels) {
  localStorage.setItem(CONFIG.LEVEL_REWARDS_CLAIMED_KEY, JSON.stringify([...new Set(levels.map(Number))]));
}

function randomCardByRarity(rarity) {
  const matches = CARDS.filter(c => c.rarity === rarity);
  return matches[Math.floor(Math.random() * matches.length)] || CARDS[0];
}

function renderLevelRewardsPanel() {
  const body = document.getElementById('menu-panel-body');
  if (!body) return;
  const info = getXPLevelInfo();
  const claimed = loadLevelRewardsClaimed();
  const available = LEVEL_REWARDS.filter(r => info.level >= r.level && !claimed.includes(r.level)).length;
  const next = LEVEL_REWARDS.find(r => info.level < r.level);
  const rows = LEVEL_REWARDS.map(r => {
    const unlocked = info.level >= r.level;
    const isClaimed = claimed.includes(r.level);
    const cls = unlocked ? 'level-reward-card unlocked' : 'level-reward-card locked';
    let action = '';
    if (isClaimed) action = '<span class="level-reward-status claimed">✓ RÉCUPÉRÉE</span>';
    else if (unlocked) action = `<button class="level-reward-claim" onclick="claimLevelReward(${r.level}, this)">RÉCUPÉRER</button>`;
    else action = `<span class="level-reward-status">🔒 Niveau ${r.level}</span>`;
    return `<div class="${cls}">
      <div class="level-reward-level">NIV. ${r.level}</div>
      <div class="level-reward-icon">${r.icon}</div>
      <div class="level-reward-main"><strong>${r.label}</strong><small>${unlocked ? 'Récompense débloquée' : 'Progresse pour la débloquer'}</small></div>
      <div class="level-reward-action">${action}</div>
    </div>`;
  }).join('');
  body.innerHTML = `
    <div class="level-rewards-header">
      <div><div class="profile-panel-kicker">PROGRESSION</div><h2>⭐ Récompenses de niveau</h2><p class="panel-subtitle">Niveau ${info.level} · ${info.inLevel}/${info.needed} XP</p></div>
      <div class="level-rewards-count">${available ? `🎁 ${available} à récupérer` : (next ? `Prochaine : niv. ${next.level}` : '👑 Tout récupéré')}</div>
    </div>
    <div class="level-rewards-xp"><div class="profile-xp-track"><span style="width:${info.pct}%"></span></div></div>
    <div class="level-rewards-list">${rows}</div>`;
}

window.claimLevelReward = function(level, btnEl) {
  const reward = LEVEL_REWARDS.find(r => r.level === Number(level));
  if (!reward) return;
  const info = getXPLevelInfo();
  const claimed = loadLevelRewardsClaimed();
  if (info.level < reward.level || claimed.includes(reward.level)) return;
  if (reward.type === 'coins') {
    addCoins(reward.amount);
  } else if (reward.type === 'card') {
    for (let i = 0; i < reward.amount; i++) addCardToCollection(randomCardByRarity(reward.rarity).id, 1);
  }
  claimed.push(reward.level);
  saveLevelRewardsClaimed(claimed);
  openMenuPanel('levels');
};

function getProfileInitial(name) {
  const clean = sanitizeProfileName(name);
  return clean ? clean.charAt(0).toUpperCase() : 'A';
}

function renderProfilePanel() {
  const body = document.getElementById('menu-panel-body');
  if (!body) return;
  const profile = loadProfile();
  const trophies = loadTrophies();
  const coins = loadCoins();
  const stats = loadStats();
  const { currentRank } = getRankInfo(trophies);
  const xpInfo = getXPLevelInfo();
  const level = xpInfo.level;
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  const next = TROPHY_ROAD.find(r => r.req > trophies)?.req ?? null;
  const rangeStart = TROPHY_ROAD.filter(r => r.req <= trophies).at(-1)?.req ?? 0;
  const range = next === null ? 1 : Math.max(1, next - rangeStart);
  const pct = next === null ? 100 : Math.max(0, Math.min(100, ((trophies - rangeStart) / range) * 100));

  body.innerHTML = `
    <div class="profile-panel">
      <div class="profile-panel-hero">
        <div class="profile-avatar-large" id="profile-panel-avatar">${getProfileInitial(profile.name)}</div>
        <div class="profile-hero-main">
          <div class="profile-panel-kicker">PROFIL JOUEUR</div>
          <h2>${escapeHTML(profile.name || 'Aventurier')}</h2>
          <div class="profile-rank-line">${currentRank.icon} ${currentRank.name} <span>•</span> Niveau ${level}</div>
        </div>
        <button type="button" class="profile-edit-btn" onclick="editProfileName()">✏️ Modifier</button>
      </div>

      <div class="profile-profile-grid">
        <div class="profile-stat-card"><span>🏆</span><b>${trophies}</b><small>Trophées</small></div>
        <div class="profile-stat-card"><span>🪙</span><b>${coins}</b><small>Pièces</small></div>
        <div class="profile-stat-card"><span>🎮</span><b>${stats.games}</b><small>Parties</small></div>
        <div class="profile-stat-card"><span>🏅</span><b>${stats.wins}</b><small>Victoires</small></div>
        <div class="profile-stat-card"><span>📈</span><b>${winRate}%</b><small>Win rate</small></div>
        <div class="profile-stat-card"><span>🔥</span><b>${stats.bestStreak}</b><small>Meilleure série</small></div>
      </div>

      <div class="profile-xp-card">
        <div class="profile-xp-head"><span>⭐ Niveau ${xpInfo.level}</span><strong>${xpInfo.inLevel}/${xpInfo.needed} XP</strong></div>
        <div class="profile-xp-track"><span style="width:${xpInfo.pct}%"></span></div>
        <div class="profile-xp-foot"><span>${xpInfo.xp} XP au total</span><span>${xpInfo.needed - xpInfo.inLevel} XP avant le niveau ${xpInfo.level + 1}</span></div>
      </div>

      <div class="profile-progress-card">
        <div class="profile-progress-head"><span>Progression des trophées</span><strong>${next === null ? 'Rang maximum' : `${next - trophies} 🏆 avant ${next}`}</strong></div>
        <div class="profile-progress-track"><span style="width:${pct}%"></span></div>
      </div>

      <div class="profile-quick-actions">
        <button type="button" onclick="openMenuPanel('trophies')">🏆 Route des trophées</button>
        <button type="button" onclick="openMenuPanel('stats')">📊 Voir mes statistiques</button>
      </div>
    </div>`;
}

window.editProfileName = function() {
  const profile = loadProfile();
  const body = document.getElementById('menu-panel-body');
  if (!body) return;
  body.innerHTML = `
    <div class="profile-edit-panel">
      <div class="profile-panel-kicker">MODIFIER LE PROFIL</div>
      <h2>Ton pseudo</h2>
      <p class="panel-subtitle">2 à 16 caractères. Tu peux le modifier quand tu veux.</p>
      <label class="profile-input-wrap profile-input-wrap-panel">
        <span>Pseudo</span>
        <input id="profile-edit-input" type="text" maxlength="16" value="${escapeHTML(profile.name)}" spellcheck="false" autocomplete="nickname">
      </label>
      <div class="profile-input-hint"><span id="profile-edit-count">${profile.name.length}/16</span><span id="profile-edit-error"></span></div>
      <div class="profile-edit-actions">
        <button type="button" class="profile-secondary-btn" onclick="renderProfilePanel()">ANNULER</button>
        <button type="button" class="profile-confirm-btn profile-panel-save" onclick="saveEditedProfile()">ENREGISTRER <span>✓</span></button>
      </div>
    </div>`;
  const input = document.getElementById('profile-edit-input');
  if (input) {
    input.focus(); input.select();
    input.addEventListener('input', () => { const c=document.getElementById('profile-edit-count'); if(c)c.textContent=`${input.value.length}/16`; });
  }
};

window.saveEditedProfile = function() {
  const input = document.getElementById('profile-edit-input');
  const error = document.getElementById('profile-edit-error');
  const name = sanitizeProfileName(input?.value);
  if (name.length < 2) { if(error) error.textContent='Pseudo trop court'; return; }
  saveProfile({ name });
  updateMenuDisplays();
  renderProfilePanel();
  showShopFeedback('👤 Pseudo mis à jour', false);
};

function showProfileSetup() {
  const overlay=document.getElementById('profile-setup-overlay');
  if(!overlay)return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden','false');
  document.body.classList.add('profile-setup-active');
  const input=document.getElementById('profile-pseudo-input');
  const error=document.getElementById('profile-pseudo-error');
  const count=document.getElementById('profile-pseudo-count');
  const icon=document.getElementById('profile-setup-icon');
  const update=()=>{ const v=sanitizeProfileName(input?.value); if(count)count.textContent=`${v.length}/16`; if(icon)icon.textContent=getProfileInitial(v); if(error)error.textContent=''; };
  input?.addEventListener('input',update);
  input?.addEventListener('keydown',(e)=>{if(e.key==='Enter')confirmProfileSetup();});
  setTimeout(()=>input?.focus(),120);
}

function closeProfileSetup() {
  const overlay=document.getElementById('profile-setup-overlay');
  if(!overlay)return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('profile-setup-active');
}

window.confirmProfileSetup = async function() {
  const input = document.getElementById('profile-pseudo-input');
  const error = document.getElementById('profile-pseudo-error');
  const name = sanitizeProfileName(input?.value);

  if (name.length < 2) {
    if (error) error.textContent = 'Choisis au moins 2 caractères.';
    return;
  }

  // Sauvegarde locale : on la conserve quoi qu'il arrive.
  saveProfile({ name });

  // Synchronisation avec Supabase.
  try {
    const cloudProfile = await syncPlayerProfile(name);

    if (cloudProfile) {
      console.log('🟢 Profil joueur synchronisé avec Supabase :', cloudProfile);
    } else {
      console.warn('🟠 Profil local conservé, mais synchronisation Supabase impossible.');
    }
  } catch (error) {
    console.error('Erreur synchronisation profil :', error);
  }

  updateMenuDisplays();
  closeProfileSetup();

  // Premier lancement : le tutoriel reste obligatoire avant le menu.
  if (!isTutorialCompleted()) {
    startTutorial();
  }
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

/* ============================================================
   SUCCÈS / ACHIEVEMENTS
   ============================================================ */
const ACHIEVEMENTS = [
  {id:'first_wall', icon:'🧱', name:'Première barrière', desc:'Pose ta toute première barrière.', target:1, reward:50, kind:'walls'},
  {id:'architect', icon:'🏗️', name:'Architecte', desc:'Pose 50 barrières au total.', target:50, reward:150, kind:'walls'},
  {id:'first_win', icon:'🏆', name:'Première victoire', desc:'Remporte ta première partie.', target:1, reward:100, kind:'wins'},
  {id:'win_streak', icon:'🔥', name:'En série', desc:'Enchaîne 3 victoires consécutives.', target:3, reward:200, kind:'streak'},
  {id:'champion_250', icon:'🥇', name:'Petit champion', desc:'Atteins 250 trophées.', target:250, reward:250, kind:'trophies'},
  {id:'climber_500', icon:'💎', name:'Grimpeur', desc:'Atteins 500 trophées.', target:500, reward:400, kind:'trophies'},
  {id:'fearless', icon:'⚔️', name:'Sans peur', desc:'Gagne une partie en difficulté Difficile.', target:1, reward:300, kind:'hardwin'},
  {id:'nightmare', icon:'💀', name:'Cauchemar', desc:'Gagne une partie en difficulté Expert.', target:1, reward:500, kind:'expertwin'},
  {id:'speed', icon:'⚡', name:'Victoire rapide', desc:'Gagne une partie en 20 déplacements ou moins.', target:1, reward:300, kind:'quickwin'},
  {id:'master', icon:'👑', name:'Maître', desc:'Atteins 1200 trophées.', target:1200, reward:1000, kind:'trophies'}
];
function getAchievementData(){
  try{
    const raw=JSON.parse(localStorage.getItem(CONFIG.ACHIEVEMENTS_KEY)||'null');
    if(raw && typeof raw==='object') return {values:raw.values||{}, unlocked:raw.unlocked||{}, claimed:raw.claimed||{}, stats:raw.stats||{walls:0}};
  }catch(e){}
  return {values:{}, unlocked:{}, claimed:{}, stats:{walls:0}};
}
function saveAchievementData(d){localStorage.setItem(CONFIG.ACHIEVEMENTS_KEY,JSON.stringify(d));}
function achievementProgress(a,d){
  const stats=loadStats();
  if(a.kind==='walls') return Math.max(0,Number(d.stats.walls)||0);
  if(a.kind==='wins') return stats.wins;
  if(a.kind==='streak') return stats.bestStreak;
  if(a.kind==='trophies') return loadTrophies();
  return Number(d.values[a.id])||0;
}
function unlockAchievement(id){
  const a=ACHIEVEMENTS.find(x=>x.id===id); if(!a) return false;
  const d=getAchievementData(); if(d.unlocked[id]) return false;
  d.unlocked[id]=Date.now(); d.values[id]=a.target; saveAchievementData(d);
  showAchievementToast(a);
  return true;
}
function checkAchievements(extra={}){
  const d=getAchievementData(); const stats=loadStats(); const trophies=loadTrophies();
  d.stats.walls=Math.max(0,Number(d.stats.walls)||0);
  const checks={
    first_wall:d.stats.walls>=1,
    architect:d.stats.walls>=50,
    first_win:stats.wins>=1,
    win_streak:stats.bestStreak>=3,
    champion_250:trophies>=250,
    climber_500:trophies>=500,
    fearless:extra.difficulty==='hard' && extra.humanWon===true,
    nightmare:extra.difficulty==='expert' && extra.humanWon===true,
    speed:extra.humanWon===true && Number(extra.moves||0)<=20,
    master:trophies>=1200
  };
  saveAchievementData(d);
  ACHIEVEMENTS.forEach(a=>{if(checks[a.id]) unlockAchievement(a.id);});
}
function registerAchievementWall(){
  const d=getAchievementData(); d.stats.walls=(Number(d.stats.walls)||0)+1; saveAchievementData(d); checkAchievements();
}
function showAchievementToast(a){
  let el=document.getElementById('achievement-toast');
  if(!el){el=document.createElement('div');el.id='achievement-toast';document.body.appendChild(el);}
  el.innerHTML=`<div class="achievement-toast-icon">${a.icon}</div><div><div class="achievement-toast-kicker">SUCCÈS DÉBLOQUÉ</div><strong>${escapeHTML(a.name)}</strong><span>+${a.reward} 🪙</span></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(window._achievementToastTimer); window._achievementToastTimer=setTimeout(()=>el.classList.remove('show'),3600);
}
function renderAchievementsPanel(){
  const body=document.getElementById('menu-panel-body'); if(!body)return;
  const d=getAchievementData();
  const unlocked=ACHIEVEMENTS.filter(a=>d.unlocked[a.id]).length;
  const claimed=ACHIEVEMENTS.filter(a=>d.claimed[a.id]).length;
  body.innerHTML=`<div class="achievements-panel">
    <div class="achievements-head"><div><div class="profile-panel-kicker">COLLECTION</div><h2>🏅 Succès</h2><p class="panel-subtitle">Débloque des objectifs spéciaux puis récupère leurs récompenses.</p></div><div class="achievements-count">${unlocked}/${ACHIEVEMENTS.length}</div></div>
    <div class="achievements-progress"><div><span>Progression</span><b>${unlocked}/${ACHIEVEMENTS.length}</b></div><div class="achievement-progress-track"><span style="width:${Math.round(unlocked/ACHIEVEMENTS.length*100)}%"></span></div><div class="achievement-rewards-summary">${claimed}/${unlocked} récompense${unlocked>1?'s':''} récupérée${claimed>1?'s':''}</div></div>
    <div class="achievements-grid">${ACHIEVEMENTS.map(a=>{
      const done=!!d.unlocked[a.id], isClaimed=!!d.claimed[a.id], p=Math.min(a.target,achievementProgress(a,d)); const pct=Math.round(p/a.target*100);
      let action='';
      if(done && isClaimed) action='<span class="achievement-claimed">✓ RÉCUPÉRÉ</span>';
      else if(done) action=`<button type="button" class="achievement-claim-btn" data-achievement-claim="${a.id}">RÉCUPÉRER</button>`;
      else action=`<span class="achievement-locked">${p}/${a.target}</span>`;
      return `<article class="achievement-card ${done?'unlocked':''} ${done&&!isClaimed?'ready':''}"><div class="achievement-card-icon">${a.icon}</div><div class="achievement-card-main"><div class="achievement-card-title">${escapeHTML(a.name)} ${done?'<span class="achievement-check">✓</span>':''}</div><div class="achievement-card-desc">${escapeHTML(a.desc)}</div><div class="achievement-card-progress"><span style="width:${pct}%"></span></div><div class="achievement-card-meta"><span>${done?'DÉBLOQUÉ':`${p}/${a.target}`}</span><b>+${a.reward} 🪙</b></div><div class="achievement-card-action">${action}</div></div></article>`;
    }).join('')}</div>
  </div>`;
}
window.claimAchievement=function(id,btnEl){
  const a=ACHIEVEMENTS.find(x=>x.id===id); if(!a)return;
  const d=getAchievementData();
  if(!d.unlocked[id] || d.claimed[id])return;
  d.claimed[id]=Date.now();
  saveAchievementData(d);
  addCoins(a.reward);
  updateMenuDisplays();
  if(btnEl){btnEl.disabled=true;btnEl.textContent='✓ RÉCUPÉRÉ';}
  renderAchievementsPanel();
};
window.openAchievements=()=>openMenuPanel('achievements');

/* ============================================================
   QUÊTES QUOTIDIENNES
   ============================================================ */
const DAILY_QUESTS_KEY = 'quoridor4_daily_quests_v1';
const DAILY_QUEST_POOL = [
  { id:'play',    icon:'🎮', name:'Jouer 1 partie', desc:'Termine une partie.', target:1, reward:100, event:'game' },
  { id:'moves',   icon:'🚶', name:'Faire 8 déplacements', desc:'Déplace ton pion 8 fois.', target:8, reward:120, event:'move' },
  { id:'walls',   icon:'🧱', name:'Poser 5 barrières', desc:'Pose 5 barrières pendant tes parties.', target:5, reward:150, event:'wall' },
  { id:'cards',   icon:'🃏', name:'Utiliser 2 cartes', desc:'Utilise 2 cartes pendant tes parties.', target:2, reward:180, event:'card' },
  { id:'win',     icon:'🏆', name:'Gagner 1 partie', desc:'Remporte une partie.', target:1, reward:250, event:'win' },
  { id:'quick',   icon:'⚡', name:'Victoire rapide', desc:'Gagne une partie en 25 déplacements ou moins.', target:1, reward:300, event:'quickwin' },
  { id:'chaos',   icon:'🌀', name:'Jouer en Mode Chaos', desc:'Termine une partie en Mode Chaos.', target:1, reward:220, event:'chaosgame' },
  { id:'mixed',   icon:'🎯', name:'Varier les plaisirs', desc:'Joue 2 parties.', target:2, reward:200, event:'game' },
  { id:'wallsandcards', icon:'🔥', name:'Stratège', desc:'Pose 3 barrières et utilise 1 carte.', target:1, reward:280, event:'combo' }
];

function dailyDateKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dailySeed(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function getDailyQuestData(){
  const today=dailyDateKey();
  try{
    const raw=JSON.parse(localStorage.getItem(DAILY_QUESTS_KEY)||'null');
    if(raw && raw.date===today && Array.isArray(raw.quests)) return raw;
  }catch(e){}
  const pool=[...DAILY_QUEST_POOL];
  let seed=dailySeed(today), picked=[];
  while(picked.length<3 && pool.length){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const idx=seed%pool.length;
    picked.push({...pool.splice(idx,1)[0], progress:0, claimed:false});
  }
  const data={date:today,quests:picked,allClaimed:false};
  localStorage.setItem(DAILY_QUESTS_KEY,JSON.stringify(data));
  return data;
}
function saveDailyQuestData(data){ localStorage.setItem(DAILY_QUESTS_KEY,JSON.stringify(data)); }
function updateDailyQuest(event, amount=1){
  const data=getDailyQuestData();
  let changed=false;
  data.quests.forEach(q=>{
    if(q.claimed) return;
    if(q.event==='combo') return;
    if(q.event===event){
      q.progress=Math.min(q.target,q.progress+amount); changed=true;
    }
  });
  if(event==='combo'){
    const human=state?.players?.find(p=>p.isHuman);
    if(human && (human.wallsPlacedThisGame||0)>=3 && (human.cardsUsedThisGame||0)>=1){
      data.quests.forEach(q=>{if(q.event==='combo'&&!q.claimed){q.progress=1;changed=true;}});
    }
  }
  if(changed) saveDailyQuestData(data);
  return changed;
}
function claimDailyQuest(index){
  const data=getDailyQuestData(), q=data.quests[index];
  if(!q || q.claimed || q.progress<q.target) return;
  q.claimed=true; addCoins(q.reward); saveDailyQuestData(data);
  showShopFeedback(`🎯 ${q.name} : +${q.reward} 🪙`,false);
  renderDailyQuestsPanel();
  updateMenuDisplays();
}
function renderDailyQuestsPanel(){
  const body=document.getElementById('menu-panel-body'); if(!body)return;
  const data=getDailyQuestData();
  const done=data.quests.filter(q=>q.claimed).length;
  body.innerHTML=`
    <div class="daily-quests-panel">
      <div class="daily-quests-head">
        <div><h2>🎯 Quêtes du jour</h2><p class="panel-subtitle">3 objectifs renouvelés chaque jour.</p></div>
        <div class="daily-count">${done}/3</div>
      </div>
      <div class="daily-quests-list">
        ${data.quests.map((q,i)=>{
          const pct=Math.min(100,Math.round(q.progress/q.target*100));
          const complete=q.progress>=q.target;
          return `<div class="daily-quest-card ${q.claimed?'claimed':''} ${complete?'complete':''}">
            <div class="daily-quest-icon">${q.icon}</div>
            <div class="daily-quest-main">
              <div class="daily-quest-title">${q.name}</div>
              <div class="daily-quest-desc">${q.desc}</div>
              <div class="daily-quest-progress"><span style="width:${pct}%"></span></div>
              <div class="daily-quest-meta">${q.progress}/${q.target} <b>+${q.reward} 🪙</b></div>
            </div>
            <button class="daily-claim-btn" ${(!complete||q.claimed)?'disabled':''} onclick="claimDailyQuest(${i})">${q.claimed?'✓':complete?'RÉCLAMER':'EN COURS'}</button>
          </div>`;
        }).join('')}
      </div>
      <div class="daily-bonus ${done===3?'ready':''}">
        ${done===3?'🎁 Bonus des 3 quêtes : +500 🪙':'🎁 Termine les 3 quêtes pour débloquer le bonus +500 🪙'}
        ${done===3 && !data.allClaimed ? '<button type="button" id="daily-bonus-claim-btn" class="daily-bonus-btn">RÉCLAMER</button>' : data.allClaimed ? '<span class="daily-bonus-claimed">✓ RÉCLAMÉ</span>' : ''}
      </div>
    </div>`;
}
window.claimDailyBonus=function(){
  const data=getDailyQuestData();
  if(data.allClaimed || data.quests.some(q=>!q.claimed)) return;
  data.allClaimed=true;
  saveDailyQuestData(data);
  const current=loadCoins();
  localStorage.setItem(CONFIG.COINS_KEY, String(Math.max(0,current+500)));
  if(state) state.coins=loadCoins();
  updateCoinDisplay();
  updateMenuDisplays();
  renderDailyQuestsPanel();
  showShopFeedback('🎁 Bonus quotidien : +500 🪙',false);
};


window.openDailyQuests=function(){ openMenuPanel('quests'); };

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
  { req: 300,  rank: null,      icon: '🌀', reward: 0, modeUnlock: 'chaos', modeName: 'Mode Chaos' },
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
    description: 'Une IA volontairement imparfaite.',
    trophiesWin: 20, trophiesLoss: 10, coinsWin: 20, coinsLoss: 5,
    wallProbability: 0.12, moveRandomness: 0.38, wallAttempts: 18, wallRadius: 1,
    lookAhead: 0
  },
  normal: {
    name: 'Normale', icon: '🟡',
    description: 'Une IA équilibrée.',
    trophiesWin: 30, trophiesLoss: 15, coinsWin: 50, coinsLoss: 15,
    wallProbability: 0.35, moveRandomness: 0.10, wallAttempts: 45, wallRadius: 2,
    lookAhead: 1
  },
  hard: {
    name: 'Difficile', icon: '🔴',
    description: 'Une IA tactique qui anticipe.',
    trophiesWin: 40, trophiesLoss: 15, coinsWin: 75, coinsLoss: 20,
    wallProbability: 0.62, moveRandomness: 0.015, wallAttempts: 120, wallRadius: 4,
    lookAhead: 2
  },
  expert: {
    name: 'Très difficile', icon: '💀',
    description: 'Une IA très stratégique. Bonne chance. 😭',
    trophiesWin: 50, trophiesLoss: 20, coinsWin: 100, coinsLoss: 25,
    wallProbability: 0.90, moveRandomness: 0, wallAttempts: 300, wallRadius: 99,
    lookAhead: 3
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
  { id:'classic', name:'Classique', price:0,    shape:'classic', bg:'var(--player-0)', glow:null, icon:'' },
  { id:'ocean',   name:'Robot',     price:250,  shape:'robot',   bg:'linear-gradient(145deg,#8D99AE,#334155)', glow:'#94A3B8', icon:'🤖' },
  { id:'flame',   name:'Ninja',     price:500,  shape:'ninja',   bg:'linear-gradient(145deg,#24243E,#09090F)', glow:'#A78BFA', icon:'🥷' },
  { id:'neon',    name:'Mage',      price:750,  shape:'mage',    bg:'linear-gradient(145deg,#7C3AED,#312E81)', glow:'#A78BFA', icon:'🪄' },
  { id:'gold',    name:'Roi',       price:1200, shape:'king',    bg:'linear-gradient(145deg,#FDE68A,#B7791F)', glow:'#FBBF24', icon:'♛' },
  { id:'shadow',  name:'Fantôme',   price:1800, shape:'ghost',   bg:'linear-gradient(145deg,#E5E7EB,#64748B)', glow:'#CBD5E1', icon:'👻' },
  { id:'samurai', name:'Samouraï',  price:2200, shape:'samurai', bg:'linear-gradient(145deg,#DC2626,#450A0A)', glow:'#EF4444', icon:'⚔' },
  { id:'alien',   name:'Alien',     price:2600, shape:'alien',   bg:'linear-gradient(145deg,#34D399,#065F46)', glow:'#34D399', icon:'👽' },
  { id:'frog',    name:'Grenouille',price:3000, shape:'frog',    bg:'linear-gradient(145deg,#84CC16,#365314)', glow:'#84CC16', icon:'🐸' },
  { id:'crystal', name:'Cristal',   price:3500, shape:'crystal', bg:'linear-gradient(145deg,#67E8F9,#2563EB)', glow:'#67E8F9', icon:'◆' },
  { id:'cowboy',  name:'Cowboy',    price:4000, shape:'cowboy',  bg:'linear-gradient(145deg,#D97706,#78350F)', glow:'#F59E0B', icon:'🤠' },
];


// ============================================================
//  PERSONNALISATION — PLATEAUX
// ============================================================
const BOARD_THEMES = [
  { id:'classic', name:'Classique', price:0, icon:'🪵', desc:'Le plateau original.', preview:'classic' },
  { id:'forest', name:'Forêt', price:450, icon:'🌲', desc:'Un plateau naturel et chaleureux.', preview:'forest' },
  { id:'ice', name:'Glace', price:900, icon:'🧊', desc:'Un plateau froid aux couleurs polaires.', preview:'ice' },
  { id:'desert', name:'Désert', price:1400, icon:'🏜️', desc:'Sable, pierre et ambiance désertique.', preview:'desert' },
  { id:'volcano', name:'Volcan', price:2000, icon:'🌋', desc:'Roche sombre et chaleur volcanique.', preview:'volcano' },
  { id:'cosmos', name:'Cosmos', price:2800, icon:'🌌', desc:'Un plateau venu de l’espace.', preview:'cosmos' },
  { id:'dungeon', name:'Donjon', price:3400, icon:'🏰', desc:'Pierre sombre, comme une arène médiévale.', preview:'dungeon' }
];
const BOARD_THEME_KEY = 'quoridor4_board_theme';
const EFFECT_KEY = 'quoridor4_equipped_effect';
const EFFECTS = [
 {id:'trail',name:'Traînée',price:300,rarity:'Commun',icon:'💨',desc:'Une traînée légère accompagne chacun de tes déplacements.',color:'#8BD3FF'},
 {id:'spark',name:'Étincelles',price:450,rarity:'Commun',icon:'✨',desc:'Des étincelles jaillissent à chaque déplacement.',color:'#FFD84D'},
 {id:'lightning',name:'Foudre',price:800,rarity:'Rare',icon:'⚡',desc:'Un éclair frappe ton pion lorsque tu avances.',color:'#9B8CFF'},
 {id:'portal',name:'Portail',price:1100,rarity:'Rare',icon:'🌀',desc:'Un portail mystique accompagne tes déplacements et tes cartes.',color:'#B36BFF'},
 {id:'inferno',name:'Inferno',price:1800,rarity:'Épique',icon:'🔥',desc:'Des flammes explosent autour de ton pion.',color:'#FF6A2A'},
 {id:'blizzard',name:'Blizzard',price:2200,rarity:'Épique',icon:'❄️',desc:'Un tourbillon de glace accompagne tes actions.',color:'#7DDCFF'},
 {id:'galaxy',name:'Galaxie',price:3500,rarity:'Légendaire',icon:'🌌',desc:'Des étoiles et une aura cosmique suivent ton pion.',color:'#A78BFA'},
 {id:'royal',name:'Royal',price:5000,rarity:'Légendaire',icon:'👑',desc:'Une aura royale et des particules dorées marquent tes actions.',color:'#FFD45A'}
];

// ============================================================
//  PERSONNALISATION — EMOTES ANIMÉS
// ============================================================
const EMOTE_KEY = 'quoridor4_emotes';
const EMOTES = [
  {id:'gg', name:'Bien joué', price:250, rarity:'Commun', icon:'GG', desc:'Un petit GG animé après un beau coup.', tone:'green'},
  {id:'clap', name:'Applaudissements', price:450, rarity:'Commun', icon:'👏', desc:'Des applaudissements éclatent autour de ton pion.', tone:'gold'},
  {id:'laugh', name:'Mort de rire', price:700, rarity:'Rare', icon:'😂', desc:'Ton pion part dans un fou rire bien visible.', tone:'yellow'},
  {id:'wow', name:'WOW', price:900, rarity:'Rare', icon:'WOW!', desc:'Une réaction spectaculaire apparaît au-dessus de ton pion.', tone:'blue'},
  {id:'angry', name:'Provocation', price:1300, rarity:'Épique', icon:'!', desc:'Une réaction rouge et nerveuse fait vibrer ton pion.', tone:'red'},
  {id:'cry', name:'Tristesse', price:1700, rarity:'Épique', icon:'💧', desc:'Une petite pluie de larmes tombe autour du pion.', tone:'cyan'},
  {id:'fire', name:'En feu', price:2400, rarity:'Légendaire', icon:'🔥', desc:'Ton pion s’enflamme dans une animation impressionnante.', tone:'orange'},
  {id:'crown', name:'Respect royal', price:4000, rarity:'Légendaire', icon:'♛', desc:'Une couronne apparaît avec une aura royale.', tone:'purple'}
];
function loadEmotes(){
  try{
    const raw=JSON.parse(localStorage.getItem(EMOTE_KEY)||'{}');
    const owned=Array.isArray(raw.owned)?raw.owned.filter(id=>EMOTES.some(e=>e.id===id)):[];
    const equipped=Array.isArray(raw.equipped)?raw.equipped.filter(id=>owned.includes(id)&&EMOTES.some(e=>e.id===id)).slice(0,4):[];
    if(!owned.includes('gg')) owned.unshift('gg');
    if(!equipped.length) equipped.push('gg');
    return {owned,equipped};
  }catch(e){return {owned:['gg'],equipped:['gg']};}
}
function saveEmotes(data){localStorage.setItem(EMOTE_KEY,JSON.stringify(data));}
function emoteOwned(id){return loadEmotes().owned.includes(id);}
function buildEmoteCardHTML(e,data){
  const owned=data.owned.includes(e.id), equipped=data.equipped.includes(e.id);
  let action='';
  if(equipped) action='<div class="shop-badge equipped">✓ ÉQUIPÉ</div>';
  else if(owned) action=`<button class="shop-action-btn equip-btn" onclick="equipEmoteFromShop('${e.id}')">ÉQUIPER</button>`;
  else action=`<button class="shop-action-btn buy-btn" onclick="buyEmoteFromShop('${e.id}')">ACHETER</button>`;
  return `<div class="emote-shop-card ${owned?'owned':''} ${equipped?'equipped':''}">
    <div class="emote-preview emote-preview-${e.id}"><div class="emote-demo-pawn"></div><div class="emote-demo-bubble">${e.icon}</div><i></i><i></i><i></i></div>
    <div class="effect-rarity">${e.rarity}</div><div class="effect-shop-name">${e.name}</div>
    <div class="effect-shop-desc">${e.desc}</div><div class="effect-price">${e.price?'🪙 '+e.price:'Gratuit'}</div>${action}
  </div>`;
}
window.buyEmoteFromShop=function(id){
  const e=EMOTES.find(x=>x.id===id); if(!e)return; const data=loadEmotes();
  if(data.owned.includes(id))return;
  if(loadCoins()<e.price){showShopFeedback('🪙 Jetons insuffisants',true);return;}
  addCoins(-e.price); data.owned.push(id); saveEmotes(data); showShopFeedback(`🎉 ${e.name} acheté !`,false); renderShopPanel();
};
window.equipEmoteFromShop=function(id){
  const data=loadEmotes(); if(!data.owned.includes(id))return;
  if(data.equipped.includes(id)) data.equipped=data.equipped.filter(x=>x!==id);
  else { if(data.equipped.length>=4){showShopFeedback('Tu peux équiper 4 emotes maximum.',true);return;} data.equipped.push(id); }
  saveEmotes(data); renderShopPanel(); renderEmoteBar();
};
function renderEmoteBar(){
  const bar=document.getElementById('emote-bar'); if(!bar)return;
  const data=loadEmotes();
  const list=data.equipped.map(id=>EMOTES.find(e=>e.id===id)).filter(Boolean);
  bar.innerHTML=list.map(e=>`<button class="emote-use-btn emote-${e.id}" onclick="useEmote('${e.id}')" title="${e.name}"><span>${e.icon}</span></button>`).join('') || '<span class="emote-empty">Équipe des emotes dans la boutique</span>';
}
window.useEmote=function(id){
  if(!state || state.gameOver)return;
  const player=currentPlayer(); if(!player || !player.isHuman)return;
  const data=loadEmotes(); if(!data.equipped.includes(id))return;
  showAnimatedEmote(id,player);
};
function showAnimatedEmote(id,player){
  const board=document.getElementById('board-frame'); const pawn=document.getElementById('pawn-'+player.id); const e=EMOTES.find(x=>x.id===id); if(!board||!pawn||!e)return;
  const br=board.getBoundingClientRect(), pr=pawn.getBoundingClientRect();
  const bubble=document.createElement('div'); bubble.className=`battle-emote battle-emote-${id}`; bubble.innerHTML=`<div class="battle-emote-bubble">${e.icon}</div><div class="battle-emote-burst"><i></i><i></i><i></i><i></i></div>`;
  bubble.style.left=(pr.left-br.left+pr.width/2)+'px'; bubble.style.top=(pr.top-br.top+pr.height*.15)+'px';
  board.appendChild(bubble); setTimeout(()=>bubble.remove(),1250);
}

let shopCategory = 'pawns';

function loadBoardTheme() {
  const saved = localStorage.getItem(BOARD_THEME_KEY);
  return BOARD_THEMES.some(t => t.id === saved) ? saved : 'classic';
}
function saveBoardTheme(id) { localStorage.setItem(BOARD_THEME_KEY, id); }
function getBoardTheme() { return BOARD_THEMES.find(t => t.id === loadBoardTheme()) || BOARD_THEMES[0]; }
function applyBoardTheme() {
  const frame = document.getElementById('board-frame');
  if (!frame) return;
  const theme = getBoardTheme();
  frame.classList.remove(...BOARD_THEMES.map(t => 'theme-' + t.id));
  frame.classList.add('theme-' + theme.id);
}

window.buyBoardThemeFromShop = function(themeId) {
  const theme = BOARD_THEMES.find(t => t.id === themeId);
  if (!theme) return;
  const shop = loadShop();
  shop.boardOwned = Array.isArray(shop.boardOwned) ? shop.boardOwned : ['classic'];
  if (!shop.boardOwned.includes('classic')) shop.boardOwned.unshift('classic');
  if (shop.boardOwned.includes(themeId)) return;
  const coins = loadCoins();
  if (coins < theme.price) {
    showShopFeedback('🪙 Jetons insuffisants', true);
    return;
  }
  addCoins(-theme.price);
  shop.boardOwned.push(themeId);
  saveShop(shop);
  showShopFeedback(`🛍️ ${theme.name} acheté !`, false);
  renderShopPanel();
};

window.equipBoardThemeFromShop = function(themeId) {
  const shop = loadShop();
  const owned = Array.isArray(shop.boardOwned) ? shop.boardOwned : ['classic'];
  if (!owned.includes(themeId)) return;
  saveBoardTheme(themeId);
  applyBoardTheme();
  renderShopPanel();
};


// ============================================================
//  CARTES & COLLECTION
// ============================================================
const CARDS = [
  // Communes — effets immédiatement utiles en partie
  { id:'sprint', name:'Sprint', icon:'⚡', rarity:'Commune', color:'#4DA3FF', desc:'Avance jusqu’à 2 cases sur ton chemin.', weight:18, effect:'sprint2' },
  { id:'freewall', name:'Mur gratuit', icon:'🧱', rarity:'Commune', color:'#63C174', desc:'Pose une barrière sans consommer ta réserve.', weight:18, effect:'freewall' },
  { id:'doublemove', name:'Second souffle', icon:'👟', rarity:'Commune', color:'#22C55E', desc:'Après ton déplacement, tu rejoues immédiatement.', weight:14, effect:'doubleturn' },
  { id:'wallbreak', name:'Brise-mur', icon:'💥', rarity:'Commune', color:'#F59E0B', desc:'Détruit la barrière de ton choix sur le plateau.', weight:10, effect:'breakwall' },

  // Rares
  { id:'doubleturn', name:'Double tour', icon:'🔄', rarity:'Rare', color:'#4C7DFF', desc:'Ton prochain coup est immédiatement suivi d’un autre.', weight:8, effect:'doubleturn' },
  { id:'jump', name:'Saut', icon:'🌀', rarity:'Rare', color:'#7A5CFF', desc:'Avance jusqu’à 3 cases en une seule utilisation.', weight:7, effect:'jump3' },
  { id:'passwall', name:'Passe-muraille', icon:'👻', rarity:'Rare', color:'#06B6D4', desc:'Ton prochain déplacement ignore les barrières.', weight:6, effect:'passwall' },
  { id:'thief', name:'Voleur de murs', icon:'🦹', rarity:'Rare', color:'#14B8A6', desc:'Récupère une barrière chez un adversaire et ajoute-la à ta réserve.', weight:5, effect:'thief' },

  // Épiques
  { id:'dash', name:'Ruée', icon:'💨', rarity:'Épique', color:'#A855F7', desc:'Avance jusqu’à 4 cases en une seule utilisation.', weight:4, effect:'jump4' },
  { id:'fortress', name:'Forteresse', icon:'🏰', rarity:'Épique', color:'#8B5CF6', desc:'Pose une barrière gratuite et récupère une barrière en réserve.', weight:3, effect:'fortress' },
  { id:'exchange', name:'Échange', icon:'⇄', rarity:'Épique', color:'#EC4899', desc:'Échange ta position avec celle d’un adversaire.', weight:2.5, effect:'exchange' },
  { id:'teleport', name:'Téléportation', icon:'✦', rarity:'Épique', color:'#6366F1', desc:'Téléporte-toi vers une case libre aléatoire.', weight:2, effect:'teleport' },

  // Légendaires
  { id:'warp', name:'Distorsion', icon:'🪐', rarity:'Légendaire', color:'#D946EF', desc:'Avance jusqu’à 5 cases sur ton chemin.', weight:1.2, effect:'jump5' },
  { id:'shield', name:'Bouclier', icon:'🛡️', rarity:'Légendaire', color:'#F59E0B', desc:'Protège ton prochain coup contre un effet négatif du Mode Chaos.', weight:0.9, effect:'shield' },
  { id:'chaosmaster', name:'Maître du Chaos', icon:'☄️', rarity:'Légendaire', color:'#EF4444', desc:'Avance jusqu’à 3 cases et rejoue immédiatement.', weight:0.7, effect:'momentum' },
  { id:'legendaryrush', name:'Éclair légendaire', icon:'🌟', rarity:'Légendaire', color:'#F97316', desc:'Avance jusqu’à 5 cases puis rejoue immédiatement.', weight:0.5, effect:'legendaryrush' }
];
const CARD_KEY = 'quoridor4_cards';
const CARD_HAND_SIZE = 3;
const PACK_COST = 300;
const DECK_KEY = 'quoridor4_card_deck';
const DECK_SIZE = 5;

function loadCards() {
  try {
    const raw = JSON.parse(localStorage.getItem(CARD_KEY) || '{}');
    if (!raw.collection || typeof raw.collection !== 'object') throw new Error('bad');
    return { collection: raw.collection, starter: !!raw.starter };
  } catch(e) { return { collection:{ sprint:1, freewall:1, vision:1 }, starter:false }; }
}
function saveCards(data) { localStorage.setItem(CARD_KEY, JSON.stringify(data)); }
function ensureStarterCards() {
  const data = loadCards();
  if (!data.starter) {
    data.collection.sprint = Math.max(1, Number(data.collection.sprint)||0);
    data.collection.freewall = Math.max(1, Number(data.collection.freewall)||0);
    data.collection.vision = Math.max(1, Number(data.collection.vision)||0);
    data.starter = true; saveCards(data);
  }
  return data;
}
function ownedCards() {
  const data = ensureStarterCards();
  return CARDS.filter(c => (Number(data.collection[c.id])||0) > 0);
}
function cardById(id) { return CARDS.find(c => c.id === id); }
function weightedRandomCard() {
  const total = CARDS.reduce((n,c)=>n+c.weight,0); let roll=Math.random()*total;
  for (const c of CARDS) { roll -= c.weight; if (roll <= 0) return c; }
  return CARDS[0];
}
function addCardToCollection(id, amount=1) {
  const data=ensureStarterCards(); data.collection[id]=(Number(data.collection[id])||0)+amount; saveCards(data);
}
function cardCounts() { return ensureStarterCards().collection; }
function loadDeck() {
  const owned = ownedCards().map(c=>c.id);
  let deck=[];
  try { deck=JSON.parse(localStorage.getItem(DECK_KEY)||'[]'); } catch(e) { deck=[]; }
  deck = Array.isArray(deck) ? deck.filter(id=>owned.includes(id)) : [];
  if (!deck.length) deck=owned.slice(0, DECK_SIZE);
  deck=[...new Set(deck)].slice(0,DECK_SIZE);
  localStorage.setItem(DECK_KEY, JSON.stringify(deck));
  return deck;
}
function saveDeck(deck) { localStorage.setItem(DECK_KEY, JSON.stringify([...new Set(deck)].slice(0,DECK_SIZE))); }
function toggleDeckCard(id) {
  const owned=ownedCards().map(c=>c.id); if(!owned.includes(id)) return;
  let deck=loadDeck();
  if(deck.includes(id)) deck=deck.filter(x=>x!==id);
  else if(deck.length<DECK_SIZE) deck.push(id);
  else { showMessage('Ton deck est déjà complet (5 cartes).',2200); return; }
  saveDeck(deck); openMenuPanel('cards');
}
window.toggleDeckCard=toggleDeckCard;
function drawHand() {
  const pool=loadDeck();
  if (!pool.length) return [];
  const shuffled=[...pool].sort(()=>Math.random()-.5);
  return shuffled.slice(0,CARD_HAND_SIZE);
}
function consumeCard(id) {
  const data=ensureStarterCards();
  const n=Number(data.collection[id])||0;
  if(n<=0) return false;
  data.collection[id]=n-1; saveCards(data); return true;
}
// ============================================================
//  OUVERTURE DE PACK — SCÈNE CINÉMATIQUE
//  Séquence : arrivée → suspense → impacts successifs → déchirure
//  lumineuse → révélation des cartes (effets selon la rareté).
// ============================================================
const PACK_RARITY_FX = {
  'Commune':    { tier: 1, color: '#B9C2E0', particles: 8,  tone: [523] },
  'Rare':       { tier: 2, color: '#4DA3FF', particles: 16, tone: [440, 659] },
  'Épique':     { tier: 3, color: '#B66CFF', particles: 26, tone: [392, 523, 659] },
  'Légendaire': { tier: 4, color: '#FFD45A', particles: 44, tone: [392, 494, 587, 784] }
};
function pkoRarityFx(rarity) { return PACK_RARITY_FX[rarity] || PACK_RARITY_FX['Commune']; }

const PKO_REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let pendingPackRewards = null;
let pendingPackNewFlags = null;
let pendingPackPrevCounts = null;
let packOpenPhase = 'idle'; // idle | arriving | ready | charging | bursting | revealing | opened
let packFlippedCount = 0;
let packTimers = [];
let packRevealTimers = [];
let packTensionTimer = null;

function pkoDelay(ms) { return PKO_REDUCED_MOTION ? Math.min(ms, 60) : ms; }
function pkoTimeout(fn, ms) { const id = setTimeout(fn, pkoDelay(ms)); packTimers.push(id); return id; }
function pkoClearTimers() {
  packTimers.forEach(clearTimeout); packTimers = [];
  packRevealTimers.forEach(clearTimeout); packRevealTimers = [];
  if (packTensionTimer) { clearTimeout(packTensionTimer); packTensionTimer = null; }
}

/* ---------- Petit moteur de particules (canvas, léger) ---------- */
let pkoCanvas = null, pkoCtx = null, pkoParticles = [], pkoRafId = null, pkoAmbientTimer = null, pkoDPR = 1;

function setupPackCanvas() {
  pkoCanvas = document.getElementById('pack-fx-canvas');
  if (!pkoCanvas) return;
  pkoCtx = pkoCanvas.getContext('2d');
  resizePackCanvas();
}
function resizePackCanvas() {
  const modal = document.getElementById('pack-opening-modal');
  if (!pkoCanvas || !pkoCtx || !modal) return;
  const rect = modal.getBoundingClientRect();
  pkoDPR = Math.min(window.devicePixelRatio || 1, 2);
  pkoCanvas.width = Math.max(1, Math.round(rect.width * pkoDPR));
  pkoCanvas.height = Math.max(1, Math.round(rect.height * pkoDPR));
  pkoCanvas.style.width = rect.width + 'px';
  pkoCanvas.style.height = rect.height + 'px';
  pkoCtx.setTransform(pkoDPR, 0, 0, pkoDPR, 0, 0);
}
function pkoClearCanvas() {
  if (!pkoCtx || !pkoCanvas) return;
  pkoCtx.save();
  pkoCtx.setTransform(1, 0, 0, 1, 0, 0);
  pkoCtx.clearRect(0, 0, pkoCanvas.width, pkoCanvas.height);
  pkoCtx.restore();
}
function pkoPointInModal(el) {
  const modal = document.getElementById('pack-opening-modal');
  if (!el || !modal) return { x: 0, y: 0 };
  const mr = modal.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return { x: (er.left + er.width / 2) - mr.left, y: (er.top + er.height / 2) - mr.top };
}
function spawnBurstParticles(el, count, speed, big) {
  if (PKO_REDUCED_MOTION || !pkoCtx || !el) return;
  const origin = pkoPointInModal(el);
  let color = (document.getElementById('pack-visual').style.getPropertyValue('--pko-c') || '#FFC94D').trim();
  if (el.classList && el.classList.contains('pko-card')) {
    const cc = el.style.getPropertyValue('--card-color');
    if (cc) color = cc.trim();
  }
  const n = Math.min(count, 90);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * 0.35 + Math.random() * speed * 0.55;
    pkoParticles.push({
      x: origin.x, y: origin.y,
      vx: Math.cos(angle) * v / 28,
      vy: Math.sin(angle) * v / 28 - (big ? 1.4 : 0.5),
      life: 0, maxLife: (big ? 60 : 36) + Math.random() * 26,
      size: (big ? 2.6 : 1.7) + Math.random() * 1.6,
      color, grav: big ? 0.045 : 0.03,
      shard: !!big && Math.random() < 0.3,
      rot: Math.random() * Math.PI
    });
  }
  if (pkoParticles.length > 420) pkoParticles.splice(0, pkoParticles.length - 420);
  pkoEnsureLoop();
}
function pkoEnsureLoop() {
  if (pkoRafId) return;
  const step = () => {
    if (!pkoCtx) { pkoRafId = null; return; }
    if (packOpenPhase === 'idle' && pkoParticles.length === 0) { pkoRafId = null; return; }
    pkoClearCanvas();
    pkoParticles = pkoParticles.filter(p => {
      p.life++; p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.rot += 0.15;
      const t = p.life / p.maxLife;
      if (t >= 1) return false;
      pkoCtx.globalAlpha = Math.max(0, 1 - t);
      pkoCtx.fillStyle = p.color;
      if (p.shard) {
        pkoCtx.save();
        pkoCtx.translate(p.x, p.y);
        pkoCtx.rotate(p.rot);
        pkoCtx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        pkoCtx.restore();
      } else {
        pkoCtx.beginPath();
        pkoCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pkoCtx.fill();
      }
      return true;
    });
    pkoCtx.globalAlpha = 1;
    pkoRafId = requestAnimationFrame(step);
  };
  pkoRafId = requestAnimationFrame(step);
}
function startAmbientParticles() {
  if (PKO_REDUCED_MOTION) return;
  stopAmbientParticles();
  pkoAmbientTimer = setInterval(() => {
    if (packOpenPhase !== 'ready' && packOpenPhase !== 'arriving') return;
    const visual = document.getElementById('pack-visual');
    if (visual) spawnBurstParticles(visual, 2, 8);
  }, 420);
}
function stopAmbientParticles() {
  if (pkoAmbientTimer) { clearInterval(pkoAmbientTimer); pkoAmbientTimer = null; }
  pkoParticles = [];
  pkoClearCanvas();
  if (pkoRafId) { cancelAnimationFrame(pkoRafId); pkoRafId = null; }
}

/* ---------- Flash plein écran ---------- */
function triggerScreenFlash(soft) {
  const flash = document.getElementById('pko-screenflash');
  if (!flash || PKO_REDUCED_MOTION) return;
  flash.classList.remove('pko-flash-strong', 'pko-flash-soft');
  void flash.offsetWidth;
  flash.classList.add(soft ? 'pko-flash-soft' : 'pko-flash-strong');
}

/* ---------- Petits sons synthétisés (en plus des sons existants) ---------- */
let pkoAudioCtx = null;
function pkoGetAudioCtx() {
  if (!audioEnabled) return null;
  try {
    if (!pkoAudioCtx) pkoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (pkoAudioCtx.state === 'suspended') pkoAudioCtx.resume();
    return pkoAudioCtx;
  } catch (_) { return null; }
}
function pkoTone(freq, delay, dur, type, gainMul) {
  const ctx = pkoGetAudioCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    const peak = 0.16 * audioVolume * (gainMul || 1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.2));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + (dur || 0.2) + 0.05);
  } catch (_) {}
}
function pkoNoiseThud(delay, dur, vol) {
  const ctx = pkoGetAudioCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + (delay || 0);
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * (dur || 0.18)));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime((vol || 0.22) * audioVolume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.18));
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(t0);
  } catch (_) {}
}
function pkoSynthImpact(stage) {
  if (!audioEnabled) return;
  pkoNoiseThud(0, 0.14 + stage * 0.02, 0.12 + stage * 0.05);
  pkoTone(120 + stage * 22, 0.01, 0.12, 'triangle', 0.5 + stage * 0.15);
}
function pkoSynthBurst(tier) {
  if (!audioEnabled) return;
  pkoNoiseThud(0, 0.28, 0.32);
  const freqs = tier >= 4 ? [523, 659, 784, 1046] : tier >= 3 ? [440, 554, 659] : [392, 523];
  freqs.forEach((f, i) => pkoTone(f, 0.02 + i * 0.05, 0.5, 'sine', 0.55));
}
function pkoSynthReveal(tier) {
  if (!audioEnabled) return;
  const fx = Object.values(PACK_RARITY_FX).find(f => f.tier === tier) || PACK_RARITY_FX['Commune'];
  fx.tone.forEach((f, i) => pkoTone(f, i * 0.045, 0.32, 'triangle', 0.4 + tier * 0.06));
}

/* ---------- Séquence principale ---------- */
function openCardPack() {
  if (packOpenPhase !== 'idle') return;
  const coins = loadCoins();
  if (coins < PACK_COST) { showMessage(`Il te faut ${PACK_COST} 🪙 pour acheter un pack.`); return; }
  const overlay = document.getElementById('pack-opening-overlay');
  if (!overlay) return;

  addCoins(-PACK_COST);

  const counts = cardCounts();
  const seen = {};
  pendingPackRewards = []; pendingPackNewFlags = []; pendingPackPrevCounts = [];
  for (let i = 0; i < 3; i++) {
    const card = weightedRandomCard();
    const priorTotal = (Number(counts[card.id]) || 0) + (seen[card.id] || 0);
    pendingPackRewards.push(card);
    pendingPackNewFlags.push(priorTotal === 0);
    pendingPackPrevCounts.push(priorTotal);
    seen[card.id] = (seen[card.id] || 0) + 1;
  }

  packOpenPhase = 'arriving';
  startPackScene();
}

function pkoBestRarityFx() {
  let best = PACK_RARITY_FX['Commune'];
  (pendingPackRewards || []).forEach(c => { const fx = pkoRarityFx(c.rarity); if (fx.tier > best.tier) best = fx; });
  return best;
}
function pkoBestRarityLabel() {
  let best = 'Commune', bestTier = 0;
  (pendingPackRewards || []).forEach(c => { const t = pkoRarityFx(c.rarity).tier; if (t > bestTier) { bestTier = t; best = c.rarity; } });
  return best;
}

function startPackScene() {
  const overlay = document.getElementById('pack-opening-overlay');
  const modal = document.getElementById('pack-opening-modal');
  const visual = document.getElementById('pack-visual');
  const stage = document.getElementById('pack-reveal-stage');
  const subtitle = document.getElementById('pack-opening-subtitle');
  const closeBtn = document.getElementById('pack-opening-close');
  const footer = document.getElementById('pko-reveal-footer');
  if (!overlay || !visual || !stage || !subtitle || !modal) return;

  pkoClearTimers();
  packFlippedCount = 0;

  overlay.classList.remove('hidden', 'closing');
  overlay.classList.add('opening');
  overlay.setAttribute('aria-hidden', 'false');
  modal.classList.remove('pko-legendary-tease', 'pko-shake-1', 'pko-shake-2', 'pko-shake-3');
  stage.innerHTML = '';
  if (footer) footer.classList.add('hidden');
  if (closeBtn) closeBtn.classList.add('hidden');

  const best = pkoBestRarityFx();
  visual.style.setProperty('--pko-c', best.color);
  if (best.tier >= 4) modal.classList.add('pko-legendary-tease');

  visual.className = 'pack-visual';
  void visual.offsetWidth;
  visual.classList.add('pko-arrive');
  subtitle.textContent = 'Le pack arrive…';

  setupPackCanvas();
  startAmbientParticles();

  pkoTimeout(() => {
    if (packOpenPhase !== 'arriving') return;
    packOpenPhase = 'ready';
    visual.classList.remove('pko-arrive');
    visual.classList.add('pko-ready');
    subtitle.textContent = 'Touche le pack pour l’ouvrir';
    visual.onclick = triggerPackOpening;
    visual.setAttribute('role', 'button');
    visual.setAttribute('tabindex', '0');
    visual.setAttribute('aria-label', 'Ouvrir le pack');
    visual.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerPackOpening(); } };
    packTensionTimer = setTimeout(() => {
      if (packOpenPhase === 'ready') { visual.classList.add('pko-eager'); subtitle.textContent = 'Vas-y, ouvre-le ! ✨'; }
    }, pkoDelay(3400));
  }, 780);
}

function triggerPackOpening() {
  if (packOpenPhase !== 'ready') return;
  packOpenPhase = 'charging';

  const visual = document.getElementById('pack-visual');
  const modal = document.getElementById('pack-opening-modal');
  const subtitle = document.getElementById('pack-opening-subtitle');
  if (!visual) return;

  if (packTensionTimer) { clearTimeout(packTensionTimer); packTensionTimer = null; }
  visual.onclick = null; visual.onkeydown = null; visual.removeAttribute('tabindex');
  visual.setAttribute('aria-label', 'Pack en cours d’ouverture');

  visual.classList.remove('pko-ready', 'pko-eager');
  visual.classList.add('pko-charging');
  if (subtitle) subtitle.textContent = 'Il réagit...';

  playSound('pack');
  pkoSynthImpact(1);
  visual.classList.add('pko-impact1');
  spawnBurstParticles(visual, 6, 40);

  pkoTimeout(() => {
    visual.classList.remove('pko-impact1');
    void visual.offsetWidth;
    visual.classList.add('pko-impact2', 'pko-leak');
    if (subtitle) subtitle.textContent = 'Ça bouge là-dedans...';
    pkoSynthImpact(2);
    spawnBurstParticles(visual, 10, 55);
  }, 260);

  pkoTimeout(() => {
    visual.classList.remove('pko-impact2');
    void visual.offsetWidth;
    visual.classList.add('pko-impact3');
    if (subtitle) subtitle.textContent = '✨ La lumière sort du pack !';
    pkoSynthImpact(3);
    spawnBurstParticles(visual, 14, 70);
    if (modal) { modal.classList.add('pko-shake-2'); }
  }, 260);

  pkoTimeout(() => { startPackBurst(); }, 260 + 260 + 300);
}

function startPackBurst() {
  packOpenPhase = 'bursting';
  const visual = document.getElementById('pack-visual');
  const modal = document.getElementById('pack-opening-modal');
  const subtitle = document.getElementById('pack-opening-subtitle');
  if (!visual) return;

  visual.classList.remove('pko-impact3', 'pko-leak');
  void visual.offsetWidth;
  visual.classList.add('pko-burst');
  if (modal) { modal.classList.remove('pko-shake-2'); void modal.offsetWidth; modal.classList.add('pko-shake-3'); }

  pkoSynthBurst(pkoBestRarityFx().tier);
  triggerScreenFlash(false);
  spawnBurstParticles(visual, 46, 220, true);

  pkoTimeout(() => {
    if (subtitle) subtitle.textContent = 'Pack ouvert !';
    // Les récompenses sont accordées maintenant, quoi qu'il arrive ensuite.
    if (pendingPackRewards) pendingPackRewards.forEach(card => addCardToCollection(card.id, 1));
    visual.classList.add('pko-hide');
    beginRevealPhase();
  }, 620);
}

function beginRevealPhase() {
  packOpenPhase = 'revealing';
  const stage = document.getElementById('pack-reveal-stage');
  const subtitle = document.getElementById('pack-opening-subtitle');
  const footer = document.getElementById('pko-reveal-footer');
  if (!stage || !pendingPackRewards) return;

  playSound('card');
  if (subtitle) subtitle.textContent = 'Touche les cartes pour les révéler';

  stage.innerHTML = pendingPackRewards.map((c, i) => {
    const isNew = pendingPackNewFlags && pendingPackNewFlags[i];
    const prevCount = (pendingPackPrevCounts && pendingPackPrevCounts[i]) || 0;
    const tier = pkoRarityFx(c.rarity).tier;
    return `<div class="pko-card pko-tier-${tier}" data-index="${i}" style="--card-color:${c.color}; --reveal-delay:${i * 110}ms">
      <div class="pko-card-inner">
        <div class="pko-card-face pko-card-back">
          <div class="pko-card-back-glow"></div>
          <div class="pko-card-back-pattern"></div>
          <div class="pko-card-back-logo">Q4</div>
        </div>
        <div class="pko-card-face pko-card-front">
          <div class="pko-card-rarity">${c.rarity}</div>
          <div class="pko-card-icon">${c.icon}</div>
          <div class="pko-card-name">${c.name}</div>
          <div class="pko-card-desc">${c.desc}</div>
          ${isNew ? '<div class="pko-card-new">NOUVEAU</div>' : `<div class="pko-card-count">Tu en avais déjà ${prevCount}</div>`}
        </div>
      </div>
      <div class="pko-card-burst"></div>
    </div>`;
  }).join('');

  stage.querySelectorAll('.pko-card').forEach((el) => {
    const idx = Number(el.dataset.index);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Révéler la carte');
    el.addEventListener('click', () => flipRevealCard(idx));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipRevealCard(idx); } });
    const t = pkoTimeout(() => flipRevealCard(idx), 2200 + idx * 550);
    packRevealTimers.push(t);
  });

  if (footer) footer.classList.remove('hidden');
}

function flipRevealCard(index) {
  const stage = document.getElementById('pack-reveal-stage');
  if (!stage || !pendingPackRewards) return;
  const el = stage.querySelector(`.pko-card[data-index="${index}"]`);
  if (!el || el.classList.contains('pko-flipped')) return;
  const card = pendingPackRewards[index];
  if (!card) return;
  const fx = pkoRarityFx(card.rarity);

  el.classList.add('pko-flipped', 'pko-flipping');
  playSound('card');
  pkoSynthReveal(fx.tier);
  spawnBurstParticles(el, fx.particles, 30 + fx.tier * 14);

  if (fx.tier >= 3) {
    const modal = document.getElementById('pack-opening-modal');
    if (modal) { modal.classList.remove('pko-shake-1', 'pko-shake-2', 'pko-shake-3'); void modal.offsetWidth; modal.classList.add(fx.tier >= 4 ? 'pko-shake-3' : 'pko-shake-2'); }
  }
  if (fx.tier >= 4) triggerScreenFlash(true);

  setTimeout(() => el.classList.remove('pko-flipping'), 650);

  packFlippedCount++;
  if (packFlippedCount >= pendingPackRewards.length) {
    packRevealTimers.forEach(clearTimeout); packRevealTimers = [];
    pkoTimeout(finishPackReveal, 650);
  }
}

function revealAllPackCards() {
  if (!pendingPackRewards) return;
  packRevealTimers.forEach(clearTimeout); packRevealTimers = [];
  pendingPackRewards.forEach((_, i) => pkoTimeout(() => flipRevealCard(i), i * 140));
}

function finishPackReveal() {
  packOpenPhase = 'opened';
  const subtitle = document.getElementById('pack-opening-subtitle');
  const closeBtn = document.getElementById('pack-opening-close');
  const footer = document.getElementById('pko-reveal-footer');
  const bestLabel = pkoBestRarityLabel();
  const bestTier = pkoRarityFx(bestLabel).tier;
  if (subtitle) subtitle.textContent = bestTier >= 3 ? `🎉 Incroyable, du ${bestLabel} dans ce pack !` : '🎉 3 cartes ajoutées à ta collection !';
  if (footer) footer.classList.add('hidden');
  if (closeBtn) closeBtn.classList.remove('hidden');
}

function closePackOpening() {
  const overlay = document.getElementById('pack-opening-overlay');
  const visual = document.getElementById('pack-visual');
  if (!overlay) return;
  pkoClearTimers();
  stopAmbientParticles();
  packOpenPhase = 'idle';
  pendingPackRewards = null; pendingPackNewFlags = null; pendingPackPrevCounts = null; packFlippedCount = 0;
  if (visual) { visual.onclick = null; visual.onkeydown = null; }
  overlay.classList.remove('opening');
  overlay.classList.add('closing');
  pkoTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
    overlay.setAttribute('aria-hidden', 'true');
    openMenuPanel('cards');
  }, 260);
}
window.openCardPack = openCardPack;
window.openCardsPanel = () => openMenuPanel('cards');
window.revealAllPackCards = revealAllPackCards;

function buildCardCollectionHTML() {
  const counts=cardCounts();
  const deck=loadDeck();
  const ownedCount=CARDS.filter(c=>(Number(counts[c.id])||0)>0).length;
  const totalCopies=Object.values(counts).reduce((a,b)=>a+(Number(b)||0),0);
  const cards=CARDS.map(c=>{
    const count=Number(counts[c.id])||0;
    const owned=count>0, selected=deck.includes(c.id);
    return `<button class="collection-card ${owned?'owned':'locked'} ${selected?'in-deck':''}" style="--card-color:${c.color}" ${owned?`onclick="toggleDeckCard('${c.id}')"`:''}>
      <div class="collection-card-icon">${owned?c.icon:'?'}</div>
      <div class="collection-card-main">
        <div class="collection-card-title"><strong>${owned?c.name:'Carte verrouillée'}</strong><span class="card-rarity">${c.rarity}</span></div>
        <p>${owned?c.desc:'Ouvre des packs pour découvrir cette carte.'}</p>
      </div>
      <div class="collection-card-side">${owned?`<span class="collection-count">×${count}</span>${selected?'<span class="deck-check">✓</span>':''}`:'🔒'}</div>
    </button>`;
  }).join('');
  const deckCards=deck.map(id=>cardById(id)).filter(Boolean).map(c=>`<div class="deck-mini" style="--card-color:${c.color}"><span>${c.icon}</span><b>${c.name}</b></div>`).join('');
  return `<div class="cards-header"><div><h2>🃏 Collection</h2><p class="panel-subtitle">Choisis jusqu'à 5 cartes pour ton deck. Tu en piocheras 3 par partie.</p></div><div class="cards-owned">${ownedCount}/${CARDS.length} découvertes<br><small>${totalCopies} exemplaires</small></div></div>
  <div class="deck-panel"><div class="deck-panel-head"><div><strong>🎴 Mon deck</strong><span>${deck.length}/${DECK_SIZE}</span></div><small>${deck.length<DECK_SIZE?'Ajoute des cartes en appuyant dessus.':'Deck complet'}</small></div><div class="deck-slots">${deckCards || '<div class="deck-empty">Aucune carte sélectionnée</div>'}</div></div>
  <div class="pack-box"><div><strong>🎁 Pack de cartes</strong><p>3 cartes aléatoires • avec une chance de tomber sur une rareté supérieure.</p><small>Coût : ${PACK_COST} 🪙</small></div><button class="pack-open-btn" onclick="openCardPack()">ACHETER UN PACK</button></div>
  <div class="collection-list">${cards}</div>`;
}
function getSkin(id) {
  return PAWN_SKINS.find(s => s.id === id) || PAWN_SKINS[0];
}

/* ============================================================
   2. GÉOMÉTRIE
   ============================================================ */

function pentMetrics() {
  // Le plateau garde la forme d'un pentagone régulier, mais chaque case
  // est légèrement séparée de la suivante pour qu'aucune ne soit coupée.
  const target = Math.min(window.innerWidth * 0.88, 422);
  const gap = Math.max(6, target * 0.022);
  const cell = (target - 8 * gap) / 9;
  return { cell, gap, step: cell + gap };
}

function classicMetrics() {
  // Le plateau classique faisait 440px CSS en permanence (9x40 + 8x10).
  // Sur téléphone, la largeur CSS du viewport est souvent ~360px, même si
  // la capture physique fait ~700px. Le plateau dépassait donc de l'écran.
  // On calcule maintenant la taille réelle disponible en tenant compte des
  // barres latérales du #board-frame.
  const frameSideSpace = 48; // 18px + 18px + 2 gaps de 6px
  const horizontalPadding = 24;
  const maxBoard = N * CONFIG.CELL_SIZE + (N - 1) * CONFIG.WALL_GAP;
  const available = Math.max(240, window.innerWidth - frameSideSpace - horizontalPadding);
  const target = Math.min(maxBoard, available);
  const gap = Math.max(5, Math.min(CONFIG.WALL_GAP, target * 0.0227));
  const cell = (target - (N - 1) * gap) / N;
  return { cell, gap, step: cell + gap };
}

function stepSize() {
  return isPentagonMode() ? pentMetrics().step : classicMetrics().step;
}

function cellPixelPos(r, c) {
  const m = isPentagonMode() ? pentMetrics() : classicMetrics();
  const offset = isPentagonMode() ? (m.step - m.cell) / 2 : 0;
  return { x: c * m.step + offset, y: r * m.step + offset };
}

function boardPixelSize() {
  const m = isPentagonMode() ? pentMetrics() : classicMetrics();
  return N * m.cell + (N - 1) * m.gap;
}

function wallPixelRect(i, j, orientation) {
  const m = isPentagonMode() ? pentMetrics() : classicMetrics();
  const step = m.step, gap = m.gap, cell = m.cell;
  if (orientation === 'H') {
    return { x: j * step + (isPentagonMode() ? (step-cell)/2 : 0), y: (i + 1) * step - gap, width: 2 * cell + gap, height: gap };
  }
  return { x: (j + 1) * step - gap, y: i * step + (isPentagonMode() ? (step-cell)/2 : 0), width: gap, height: 2 * cell + gap };
}

function jointHitboxRect(i, j) {
  const m = isPentagonMode() ? pentMetrics() : classicMetrics();
  const gap = m.gap, step = m.step, HIT = Math.max(gap + 14, 22);
  const centerX = (j + 1) * step - gap / 2;
  const centerY = (i + 1) * step - gap / 2;
  return { x: centerX - HIT / 2, y: centerY - HIT / 2, size: HIT };
}

/* ============================================================
   3. ÉTAT DU JEU
   ============================================================ */

const ALL_PLAYER_DEFS = [
  { id: 0, name: 'Toi',   color: 'var(--player-0)', side: 'bottom',   pentSide: 2, isHuman: true  },
  { id: 1, name: 'Bot 1', color: 'var(--player-1)', side: 'top',      pentSide: 0, isHuman: false },
  { id: 2, name: 'Bot 2', color: 'var(--player-2)', side: 'right',    pentSide: 1, isHuman: false },
  { id: 3, name: 'Bot 3', color: 'var(--player-3)', side: 'left',     pentSide: 3, isHuman: false },
  { id: 4, name: 'Bot 4', color: 'var(--player-4)', side: 'top-left', pentSide: 4, isHuman: false },
];

// En mode 5 joueurs, le plateau devient un vrai pentagone régulier.
// Les 5 côtés ont la même longueur et chaque joueur possède un côté de départ
// et un côté d'arrivée distincts. La grille reste discrète pour conserver les
// règles de déplacement/barrières existantes.
const PENTAGON_VERTICES = [
  [0.50, 0.00], [0.975528, 0.345492], [0.793893, 0.904508],
  [0.206107, 0.904508], [0.024472, 0.345492]
];
const PENTAGON_GOAL_SIDE = { 0: 2, 1: 3, 2: 4, 3: 0, 4: 1 };

function isPentagonMode() { return getSelectedPlayersCount() === 5; }

function pointInPentagon(x, y) {
  let inside = false;
  for (let i = 0, j = PENTAGON_VERTICES.length - 1; i < PENTAGON_VERTICES.length; j = i++) {
    const xi = PENTAGON_VERTICES[i][0], yi = PENTAGON_VERTICES[i][1];
    const xj = PENTAGON_VERTICES[j][0], yj = PENTAGON_VERTICES[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPlayableCell(r, c) {
  if (!isPentagonMode()) return true;

  // Une case n'est jouable que si ses 4 coins restent dans le pentagone.
  // Ainsi aucune case n'est coupée par un côté incliné : toutes les cases
  // visibles sont entières.
  const m = pentMetrics();
  const boardSize = boardPixelSize();
  const { x, y } = cellPixelPos(r, c);
  const inset = 0.8;
  const x0 = (x + inset) / boardSize;
  const y0 = (y + inset) / boardSize;
  const x1 = (x + m.cell - inset) / boardSize;
  const y1 = (y + m.cell - inset) / boardSize;
  return pointInPentagon(x0, y0) &&
         pointInPentagon(x1, y0) &&
         pointInPentagon(x0, y1) &&
         pointInPentagon(x1, y1);
}

function pentagonSideDistance(x, y, sideIndex) {
  const a = PENTAGON_VERTICES[sideIndex];
  const b = PENTAGON_VERTICES[(sideIndex + 1) % PENTAGON_VERTICES.length];
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = x - a[0], wy = y - a[1];
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  const px = a[0] + t * vx, py = a[1] + t * vy;
  return Math.hypot(x - px, y - py);
}

function nearestPlayableCellToPentSide(sideIndex) {
  let best = null, bestScore = Infinity;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!isPlayableCell(r, c)) continue;
    const x = (c + 0.5) / N, y = (r + 0.5) / N;
    const a = PENTAGON_VERTICES[sideIndex];
    const b = PENTAGON_VERTICES[(sideIndex + 1) % PENTAGON_VERTICES.length];
    const midX = (a[0] + b[0]) / 2, midY = (a[1] + b[1]) / 2;
    const score = pentagonSideDistance(x, y, sideIndex) + Math.hypot(x - midX, y - midY) * 0.35;
    if (score < bestScore) { bestScore = score; best = { row: r, col: c }; }
  }
  return best;
}

function getSelectedPlayersCount() {
  const value = parseInt(localStorage.getItem(CONFIG.MODE_KEY) || '4', 10);
  return Number.isInteger(value) && value >= 2 && value <= 5 ? value : 4;
}
function setSelectedPlayersCount(count) {
  if (count >= 2 && count <= 5) localStorage.setItem(CONFIG.MODE_KEY, String(count));
}



// ============================================================
// MODE CHAOS — cases spéciales
// ============================================================
const CHAOS_MODE = 'chaos';
const CHAOS_SPECIALS = [
  { id:'replay',  icon:'↻', name:'Rejoue',       desc:'Tu rejoues immédiatement.', cls:'special-replay' },
  { id:'swap',    icon:'⇄', name:'Échange',      desc:'Ta position est échangée avec un adversaire.', cls:'special-swap' },
  { id:'ghost',   icon:'◈', name:'Passe-muraille',desc:'Ton prochain déplacement peut traverser une barrière.', cls:'special-ghost' },
  { id:'turbo',   icon:'»', name:'Turbo',         desc:'Ton prochain déplacement peut aller jusqu’à 2 cases.', cls:'special-turbo' },
  { id:'shield',  icon:'◆', name:'Bouclier',     desc:'Tu bloques le prochain effet négatif.', cls:'special-shield' },
  { id:'skip',    icon:'×', name:'Piège',        desc:'Tu perdras ton prochain tour.', cls:'special-skip' },
  { id:'magnet',  icon:'●', name:'Aimant',       desc:'Le joueur adverse le plus proche est attiré vers toi.', cls:'special-magnet' },
  { id:'teleport',icon:'✦', name:'Téléportation', desc:'Tu es envoyé vers une case libre aléatoire.', cls:'special-teleport' }
];

function isChaosMode() { return localStorage.getItem(CONFIG.GAME_MODE_KEY) === CHAOS_MODE; }
function setGameMode(mode) {
  localStorage.setItem(CONFIG.GAME_MODE_KEY, mode === CHAOS_MODE ? CHAOS_MODE : 'classic');
}
function getGameMode() { return isChaosMode() ? CHAOS_MODE : 'classic'; }
function chaosSpecialById(id) { return CHAOS_SPECIALS.find(x=>x.id===id); }
function chaosKey(r,c) { return `${r},${c}`; }
function getChaosSpecial(r,c) { return state && state.specialCells ? state.specialCells.get(chaosKey(r,c)) : null; }
function chaosCandidates(players) {
  const candidates=[];
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) {
    if(!isPlayableCell(r,c)) continue;
    if(players.some(p=>p.row===r && p.col===c)) continue;
    // Évite de remplir les cases immédiatement autour des départs.
    if(players.some(p=>Math.abs(p.row-r)+Math.abs(p.col-c)<=1)) continue;
    candidates.push([r,c]);
  }
  return candidates;
}
function generateChaosSpecialCells(players) {
  const map=new Map();
  const candidates=chaosCandidates(players);
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const types=CHAOS_SPECIALS.map(x=>x.id);
  for(let i=types.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
  const count=Math.min(CONFIG.CHAOS_SPECIAL_COUNT,candidates.length,types.length);
  for(let i=0;i<count;i++) map.set(chaosKey(candidates[i][0],candidates[i][1]),types[i]);
  return map;
}
function renderChaosSpecialCells() {
  // Les cases spéciales sont des cases du plateau : on ne doit surtout pas
  // supprimer les éléments .cell eux-mêmes quand une case est consommée.
  document.querySelectorAll('.chaos-special-cell').forEach(el=>{
    el.classList.remove('chaos-special-cell');
    el.removeAttribute('data-special');
    el.removeAttribute('title');
    el.innerHTML='';
  });
  if(!state || !isChaosMode()) return;
  for(const [key,id] of state.specialCells.entries()){
    const [r,c]=key.split(',').map(Number); const cell=document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`); const info=chaosSpecialById(id);
    if(!cell || !info) continue;
    cell.classList.add('chaos-special-cell',info.cls); cell.dataset.special=id; cell.innerHTML=`<span class="chaos-special-mystery">?</span>`; cell.title='Case spéciale';
  }
}
function showChaosTrigger(player, info) {
  const frame=document.getElementById('board-frame'), pawn=document.getElementById('pawn-'+player.id); if(!frame||!pawn)return;
  const br=frame.getBoundingClientRect(), pr=pawn.getBoundingClientRect();
  const fx=document.createElement('div'); fx.className=`chaos-trigger ${info.cls}`; fx.innerHTML=`<div class="chaos-trigger-ring"></div><strong>${info.icon}</strong><span>${info.name}</span>`;
  fx.style.left=(pr.left-br.left+pr.width/2)+'px'; fx.style.top=(pr.top-br.top+pr.height/2)+'px'; frame.appendChild(fx); setTimeout(()=>fx.remove(),1100);
}
function getMovementNeighbors(player,r,c) {
  const deltas=[[-1,0],[1,0],[0,-1],[0,1]], out=[];
  const ignoreWalls=(player.wallPassMoves||0)>0;
  for(const [dr,dc] of deltas){const nr=r+dr,nc=c+dc;if(nr<0||nr>=N||nc<0||nc>=N||!isPlayableCell(nr,nc))continue;if(ignoreWalls||isEdgeOpen(r,c,nr,nc))out.push([nr,nc]);}
  return out;
}
function getChaosReachableCells(player,maxSteps) {
  const seen=new Map([[chaosKey(player.row,player.col),0]]), q=[[player.row,player.col]];
  for(let qi=0;qi<q.length;qi++){
    const [r,c]=q[qi], d=seen.get(chaosKey(r,c)); if(d>=maxSteps)continue;
    for(const [nr,nc] of getMovementNeighbors(player,r,c)){
      if(isCellOccupied(nr,nc,player.id)) continue;
      const k=chaosKey(nr,nc); if(!seen.has(k)){seen.set(k,d+1);q.push([nr,nc]);}
    }
  }
  seen.delete(chaosKey(player.row,player.col)); return [...seen.keys()].map(k=>k.split(',').map(Number));
}
function movePlayerToward(target, mover) {
  const opts=getValidMoveCells(target); if(!opts.length)return false;
  opts.sort((a,b)=>Math.abs(a[0]-mover.row)+Math.abs(a[1]-mover.col)-Math.abs(b[0]-mover.row)-Math.abs(b[1]-mover.col));
  movePawn(target,opts[0][0],opts[0][1]); return true;
}
function resolveChaosCell(player) {
  if(!isChaosMode() || !state || state.gameOver) return false;
  const id=getChaosSpecial(player.row,player.col); if(!id)return false;
  const info=chaosSpecialById(id); if(!info)return false;
  // La case reste en place mais ne se redéclenche pas immédiatement si un effet téléporte dessus.
  state.specialCells.delete(chaosKey(player.row,player.col));
  const protectedPlayer = player.chaosShield>0;
  showChaosTrigger(player,info); playSound('card'); showMessage(`${info.icon} ${info.name} — ${info.desc}`,2800);
  if(id==='replay') state.extraTurnForId=player.id;
  else if(id==='ghost') player.wallPassMoves=1;
  else if(id==='turbo') player.chaosBonusSteps=2;
  else if(id==='shield') player.chaosShield=1;
  else if(id==='skip') { if(protectedPlayer){player.chaosShield=0;showMessage('🛡️ Ton bouclier a bloqué le piège !',2500);} else player.skipNextTurn=true; }
  else if(id==='swap') {
    if(protectedPlayer){player.chaosShield=0;showMessage('🛡️ Ton bouclier a bloqué l’échange !',2500);}
    else { const opps=state.players.filter(p=>p.id!==player.id); if(opps.length){const opp=opps[Math.floor(Math.random()*opps.length)]; const old={row:player.row,col:player.col}; player.row=opp.row;player.col=opp.col;opp.row=old.row;opp.col=old.col;renderPawns();} }
  }
  else if(id==='magnet') {
    if(protectedPlayer){player.chaosShield=0;showMessage('🛡️ Ton bouclier a bloqué l’aimant !',2500);}
    else { const opps=state.players.filter(p=>p.id!==player.id).sort((a,b)=>(Math.abs(a.row-player.row)+Math.abs(a.col-player.col))-(Math.abs(b.row-player.row)+Math.abs(b.col-player.col))); if(opps[0]){movePlayerToward(opps[0],player);renderPawns();} }
  }
  else if(id==='teleport') {
    const opts=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(isPlayableCell(r,c)&&!isCellOccupied(r,c,player.id))opts.push([r,c]);
    if(opts.length){const [r,c]=opts[Math.floor(Math.random()*opts.length)];player.row=r;player.col=c;renderPawns();}
  }
  renderChaosSpecialCells(); refreshHighlights();
  return true;
}

let state = null;
let uiLocked = false;
let tutorialActive = false;
let tutorialStep = 0;
let tutorialStepStartedAt = 0;
let tutorialCoachHidden = false;
let tutorialTransitionToken = 0;
let tutorialBusy = false;
const TUTORIAL_MIN_STEP_MS = 1800;
const TUTORIAL_KEY = 'quoridor4_tutorial_completed';

function createNewGameState() {
  const count = isChaosMode() ? 4 : getSelectedPlayersCount();
  const mid = Math.floor(N / 2);
  const startPositions = {
    bottom: { row: N - 1, col: mid }, top: { row: 0, col: mid },
    left: { row: mid, col: 0 }, right: { row: mid, col: N - 1 },
    'top-left': { row: 0, col: 0 }
  };
  const wallsPerPlayer = count === 2 ? 8 : count === 3 ? 6 : count === 4 ? 5 : 4;
  const players = ALL_PLAYER_DEFS.slice(0, count).map(def => {
    const pos = count === 5 ? nearestPlayableCellToPentSide(def.pentSide) : startPositions[def.side];
    const playerName = def.isHuman ? getPlayerName() : def.name;
    return { ...def, name: playerName, row: pos.row, col: pos.col, wallsLeft: wallsPerPlayer, botTurns: 0, lastWallTargetId: null };
  });
  const gameState = {
    players, currentPlayerIndex: 0, walls: new Set(), jointOrientations: new Map(), wallOwners: new Map(),
    mode: 'move', orientation: 'H', gameOver: false, difficulty: getDifficultyKey(),
    trophies: loadTrophies(), coins: loadCoins(),
    cardHand: drawHand(), cardUsed: new Set(), pendingFreeWall: false, pendingBreakWall: false, extraTurn: false, extraTurnForId: null, cardPlayedThisTurn: false, cardActivationPending: false, visionCells: [],
    chaos: getGameMode() === CHAOS_MODE, specialCells: new Map(), tutorial: false
  };
  state = gameState;
  if (gameState.chaos) gameState.specialCells = generateChaosSpecialCells(players);
  return gameState;
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
    if (!isPlayableCell(nr, nc)) continue;
    if (isEdgeOpen(r, c, nr, nc)) result.push([nr, nc]);
  }
  return result;
}

function isGoalCell(side, r, c) {
  if (isPentagonMode()) {
    const player = ALL_PLAYER_DEFS.find(p => p.side === side);
    if (!player) return false;
    const goalSide = PENTAGON_GOAL_SIDE[player.pentSide];
    if (!isPlayableCell(r, c)) return false;
    const x = (c + 0.5) / N, y = (r + 0.5) / N;
    return pentagonSideDistance(x, y, goalSide) <= 0.18;
  }
  const fivePlayers = false;
  const mid = Math.floor(N / 2);
  if (side === 'bottom') return r === 0;
  if (side === 'top') return r === N - 1;
  if (side === 'left') return c === N - 1;
  if (side === 'right') return c === 0;
  if (side === 'top-left') return false;
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
      if (isPlayableCell(r, c) && isGoalCell(side, r, c)) { dist[r][c] = 0; queue.push([r, c]); }
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
  const steps = player.chaosBonusSteps || 1;
  if (isChaosMode() && steps > 1) return getChaosReachableCells(player, steps);
  return getMovementNeighbors(player, player.row, player.col).filter(([r, c]) => !isCellOccupied(r, c, player.id));
}

function movePawn(player, r, c) {
  const changed = player.row !== r || player.col !== c;
  player.row = r; player.col = c;
  if (changed) { playSound('move'); }
}

function getWallEdges(i, j, orientation) {
  if (orientation === 'H') { return [ edgeKey(i, j, i + 1, j), edgeKey(i, j + 1, i + 1, j + 1) ]; } 
  else { return [ edgeKey(i, j, i, j + 1), edgeKey(i + 1, j, i + 1, j + 1) ]; }
}

function canPlaceWall(player, i, j, orientation, freeWall = false) {
  if (player.wallsLeft <= 0 && !freeWall) return { ok: false, reason: 'Plus aucune barrière disponible.' };
  if (i < 0 || i > N - 2 || j < 0 || j > N - 2) return { ok: false, reason: 'Position invalide.' };
  if (isPentagonMode()) {
    const requiredCells = orientation === 'H' ? [[i,j],[i,j+1],[i+1,j],[i+1,j+1]] : [[i,j],[i+1,j],[i,j+1],[i+1,j+1]];
    if (!requiredCells.every(([r,c]) => isPlayableCell(r,c))) return { ok: false, reason: 'Cette barrière est hors du plateau.' };
  }
  if (state.jointOrientations.has(`${i},${j}`)) return { ok: false, reason: 'Il y a déjà une barrière ici.' };

  const edges = getWallEdges(i, j, orientation);
  for (const e of edges) { if (state.walls.has(e)) return { ok: false, reason: 'Emplacement occupé.' }; }

  edges.forEach(e => state.walls.add(e));
  const everyoneHasPath = state.players.every(p => hasPathToGoal(p));
  edges.forEach(e => state.walls.delete(e));

  if (!everyoneHasPath) return { ok: false, reason: "Cette barrière bloquerait complètement un joueur." };
  return { ok: true, edges };
}

function placeWall(player, i, j, orientation, freeWall = false) {
  const check = canPlaceWall(player, i, j, orientation, freeWall);
  if (!check.ok) return false;
  check.edges.forEach(e => state.walls.add(e));
  state.jointOrientations.set(`${i},${j}`, orientation);
  state.wallOwners.set(`${i},${j}`, player.id);
  if (!freeWall) player.wallsLeft -= 1;
  renderWall(i, j, orientation);
  playSound('wall');
  updatePlayersHUD();
  return true;
}


/* ============================================================
   AUDIO — fichiers WAV locaux
   ============================================================ */
const AUDIO_KEY = 'quoridor4_audio_settings';
let audioEnabled = true;
let audioVolume = 0.65;
const audioBank = {};
const AUDIO_FILES = {click:'sounds/click.wav',move:'sounds/move.wav',wall:'sounds/wall.wav',turn:'sounds/turn.wav',card:'sounds/card.wav',pack:'sounds/pack.wav',win:'sounds/win.wav',lose:'sounds/lose.wav',test:'sounds/test.wav'};
function loadAudioSettings(){try{const raw=JSON.parse(localStorage.getItem(AUDIO_KEY)||'{}');audioEnabled=raw.enabled!==false;audioVolume=Number.isFinite(raw.volume)?Math.max(0,Math.min(1,raw.volume)):0.65;}catch(_){}}
function saveAudioSettings(){try{localStorage.setItem(AUDIO_KEY,JSON.stringify({enabled:audioEnabled,volume:audioVolume}));}catch(_) {}}
function preloadAudio(){Object.entries(AUDIO_FILES).forEach(([name,src])=>{const a=new Audio(src);a.preload='auto';a.volume=audioVolume;audioBank[name]=a;});}
function playSound(name){if(!audioEnabled)return;const base=audioBank[name];if(!base)return;try{const a=base.cloneNode(true);a.volume=audioVolume;a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(()=>{});}catch(_) {}}
function testAudio(){if(!audioEnabled){audioEnabled=true;saveAudioSettings();updateAudioControls();}playSound('test');}
function updateAudioControls(){const toggle=document.getElementById('audio-toggle'),slider=document.getElementById('audio-volume'),label=document.getElementById('audio-volume-label');if(toggle){toggle.textContent=audioEnabled?'🔊 Sons activés':'🔇 Sons désactivés';toggle.classList.toggle('selected',audioEnabled);}if(slider)slider.value=Math.round(audioVolume*100);if(label)label.textContent=Math.round(audioVolume*100)+'%';}
function toggleAudio(){audioEnabled=!audioEnabled;saveAudioSettings();updateAudioControls();if(audioEnabled)playSound('click');}
function setAudioVolume(v){audioVolume=Math.max(0,Math.min(1,Number(v)/100));saveAudioSettings();Object.values(audioBank).forEach(a=>a.volume=audioVolume);updateAudioControls();}
loadAudioSettings();
preloadAudio();

/* ============================================================
   5. TOURS DE JEU & IA BOTS
   ============================================================ */


function isTutorialCompleted() {
  return localStorage.getItem(TUTORIAL_KEY) === '1';
}
function setTutorialCompleted() {
  localStorage.setItem(TUTORIAL_KEY, '1');
}
function tutorialMessage() {
  const messages = [
    ['🎓 Bienvenue !', `Ton objectif est simple : ${getPlayerName()}, atteins la ligne opposée avant ton adversaire. Les cases vertes montrent où tu peux aller.`, 'Déplace ton pion sur une case verte.'],
    ['🧱 À toi de jouer', 'Tu peux maintenant poser une barrière. Elle sert à rallonger le chemin de ton adversaire.', 'Passe en mode « Barrière », puis place-en une sur le plateau.'],
    ['👀 Observe le tour adverse', 'Après ton action, le tour passe automatiquement à l’adversaire. Une partie alterne ainsi entre les joueurs.', 'Attends que le bot joue.'],
    ['🃏 Découvre les cartes', 'Les cartes donnent des capacités spéciales. Pour commencer, utilise ton Sprint : il te permet d’avancer plus loin.', 'Appuie sur la carte « Sprint » dans ta main.'],
    ['🏁 À toi de gagner', 'Tu connais maintenant les bases : déplacement, barrières, tours et cartes. Termine la partie en atteignant ton objectif.', 'Joue normalement jusqu’à atteindre le haut du plateau.']
  ];
  return messages[tutorialStep] || messages[4];
}
function ensureTutorialCoach() {
  let el = document.getElementById('tutorial-coach');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tutorial-coach';
    el.className = 'tutorial-coach hidden';
    el.innerHTML = `
      <div class="tutorial-coach-inner">
        <div class="tutorial-coach-step" id="tutorial-coach-step"></div>
        <div class="tutorial-coach-title" id="tutorial-coach-title"></div>
        <div class="tutorial-coach-text" id="tutorial-coach-text"></div>
        <div class="tutorial-coach-footer">
          <span class="tutorial-coach-progress" id="tutorial-coach-progress"></span>
          <div class="tutorial-coach-actions"><button type="button" class="tutorial-hide-btn hidden" id="tutorial-hide-btn">Masquer</button><button type="button" class="tutorial-skip-btn" id="tutorial-skip-btn">Quitter</button></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('tutorial-skip-btn').addEventListener('click', skipTutorial);
    document.getElementById('tutorial-hide-btn').addEventListener('click', toggleTutorialCoachVisibility);
  }
  return el;
}
function updateTutorialCoach() {
  if (!tutorialActive) return;
  const el = ensureTutorialCoach();
  const [title,text,action] = tutorialMessage();
  document.getElementById('tutorial-coach-step').textContent = `TUTORIEL · ${tutorialStep + 1}/5`;
  document.getElementById('tutorial-coach-title').textContent = title;
  document.getElementById('tutorial-coach-text').innerHTML = `${text}<br><strong>${action}</strong>`;
  const hideBtn = document.getElementById('tutorial-hide-btn');
  hideBtn.classList.toggle('hidden', tutorialStep !== 4);
  hideBtn.textContent = tutorialCoachHidden ? 'Afficher' : 'Masquer';
  if (tutorialStep !== 4) tutorialCoachHidden = false;
  el.classList.toggle('hidden', tutorialCoachHidden);
  // Le panneau lui-même laisse toujours passer les clics vers le jeu.
  el.style.pointerEvents = 'none';
  const inner = el.querySelector('.tutorial-coach-inner');
  if (inner) inner.style.pointerEvents = tutorialCoachHidden ? 'none' : 'auto';
  highlightTutorialTarget();
}
function toggleTutorialCoachVisibility() {
  if (!tutorialActive || tutorialStep !== 4) return;
  tutorialCoachHidden = !tutorialCoachHidden;
  const el = ensureTutorialCoach();
  const hideBtn = document.getElementById('tutorial-hide-btn');
  hideBtn.classList.remove('hidden');
  hideBtn.textContent = tutorialCoachHidden ? 'Afficher' : 'Masquer';
  // Masquer le coach ne doit jamais bloquer la partie : le jeu reste totalement interactif.
  if (tutorialCoachHidden) {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    el.style.pointerEvents = 'none';
    if (state && !state.gameOver) { uiLocked = false; tutorialBusy = false; state.cardActivationPending = false; }
  } else {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.style.pointerEvents = 'none';
    const inner = el.querySelector('.tutorial-coach-inner');
    if (inner) inner.style.pointerEvents = 'auto';
    highlightTutorialTarget();
  }
}
function highlightTutorialTarget() {
  document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
  if (!tutorialActive || !state || state.gameOver) return;
  if (tutorialStep === 0) {
    document.querySelectorAll('.cell.valid-move').forEach(el => el.classList.add('tutorial-focus'));
  } else if (tutorialStep === 1) {
    const btn = document.getElementById('mode-wall-btn'); if (btn) btn.classList.add('tutorial-focus');
  } else if (tutorialStep === 3) {
    const btn = document.querySelector('#card-bar .game-card-btn'); if (btn) btn.classList.add('tutorial-focus');
  }
}
function advanceTutorial(step) {
  if (!tutorialActive) return;
  if (step < tutorialStep) return;
  tutorialTransitionToken++;
  tutorialStep = step;
  tutorialStepStartedAt = Date.now();
  tutorialCoachHidden = false;
  tutorialBusy = false;
  uiLocked = false;

  // À l'entrée dans la phase finale, on repart sur un état de tour propre.
  // Ceci coupe définitivement toute trace de l'animation/carte de l'étape 4
  // et garantit que le joueur humain récupère la main avant de continuer.
  if (step === 4 && state && state.tutorial) {
    const humanIndex = state.players.findIndex(p => p.isHuman);
    if (humanIndex >= 0) state.currentPlayerIndex = humanIndex;
    state.gameOver = false;
    state.cardActivationPending = false;
    state.cardPlayedThisTurn = false;
    state.pendingFreeWall = false;
    state.pendingBreakWall = false;
    document.getElementById('card-activation-overlay')?.remove();
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
    setMode('move');
    refreshHighlights();
  }

  updateTutorialCoach();
  refreshHighlights();
  renderCardBar();
  setTimeout(highlightTutorialTarget, 30);
}
function skipTutorial() {
  const restoreMode = tutorialPreviousMode;
  tutorialActive = false;
  tutorialTransitionToken++;
  tutorialStep = 0;
  tutorialCoachHidden = false;
  tutorialBusy = false;
  document.getElementById('tutorial-coach')?.remove();
  uiLocked = false;
  if (state) state.gameOver = true;
  setGameMode(restoreMode);
  showScreen('menu');
}
function finishTutorial() {
  if (!tutorialActive) return;
  // Garde la dernière étape visible assez longtemps, même si le joueur
  // atteint l'objectif très rapidement avec Sprint.
  const elapsed = Date.now() - tutorialStepStartedAt;
  if (tutorialStep === 4 && elapsed < TUTORIAL_MIN_STEP_MS) {
    const token = tutorialTransitionToken;
    setTimeout(() => { if (tutorialActive && tutorialStep === 4 && tutorialTransitionToken === token) finishTutorial(); }, TUTORIAL_MIN_STEP_MS - elapsed);
    return;
  }
  const restoreMode = tutorialPreviousMode;
  tutorialActive = false;
  setTutorialCompleted();
  addCoins(100);
  document.getElementById('tutorial-coach')?.remove();
  const modal = document.createElement('div');
  modal.className = 'tutorial-complete-overlay';
  modal.innerHTML = `<div class="tutorial-complete-card">
    <div class="tutorial-complete-icon">🎓</div>
    <div class="tutorial-complete-kicker">TUTORIEL TERMINÉ</div>
    <h2>Tu es prêt.</h2>
    <p>Tu connais maintenant les mécaniques essentielles de Quoridor 4.</p>
    <div class="tutorial-complete-reward">+100 🪙</div>
    <button type="button" id="tutorial-complete-btn">JOUER UNE VRAIE PARTIE <span>›</span></button>
    <button type="button" id="tutorial-complete-menu" class="tutorial-complete-secondary">Retour au menu</button>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('tutorial-complete-btn').addEventListener('click', () => { modal.remove(); setGameMode(restoreMode); showScreen('menu'); updateMenuDisplays(); startGame(); });
  document.getElementById('tutorial-complete-menu').addEventListener('click', () => { modal.remove(); setGameMode(restoreMode); showScreen('menu'); updateMenuDisplays(); });
}
function startTutorial() {
  closeMenuPanel();
  hideEndModal();
  tutorialPreviousMode = getGameMode();
  // Le tutoriel est toujours une partie classique : aucune case spéciale,
  // même si le joueur avait sélectionné le Mode Chaos avant de l'ouvrir.
  setGameMode('classic');
  tutorialActive = true;
  tutorialTransitionToken++;
  tutorialStep = 0;
  tutorialStepStartedAt = Date.now();
  tutorialCoachHidden = false;
  uiLocked = false;
  showScreen('game');
  state = createNewGameState();
  state.tutorial = true;
  const defs = ALL_PLAYER_DEFS.slice(0,2);
  state.players = defs.map((def, idx) => {
    const pos = idx === 0 ? {row:N-1,col:Math.floor(N/2)} : {row:0,col:Math.floor(N/2)};
    return { ...def, name: def.isHuman ? getPlayerName() : 'Guide', row:pos.row, col:pos.col, wallsLeft:8, botTurns:0, lastWallTargetId:null };
  });
  state.trophies = loadTrophies(); state.coins = loadCoins();
  state.walls = new Set(); state.jointOrientations = new Map(); state.wallOwners = new Map();
  state.cardHand = ['sprint','freewall','doublemove']; state.cardUsed = new Set();
  state.cardPlayedThisTurn=false; state.cardActivationPending=false; state.pendingFreeWall=false; state.pendingBreakWall=false;
  const frame = document.getElementById('board-frame');
  if (frame) { frame.classList.remove('mode-5','mode-chaos'); }
  applyBoardTheme(); buildBoardDOM(); renderChaosSpecialCells();
  document.getElementById('players-hud').innerHTML=''; renderPawns(); updatePlayersHUD(); updateGoalBarsDisplay(); renderCardBar(); renderEmoteBar();
  setMode('move'); hideEndModal();
  ensureTutorialCoach(); updateTutorialCoach();
  beginTurn();
}

function startGame() {
  tutorialActive = false;
  document.getElementById('tutorial-coach')?.remove();
  uiLocked = false;
  showScreen('game');
  state = createNewGameState();
  state.players.forEach(p=>{p.movesThisGame=0;p.wallsPlacedThisGame=0;p.cardsUsedThisGame=0;});
  const frame = document.getElementById('board-frame');
  if (frame) { frame.classList.toggle('mode-5', state.players.length === 5); frame.classList.toggle('mode-chaos', state.chaos); }
  applyBoardTheme();
  buildBoardDOM();
  renderChaosSpecialCells();
  document.getElementById('players-hud').innerHTML = ''; 
  renderPawns();
  updateTrophyDisplay();
  updateCoinDisplay();
  updatePlayersHUD();
  updateGoalBarsDisplay();
  renderCardBar();
  renderEmoteBar();
  updateTurnIndicator();
  clearWallsFromDOM();
  setMode('move');
  hideEndModal();
  showMessage(state.chaos ? '🌀 MODE CHAOS — Les cases spéciales peuvent tout changer !' : '');
  beginTurn();
}

function beginTurn() {
  if (state.gameOver) return;
  const player = currentPlayer();
  updateTurnIndicator();
  updatePlayersHUD();
  renderCardBar();
  if (player.isHuman) playSound('turn');

  if (player.isHuman) {
    // In tutorial final phase, never let a stale UI lock survive a turn transition.
    if (tutorialActive && state.tutorial) { uiLocked = false; tutorialBusy = false; }
    setMode('move'); refreshHighlights(); highlightTutorialTarget();
  } else { clearHighlights(); setTimeout(() => runBotTurn(player), CONFIG.BOT_MOVE_DELAY_MS); }
}

function endTurn() {
  if (state.gameOver) return;
  clearHighlights();
  // Une seule carte maximum pendant chaque tour. Le compteur est réinitialisé
  // avant un nouveau tour, y compris lorsqu'une carte donne un tour bonus.
  state.cardPlayedThisTurn = false;
  state.cardActivationPending = false;
  if (state.extraTurnForId === currentPlayer().id) { state.extraTurnForId = null; beginTurn(); return; }
  if (state.extraTurn && currentPlayer().isHuman) { state.extraTurn = false; beginTurn(); return; }
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const next = currentPlayer();
  if (next.skipNextTurn) { next.skipNextTurn = false; showMessage(`🚫 ${next.isHuman?'Tu':next.name} passes son tour !`,2200); state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length; }
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

  if (tutorialActive && state.tutorial) {
    player.botTurns = (player.botTurns || 0) + 1;

    const safeMoves = getValidMoveCells(player)
      .filter(([r, c]) => !isGoalCell(player.side, r, c));

    if (safeMoves.length) {
      const [r, c] = safeMoves[Math.floor(Math.random() * safeMoves.length)];
      movePawn(player, r, c);
      renderPawns();
    }

    if (tutorialStep === 2) {
      setTimeout(() => {
        if (state.gameOver || !tutorialActive || tutorialStep !== 2) return;
        advanceTutorial(3);
        if (!state.gameOver && tutorialActive) {
          state.currentPlayerIndex = state.players.findIndex(p => p.isHuman);
          if (state.currentPlayerIndex < 0) state.currentPlayerIndex = 0;
          beginTurn();
          setMode('move');
        }
      }, 850);
      return;
    }

    if (tutorialStep >= 4) {
      setTimeout(() => {
        if (state.gameOver || !tutorialActive || !state.tutorial) return;
        tutorialBusy = false;
        uiLocked = false;
        state.cardActivationPending = false;
        state.cardPlayedThisTurn = false;
        const humanIndex = state.players.findIndex(p => p.isHuman);
        if (humanIndex < 0) return;
        state.currentPlayerIndex = humanIndex;
        beginTurn();
      }, 700);
      return;
    }

    return;
  }

  const difficulty = getDifficultyInfo();
  let actionDone = false;
  player.botTurns = (player.botTurns || 0) + 1;

  /*
   * Gestion intelligente des barrières :
   * l'IA ne doit plus les gaspiller au début.
   * Plus la partie avance ou plus un adversaire est proche
   * de gagner, plus elle accepte d'utiliser une barrière.
   */
  let wallProbability = difficulty.wallProbability;

  const turnNumber = player.botTurns || 1;

  const opponents = state.players.filter(p => p.id !== player.id);
  let closestOpponentDistance = 999;

  for (const opponent of opponents) {
    const d = computeGoalDistances(opponent.side)[opponent.row][opponent.col];
    if (Number.isFinite(d)) {
      closestOpponentDistance = Math.min(closestOpponentDistance, d);
    }
  }

  if (difficulty === DIFFICULTIES.expert) {
    // Début de partie : priorité absolue à la course.
    if (turnNumber <= 3) {
      wallProbability *= 0.10;
    } else if (turnNumber <= 6) {
      wallProbability *= 0.25;
    } else if (turnNumber <= 9) {
      wallProbability *= 0.50;
    }

    // Une barrière devient beaucoup plus intéressante si quelqu'un
    // est réellement proche de son objectif.
    if (closestOpponentDistance <= 2) {
      wallProbability = Math.max(wallProbability, 0.95);
    } else if (closestOpponentDistance <= 4) {
      wallProbability = Math.max(wallProbability, 0.70);
    } else if (closestOpponentDistance <= 6) {
      wallProbability = Math.max(wallProbability, 0.35);
    }
  } else if (difficulty === DIFFICULTIES.hard) {
    if (turnNumber <= 3) {
      wallProbability *= 0.30;
    } else if (turnNumber <= 6) {
      wallProbability *= 0.60;
    }

    if (closestOpponentDistance <= 3) {
      wallProbability = Math.max(wallProbability, 0.75);
    }
  } else if (difficulty === DIFFICULTIES.normal) {
    if (turnNumber <= 3) {
      wallProbability *= 0.35;
    }
  } else {
    // Facile : très peu de barrières au début.
    if (turnNumber <= 4) {
      wallProbability *= 0.20;
    }
  }

  if (player.wallsLeft <= 1) wallProbability *= 0.35;
  else if (player.wallsLeft === 2) wallProbability *= 0.65;

  if (player.wallsLeft > 0 && Math.random() < wallProbability) {
    actionDone = botTryPlaceBlockingWall(player, difficulty);
  }

  if (!actionDone) actionDone = botTryMove(player, difficulty);
  if (!actionDone) showMessage(`${player.name} passe son tour.`);

  setTimeout(() => { if (!state.gameOver) endTurn(); }, 250);
}

function botTryMove(player, difficulty = getDifficultyInfo()) {
  const dist = computeGoalDistances(player.side);
  const candidates = getValidMoveCells(player);
  if (!candidates.length) return false;

  // Facile : erreurs volontaires.
  if (difficulty.moveRandomness > 0 && Math.random() < difficulty.moveRandomness) {
    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    movePawn(player, r, c);
    if (player.wallPassMoves) player.wallPassMoves = 0;
    renderPawns();
    if (checkWinAfterMove(player)) return true;
    resolveChaosCell(player);
    checkWinAfterMove(player);
    return true;
  }

  const scored = candidates.map(([r, c]) => {
    const distance = dist[r][c];
    let score = Number.isFinite(distance) ? -distance * 100 : -100000;

    score += neighborsOpen(r, c).length * (
      difficulty === DIFFICULTIES.expert ? 7 :
      difficulty === DIFFICULTIES.hard ? 4 : 2
    );

    if (isGoalCell(player.side, r, c)) score += 100000;

    // Aux niveaux élevés, l'IA vérifie si un adversaire est proche de gagner.
    if (difficulty.lookAhead >= 1) {
      const closestOpponent = state.players
        .filter(p => p.id !== player.id)
        .map(p => {
          const d = computeGoalDistances(p.side)[p.row][p.col];
          return Number.isFinite(d) ? d : 999;
        })
        .reduce((best, d) => Math.min(best, d), 999);

      if (closestOpponent <= 3 && Number.isFinite(distance)) {
        score += 100 - distance * 5;
      }
    }

    return { r, c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let choice;

  if (difficulty === DIFFICULTIES.easy) {
    const pool = scored.slice(0, Math.min(2, scored.length));
    choice = pool[Math.floor(Math.random() * pool.length)];
  } else if (difficulty === DIFFICULTIES.normal) {
    const pool = scored.slice(0, Math.min(3, scored.length));
    choice = pool[Math.floor(Math.random() * pool.length)];
  } else {
    choice = scored[0];
  }

  if (isChaosMode() && player.chaosBonusSteps > 1) {
    const reachable = getChaosReachableCells(player, player.chaosBonusSteps);
    if (reachable.length) {
      reachable.sort((a, b) => dist[a[0]][a[1]] - dist[b[0]][b[1]]);
      choice = { r: reachable[0][0], c: reachable[0][1] };
    }
    player.chaosBonusSteps = 0;
  }

  if (!choice) return false;

  if (player.wallPassMoves) player.wallPassMoves = 0;

  movePawn(player, choice.r, choice.c);
  renderPawns();

  if (checkWinAfterMove(player)) return true;
  resolveChaosCell(player);
  checkWinAfterMove(player);
  return true;
}

function getBotTarget(player) {
  const opponents = state.players.filter(p => p.id !== player.id);
  if (!opponents.length) return null;

  const ranked = opponents.map(opponent => {
    const distance = computeGoalDistances(opponent.side)[opponent.row][opponent.col];
    let score = Number.isFinite(distance) ? 1000 - distance * 100 : -100000;
    score += Math.max(0, 5 - (opponent.wallsLeft || 0)) * 8;
    return { opponent, score };
  }).sort((a, b) => b.score - a.score);

  // Facile : cible parfois quelqu'un d'autre.
  if (getDifficultyInfo() === DIFFICULTIES.easy && Math.random() < 0.35) {
    return opponents[Math.floor(Math.random() * opponents.length)];
  }

  return ranked[0].opponent;
}

function botTryPlaceBlockingWall(player, difficulty = getDifficultyInfo()) {
  const target = getBotTarget(player);
  if (!target) return false;

  player.lastWallTargetId = target.id;

  const targetDistancesBefore = computeGoalDistances(target.side);
  const ownDistancesBefore = computeGoalDistances(player.side);

  const targetDistBefore = targetDistancesBefore[target.row][target.col];
  const ownDistBefore = ownDistancesBefore[player.row][player.col];

  if (!Number.isFinite(targetDistBefore)) return false;

  const candidates = [];
  const radius = Math.min(N, difficulty.wallRadius);

  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      if (
        difficulty.wallRadius < 99 &&
        (Math.abs(i - target.row) > radius + 1 ||
         Math.abs(j - target.col) > radius + 1)
      ) continue;

      candidates.push([i, j, 'H'], [i, j, 'V']);
    }
  }

  // Facile/Normal ne recherchent pas toujours dans le même ordre.
  if (difficulty === DIFFICULTIES.easy || difficulty === DIFFICULTIES.normal) {
    candidates.sort(() => Math.random() - 0.5);
  }

  let best = null;
  let bestScore = -Infinity;
  let checked = 0;

  for (const [i, j, orientation] of candidates) {
    if (checked >= difficulty.wallAttempts) break;
    checked++;

    const check = canPlaceWall(player, i, j, orientation);
    if (!check.ok) continue;

    check.edges.forEach(edge => state.walls.add(edge));

    const targetDistAfter =
      computeGoalDistances(target.side)[target.row][target.col];
    const ownDistAfter =
      computeGoalDistances(player.side)[player.row][player.col];

    check.edges.forEach(edge => state.walls.delete(edge));

    if (!Number.isFinite(targetDistAfter)) continue;

    const targetGain = targetDistAfter - targetDistBefore;
    const ownCost = ownDistAfter - ownDistBefore;

    let score = targetGain * 150 - Math.max(0, ownCost) * 45;

    if (targetDistBefore <= 4) score += targetGain * 80;

    if (difficulty === DIFFICULTIES.hard) {
      score += targetDistAfter * 2;
    }

    if (difficulty === DIFFICULTIES.expert) {
      score += targetDistAfter * 5;
      if (targetGain >= 2) score += 30;
      if (targetGain >= 4) score += 60;

      // Si l'IA est elle-même proche de gagner, elle conserve davantage ses murs.
      if (ownDistBefore <= 3) {
        score -= Math.max(0, targetGain) * 20;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = [i, j, orientation];
    }
  }

  const minimumGain =
    difficulty === DIFFICULTIES.expert ? 2.0 :
    difficulty === DIFFICULTIES.hard ? 1.2 :
    difficulty === DIFFICULTIES.normal ? 0.8 : 0.5;

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
  const claimed = loadClaimedRewards();
  if (claimed.includes(req)) return;
  claimed.push(req);
  localStorage.setItem(CONFIG.CLAIMED_REWARDS_KEY, JSON.stringify(claimed));
  addCoins(amount);
  openMenuPanel('trophies');
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
    shop = { owned: ['classic'], equipped: 'classic', effectOwned: ['trail'], effectEquipped: 'trail', boardOwned: ['classic'] };
  } else {
    try {
      const parsed = JSON.parse(raw);
      shop = {
        owned: Array.isArray(parsed.owned) ? parsed.owned.slice() : ['classic'],
        equipped: typeof parsed.equipped === 'string' ? parsed.equipped : 'classic',
        effectOwned: Array.isArray(parsed.effectOwned) ? parsed.effectOwned.slice() : ['trail'],
        effectEquipped: typeof parsed.effectEquipped === 'string' ? parsed.effectEquipped : 'trail',
        boardOwned: Array.isArray(parsed.boardOwned) ? parsed.boardOwned.slice() : ['classic'],
      };
    } catch {
      shop = { owned: ['classic'], equipped: 'classic', effectOwned: ['trail'], effectEquipped: 'trail', boardOwned: ['classic'] };
    }
  }
  if (!Array.isArray(shop.effectOwned)) shop.effectOwned = ['trail'];
  if (!Array.isArray(shop.boardOwned)) shop.boardOwned = ['classic'];
  if (!shop.boardOwned.includes('classic')) shop.boardOwned.unshift('classic');
  if (!shop.effectOwned.includes('trail')) shop.effectOwned.unshift('trail');
  if (!EFFECTS.some(e => e.id === shop.effectEquipped) || !shop.effectOwned.includes(shop.effectEquipped)) shop.effectEquipped = 'trail';
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
  pawnEl.className = 'pawn pawn-skin pawn-skin-' + (skin.shape || 'classic');
  pawnEl.style.background = skin.bg || 'var(--player-0)';
  pawnEl.style.border = '2px solid rgba(255,255,255,0.85)';
  pawnEl.style.setProperty('--pawn-glow', skin.glow ? `0 0 14px ${skin.glow}` : '0 0 0 rgba(0,0,0,0)');
      pawnEl.style.removeProperty('--pawn-icon');
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
  const glowStyle = `${skin.glow ? `box-shadow:0 0 14px ${skin.glow}, 0 3px 6px rgba(0,0,0,0.35);` : ''} --pawn-icon:${JSON.stringify(skin.icon || '')};`;

  let actionHTML;
  if (isEquipped) actionHTML = `<div class="shop-badge equipped">✓ ÉQUIPÉ</div>`;
  else if (isOwned) actionHTML = `<button class="shop-action-btn equip-btn" onclick="equipSkinFromShop('${skin.id}')">ÉQUIPER</button>`;
  else actionHTML = `<button class="shop-action-btn buy-btn" onclick="buySkinFromShop('${skin.id}')">ACHETER</button>`;

  return `
    <div class="shop-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}" id="shop-card-${skin.id}">
      <div class="shop-pawn-preview pawn-skin pawn-skin-${skin.shape || 'classic'}" style="background:${skin.bg || 'var(--player-0)'};${glowStyle}"><span class="shop-pawn-icon">${skin.icon || ''}</span></div>
      <div class="shop-card-name">${skin.name.toUpperCase()}</div>
      <div class="shop-card-price">${priceLabel}</div>
      ${actionHTML}
    </div>`;
}

function buildBoardThemeCardHTML(theme, shop) {
  const owned = Array.isArray(shop.boardOwned) && shop.boardOwned.includes(theme.id);
  const equipped = loadBoardTheme() === theme.id;
  const priceLabel = theme.price === 0 ? 'Gratuit' : `🪙 ${theme.price}`;
  let actionHTML;
  if (equipped) actionHTML = `<div class="shop-badge equipped">✓ ÉQUIPÉ</div>`;
  else if (owned) actionHTML = `<button class="shop-action-btn equip-btn" onclick="equipBoardThemeFromShop('${theme.id}')">ÉQUIPER</button>`;
  else actionHTML = `<button class="shop-action-btn buy-btn" onclick="buyBoardThemeFromShop('${theme.id}')">ACHETER</button>`;

  return `
    <div class="board-theme-card ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
      <div class="theme-preview theme-${theme.preview}">
        <div class="theme-preview-cells"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <span class="theme-preview-icon">${theme.icon}</span>
      </div>
      <div class="shop-card-name">${theme.name.toUpperCase()}</div>
      <div class="theme-description">${theme.desc}</div>
      <div class="shop-card-price">${priceLabel}</div>
      ${actionHTML}
    </div>`;
}

function getEquippedEffect(){ const shop=loadShop(); return EFFECTS.find(e=>e.id===shop.effectEquipped)||EFFECTS[0]; }
function effectOwned(id){ const s=loadShop(); return s.effectOwned.includes(id); }
window.buyEffectFromShop=function(id){ const e=EFFECTS.find(x=>x.id===id); if(!e)return; const s=loadShop(); if(s.effectOwned.includes(id))return; if(loadCoins()<e.price){showShopFeedback('🪙 Jetons insuffisants',true);return;} addCoins(-e.price); s.effectOwned.push(id); s.effectEquipped=id; saveShop(s); showShopFeedback(`✨ ${e.name} acheté et équipé !`,false); renderShopPanel(); };
window.equipEffectFromShop=function(id){ const s=loadShop(); if(!s.effectOwned.includes(id))return; s.effectEquipped=id; saveShop(s); renderShopPanel(); };
function buildEffectCardHTML(e,shop){
  const owned=shop.effectOwned.includes(e.id), equipped=shop.effectEquipped===e.id;
  const action=equipped?'<div class="shop-badge equipped">✓ ÉQUIPÉ</div>':owned?`<button class="shop-action-btn equip-btn effect-action" onclick="equipEffectFromShop('${e.id}')">ÉQUIPER</button>`:`<button class="shop-action-btn buy-btn effect-action" onclick="buyEffectFromShop('${e.id}')">ACHETER</button>`;
  const fx=`<div class="preview-fx fx-${e.id}"><i></i><i></i><i></i><i></i><i></i></div>`;
  return `<div class="effect-shop-card ${owned?'owned':''} ${equipped?'equipped':''}"><div class="effect-preview effect-${e.id}"><div class="preview-pawn"></div>${fx}</div><div class="effect-rarity">${e.rarity}</div><div class="effect-shop-name">${e.name}</div><div class="effect-shop-desc">${e.desc}</div><div class="effect-price">${e.price?'🪙 '+e.price:'Gratuit'}</div>${action}</div>`;
}
function emitCosmeticEffect(type, player){
  if(!player || !player.isHuman) return;
  const pawn=document.getElementById('pawn-'+player.id);
  if(!pawn) return;
  const effect=getEquippedEffect();
  if(!effect) return;
  if(type==='card' && !['portal','royal'].includes(effect.id)) return;
  if(type==='move' && !['trail','spark','lightning','portal','inferno','blizzard','galaxy','royal'].includes(effect.id)) return;

  // V24 : position calculée analytiquement depuis la grille, plutôt que
  // mesurée sur le pion avec getBoundingClientRect().
  // BUG TROUVÉ (cause réelle, pas un problème CSS) : juste avant cet appel,
  // renderPawns() lance une animation Web Animations API sur le pion
  // (un glissement de l'ancienne case vers la nouvelle, via `transform`).
  // Cette transformation est appliquée immédiatement, de façon synchrone.
  // Or getBoundingClientRect() renvoie la position ÉCRAN ACTUELLE, donc
  // pendant l'image où l'animation démarre, elle renvoyait la position de
  // l'ANCIENNE case (celle que le pion est en train de quitter) et non la
  // nouvelle — l'effet se déclenchait bien, mais décalé d'une case, ce qui
  // le rendait très facile à manquer voire invisible selon le sens du coup.
  // On calcule donc la position directement à partir des coordonnées de
  // grille (les mêmes que celles utilisées par renderPawns pour placer le
  // pion), en l'ajoutant à la position réelle du plateau à l'écran : cette
  // valeur est stable, qu'une animation soit en cours ou non.
  const board = boardEl();
  if (!board) return;
  const boardRect = board.getBoundingClientRect();
  const fxCellSize = (isPentagonMode() ? pentMetrics() : classicMetrics()).cell;
  const fxPawnSize = fxCellSize * 0.72;
  const fxMargin = (fxCellSize - fxPawnSize) / 2;
  const { x: fxCellX, y: fxCellY } = cellPixelPos(player.row, player.col);
  const centerX = boardRect.left + fxCellX + fxMargin + fxPawnSize / 2;
  const centerY = boardRect.top + fxCellY + fxMargin + fxPawnSize / 2;

  const layer=document.createElement('div');
  layer.className='pawn-effect-screen pawn-effect-screen-'+effect.id;
  layer.style.position='fixed';
  layer.style.left=centerX+'px';
  layer.style.top=centerY+'px';
  layer.style.width='1px';
  layer.style.height='1px';
  layer.style.zIndex='100000';
  layer.style.pointerEvents='none';
  layer.style.setProperty('--effect-color', effect.color);
  document.body.appendChild(layer);

  // Halo central : volontairement très visible, même sans particules.
  const core=document.createElement('div');
  core.className='pawn-effect-screen-core';
  core.style.setProperty('--effect-color', effect.color);
  layer.appendChild(core);

  const count={trail:12,spark:26,lightning:18,portal:18,inferno:24,blizzard:24,galaxy:28,royal:30}[effect.id]||18;
  for(let i=0;i<count;i++){
    const part=document.createElement('i');
    part.className='pawn-effect-screen-particle';
    const angle=Math.random()*Math.PI*2;
    const distance=(effect.id==='trail'?25:30)+Math.random()*(effect.id==='trail'?38:55);
    const size=effect.id==='spark'?4+Math.random()*5:4+Math.random()*6;
    part.style.width=size+'px';
    part.style.height=size+'px';
    part.style.background=effect.color;
    part.style.boxShadow=`0 0 8px ${effect.color}, 0 0 18px ${effect.color}`;
    part.style.setProperty('--dx',Math.cos(angle)*distance+'px');
    part.style.setProperty('--dy',Math.sin(angle)*distance+'px');
    part.style.setProperty('--delay',(Math.random()*0.06)+'s');
    layer.appendChild(part);
  }

  if(effect.id==='lightning'){
    const bolt=document.createElement('div');
    bolt.className='pawn-effect-screen-bolt';
    bolt.textContent='⚡';
    bolt.style.color=effect.color;
    layer.appendChild(bolt);
  }
  if(effect.id==='royal'){
    const crown=document.createElement('div');
    crown.className='pawn-effect-screen-crown';
    crown.textContent='👑';
    layer.appendChild(crown);
    const ring=document.createElement('div');
    ring.className='pawn-effect-screen-ring';
    layer.appendChild(ring);
  }
  if(effect.id==='portal') {
    // PORTAL V4: rendu autonome en vrais éléments DOM.
    // Le portail est créé AVANT l'animation de carte et reste au-dessus de celle-ci.
    layer.classList.add('screen-card-effect');
    layer.style.zIndex='2147483647';
    layer.style.width='1px'; layer.style.height='1px';
    const portalBack=document.createElement('div'); portalBack.className='portal-fx-back'; layer.appendChild(portalBack);
    const portalOuter=document.createElement('div'); portalOuter.className='portal-fx-ring portal-fx-outer'; layer.appendChild(portalOuter);
    const portalMid=document.createElement('div'); portalMid.className='portal-fx-ring portal-fx-mid'; layer.appendChild(portalMid);
    const portalInner=document.createElement('div'); portalInner.className='portal-fx-ring portal-fx-inner'; layer.appendChild(portalInner);
    const portalVoid=document.createElement('div'); portalVoid.className='portal-fx-void'; layer.appendChild(portalVoid);
    const portalBeam=document.createElement('div'); portalBeam.className='portal-fx-beam'; layer.appendChild(portalBeam);
    for(let k=0;k<24;k++){
      const p=document.createElement('i'); p.className='portal-fx-particle';
      const a=(k/24)*Math.PI*2 + Math.random()*.2;
      const r=42+Math.random()*42;
      p.style.setProperty('--px',Math.cos(a)*r+'px'); p.style.setProperty('--py',Math.sin(a)*r*.58+'px');
      p.style.setProperty('--pd',(Math.random()*.45)+'s');
      p.style.setProperty('--ps',(2+Math.random()*4)+'px');
      layer.appendChild(p);
    }
  }

  setTimeout(()=>layer.remove(), effect.id==='portal'?1650:effect.id==='royal'?1350:1000);
}

function buildComingSoonShopHTML(icon, title, text) {
  return `<div class="shop-coming-soon"><div class="coming-icon">${icon}</div><h3>${title}</h3><p>${text}</p><span>🚧 Bientôt disponible</span></div>`;
}

window.setShopCategory = function(category) {
  shopCategory = category;
  renderShopPanel();
};

function buildShopHTML() {
  const shop = loadShop();
  shop.boardOwned = Array.isArray(shop.boardOwned) ? shop.boardOwned : ['classic'];
  if (!shop.boardOwned.includes('classic')) shop.boardOwned.unshift('classic');
  const coins = loadCoins();

  let content = '';
  if (shopCategory === 'pawns') {
    content = `<div class="shop-grid">${PAWN_SKINS.map(skin => buildShopCardHTML(skin, shop)).join('')}</div>`;
  } else if (shopCategory === 'boards') {
    content = `<div class="shop-grid board-theme-grid">${BOARD_THEMES.map(theme => buildBoardThemeCardHTML(theme, shop)).join('')}</div>`;
  } else if (shopCategory === 'effects') {
    content = `<div class="effect-grid">${EFFECTS.map(e=>buildEffectCardHTML(e,shop)).join('')}</div>`;
  } else {
    content = `<div class="emote-shop-note">🎉 <b>Équipe jusqu’à 4 emotes</b> puis utilise-les pendant la partie.</div><div class="emote-grid">${EMOTES.map(e=>buildEmoteCardHTML(e,loadEmotes())).join('')}</div>`;
  }

  return `
    <div class="shop-header">
      <button class="shop-back-btn" onclick="closeMenuPanel()">← Retour</button>
      <h2>🛍️ Boutique</h2>
      <div class="shop-balance">🪙 <span id="shop-coin-count">${coins}</span></div>
    </div>
    <div class="shop-tabs" role="tablist">
      <button class="shop-tab ${shopCategory === 'pawns' ? 'active' : ''}" onclick="setShopCategory('pawns')">🧍 Pions</button>
      <button class="shop-tab ${shopCategory === 'boards' ? 'active' : ''}" onclick="setShopCategory('boards')">🗺️ Plateaux</button>
      <button class="shop-tab ${shopCategory === 'effects' ? 'active' : ''}" onclick="setShopCategory('effects')">✨ Effets</button>
      <button class="shop-tab ${shopCategory === 'emotes' ? 'active' : ''}" onclick="setShopCategory('emotes')">🎉 Emotes</button>
    </div>
    <div id="shop-feedback" class="shop-feedback"></div>
    ${content}
  `;
}

function renderShopPanel() {
  const body = document.getElementById('menu-panel-body');
  if (body) body.innerHTML = buildShopHTML();
}


window.selectGameMode = function(count) { setSelectedPlayersCount(count); setGameMode('classic'); openMenuPanel('modes'); };
window.selectChaosMode = function() { if(loadTrophies() < CONFIG.CHAOS_UNLOCK_TROPHIES) return; setSelectedPlayersCount(4); setGameMode('chaos'); openMenuPanel('modes'); };
window.selectClassicMode = function() { setGameMode('classic'); openMenuPanel('modes'); };

/* ============================================================
   7. INTERFACE DU MENU
   ============================================================ */

function updateMenuDisplays() {
  const trophiesCount = loadTrophies();
  const coinsCount = loadCoins();
  const profileName = getPlayerName();
  
  const profileNameEl = document.getElementById('menu-profile-name');
  const avatarEl = document.getElementById('menu-avatar');
  const trophyEl = document.getElementById('menu-trophy-count');
  const coinEl = document.getElementById('menu-coin-count');
  const rankEl = document.getElementById('menu-profile-rank');
  const difficultyEl = document.getElementById('menu-profile-difficulty');
  const xpInfo = getXPLevelInfo();
  const menuLevelEl = document.getElementById('menu-profile-level');
  const menuXpBar = document.getElementById('menu-profile-xp-fill');
  const menuXpText = document.getElementById('menu-profile-xp-text');
  
  if (profileNameEl) profileNameEl.textContent = profileName;
  if (avatarEl) avatarEl.textContent = getProfileInitial(profileName);
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
  if (menuLevelEl) menuLevelEl.textContent = `Niv. ${xpInfo.level}`;
  if (menuXpBar) menuXpBar.style.width = `${xpInfo.pct}%`;
  if (menuXpText) menuXpText.textContent = `${xpInfo.inLevel}/${xpInfo.needed} XP`;
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
  if (panel) panel.classList.toggle('fullscreen-panel', ['shop','cards','levels','trophies','achievements'].includes(type));
  
  if (type === 'quests') { renderDailyQuestsPanel(); panel.classList.remove('hidden'); return; }
  if (type === 'achievements') { renderAchievementsPanel(); panel.classList.remove('hidden'); return; }
  if (type === 'profile') { renderProfilePanel(); panel.classList.remove('hidden'); return; }
  if (type === 'modes') {
    const current = getSelectedPlayersCount();
    body.innerHTML = `
      <h2>🎮 Modes de jeu</h2>
      <p class="panel-subtitle">Choisis le nombre de joueurs.</p>
      <div class="modes-list">
        ${[
          [2,'🟢 1 VS 1','Duel à 2 joueurs'],
          [3,'🔵 1 VS 1 VS 1','Bataille à 3 joueurs'],
          [4,'🟣 1 VS 1 VS 1 VS 1','Mode classique à 4 joueurs'],
          [5,'🟠 1 VS 1 VS 1 VS 1 VS 1','Mêlée générale à 5 joueurs']
        ].map(([n,title,desc]) => `
          <div class="mode-card ${current===n?'selected':''}">
            <div class="mode-card-header"><span>${title}</span><span class="mode-players-badge">👥 ${n} joueurs</span></div>
            <p class="mode-card-desc">${desc}</p>
            <div class="mode-card-footer"><span></span><button class="mode-select-btn" onclick="selectGameMode(${n})">${current===n?'✓ Actif':'Choisir'}</button></div>
          </div>`).join('')}
      </div>
      <div class="chaos-mode-card ${getGameMode()===CHAOS_MODE?'selected':''}">
        <div class="chaos-mode-title"><span>🌀 Mode Chaos</span><span class="mode-players-badge">🌀 Spécial</span></div>
        <p>Des cases spéciales apparaissent sur le plateau et peuvent bouleverser la partie.</p>
        <div class="chaos-mode-effects"><span>↻ Rejoue</span><span>⇄ Échange</span><span>◈ Mur</span><span>» Turbo</span><span>✦ Téléportation</span></div>
        ${loadTrophies() >= CONFIG.CHAOS_UNLOCK_TROPHIES ? `<div class="mode-card-footer"><span class="chaos-unlock-ok">🔓 Débloqué</span><button class="mode-select-btn chaos-select-btn" onclick="selectChaosMode()">${getGameMode()===CHAOS_MODE?'✓ Actif':'Jouer'}</button></div>` : `<div class="mode-card-footer"><span class="chaos-unlock-locked">🔒 ${CONFIG.CHAOS_UNLOCK_TROPHIES} 🏆 requis</span><button class="mode-select-btn chaos-select-btn" disabled>Verrouillé</button></div>`}
      </div>`;
  } else if (type === 'trophies') {
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
      } else if (m.modeUnlock) {
        actionHTML = `<div class="tr-reached">🌀 ${m.modeName} débloqué</div>`;
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
            ${m.modeUnlock ? `<div class="tr-rank chaos-road-unlock">🌀 ${m.modeName}</div>` : ''}
            ${m.reward > 0 ? `<div class="tr-reward">+${m.reward} 🪙</div>` : ''}
          </div>
          <div class="tr-card-action">${actionHTML}</div>
        </div>
      `;
    });
    listHTML += `</div>`;

    body.innerHTML = headerHTML + progressHTML + listHTML;
    
  } else if (type === 'levels') {
    renderLevelRewardsPanel();
  } else if (type === 'cards') {
    body.innerHTML = buildCardCollectionHTML();
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
      <div class="tutorial-panel-hero"><span class="tutorial-panel-icon">🎓</span><div><div class="profile-panel-kicker">APPRENDRE EN JOUANT</div><h2>Première partie</h2></div></div>
      <p class="panel-subtitle">Un tutoriel interactif va te guider directement sur le plateau. Tu feras toi-même chaque action importante.</p>
      <div class="tutorial-step"><span class="tutorial-step-number">1</span><p><strong>Déplacement</strong><br>Apprends à bouger ton pion et à lire les cases disponibles.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">2</span><p><strong>Barrières</strong><br>Découvre comment ralentir l'adversaire sans lui fermer complètement son chemin.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">3</span><p><strong>Cartes</strong><br>Teste gratuitement une carte Sprint pendant le tutoriel.</p></div>
      <button type="button" class="tutorial-launch-btn" onclick="startTutorial()">🎮 COMMENCER LE TUTORIEL <span>›</span></button>
    `;
  } else if (type === 'shop') {
    body.innerHTML = buildShopHTML();
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
      <h2>⚙️ Paramètres</h2>
      <p class="difficulty-note">La difficulté change les bots et les récompenses. Le choix s'applique à la prochaine partie.</p>
      <div class="difficulty-list">${cards}</div>
      <div class="audio-settings">
        <h3>🔊 Audio</h3>
        <button id="audio-toggle" class="audio-toggle-btn" onclick="toggleAudio()"></button>
        <button class="audio-test-btn" onclick="testAudio()">🔊 Tester le son</button>
        <div class="audio-volume-row"><span>Volume</span><strong id="audio-volume-label"></strong></div>
        <input id="audio-volume" class="audio-volume-slider" type="range" min="0" max="100" step="1" oninput="setAudioVolume(this.value)">
      </div>
    `;
    updateAudioControls();
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
      cell.className = 'cell' + ((r + c) % 2 === 1 ? ' cell-alt' : '') + (!isPlayableCell(r, c) ? ' cell-outside' : '');
      cell.style.left = x + 'px'; cell.style.top = y + 'px';
      // En mode pentagone, la taille des cases doit suivre exactement
      // pentMetrics().cell. Utiliser CONFIG.CELL_SIZE ici faisait dépasser
      // les cases du plateau et cassait le redimensionnement mobile.
      const cellSize = isPentagonMode() ? pentMetrics().cell : CONFIG.CELL_SIZE;
      cell.style.width = cellSize + 'px'; cell.style.height = cellSize + 'px';
      cell.dataset.row = r; cell.dataset.col = c;
      if (isPlayableCell(r, c)) cell.addEventListener('click', () => onCellClick(r, c));
      board.appendChild(cell);
    }
  }

  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      if (isPentagonMode()) {
        const around = [[i,j],[i,j+1],[i+1,j],[i+1,j+1]];
        if (!around.every(([r,c]) => isPlayableCell(r,c))) continue;
      }
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

function updateBreakWallSelection() {
  document.querySelectorAll('.wall-segment').forEach(el => {
    el.classList.toggle('break-target', !!(state && state.pendingBreakWall));
  });
}

function breakSelectedWall(key) {
  if (!state || !state.pendingBreakWall || state.gameOver || !currentPlayer().isHuman) return;
  const orientation = state.jointOrientations.get(key);
  if (!orientation) return;
  const [i, j] = key.split(',').map(Number);
  for (const edge of getWallEdges(i, j, orientation)) state.walls.delete(edge);
  state.jointOrientations.delete(key);
  state.wallOwners.delete(key);
  state.pendingBreakWall = false;
  markCardUsed('wallbreak');
  clearWallsFromDOM();
  for (const [wallKey, wallOrientation] of state.jointOrientations.entries()) {
    const [wi, wj] = wallKey.split(',').map(Number);
    renderWall(wi, wj, wallOrientation);
  }
  updateBreakWallSelection();
  updatePlayersHUD();
  renderCardBar();
  playSound('wall');
  emitCosmeticEffect('card', currentPlayer());
  showMessage('💥 Barrière détruite !', 2200);
}

function renderWall(i, j, orientation) {
  const rect = wallPixelRect(i, j, orientation);
  const el = document.createElement('div'); el.className = 'wall-segment';
  el.style.left = rect.x + 'px'; el.style.top = rect.y + 'px';
  el.style.width = rect.width + 'px'; el.style.height = rect.height + 'px';
  el.dataset.wallKey = `${i},${j}`;
  el.addEventListener('click', (event) => {
    if (state && state.pendingBreakWall) {
      event.stopPropagation();
      breakSelectedWall(el.dataset.wallKey);
    }
  });
  boardEl().appendChild(el);
  if (state && state.pendingBreakWall) el.classList.add('break-target');
}

function renderPawns() {
  for (const player of state.players) {
    let pawnEl = document.getElementById('pawn-' + player.id);
    if (!pawnEl) {
      pawnEl = document.createElement('div'); pawnEl.id = 'pawn-' + player.id; pawnEl.className = 'pawn';
      const pawnCellSize = (isPentagonMode() ? pentMetrics() : classicMetrics()).cell;
      const pawnSize = pawnCellSize * 0.72;
      pawnEl.style.width = pawnSize + 'px'; pawnEl.style.height = pawnSize + 'px';
      boardEl().appendChild(pawnEl);
    }

    // Le joueur humain affiche le skin actuellement équipé dans la Boutique.
    // Les bots gardent exactement leur couleur habituelle (jamais modifiée).
    if (player.isHuman) {
      applyPawnSkin(pawnEl, getEquippedSkin());
      const hasRoyalAura = getEquippedEffect().id === 'royal';
      let aura = pawnEl.querySelector('.pawn-aura');
      if (hasRoyalAura && !aura) {
        aura = document.createElement('div');
        aura.className = 'pawn-aura pawn-aura-royal';
        aura.innerHTML = '<span class="pawn-aura-crown">👑</span><span class="pawn-aura-sweep sweep-a"></span><span class="pawn-aura-sweep sweep-b"></span><span class="pawn-aura-core-ring"></span>' + '<i></i>'.repeat(12);
        pawnEl.appendChild(aura);
      } else if (!hasRoyalAura && aura) {
        aura.remove();
      }
    } else {
      pawnEl.className = 'pawn';
      pawnEl.style.background = player.color;
      pawnEl.style.removeProperty('--pawn-icon');
      pawnEl.style.border = '2px solid rgba(0,0,0,0.18)';
    }

    const { x, y } = cellPixelPos(player.row, player.col);
    const pawnCellSize = (isPentagonMode() ? pentMetrics() : classicMetrics()).cell;
    const margin = (pawnCellSize - pawnCellSize * 0.72) / 2;
    const nextLeft = x + margin;
    const nextTop = y + margin;
    const prevLeft = parseFloat(pawnEl.style.left);
    const prevTop = parseFloat(pawnEl.style.top);
    const hadPosition = Number.isFinite(prevLeft) && Number.isFinite(prevTop);
    const moved = hadPosition && (Math.abs(prevLeft - nextLeft) > 0.1 || Math.abs(prevTop - nextTop) > 0.1);

    // On fixe immédiatement la destination puis on anime le déplacement avec
    // transform : cela évite l'effet "téléportation" même quand plusieurs
    // rendus DOM se produisent pendant le tour.
    pawnEl.style.left = nextLeft + 'px';
    pawnEl.style.top = nextTop + 'px';
    if (moved && typeof pawnEl.animate === 'function') {
      const dx = prevLeft - nextLeft;
      const dy = prevTop - nextTop;
      pawnEl.getAnimations().forEach(a => a.cancel());
      pawnEl.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' }
        ],
        { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'none' }
      );
    }
  }
}

function clearHighlights() { document.querySelectorAll('.cell.valid-move, .cell.vision-path').forEach(el => el.classList.remove('valid-move','vision-path')); }

function refreshHighlights() {
  clearHighlights(); if (state.mode !== 'move' || state.gameOver) return;
  const player = currentPlayer(); if (!player.isHuman) return;
  const moves = getValidMoveCells(player);
  for (const [r, c] of moves) {
    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) cell.classList.add('valid-move');
  }
  if (state.visionCells && state.visionCells.length) {
    state.visionCells.forEach(([r,c]) => { const cell=document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`); if(cell) cell.classList.add('vision-path'); });
  }
}

function updateTrophyDisplay() { if(state) document.getElementById('trophy-count').textContent = state.trophies; }
function updateCoinDisplay() { if(state) document.getElementById('coin-count').textContent = state.coins; }

function updateGoalBarsDisplay() {
  const legacyBars = ['goal-bar-top','goal-bar-bottom','goal-bar-left','goal-bar-right','goal-corner-br'];
  legacyBars.forEach(id => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', isPentagonMode()); });

  const pentBars = [0,1,2,3,4].map(i => document.getElementById(`pent-goal-${i}`));
  pentBars.forEach(el => {
    if (!el) return;
    el.classList.remove('active-goal','human-goal');
    el.style.removeProperty('--goal-color');
    el.style.background = '';
  });

  if (isPentagonMode()) {
    state.players.forEach(p => {
      const goalSide = PENTAGON_GOAL_SIDE[p.pentSide];
      const el = document.getElementById(`pent-goal-${goalSide}`);
      if (!el) return;
      el.classList.add('active-goal');
      el.style.setProperty('--goal-color', `var(--player-${p.id})`);
      el.style.background = 'var(--goal-color)';
      el.title = `Objectif de ${p.name}`;
      if (p.isHuman) el.classList.add('human-goal');
    });
    const human = state.players.find(p => p.isHuman);
    const label = document.getElementById('pent-goal-label');
    if (label && human) {
      label.textContent = `🎯 Ton objectif : côté ${PENTAGON_GOAL_SIDE[human.pentSide] + 1}`;
    }
    return;
  }

  const bars = {
    top: document.getElementById('goal-bar-top'), bottom: document.getElementById('goal-bar-bottom'),
    left: document.getElementById('goal-bar-left'), right: document.getElementById('goal-bar-right')
  };
  Object.values(bars).forEach(el => {
    if (!el) return;
    el.classList.remove('active-goal','human-goal');
    el.style.removeProperty('--goal-color');
    el.style.background = '';
  });
  const destinationByStart = { bottom:'top', top:'bottom', left:'right', right:'left' };
  state.players.forEach(p => {
    const dest = destinationByStart[p.side];
    if (dest && bars[dest]) {
      bars[dest].classList.add('active-goal');
      bars[dest].style.setProperty('--goal-color', `var(--player-${p.id})`);
      bars[dest].style.background = 'var(--goal-color)';
      bars[dest].title = `Objectif de ${p.name}`;
      if (p.isHuman) bars[dest].classList.add('human-goal');
    }
  });
}

function updatePlayersHUD() {
  const container = document.getElementById('players-hud');
  container.classList.remove('count-2','count-3','count-4','count-5');
  container.classList.add(`count-${state.players.length}`);
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
  if (state && mode !== 'breakwall') { state.pendingBreakWall = false; updateBreakWallSelection(); }
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

function showEndModal(humanWon, deltaTrophies, deltaCoins, xpGain = null) {
  const modal = document.getElementById('end-modal');
  document.getElementById('end-title').textContent = humanWon ? 'Victoire ! 🎉' : 'Défaite';
  document.getElementById('end-text').textContent = humanWon ? 'Tu as atteint le bord opposé avant tout le monde.' : 'Un adversaire a atteint son objectif avant toi.';
  
  const trophySign = deltaTrophies >= 0 ? '+' : '';
  document.getElementById('trophy-change').textContent = `${trophySign}${deltaTrophies} 🏆`;
  document.getElementById('coin-change').textContent = `+${deltaCoins} 🪙`;
  const xpEl = document.getElementById('xp-change');
  if (xpEl) {
    const gained = xpGain?.amount ?? 0;
    const levelText = xpGain?.leveledUp ? ` • ⭐ Niveau ${xpGain.after.level} !` : '';
    xpEl.textContent = `+${gained} XP${levelText}`;
    xpEl.classList.toggle('xp-level-up', !!xpGain?.leveledUp);
  }
  
  modal.classList.remove('hidden');
  modal.classList.remove('victory-modal','defeat-modal');
  modal.classList.add(humanWon ? 'victory-modal' : 'defeat-modal');
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


function markCardUsed(id) {
  if (!state || state.cardUsed.has(id) || state.cardPlayedThisTurn) return false;
  if (!consumeCard(id)) return false;
  state.cardUsed.add(id);
  state.cardPlayedThisTurn = true;
  return true;
}
function cardAvailable(id) {
  return !!state && !state.gameOver && !state.cardPlayedThisTurn && !state.cardActivationPending && currentPlayer().isHuman && state.cardHand.includes(id) && !state.cardUsed.has(id);
}
function renderCardBar() {
  const bar=document.getElementById('card-bar'); if(!bar || !state) return;
  bar.innerHTML='';
  state.cardHand.forEach(id=>{
    const c=cardById(id); if(!c) return;
    const used=state.cardUsed.has(id);
    const btn=document.createElement('button'); btn.className='game-card-btn rarity-'+c.rarity.toLowerCase().replace('é','e').replace('è','e').replace('ê','e')+(used?' used':''); btn.style.setProperty('--card-color',c.color);
    btn.disabled=used || !currentPlayer().isHuman || state.gameOver;
    btn.innerHTML=`<span class="game-card-icon">${c.icon}</span><span class="game-card-name">${c.name}</span><span class="game-card-rarity">${c.rarity}</span>`;
    btn.title=c.desc; btn.addEventListener('click',()=>useCard(id)); bar.appendChild(btn);
  });
}
function resolveCardUse(id) {
  if(!state || state.gameOver || state.cardPlayedThisTurn) { if(state) state.cardActivationPending=false; return; }
  if(!state.cardHand.includes(id) || state.cardUsed.has(id) || !currentPlayer().isHuman) { state.cardActivationPending=false; return; }
  state.cardActivationPending = false;
  playSound('card');
  const c=cardById(id); if(!c) return;
  const player=currentPlayer();
  const effect=c.effect;

  if(effect==='freewall') {
    state.pendingFreeWall=true; markCardUsed(id); setMode('wall'); renderCardBar();
    showMessage('🧱 Barrière gratuite activée : choisis où la poser.',3000); return;
  }
  if(effect==='breakwall') {
    const wallKeys = [...state.jointOrientations.keys()];
    if (!wallKeys.length) {
      showMessage('💥 Il n’y a aucune barrière à détruire.',2500);
      return;
    }
    state.pendingBreakWall = true;
    state.cardPlayedThisTurn = true;
    updateBreakWallSelection();
    showMessage('💥 Clique sur la barrière que tu veux détruire.',4000);
    return;
  }
  if(effect==='fortress') {
    state.pendingFreeWall=true; player.wallsLeft += 1; markCardUsed(id); setMode('wall'); renderPawns(); renderCardBar();
    showMessage('🏰 Forteresse : barrière gratuite +1 barrière en réserve.',3500); return;
  }
  if(effect==='vision3' || effect==='vision5' || effect==='vision7' || effect==='vision9') {
    const steps=Number(effect.replace('vision',''));
    const dist=computeGoalDistances(player.side);
    state.visionCells=[]; let cur=[player.row,player.col];
    for(let k=0;k<steps;k++){
      const opts=neighborsOpen(cur[0],cur[1]).filter(([r,c])=>!isCellOccupied(r,c,player.id)).sort((a,b)=>dist[a[0]][a[1]]-dist[b[0]][b[1]]);
      if(!opts.length) break; cur=opts[0]; state.visionCells.push(cur);
    }
    markCardUsed(id); refreshHighlights(); renderCardBar();
    showMessage(`👁️ ${state.visionCells.length} cases de ton meilleur chemin sont révélées.`,3000); return;
  }
  if(effect==='doubleturn') {
    markCardUsed(id); state.extraTurn=true; renderCardBar(); showMessage('🔄 Double tour activé !',3000); return;
  }
  if(effect==='passwall') {
    player.wallPassMoves = 1; markCardUsed(id); renderCardBar(); refreshHighlights();
    showMessage('👻 Passe-muraille activé : ton prochain déplacement ignore les barrières.',3000); return;
  }
  if(effect==='thief') {
    const targets = state.players.filter(p => p.id !== player.id && p.wallsLeft > 0);
    if (!targets.length) { showMessage('🦹 Aucun adversaire n’a de barrière à voler.'); return; }
    const target = targets[Math.floor(Math.random()*targets.length)];
    target.wallsLeft -= 1; player.wallsLeft += 1; markCardUsed(id); renderPawns(); updatePlayersHUD(); renderCardBar();
    showMessage(`🦹 Tu voles 1 barrière à ${target.name} !`,3000); return;
  }
  if(effect==='exchange') {
    const targets = state.players.filter(p => p.id !== player.id && !isCellOccupied(p.row,p.col,player.id));
    if (!targets.length) { showMessage('⇄ Aucun adversaire disponible pour l’échange.'); return; }
    const target = targets[Math.floor(Math.random()*targets.length)];
    const r=player.row, c=player.col; player.row=target.row; player.col=target.col; target.row=r; target.col=c;
    markCardUsed(id); renderPawns(); renderCardBar();
    showMessage(`⇄ Échange de position avec ${target.name} !`,3000); return;
  }
  if(effect==='teleport') {
    const candidates=[];
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(isPlayableCell(r,c) && !isCellOccupied(r,c,player.id) && !(r===player.row&&c===player.col) && !isGoalCell(player.side,r,c)) candidates.push([r,c]);
    if(!candidates.length) return;
    const dest=candidates[Math.floor(Math.random()*candidates.length)];
    markCardUsed(id); movePawn(player,dest[0],dest[1]); renderPawns(); emitCosmeticEffect('move', player); renderCardBar();
    setTimeout(()=>{ if(checkWinAfterMove(player)) return; resolveChaosCell(player); if(checkWinAfterMove(player)) return; endTurn(); },420); return;
  }
  if(effect==='shield') {
    if (!isChaosMode()) { showMessage('🛡️ Le Bouclier sera prêt pour une partie en Mode Chaos.',2800); return; }
    player.chaosShield = 1; markCardUsed(id); renderCardBar(); showMessage('🛡️ Bouclier activé !',2500); return;
  }
  if(effect==='sprint2' || effect==='jump3' || effect==='jump4' || effect==='jump5' || effect==='momentum' || effect==='legendaryrush') {
    const maxSteps=effect==='sprint2'?2:effect==='jump3'?3:effect==='jump4'?4:effect==='momentum'?3:5;
    let moved=0; let cur=[player.row,player.col];
    for(let k=0;k<maxSteps;k++){
      const dist=computeGoalDistances(player.side);
      const opts=neighborsOpen(cur[0],cur[1]).filter(([r,c])=>!isCellOccupied(r,c,player.id)).sort((a,b)=>dist[a[0]][a[1]]-dist[b[0]][b[1]]);
      if(!opts.length) break; cur=opts[0]; moved++;
      if(isGoalCell(player.side,cur[0],cur[1])) break;
    }
    if(moved===0){ showMessage('Cette carte ne peut pas être utilisée ici.'); return; }
    markCardUsed(id); movePawn(player,cur[0],cur[1]); renderPawns(); emitCosmeticEffect('move', player); renderCardBar();
    if(effect==='momentum' || effect==='legendaryrush') state.extraTurn=true;
    setTimeout(()=>{ if(checkWinAfterMove(player)) return; resolveChaosCell(player); if(checkWinAfterMove(player)) return; endTurn(); },420); return;
  }
}

function runCardActivationAnimation(card, player, callback) {
  if (!card) { callback(); return; }
  const existing = document.getElementById('card-activation-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'card-activation-overlay';
  overlay.className = `card-activation-overlay effect-${card.effect}`;
  const rarityFx = ['Épique','Légendaire'].includes(card.rarity) ? `
    <div class="activation-rarity-fx ${card.rarity === 'Légendaire' ? 'fx-legendary' : 'fx-epic'}">
      <span class="fx-ring ring-1"></span><span class="fx-ring ring-2"></span><span class="fx-ring ring-3"></span>
      <span class="fx-bolt bolt-a"></span><span class="fx-bolt bolt-b"></span>
      <span class="fx-wind wind-a"></span><span class="fx-wind wind-b"></span><span class="fx-wind wind-c"></span>
      <span class="fx-shockwave"></span>
    </div>` : '';
  overlay.innerHTML = `
    <div class="card-activation-backdrop"></div>
    ${rarityFx}
    <div class="card-activation-burst burst-a"></div>
    <div class="card-activation-burst burst-b"></div>
    <div class="card-activation-spin-frame">
      <div class="card-activation-spin-ring ring-a"></div>
      <div class="card-activation-spin-ring ring-b"></div>
      <div class="card-activation-card">
        <div class="activation-card-shine"></div>
        <div class="activation-card-icon">${card.icon}</div>
        <div class="activation-card-name">${card.name}</div>
        <div class="activation-card-rarity">${card.rarity}</div>
      </div>
    </div>
    <div class="card-activation-particles">
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </div>`;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('show'));
  setTimeout(() => {
    overlay.classList.add('resolve');
    setTimeout(() => {
      overlay.remove();
      callback();
    }, 230);
  }, 560);
}

function useCard(id) {
  if(!cardAvailable(id)) return;
  if (tutorialActive && tutorialBusy) return;
  if (tutorialActive && tutorialStep === 3 && id !== 'sprint') { showMessage('🎓 Commence par utiliser Sprint.'); return; }
  state.cardActivationPending = true;
  tutorialBusy = tutorialActive ? true : false;
  const c=cardById(id);
  const player=currentPlayer();
  if(!c || !player) return;
  player.cardsUsedThisGame=(player.cardsUsedThisGame||0)+1; updateDailyQuest('card'); updateDailyQuest('combo');
  uiLocked = true;
  playSound('card');
  emitCosmeticEffect('card', player);
  const token = tutorialTransitionToken;
  runCardActivationAnimation(c, player, () => {
    uiLocked = false;
    tutorialBusy = false;
    resolveCardUse(id);
    if (tutorialActive && tutorialStep === 3 && tutorialTransitionToken === token) advanceTutorial(4);
  });
}

window.useCard=useCard;
window.toggleAudio=toggleAudio;
window.setAudioVolume=setAudioVolume;
window.testAudio=testAudio;
window.playSound=playSound;
window.startTutorial=startTutorial;

function onCellClick(r, c) {
  if (state.gameOver || state.mode !== 'move') return;
  if (tutorialActive && tutorialStep === 1) { showMessage('Passe d’abord en mode 🧱 Barrière.'); return; }
  const player = currentPlayer(); if (!player.isHuman) return;
  const inputLocked = tutorialActive ? tutorialBusy : uiLocked;
  if (inputLocked) return;
  if (!getValidMoveCells(player).some(([vr, vc]) => vr === r && vc === c)) return;

  uiLocked = true; tutorialBusy = tutorialActive ? true : false; movePawn(player, r, c); player.movesThisGame=(player.movesThisGame||0)+1; updateDailyQuest('move');
  if (player.chaosBonusSteps) player.chaosBonusSteps = 0;
  if (player.wallPassMoves) player.wallPassMoves = 0;
  renderPawns();
  emitCosmeticEffect('move', player);
  setTimeout(() => { uiLocked = false; tutorialBusy = false; if (checkWinAfterMove(player)) return; resolveChaosCell(player); if (checkWinAfterMove(player)) return; if (tutorialActive && tutorialStep === 0) { advanceTutorial(1); setMode('wall'); return; } endTurn(); }, 420);
}

function onJointClick(i, j) {
  if (state.gameOver || state.mode !== 'wall') return;
  const player = currentPlayer(); if (!player.isHuman) return;
  if (tutorialActive ? tutorialBusy : uiLocked) return;

  const freeWall = !!state.pendingFreeWall;
  const result = canPlaceWall(player, i, j, state.orientation, freeWall);
  if (!result.ok) { showMessage(result.reason); return; }

  uiLocked = true; tutorialBusy = tutorialActive ? true : false;
  if (freeWall) { state.pendingFreeWall = false; markCardUsed('freewall'); }
  placeWall(player, i, j, state.orientation, freeWall); player.wallsPlacedThisGame=(player.wallsPlacedThisGame||0)+1; registerAchievementWall(); updateDailyQuest('wall'); updateDailyQuest('combo');
  renderCardBar();
  setTimeout(() => { uiLocked = false; tutorialBusy = false; if (tutorialActive && tutorialStep === 1) { advanceTutorial(2); endTurn(); return; } endTurn(); }, 250);
}

function endGame(humanWon, winnerName) {
  if (state.gameOver) return; // Sécurité pour empêcher plusieurs exécutions
  if (tutorialActive && state?.tutorial) {
    // Le tutoriel est guidé : seul le joueur peut conclure la partie.
    // Un éventuel passage d'un adversaire sur sa ligne d'arrivée est ignoré
    // afin de laisser la phase finale jouable normalement.
    if (!humanWon) {
      state.gameOver = false;
      return;
    }
    state.gameOver = true;
    playSound('win');
    finishTutorial();
    return;
  }
  state.gameOver = true;
  playSound(humanWon ? 'win' : 'lose');
  if (humanWon) emitCosmeticEffect('move', state.players.find(p=>p.isHuman));
  recordResult(humanWon);
  updateDailyQuest('game');
  if(humanWon) updateDailyQuest('win');
  if(state.chaos) updateDailyQuest('chaosgame');
  if(humanWon && ((state.players.find(p=>p.isHuman)?.movesThisGame)||0)<=25) updateDailyQuest('quickwin');
  updateDailyQuest('combo');
  
  const difficulty = getDifficultyInfo();
  const deltaTrophies = humanWon ? difficulty.trophiesWin : -difficulty.trophiesLoss;
  const deltaCoins = humanWon ? difficulty.coinsWin : difficulty.coinsLoss;
  const baseXP = humanWon ? 150 : 80;
  const difficultyXP = { easy: 0, normal: 15, hard: 30, expert: 50 };
  const deltaXP = baseXP + (difficultyXP[getDifficultyKey()] || 0);
  
  addTrophies(deltaTrophies);
  addCoins(deltaCoins);
  const xpGain = addXP(deltaXP);
  checkAchievements({humanWon, difficulty:getDifficultyKey(), moves:state.players.find(p=>p.isHuman)?.movesThisGame||0});
  
  showEndModal(humanWon, deltaTrophies, deltaCoins, xpGain);
  clearHighlights();
}

function forfeitGame() { if (!state.gameOver) endGame(false, 'Abandon'); }

function setupEventListeners() {
  document.getElementById('menu-play-btn').addEventListener('click', startGame);
  document.getElementById('menu-shop-btn').addEventListener('click', () => openMenuPanel('shop'));
  document.getElementById('menu-quests-btn').addEventListener('click', () => openMenuPanel('quests'));
  document.getElementById('menu-cards-btn').addEventListener('click', () => openMenuPanel('cards'));
  document.getElementById('menu-game-modes-btn').addEventListener('click', () => openMenuPanel('modes'));
  document.getElementById('menu-trophies-btn').addEventListener('click', () => openMenuPanel('trophies'));
  document.getElementById('menu-profile-btn').addEventListener('click', () => openMenuPanel('profile'));
  document.getElementById('profile-pseudo-confirm').addEventListener('click', confirmProfileSetup);
  
  document.getElementById('menu-stats-btn').addEventListener('click', () => openMenuPanel('stats'));
  document.getElementById('menu-tutorial-btn').addEventListener('click', () => openMenuPanel('tutorial'));
  document.getElementById('menu-level-rewards-btn').addEventListener('click', () => openMenuPanel('levels'));
  document.getElementById('menu-achievements-btn').addEventListener('click', () => openMenuPanel('achievements'));
  document.getElementById('menu-settings-btn').addEventListener('click', () => openMenuPanel('settings'));
  const moreBtn = document.getElementById('menu-more-btn');
  const moreDrawer = document.getElementById('menu-more-drawer');
  const moreClose = document.getElementById('menu-more-close');
  function toggleMoreMenu(open) { if (!moreDrawer || !moreBtn) return; const next = open === undefined ? moreDrawer.classList.contains('hidden') : open; moreDrawer.classList.toggle('hidden', !next); moreDrawer.setAttribute('aria-hidden', String(!next)); moreBtn.setAttribute('aria-expanded', String(next)); }
  if (moreBtn) moreBtn.addEventListener('click', () => toggleMoreMenu());
  if (moreClose) moreClose.addEventListener('click', () => toggleMoreMenu(false));
  document.getElementById('menu-panel-close').addEventListener('click', closeMenuPanel);
  document.getElementById('main-menu-btn').addEventListener('click', () => { hideEndModal(); showScreen('menu'); });

  document.getElementById('menu-panel').addEventListener('click', (event) => {
    if (event.target.id === 'menu-panel') { closeMenuPanel(); return; }
    const achievementBtn = event.target.closest && event.target.closest('[data-achievement-claim]');
    if (achievementBtn) {
      event.preventDefault();
      event.stopPropagation();
      window.claimAchievement(achievementBtn.getAttribute('data-achievement-claim'), achievementBtn);
      return;
    }
    const bonusBtn = event.target.closest && event.target.closest('#daily-bonus-claim-btn');
    if (bonusBtn) {
      event.preventDefault();
      event.stopPropagation();
      window.claimDailyBonus();
    }
  }, true);

  document.getElementById('mode-move-btn').addEventListener('click', () => { if (currentPlayer().isHuman && !state.gameOver) setMode('move'); });
  document.getElementById('mode-wall-btn').addEventListener('click', () => { if (currentPlayer().isHuman && !state.gameOver) setMode('wall'); });
  document.getElementById('orientation-h-btn').addEventListener('click', () => setOrientation('H'));
  document.getElementById('orientation-v-btn').addEventListener('click', () => setOrientation('V'));

  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', startGame);
  document.getElementById('forfeit-btn').addEventListener('click', forfeitGame);
  
  document.getElementById('rank-up-close-btn').addEventListener('click', hideRankUpNotification);

  document.getElementById('pack-opening-close').addEventListener('click', closePackOpening);
  document.getElementById('pko-reveal-all-btn').addEventListener('click', revealAllPackCards);
  window.addEventListener('resize', () => { if (packOpenPhase !== 'idle') resizePackCanvas(); });
}

/* ============================================================
   10. INITIALISATION
   ============================================================ */



document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading-screen');
  const progress = document.getElementById('loading-progress');
  const percent = document.getElementById('loading-percent');
  const status = document.getElementById('loading-status');
  const stageLabel = document.getElementById('loading-stage-label');
  const tip = document.getElementById('loading-tip-text');
  const stages = [
    [0,   4,  'Ouverture du plateau', 'Initialisation du jeu…', 'Chaque barrière peut changer complètement le chemin.'],
    [650, 22, 'Préparation des cartes', 'Chargement des cartes…', 'Garde tes cartes fortes pour le bon moment.'],
    [1350,43, 'Mise en place des joueurs', 'Création de la partie…', 'Avancer vite ne suffit pas : pense à tes adversaires.'],
    [2050,65, 'Préparation de la boutique', 'Synchronisation des personnalisations…', 'Les cosmétiques changent le style, pas les règles.'],
    [2750,82, 'Vérifications finales', 'Dernières vérifications…', 'Tout est presque prêt.'],
    [3450,94, 'Finalisation', 'Encore un instant…', 'Le plateau arrive.'],
    [4100,100,'Prêt !', 'La partie est prête.', 'À toi de jouer.']
  ];
  let lastPct=-1;
  const setLoading=(p,label,statusText,tipText)=>{p=Math.max(0,Math.min(100,Math.round(p)));if(p!==lastPct){if(progress)progress.style.width=p+'%';if(percent)percent.textContent=p+'%';lastPct=p;}if(stageLabel)stageLabel.textContent=label;if(status)status.textContent=statusText;if(tip)tip.textContent=tipText;};
  document.addEventListener('click',(e)=>{if(e.target.closest('button')&&!e.target.closest('.audio-toggle-btn'))playSound('click');},{passive:true});

  // Prépare immédiatement le jeu derrière le splash. Le splash est une vraie
  // séquence de lancement de 4,4 s, sans raccourci lié à reduced-motion.
  setLoading(...stages[0].slice(1));
  setupEventListeners();
  ensureStarterCards();
  updateMenuDisplays();
  showScreen('menu');
  stages.slice(1).forEach(stage=>setTimeout(()=>setLoading(...stage.slice(1)),stage[0]));

  setTimeout(()=>{
    if(!loading)return;
    loading.setAttribute('aria-busy','false');
    document.body.classList.remove('loading-active');
    loading.classList.add('is-hidden');
    setTimeout(()=>loading.remove(),560);

    // Premier lancement : pseudo puis tutoriel obligatoire, sans passer par le menu.
    if (!loadProfile().name) {
      showProfileSetup();
    } else if (!isTutorialCompleted()) {
      startTutorial();
    }
  },4380);
});

(async () => {
  try {
    const savedProfile = JSON.parse(
      localStorage.getItem(CONFIG.PROFILE_KEY) || '{}'
    );

    const username = savedProfile.name;

    if (!username) {
      console.log('Aucun pseudo sauvegardé.');
      return;
    }

    const cloudProfile = await syncPlayerProfile(username);

    if (cloudProfile) {
      console.log('🟢 Profil synchronisé :', cloudProfile);
    } else {
      console.log('🟠 Profil local conservé.');
    }

  } catch (error) {
    console.error('Erreur synchronisation au démarrage :', error);
  }
})();
