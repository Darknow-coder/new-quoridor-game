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
  MODE_KEY: 'quoridor4_selected_players_count',
  GAME_MODE_KEY: 'quoridor4_game_mode',
  CHAOS_UNLOCK_TROPHIES: 300,
  CHAOS_SPECIAL_COUNT: 8
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
 {id:'portal',name:'Portail',price:1100,rarity:'Rare',icon:'🌀',desc:'Un portail mystique s’ouvre lorsque tu utilises une carte.',color:'#B36BFF'},
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
  // Communes
  { id:'sprint', name:'Sprint', icon:'⚡', rarity:'Commune', color:'#4DA3FF', desc:'Avance jusqu’à 2 cases en suivant ton meilleur chemin.', weight:18, effect:'sprint2' },
  { id:'freewall', name:'Mur gratuit', icon:'🧱', rarity:'Commune', color:'#63C174', desc:'Pose une barrière sans consommer de barrière.', weight:18, effect:'freewall' },
  { id:'vision', name:'Vision', icon:'👁️', rarity:'Commune', color:'#6E8DFF', desc:'Révèle les 3 prochaines cases de ton meilleur chemin.', weight:16, effect:'vision3' },
  { id:'rebound', name:'Rebond', icon:'↩️', rarity:'Commune', color:'#3FB7A3', desc:'Avance d’une case supplémentaire si elle est disponible.', weight:14, effect:'sprint2' },
  { id:'builder', name:'Petit bâtisseur', icon:'🔨', rarity:'Commune', color:'#8A9A5B', desc:'Pose une barrière avec une tentative gratuite supplémentaire.', weight:12, effect:'freewall' },
  { id:'focus', name:'Concentration', icon:'🎯', rarity:'Commune', color:'#5B8DEF', desc:'Révèle ton meilleur prochain déplacement.', weight:10, effect:'vision3' },

  // Rares
  { id:'doubleturn', name:'Double tour', icon:'🔄', rarity:'Rare', color:'#4C7DFF', desc:'Ton prochain coup est immédiatement suivi d’un autre.', weight:7, effect:'doubleturn' },
  { id:'jump', name:'Saut', icon:'🌀', rarity:'Rare', color:'#7A5CFF', desc:'Avance jusqu’à 3 cases en une seule utilisation.', weight:6, effect:'jump3' },
  { id:'longvision', name:'Radar', icon:'📡', rarity:'Rare', color:'#2FA8D8', desc:'Révèle jusqu’à 5 cases de ton meilleur chemin.', weight:5, effect:'vision5' },
  { id:'reservewall', name:'Réserve', icon:'📦', rarity:'Rare', color:'#3B9E68', desc:'Récupère une barrière pour ta réserve.', weight:5, effect:'recoverwall' },
  { id:'precision', name:'Précision', icon:'🧭', rarity:'Rare', color:'#4D9FBF', desc:'Ton prochain déplacement suit directement la meilleure route.', weight:4, effect:'sprint2' },

  // Épiques
  { id:'dash', name:'Ruée', icon:'💨', rarity:'Épique', color:'#A855F7', desc:'Avance jusqu’à 4 cases sur ton meilleur chemin.', weight:3, effect:'jump4' },
  { id:'fortress', name:'Forteresse', icon:'🏰', rarity:'Épique', color:'#8B5CF6', desc:'Pose une barrière gratuite et récupère une barrière ensuite.', weight:3, effect:'fortress' },
  { id:'oracle', name:'Oracle', icon:'🔮', rarity:'Épique', color:'#9B6DFF', desc:'Révèle jusqu’à 7 cases de ton meilleur chemin.', weight:2.5, effect:'vision7' },
  { id:'momentum', name:'Élan', icon:'🔥', rarity:'Épique', color:'#E06CFF', desc:'Avance jusqu’à 3 cases et gagne un déplacement supplémentaire.', weight:2, effect:'momentum' },
  { id:'architect', name:'Architecte', icon:'📐', rarity:'Épique', color:'#C084FC', desc:'Pose une barrière gratuitement, même si ta réserve est vide.', weight:2, effect:'freewall' },

  // Légendaires
  { id:'warp', name:'Distorsion', icon:'🪐', rarity:'Légendaire', color:'#D946EF', desc:'Avance jusqu’à 5 cases en suivant le meilleur chemin.', weight:1.2, effect:'jump5' },
  { id:'mastermind', name:'Génie tactique', icon:'🧠', rarity:'Légendaire', color:'#EC4899', desc:'Révèle jusqu’à 9 cases de ton meilleur chemin.', weight:0.9, effect:'vision9' },
  { id:'fortressplus', name:'Bastion', icon:'🛡️', rarity:'Légendaire', color:'#F59E0B', desc:'Pose une barrière gratuite et récupère immédiatement une barrière.', weight:0.7, effect:'fortress' },
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
let pendingPackRewards = null;
let packOpenPhase = 'idle';

function openCardPack() {
  const coins=loadCoins();
  if(coins<PACK_COST) { showMessage(`Il te faut ${PACK_COST} 🪙 pour acheter un pack.`); return; }
  const overlay=document.getElementById('pack-opening-overlay');
  if(!overlay || overlay.classList.contains('opening')) return;

  // L'achat ne révèle rien immédiatement : le pack apparaît d'abord à l'écran.
  addCoins(-PACK_COST);
  pendingPackRewards=[];
  for(let i=0;i<3;i++) pendingPackRewards.push(weightedRandomCard());
  packOpenPhase='ready';
  showPackReadyAnimation();
}

function showPackReadyAnimation() {
  const overlay=document.getElementById('pack-opening-overlay');
  const visual=document.getElementById('pack-visual');
  const stage=document.getElementById('pack-reveal-stage');
  const subtitle=document.getElementById('pack-opening-subtitle');
  const closeBtn=document.getElementById('pack-opening-close');
  if(!overlay || !visual || !stage || !subtitle) return;

  overlay.classList.remove('hidden','closing');
  overlay.classList.add('opening','pack-ready-phase');
  overlay.setAttribute('aria-hidden','false');
  stage.innerHTML='';
  if(closeBtn) closeBtn.classList.add('hidden');
  // Reset propre des animations pour que chaque nouvel achat rejoue vraiment l'entrée.
  visual.className='pack-visual';
  void visual.offsetWidth;
  visual.classList.add('pack-ready');
  subtitle.textContent='Clique sur le pack pour l’ouvrir';

  // Le pack devient cliquable après son arrivée à l'écran.
  visual.onclick=triggerPackOpening;
  visual.setAttribute('role','button');
  visual.setAttribute('tabindex','0');
  visual.setAttribute('aria-label','Ouvrir le pack');
  visual.onkeydown=(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); triggerPackOpening(); } };
}

function triggerPackOpening() {
  if(packOpenPhase!=='ready') return;
  packOpenPhase='opening';

  const overlay=document.getElementById('pack-opening-overlay');
  const visual=document.getElementById('pack-visual');
  const subtitle=document.getElementById('pack-opening-subtitle');
  if(!overlay || !visual) return;

  visual.onclick=null;
  visual.onkeydown=null;
  visual.removeAttribute('tabindex');
  visual.setAttribute('aria-label','Pack en cours d’ouverture');
  subtitle.textContent='Il s’ouvre...';
  playSound('pack');

  // Petit délai de suspense : tremblement, puis ouverture et grosse lumière.
  // Force le navigateur à repartir d'un état neutre avant le shake.
  visual.classList.remove('pack-ready','pack-shake','pack-opened','pack-light-burst');
  void visual.offsetWidth;
  visual.classList.add('pack-shake');
  setTimeout(()=>visual.classList.add('pack-opened'),520);
  setTimeout(()=>{
    subtitle.textContent='✨ La lumière sort du pack !';
    visual.classList.add('pack-light-burst');
  },680);

  // Pour l'instant on s'arrête à cette étape : le reveal des cartes viendra ensuite.
  setTimeout(()=>{
    if(packOpenPhase!=='opening') return;
    subtitle.textContent='Pack ouvert !';
    if(pendingPackRewards){
      pendingPackRewards.forEach(card=>addCardToCollection(card.id,1));
    }
    packOpenPhase='opened';
  },1250);
}

function openPackOpeningAnimation(rewards) {
  // Compatibilité avec les anciennes versions : redirige vers le nouveau flow.
  pendingPackRewards = Array.isArray(rewards) ? rewards : null;
  showPackReadyAnimation();
}

function closePackOpening() {
  const overlay=document.getElementById('pack-opening-overlay');
  const visual=document.getElementById('pack-visual');
  if(!overlay) return;
  packOpenPhase='idle';
  pendingPackRewards=null;
  if(visual){ visual.onclick=null; visual.onkeydown=null; }
  overlay.classList.remove('opening','pack-ready-phase');
  overlay.classList.add('closing');
  setTimeout(()=>{
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
    overlay.setAttribute('aria-hidden','true');
    openMenuPanel('cards');
  },260);
}
window.openCardPack=openCardPack;
window.openCardsPanel=()=>openMenuPanel('cards');

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

function stepSize() {
  return isPentagonMode() ? pentMetrics().step : CONFIG.CELL_SIZE + CONFIG.WALL_GAP;
}

function cellPixelPos(r, c) {
  const m = isPentagonMode() ? pentMetrics() : { cell: CONFIG.CELL_SIZE, step: stepSize() };
  const offset = isPentagonMode() ? (m.step - m.cell) / 2 : 0;
  return { x: c * m.step + offset, y: r * m.step + offset };
}

function boardPixelSize() {
  if (isPentagonMode()) {
    const m = pentMetrics();
    return N * m.cell + (N - 1) * m.gap;
  }
  return N * CONFIG.CELL_SIZE + (N - 1) * CONFIG.WALL_GAP;
}

function wallPixelRect(i, j, orientation) {
  const m = isPentagonMode() ? pentMetrics() : { cell: CONFIG.CELL_SIZE, gap: CONFIG.WALL_GAP, step: stepSize() };
  const step = m.step, gap = m.gap, cell = m.cell;
  if (orientation === 'H') {
    return { x: j * step + (isPentagonMode() ? (step-cell)/2 : 0), y: (i + 1) * step - gap, width: 2 * cell + gap, height: gap };
  }
  return { x: (j + 1) * step - gap, y: i * step + (isPentagonMode() ? (step-cell)/2 : 0), width: gap, height: 2 * cell + gap };
}

function jointHitboxRect(i, j) {
  const m = isPentagonMode() ? pentMetrics() : { gap: CONFIG.WALL_GAP, step: stepSize() };
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
    return { ...def, row: pos.row, col: pos.col, wallsLeft: wallsPerPlayer };
  });
  const gameState = {
    players, currentPlayerIndex: 0, walls: new Set(), jointOrientations: new Map(),
    mode: 'move', orientation: 'H', gameOver: false, difficulty: getDifficultyKey(),
    trophies: loadTrophies(), coins: loadCoins(),
    cardHand: drawHand(), cardUsed: new Set(), pendingFreeWall: false, extraTurn: false, extraTurnForId: null, visionCells: [],
    chaos: getGameMode() === CHAOS_MODE, specialCells: new Map()
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
  if (changed) { playSound('move'); emitCosmeticEffect('move', player); }
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

function startGame() {
  uiLocked = false;
  showScreen('game');
  state = createNewGameState();
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

  if (player.isHuman) { setMode('move'); refreshHighlights(); } 
  else { clearHighlights(); setTimeout(() => runBotTurn(player), CONFIG.BOT_MOVE_DELAY_MS); }
}

function endTurn() {
  if (state.gameOver) return;
  clearHighlights();
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
    if (player.wallPassMoves) player.wallPassMoves = 0;
    renderPawns();
    if (checkWinAfterMove(player)) return true;
    resolveChaosCell(player);
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

  if (isChaosMode() && player.chaosBonusSteps > 1) {
    const reachable = getChaosReachableCells(player, player.chaosBonusSteps);
    if (reachable.length) {
      reachable.sort((a,b)=>dist[a[0]][a[1]]-dist[b[0]][b[1]]); choice = reachable[0];
    }
    player.chaosBonusSteps = 0;
  }
  if (player.wallPassMoves) player.wallPassMoves = 0;
  movePawn(player, choice[0], choice[1]);
  renderPawns();
  if (checkWinAfterMove(player)) return true;
  resolveChaosCell(player);
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
    shop = { owned: ['classic'], equipped: 'classic', effectOwned: ['trail'], effectEquipped: 'trail' };
  } else {
    try {
      const parsed = JSON.parse(raw);
      shop = {
        owned: Array.isArray(parsed.owned) ? parsed.owned.slice() : ['classic'],
        equipped: typeof parsed.equipped === 'string' ? parsed.equipped : 'classic',
        effectOwned: Array.isArray(parsed.effectOwned) ? parsed.effectOwned.slice() : ['trail'],
        effectEquipped: typeof parsed.effectEquipped === 'string' ? parsed.effectEquipped : 'trail',
      };
    } catch {
      shop = { owned: ['classic'], equipped: 'classic', effectOwned: ['trail'], effectEquipped: 'trail' };
    }
  }
  if (!Array.isArray(shop.effectOwned)) shop.effectOwned = ['trail'];
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
window.buyEffectFromShop=function(id){ const e=EFFECTS.find(x=>x.id===id); if(!e)return; const s=loadShop(); if(s.effectOwned.includes(id))return; if(loadCoins()<e.price){showShopFeedback('🪙 Jetons insuffisants',true);return;} addCoins(-e.price); s.effectOwned.push(id); saveShop(s); showShopFeedback(`✨ ${e.name} acheté !`,false); renderShopPanel(); };
window.equipEffectFromShop=function(id){ const s=loadShop(); if(!s.effectOwned.includes(id))return; s.effectEquipped=id; saveShop(s); renderShopPanel(); };
function buildEffectCardHTML(e,shop){
  const owned=shop.effectOwned.includes(e.id), equipped=shop.effectEquipped===e.id;
  const action=equipped?'<div class="shop-badge equipped">✓ ÉQUIPÉ</div>':owned?`<button class="shop-action-btn equip-btn effect-action" onclick="equipEffectFromShop('${e.id}')">ÉQUIPER</button>`:`<button class="shop-action-btn buy-btn effect-action" onclick="buyEffectFromShop('${e.id}')">ACHETER</button>`;
  const fx=`<div class="preview-fx fx-${e.id}"><i></i><i></i><i></i><i></i><i></i></div>`;
  return `<div class="effect-shop-card ${owned?'owned':''} ${equipped?'equipped':''}"><div class="effect-preview effect-${e.id}"><div class="preview-pawn"></div>${fx}</div><div class="effect-rarity">${e.rarity}</div><div class="effect-shop-name">${e.name}</div><div class="effect-shop-desc">${e.desc}</div><div class="effect-price">${e.price?'🪙 '+e.price:'Gratuit'}</div>${action}</div>`;
}
function emitCosmeticEffect(type, player){ if(!player || !player.isHuman)return; const board=boardEl(); if(!board)return; const el=document.getElementById('pawn-'+player.id); if(!el)return; const effect=getEquippedEffect(); if(!effect)return; if(type==='card' && effect.id!=='portal') return; if(type==='move' && !['trail','spark','lightning','inferno','blizzard','galaxy','royal'].includes(effect.id)) return; const count={trail:4,spark:8,lightning:5,portal:10,inferno:12,blizzard:12,galaxy:14,royal:16}[effect.id]||6; const rect=board.getBoundingClientRect(), pr=el.getBoundingClientRect(); const bx=pr.left-rect.left+pr.width/2, by=pr.top-rect.top+pr.height/2; if(effect.id==='portal'||effect.id==='royal') { const ring=document.createElement('div'); ring.className='effect-ripple'; ring.style.left=bx+'px'; ring.style.top=by+'px'; ring.style.width=pr.width*.8+'px'; ring.style.height=pr.height*.8+'px'; ring.style.borderColor=effect.color; board.appendChild(ring); setTimeout(()=>ring.remove(),600); }
 const specialMap={lightning:'fx-lightning-real',portal:'fx-portal-real',inferno:'fx-inferno-real',blizzard:'fx-blizzard-real',galaxy:'fx-galaxy-real',royal:'fx-royal-real'};
 if(specialMap[effect.id]) {
   const special=document.createElement('div');
   special.className='effect-special '+specialMap[effect.id];
   special.style.left=bx+'px'; special.style.top=by+'px';
   board.appendChild(special);
   setTimeout(()=>special.remove(),1100);
 }
 for(let i=0;i<count;i++){ const p=document.createElement('div'); p.className='effect-particle '+(effect.id==='galaxy'?'star':''); const size=effect.id==='royal'?5+Math.random()*5:4+Math.random()*5; p.style.width=size+'px';p.style.height=size+'px';p.style.background=effect.color; p.style.boxShadow=`0 0 8px ${effect.color}`; const ang=Math.random()*Math.PI*2, dist=12+Math.random()*24; p.style.left=bx+'px';p.style.top=by+'px';p.style.setProperty('--dx',Math.cos(ang)*dist+'px');p.style.setProperty('--dy',Math.sin(ang)*dist+'px'); board.appendChild(p); setTimeout(()=>p.remove(),700); }
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
      <h2>❓ Comment jouer</h2>
      <div class="tutorial-step"><span class="tutorial-step-number">1</span><p>Tu pars en bas du plateau. Ton objectif est la zone verte en haut.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">2</span><p>À ton tour, déplace ton pion d'une case ou pose une <strong>Barrière</strong>.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">3</span><p>Les barrières rallongent le chemin des adversaires, mais ne peuvent pas bloquer complètement leur route.</p></div>
      <div class="tutorial-step"><span class="tutorial-step-number">4</span><p>Le premier joueur à atteindre son côté opposé gagne la partie.</p></div>
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
      cell.style.width = CONFIG.CELL_SIZE + 'px'; cell.style.height = CONFIG.CELL_SIZE + 'px';
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
      const pawnCellSize = isPentagonMode() ? pentMetrics().cell : CONFIG.CELL_SIZE;
      const pawnSize = pawnCellSize * 0.72;
      pawnEl.style.width = pawnSize + 'px'; pawnEl.style.height = pawnSize + 'px';
      boardEl().appendChild(pawnEl);
    }

    // Le joueur humain affiche le skin actuellement équipé dans la Boutique.
    // Les bots gardent exactement leur couleur habituelle (jamais modifiée).
    if (player.isHuman) {
      applyPawnSkin(pawnEl, getEquippedSkin());
    } else {
      pawnEl.className = 'pawn';
      pawnEl.style.background = player.color;
      pawnEl.style.removeProperty('--pawn-icon');
      pawnEl.style.border = '2px solid rgba(0,0,0,0.18)';
    }

    const { x, y } = cellPixelPos(player.row, player.col);
    const pawnCellSize = isPentagonMode() ? pentMetrics().cell : CONFIG.CELL_SIZE;
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
  if (!state || state.cardUsed.has(id)) return false;
  state.cardUsed.add(id);
  return true;
}
function cardAvailable(id) {
  return !!state && !state.gameOver && currentPlayer().isHuman && state.cardHand.includes(id) && !state.cardUsed.has(id);
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
  if(!cardAvailable(id)) return;
  playSound('card');
  emitCosmeticEffect('card', currentPlayer());
  const c=cardById(id); if(!c) return;
  const player=currentPlayer();
  const effect=c.effect;

  if(effect==='freewall') {
    state.pendingFreeWall=true; markCardUsed(id); setMode('wall'); renderCardBar();
    showMessage('🧱 Barrière gratuite activée : choisis où la poser.',3000); return;
  }
  if(effect==='recoverwall') {
    player.wallsLeft += 1; markCardUsed(id); renderPawns(); renderCardBar();
    showMessage('📦 +1 barrière récupérée !',2500); return;
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
  if(effect==='sprint2' || effect==='jump3' || effect==='jump4' || effect==='jump5' || effect==='momentum' || effect==='legendaryrush') {
    const maxSteps=effect==='sprint2'?2:effect==='jump3'?3:effect==='jump4'?4:5;
    let moved=0; let cur=[player.row,player.col];
    for(let k=0;k<maxSteps;k++){
      const dist=computeGoalDistances(player.side);
      const opts=neighborsOpen(cur[0],cur[1]).filter(([r,c])=>!isCellOccupied(r,c,player.id)).sort((a,b)=>dist[a[0]][a[1]]-dist[b[0]][b[1]]);
      if(!opts.length) break; cur=opts[0]; moved++;
      if(isGoalCell(player.side,cur[0],cur[1])) break;
    }
    if(moved===0){ showMessage('Cette carte ne peut pas être utilisée ici.'); return; }
    markCardUsed(id); movePawn(player,cur[0],cur[1]); renderPawns(); renderCardBar();
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
  const c=cardById(id);
  const player=currentPlayer();
  if(!c || !player) return;
  uiLocked = true;
  playSound('card');
  emitCosmeticEffect('card', player);
  runCardActivationAnimation(c, player, () => {
    uiLocked = false;
    resolveCardUse(id);
  });
}

window.useCard=useCard;
window.toggleAudio=toggleAudio;
window.setAudioVolume=setAudioVolume;
window.testAudio=testAudio;
window.playSound=playSound;

function onCellClick(r, c) {
  if (state.gameOver || state.mode !== 'move' || uiLocked) return;
  const player = currentPlayer(); if (!player.isHuman) return;
  if (!getValidMoveCells(player).some(([vr, vc]) => vr === r && vc === c)) return;

  uiLocked = true; movePawn(player, r, c);
  if (player.chaosBonusSteps) player.chaosBonusSteps = 0;
  if (player.wallPassMoves) player.wallPassMoves = 0;
  renderPawns();
  setTimeout(() => { uiLocked = false; if (checkWinAfterMove(player)) return; resolveChaosCell(player); if (checkWinAfterMove(player)) return; endTurn(); }, 420);
}

function onJointClick(i, j) {
  if (state.gameOver || state.mode !== 'wall' || uiLocked) return;
  const player = currentPlayer(); if (!player.isHuman) return;

  const freeWall = !!state.pendingFreeWall;
  const result = canPlaceWall(player, i, j, state.orientation, freeWall);
  if (!result.ok) { showMessage(result.reason); return; }

  uiLocked = true;
  if (freeWall) { state.pendingFreeWall = false; markCardUsed('freewall'); }
  placeWall(player, i, j, state.orientation, freeWall);
  renderCardBar();
  setTimeout(() => { uiLocked = false; endTurn(); }, 250);
}

function endGame(humanWon, winnerName) {
  if (state.gameOver) return; // Sécurité pour empêcher plusieurs exécutions
  state.gameOver = true;
  playSound(humanWon ? 'win' : 'lose');
  if (humanWon) emitCosmeticEffect('move', state.players.find(p=>p.isHuman));
  recordResult(humanWon);
  
  const difficulty = getDifficultyInfo();
  const deltaTrophies = humanWon ? difficulty.trophiesWin : -difficulty.trophiesLoss;
  const deltaCoins = humanWon ? difficulty.coinsWin : difficulty.coinsLoss;
  
  addTrophies(deltaTrophies);
  addCoins(deltaCoins); 
  
  showEndModal(humanWon, deltaTrophies, deltaCoins);
  clearHighlights();
}

function forfeitGame() { if (!state.gameOver) endGame(false, 'Abandon'); }

function setupEventListeners() {
  document.getElementById('menu-play-btn').addEventListener('click', startGame);
  document.getElementById('menu-shop-btn').addEventListener('click', () => openMenuPanel('shop'));
  document.getElementById('menu-cards-btn').addEventListener('click', () => openMenuPanel('cards'));
  document.getElementById('menu-game-modes-btn').addEventListener('click', () => openMenuPanel('modes'));
  document.getElementById('menu-trophies-btn').addEventListener('click', () => openMenuPanel('trophies'));
  document.getElementById('menu-profile-btn').addEventListener('click', () => openMenuPanel('trophies'));
  
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
  document.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('.audio-toggle-btn')) playSound('click'); }, {passive:true});
  setupEventListeners();
  ensureStarterCards();
  updateMenuDisplays(); // Charge l'affichage correct des monnaies sur l'écran d'accueil
  showScreen('menu');
});
