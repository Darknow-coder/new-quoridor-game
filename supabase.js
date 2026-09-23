const SUPABASE_URL = "https://amknivbzbfskcxckjkob.supabase.co";
const SUPABASE_KEY = "sb_publishable_mtVxAzQB-j21khOp5VyGiw_2rs_O3pR";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let supabaseUser = null;
let syncTimer = null;
let syncInProgress = false;
let syncQueued = false;

window.supabaseReady = null;

const LOCAL_KEYS_TO_SYNC = new Set([
    "quoridor4_profile",
    "quoridor4_trophies",
    "quoridor4_xp",
    "quoridor4_coins"
]);

async function initSupabase() {
    try {
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (sessionData.session?.user) {
            supabaseUser = sessionData.session.user;
            console.log("🟢 Session Supabase récupérée :", supabaseUser.id);
            return supabaseUser;
        }

        const { data, error } =
            await supabaseClient.auth.signInAnonymously();

        if (error) throw error;

        supabaseUser = data.user;
        console.log("🟢 Nouveau joueur Supabase :", supabaseUser.id);
        return supabaseUser;

    } catch (error) {
        console.error("🔴 Erreur connexion Supabase :", error);
        return null;
    }
}

function readLocalPlayerData() {
    let profile = {};

    try {
        profile = JSON.parse(
            localStorage.getItem("quoridor4_profile") || "{}"
        );
    } catch {
        profile = {};
    }

    const username = String(profile?.name || "").trim();

    const trophiesRaw = parseInt(
        localStorage.getItem("quoridor4_trophies") || "0",
        10
    );

    const xpRaw = parseInt(
        localStorage.getItem("quoridor4_xp") || "0",
        10
    );

    const coinsRaw = parseInt(
        localStorage.getItem("quoridor4_coins") || "0",
        10
    );

    const trophies = Number.isFinite(trophiesRaw)
        ? Math.max(0, trophiesRaw)
        : 0;

    const xp = Number.isFinite(xpRaw)
        ? Math.max(0, xpRaw)
        : 0;

    const coins = Number.isFinite(coinsRaw)
        ? Math.max(0, coinsRaw)
        : 0;

    const level = Math.floor(xp / 200) + 1;

    return {
        username,
        trophies,
        xp,
        level,
        coins
    };
}

async function syncPlayerProfile(username) {
    try {
        if (!supabaseUser) {
            await initSupabase();
        }

        if (!supabaseUser) {
            throw new Error("Impossible de créer la session Supabase.");
        }

        const cleanUsername = String(username || "").trim();

        if (!cleanUsername) return null;

        const { data: existing, error: selectError } =
            await supabaseClient
                .from("players")
                .select("id, username")
                .eq("id", supabaseUser.id)
                .maybeSingle();

        if (selectError) throw selectError;

        if (!existing) {
            const { data: created, error: insertError } =
                await supabaseClient
                    .from("players")
                    .insert({
                        id: supabaseUser.id,
                        username: cleanUsername
                    })
                    .select()
                    .single();

            if (insertError) throw insertError;

            console.log("🟢 Profil cloud créé :", created);
            return created;
        }

        if (existing.username !== cleanUsername) {
            const { data: updated, error: updateError } =
                await supabaseClient
                    .from("players")
                    .update({
                        username: cleanUsername
                    })
                    .eq("id", supabaseUser.id)
                    .select()
                    .maybeSingle();

            if (updateError) throw updateError;

            return updated || existing;
        }

        return existing;

    } catch (error) {
        console.error("🔴 Erreur synchronisation profil :", error);
        return null;
    }
}

async function syncPlayerData() {
    try {
        if (!supabaseUser) {
            await initSupabase();
        }

        if (!supabaseUser) {
            throw new Error("Session Supabase indisponible.");
        }

        const data = readLocalPlayerData();

        if (!data.username) {
            console.log("🟡 Aucun pseudo local, synchronisation reportée.");
            return null;
        }

        await syncPlayerProfile(data.username);

        const { data: updated, error } =
            await supabaseClient
                .from("players")
                .update({
                    username: data.username,
                    trophies: data.trophies,
                    xp: data.xp,
                    level: data.level,
                    coins: data.coins
                })
                .eq("id", supabaseUser.id)
                .select()
                .maybeSingle();

        if (error) throw error;

        console.log("☁️ Profil synchronisé :", updated || data);
        return updated || data;

    } catch (error) {
        console.error("🔴 Erreur synchronisation données :", error);
        return null;
    }
}

function requestPlayerSync() {
    clearTimeout(syncTimer);

    syncTimer = setTimeout(async () => {
        if (syncInProgress) {
            syncQueued = true;
            return;
        }

        syncInProgress = true;
        syncQueued = false;

        try {
            await syncPlayerData();
        } finally {
            syncInProgress = false;

            if (syncQueued) {
                requestPlayerSync();
            }
        }
    }, 500);
}

const originalSetItem = localStorage.setItem.bind(localStorage);

localStorage.setItem = function(key, value) {
    originalSetItem(key, value);

    if (LOCAL_KEYS_TO_SYNC.has(String(key))) {
        requestPlayerSync();
    }
};

window.supabaseReady = (async () => {
    const user = await initSupabase();

    if (!user) {
        return {
            ok: false,
            user: null,
            profile: null
        };
    }

    const profile = await syncPlayerData();

    return {
        ok: !!profile,
        user,
        profile
    };
})();

/* ============================================================
   CLASSEMENT EN LIGNE — TOP 100 + RANG PERSONNEL
   ============================================================ */

(function installLeaderboard() {

    if (window.__leaderboardInstalled) return;
    window.__leaderboardInstalled = true;


    /* =========================
       STYLE
    ========================= */

    const style = document.createElement("style");

    style.textContent = `

    /* ---------- bouton menu ---------- */

    .leaderboard-nav-btn {
        position: relative;
        border: 0;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-family: inherit;
        transition: transform .15s ease, color .15s ease;
        min-width: 0;
    }

    .leaderboard-nav-btn span {
        display: block;
        font-size: 1.15rem;
        line-height: 1.1;
    }

    .leaderboard-nav-btn small {
        display: block;
        margin-top: 3px;
        font-size: .62rem;
        font-weight: 700;
        white-space: nowrap;
    }

    .leaderboard-nav-btn:hover {
        color: var(--text-light);
        transform: translateY(-2px);
    }

    .menu-bottom-nav.leaderboard-six {
        display: grid !important;
        grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
        gap: 2px;
    }

    .menu-bottom-nav.leaderboard-six > button {
        min-width: 0;
    }


    /* ---------- écran classement ---------- */

    #leaderboard-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: var(--app-bg);
        color: var(--text-light);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    #leaderboard-overlay.lb-hidden {
        display: none;
    }

    .leaderboard-screen {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 18px clamp(14px, 3vw, 42px) 24px;
    }

    .leaderboard-header {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-shrink: 0;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .leaderboard-close {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 12px;
        background: var(--panel-bg);
        color: var(--text-light);
        font-size: 1.5rem;
        cursor: pointer;
        flex-shrink: 0;
    }

    .leaderboard-title-wrap {
        flex: 1;
        min-width: 0;
    }

    .leaderboard-kicker {
        margin: 0 0 2px;
        color: var(--player-0);
        font-size: .65rem;
        font-weight: 800;
        letter-spacing: 1.4px;
    }

    .leaderboard-title {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(1.55rem, 5vw, 2.4rem);
        line-height: 1;
    }

    .leaderboard-subtitle {
        margin: 5px 0 0;
        color: var(--text-muted);
        font-size: .76rem;
    }

    .leaderboard-refresh {
        border: 1px solid rgba(255,255,255,.08);
        background: var(--panel-bg);
        color: var(--text-light);
        border-radius: 12px;
        min-height: 40px;
        padding: 0 13px;
        font-weight: 800;
        cursor: pointer;
    }

    .leaderboard-refresh:active,
    .leaderboard-close:active {
        transform: scale(.96);
    }


    /* ---------- ma position ---------- */

    .leaderboard-me-card {
        flex-shrink: 0;
        margin: 14px 0;
        padding: 14px 16px;
        border-radius: 16px;
        background:
            linear-gradient(
                135deg,
                rgba(61,220,151,.16),
                rgba(61,220,151,.05)
            );
        border: 1px solid rgba(61,220,151,.28);
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .leaderboard-me-rank {
        min-width: 58px;
        text-align: center;
        font-family: var(--font-display);
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--player-0);
    }

    .leaderboard-me-main {
        flex: 1;
        min-width: 0;
    }

    .leaderboard-me-name {
        font-family: var(--font-display);
        font-size: 1.02rem;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .leaderboard-me-level {
        margin-top: 2px;
        color: var(--text-muted);
        font-size: .72rem;
        font-weight: 700;
    }

    .leaderboard-me-trophies {
        color: var(--accent-gold);
        font-family: var(--font-display);
        font-size: 1rem;
        font-weight: 800;
        white-space: nowrap;
    }


    /* ---------- liste ---------- */

    .leaderboard-list-head {
        display: grid;
        grid-template-columns: 46px 1fr auto;
        gap: 10px;
        padding: 0 13px 7px;
        color: var(--text-muted);
        font-size: .62rem;
        font-weight: 800;
        letter-spacing: .7px;
        text-transform: uppercase;
        flex-shrink: 0;
    }

    .leaderboard-list {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-right: 2px;
    }

    .leaderboard-row {
        display: grid;
        grid-template-columns: 46px 1fr auto;
        gap: 10px;
        align-items: center;
        min-height: 58px;
        margin-bottom: 7px;
        padding: 8px 13px;
        border-radius: 14px;
        background: var(--panel-bg);
        border: 1px solid transparent;
    }

    .leaderboard-row-self {
        border-color: rgba(61,220,151,.4);
        background:
            linear-gradient(
                135deg,
                rgba(61,220,151,.13),
                var(--panel-bg)
            );
    }

    .leaderboard-position {
        text-align: center;
        font-family: var(--font-display);
        font-weight: 800;
        font-size: .9rem;
        color: var(--text-muted);
    }

    .leaderboard-position.top {
        font-size: 1.2rem;
        color: var(--accent-gold);
    }

    .leaderboard-player {
        min-width: 0;
    }

    .leaderboard-player-name {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: .88rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .leaderboard-player-level {
        margin-top: 1px;
        font-size: .66rem;
        color: var(--text-muted);
        font-weight: 700;
    }

    .leaderboard-player-trophies {
        color: var(--accent-gold);
        font-family: var(--font-display);
        font-size: .9rem;
        font-weight: 800;
        white-space: nowrap;
    }


    /* ---------- états ---------- */

    .leaderboard-loading,
    .leaderboard-error,
    .leaderboard-empty {
        min-height: 220px;
        display: grid;
        place-items: center;
        text-align: center;
        color: var(--text-muted);
        padding: 30px;
        font-size: .85rem;
    }

    .leaderboard-error strong {
        display: block;
        color: var(--text-light);
        margin-bottom: 6px;
    }

    .leaderboard-footer {
        flex-shrink: 0;
        text-align: center;
        padding-top: 10px;
        color: rgba(167,171,192,.65);
        font-size: .62rem;
    }


    @media (max-width: 600px) {

        .leaderboard-screen {
            padding: 12px 10px 18px;
        }

        .leaderboard-header {
            gap: 9px;
        }

        .leaderboard-refresh {
            font-size: .72rem;
            padding: 0 9px;
        }

        .leaderboard-list-head,
        .leaderboard-row {
            grid-template-columns: 38px 1fr auto;
        }

        .leaderboard-me-card {
            padding: 12px;
        }

        .leaderboard-me-rank {
            min-width: 48px;
            font-size: 1.15rem;
        }

        .leaderboard-player-trophies,
        .leaderboard-me-trophies {
            font-size: .82rem;
        }

        .leaderboard-nav-btn span {
            font-size: 1rem;
        }

        .leaderboard-nav-btn small {
            font-size: .53rem;
        }
    }

    `;

    document.head.appendChild(style);


    /* =========================
       UTILITAIRE HTML
    ========================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================
       BOUTON
    ========================= */

    function createLeaderboardButton() {

        if (document.getElementById("menu-leaderboard-btn")) {
            return;
        }

        const nav = document.querySelector(".menu-bottom-nav");

        const button = document.createElement("button");
        button.id = "menu-leaderboard-btn";
        button.className = "leaderboard-nav-btn";
        button.type = "button";
        button.innerHTML = `
            <span>🏆</span>
            <small>Classement</small>
        `;

        button.addEventListener("click", openLeaderboard);

        if (nav) {

            nav.classList.add("leaderboard-six");

            const moreBtn = document.getElementById("menu-more-btn");

            if (moreBtn) {
                nav.insertBefore(button, moreBtn);
            } else {
                nav.appendChild(button);
            }

        } else {

            /* Sécurité si ton menu n'utilise plus la navigation basse */
            const grid = document.querySelector("#main-menu .menu-grid");

            if (grid) {
                button.className = "menu-card-btn";
                button.innerHTML = `
                    <span class="menu-card-icon">🏆</span>
                    <span>Classement</span>
                `;
                grid.insertBefore(button, grid.firstChild);
            }
        }
    }


    /* =========================
       ÉCRAN PLEIN ÉCRAN
    ========================= */

    function createLeaderboardOverlay() {

        if (document.getElementById("leaderboard-overlay")) {
            return;
        }

        const overlay = document.createElement("div");

        overlay.id = "leaderboard-overlay";
        overlay.className = "lb-hidden";
        overlay.setAttribute("aria-hidden", "true");

        overlay.innerHTML = `
            <div class="leaderboard-screen">

                <div class="leaderboard-header">

                    <button
                        type="button"
                        class="leaderboard-close"
                        id="leaderboard-close-btn"
                        aria-label="Fermer"
                    >
                        ×
                    </button>

                    <div class="leaderboard-title-wrap">
                        <p class="leaderboard-kicker">
                            CLASSEMENT MONDIAL
                        </p>

                        <h1 class="leaderboard-title">
                            🏆 Classement
                        </h1>

                        <p class="leaderboard-subtitle">
                            Les 100 joueurs avec le plus de trophées
                        </p>
                    </div>

                    <button
                        type="button"
                        class="leaderboard-refresh"
                        id="leaderboard-refresh-btn"
                    >
                        ↻ Actualiser
                    </button>

                </div>


                <div id="leaderboard-me"></div>


                <div class="leaderboard-list-head">
                    <span>#</span>
                    <span>Joueur</span>
                    <span>🏆 Trophées</span>
                </div>


                <div
                    id="leaderboard-list"
                    class="leaderboard-list"
                >
                    <div class="leaderboard-loading">
                        Chargement du classement…
                    </div>
                </div>


                <div class="leaderboard-footer">
                    Classement mis à jour à l'ouverture ou à l'actualisation.
                </div>

            </div>
        `;

        document.body.appendChild(overlay);


        document
            .getElementById("leaderboard-close-btn")
            .addEventListener("click", closeLeaderboard);

        document
            .getElementById("leaderboard-refresh-btn")
            .addEventListener("click", loadLeaderboard);

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                closeLeaderboard();
            }
        });
    }


    /* =========================
       OUVERTURE / FERMETURE
    ========================= */

    async function openLeaderboard() {

        createLeaderboardOverlay();

        const overlay =
            document.getElementById("leaderboard-overlay");

        overlay.classList.remove("lb-hidden");
        overlay.setAttribute("aria-hidden", "false");

        document.body.style.overflow = "hidden";

        await loadLeaderboard();
    }

    function closeLeaderboard() {

        const overlay =
            document.getElementById("leaderboard-overlay");

        if (!overlay) return;

        overlay.classList.add("lb-hidden");
        overlay.setAttribute("aria-hidden", "true");

        document.body.style.overflow = "";
    }

    window.openLeaderboard = openLeaderboard;


    /* =========================
       MEDAILLES
    ========================= */

    function getPositionHTML(position) {

        if (position === 1) return "🥇";
        if (position === 2) return "🥈";
        if (position === 3) return "🥉";

        return String(position);
    }


    /* =========================
       CHARGEMENT CLASSEMENT
    ========================= */

    async function loadLeaderboard() {

        const list =
            document.getElementById("leaderboard-list");

        const me =
            document.getElementById("leaderboard-me");

        if (!list || !me) return;


        list.innerHTML = `
            <div class="leaderboard-loading">
                Chargement du classement…
            </div>
        `;


        try {

            if (window.supabaseReady) {
                await window.supabaseReady;
            }

            if (!supabaseUser) {
                await initSupabase();
            }

            if (!supabaseUser) {
                throw new Error("Connexion Supabase indisponible.");
            }


            /* ---- TOP 100 ---- */

            const { data: players, error: playersError } =
                await supabaseClient
                    .from("players")
                    .select("id, username, trophies, level")
                    .order("trophies", {
                        ascending: false
                    })
                    .order("username", {
                        ascending: true
                    })
                    .limit(100);


            if (playersError) {
                throw playersError;
            }


            /* ---- MON PROFIL ---- */

            let myPlayer =
                players.find(
                    player => player.id === supabaseUser.id
                );


            if (!myPlayer) {

                const { data, error } =
                    await supabaseClient
                        .from("players")
                        .select("id, username, trophies, level")
                        .eq("id", supabaseUser.id)
                        .maybeSingle();

                if (error) {
                    throw error;
                }

                myPlayer = data;
            }


            /* ---- AFFICHAGE MA POSITION ---- */

            if (myPlayer) {

                let myRank = null;


                /* Si je suis déjà dans le top 100,
                   on prend directement ma position. */

                const topIndex =
                    players.findIndex(
                        player => player.id === myPlayer.id
                    );

                if (topIndex !== -1) {

                    myRank = topIndex + 1;

                } else {

                    /*
                     * Sinon on compte combien de joueurs
                     * ont plus de trophées que moi.
                     */

                    const { count, error: rankError } =
                        await supabaseClient
                            .from("players")
                            .select("id", {
                                count: "exact",
                                head: true
                            })
                            .gt(
                                "trophies",
                                Number(myPlayer.trophies) || 0
                            );


                    if (rankError) {
                        console.warn(
                            "Rang personnel indisponible :",
                            rankError
                        );
                    } else {
                        myRank = Number(count || 0) + 1;
                    }
                }


                me.innerHTML = `
                    <div class="leaderboard-me-card">

                        <div class="leaderboard-me-rank">
                            ${myRank ? "#" + myRank : "—"}
                        </div>

                        <div class="leaderboard-me-main">

                            <div class="leaderboard-me-name">
                                ${escapeHTML(
                                    myPlayer.username || "Joueur"
                                )}
                            </div>

                            <div class="leaderboard-me-level">
                                Niveau ${Number(myPlayer.level) || 1}
                            </div>

                        </div>

                        <div class="leaderboard-me-trophies">
                            🏆 ${Number(myPlayer.trophies) || 0}
                        </div>

                    </div>
                `;

            } else {

                me.innerHTML = `
                    <div class="leaderboard-me-card">
                        <div class="leaderboard-me-main">
                            <div class="leaderboard-me-name">
                                Profil non trouvé
                            </div>
                            <div class="leaderboard-me-level">
                                Lance une partie pour synchroniser ton profil.
                            </div>
                        </div>
                    </div>
                `;
            }


            /* ---- TOP 100 ---- */

            if (!players || players.length === 0) {

                list.innerHTML = `
                    <div class="leaderboard-empty">
                        Aucun joueur classé pour le moment.
                    </div>
                `;

                return;
            }


            list.innerHTML = players
                .map((player, index) => {

                    const position = index + 1;
                    const isMe =
                        player.id === supabaseUser.id;

                    return `
                        <div
                            class="
                                leaderboard-row
                                ${isMe ? "leaderboard-row-self" : ""}
                            "
                        >

                            <div
                                class="
                                    leaderboard-position
                                    ${position <= 3 ? "top" : ""}
                                "
                            >
                                ${getPositionHTML(position)}
                            </div>

                            <div class="leaderboard-player">

                                <div class="leaderboard-player-name">
                                    ${escapeHTML(
                                        player.username || "Joueur"
                                    )}
                                    ${isMe ? " · TOI" : ""}
                                </div>

                                <div class="leaderboard-player-level">
                                    Niveau ${Number(player.level) || 1}
                                </div>

                            </div>

                            <div class="leaderboard-player-trophies">
                                🏆 ${Number(player.trophies) || 0}
                            </div>

                        </div>
                    `;
                })
                .join("");


        } catch (error) {

            console.error(
                "Erreur classement :",
                error
            );

            me.innerHTML = "";

            list.innerHTML = `
                <div class="leaderboard-error">
                    <div>
                        <strong>
                            Impossible de charger le classement
                        </strong>
                        Vérifie la permission de lecture de la table
                        <b>players</b> dans Supabase.
                    </div>
                </div>
            `;
        }
    }


    /* =========================
       INITIALISATION
    ========================= */

    function initLeaderboardUI() {

        createLeaderboardButton();
        createLeaderboardOverlay();
    }


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initLeaderboardUI,
            { once: true }
        );

    } else {

        initLeaderboardUI();

    }

})();
/* ============================================================
   👥 SYSTÈME D'AMIS — VERSION COMPLÈTE
   ============================================================ */


/* ============================================================
   BOUTON AMIS
   ============================================================ */

function createFriendsButton() {

    if (document.getElementById("friends-menu-btn")) return;

    const nav =
        document.querySelector(".menu-bottom-nav");

    const button =
        document.createElement("button");

    button.id = "friends-menu-btn";
    button.type = "button";
    button.className = "friends-nav-btn";

    button.innerHTML = `
        <span>👥</span>
        <small>Amis</small>
    `;

    button.addEventListener(
        "click",
        openFriendsPanel
    );


    if (nav) {

        const moreBtn =
            document.getElementById("menu-more-btn");

        if (moreBtn) {

            nav.insertBefore(
                button,
                moreBtn
            );

        } else {

            nav.appendChild(button);

        }

    } else {

        const grid =
            document.querySelector(
                "#main-menu .menu-grid"
            );

        if (grid) {

            button.className =
                "menu-card-btn";

            button.innerHTML = `
                <span class="menu-card-icon">👥</span>
                <span>Amis</span>
            `;

            grid.insertBefore(
                button,
                grid.firstChild
            );

        }

    }

}


/* ============================================================
   ÉCRAN AMIS
   ============================================================ */

function createFriendsOverlay() {

    if (
        document.getElementById(
            "friends-overlay"
        )
    ) return;


    const overlay =
        document.createElement("div");

    overlay.id =
        "friends-overlay";

    overlay.className =
        "friends-hidden";

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );


    overlay.innerHTML = `

        <div class="friends-screen">

            <div class="friends-header">

                <button
                    type="button"
                    class="friends-close"
                    id="friends-close-btn"
                >
                    ×
                </button>


                <div class="friends-title-wrap">

                    <p class="friends-kicker">
                        SOCIAL
                    </p>

                    <h1 class="friends-title">
                        👥 Amis
                    </h1>

                    <p class="friends-subtitle">
                        Ajoute tes amis et retrouve-les ici.
                    </p>

                </div>

            </div>


            <div class="friends-tabs">

                <button
                    type="button"
                    class="friends-tab active"
                    id="friends-tab-list"
                >
                    👥 Mes amis
                </button>


                <button
                    type="button"
                    class="friends-tab"
                    id="friends-tab-requests"
                >
                    🔔 Demandes
                    <span id="friends-request-count">
                        0
                    </span>
                </button>

            </div>


            <div
                id="friends-content"
                class="friends-content"
            >

                <div class="friends-add-box">

                    <div class="friends-add-title">
                        ➕ Ajouter un ami
                    </div>


                    <div class="friends-add-row">

                        <input
                            id="friends-username-input"
                            type="text"
                            maxlength="20"
                            placeholder="Entre son pseudo..."
                            autocomplete="off"
                        >


                        <button
                            type="button"
                            id="friends-add-btn"
                        >
                            Ajouter
                        </button>

                    </div>


                    <p
                        id="friends-add-message"
                        class="friends-add-message"
                    ></p>

                </div>


                <div
                    id="friends-list"
                    class="friends-list"
                >

                    <div class="friends-empty">

                        <div class="friends-empty-icon">
                            👥
                        </div>

                        <h2>
                            Aucun ami pour le moment
                        </h2>

                        <p>
                            Ajoute ton premier ami avec son pseudo.
                        </p>

                    </div>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    document
        .getElementById(
            "friends-close-btn"
        )
        .addEventListener(
            "click",
            closeFriendsPanel
        );


    document
        .getElementById(
            "friends-add-btn"
        )
        .addEventListener(
            "click",
            sendFriendRequestUI
        );


    document
        .getElementById(
            "friends-tab-list"
        )
        .addEventListener(
            "click",
            () => switchFriendsTab("friends")
        );


    document
        .getElementById(
            "friends-tab-requests"
        )
        .addEventListener(
            "click",
            () => switchFriendsTab("requests")
        );


    document
        .getElementById(
            "friends-username-input"
        )
        .addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Enter") {

                    sendFriendRequestUI();

                }

            }
        );

}


/* ============================================================
   OUVRIR / FERMER
   ============================================================ */

function openFriendsPanel() {

    createFriendsOverlay();


    const overlay =
        document.getElementById(
            "friends-overlay"
        );


    if (!overlay) return;


    overlay.classList.remove(
        "friends-hidden"
    );


    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "friends-open"
    );


    switchFriendsTab(
        "friends"
    );

}


function closeFriendsPanel() {

    const overlay =
        document.getElementById(
            "friends-overlay"
        );


    if (!overlay) return;


    overlay.classList.add(
        "friends-hidden"
    );


    overlay.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "friends-open"
    );

}


/* ============================================================
   ONGLETS AMIS / DEMANDES
   ============================================================ */

function switchFriendsTab(tab) {

    const friendsTab =
        document.getElementById(
            "friends-tab-list"
        );

    const requestsTab =
        document.getElementById(
            "friends-tab-requests"
        );

    const content =
        document.getElementById(
            "friends-list"
        );


    if (
        !friendsTab ||
        !requestsTab ||
        !content
    ) return;


    friendsTab.classList.toggle(
        "active",
        tab === "friends"
    );


    requestsTab.classList.toggle(
        "active",
        tab === "requests"
    );


    if (tab === "friends") {

        loadFriendsList();

    } else {

        loadFriendRequests();

    }

}


/* ============================================================
   LISTE DES AMIS
   ============================================================ */

async function loadFriendsList() {

    const list =
        document.getElementById("friends-list");

    if (!list) return;

    list.innerHTML = `
        <div class="friends-empty">
            <div class="friends-empty-icon">⏳</div>
            <h2>Chargement...</h2>
        </div>
    `;

    try {

        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            throw new Error(
                "Utilisateur Supabase introuvable"
            );
        }


        const {
            data: relations,
            error
        } = await supabaseClient
            .from("friend_requests")
            .select(`
                id,
                sender_id,
                receiver_id,
                status
            `)
            .eq("status", "accepted")
            .or(
                `sender_id.eq.${user.id},receiver_id.eq.${user.id}`
            );


        if (error) throw error;


        if (!relations || relations.length === 0) {

            showEmptyFriendsList();

            return;

        }


        const friendIds =
            relations.map(relation => {

                return relation.sender_id === user.id
                    ? relation.receiver_id
                    : relation.sender_id;

            });


        const uniqueFriendIds =
            [...new Set(friendIds)];


        const {
            data: friends,
            error: friendsError
        } = await supabaseClient
            .from("players")
            .select(`
                id,
                username,
                trophies,
                level
            `)
            .in("id", uniqueFriendIds);


        if (friendsError) {
            throw friendsError;
        }


        if (!friends || friends.length === 0) {

            showEmptyFriendsList();

            return;

        }


        friends.sort(
            (a, b) =>
                (Number(b.trophies) || 0) -
                (Number(a.trophies) || 0)
        );


        list.innerHTML = friends.map(friend => {

            const username =
                friend.username || "Joueur";

            const trophies =
                Number(friend.trophies) || 0;

            const level =
                Number(friend.level) || 1;


            return `
                <div
                    class="friend-card"
                    data-friend-id="${friend.id}"
                >

                    <div class="friend-card-player">

                        <div class="friend-card-avatar">
                            👤
                        </div>

                        <div class="friend-card-info">

                            <strong>
                                ${escapeFriendHtml(username)}
                            </strong>

                            <span>
                                Niveau ${level}
                            </span>

                        </div>

                    </div>


                    <div class="friend-card-trophies">
                        🏆 ${trophies}
                    </div>

                </div>
            `;

        }).join("");


        /* Clic sur un ami */

        list
            .querySelectorAll(".friend-card")
            .forEach(card => {

                card.addEventListener(
                    "click",
                    () => {

                        openFriendProfile(
                            card.dataset.friendId
                        );

                    }
                );

            });


    } catch (error) {

        console.error(
            "Erreur chargement amis :",
            error
        );


        list.innerHTML = `
            <div class="friends-empty">

                <div class="friends-empty-icon">
                    ⚠️
                </div>

                <h2>
                    Impossible de charger tes amis
                </h2>

                <p>
                    Réessaie dans quelques instants.
                </p>

            </div>
        `;

    }
}
/* ============================================================
   👤 PROFIL D'UN AMI
   ============================================================ */

async function openFriendProfile(friendId) {

    if (!friendId) return;


    let overlay =
        document.getElementById(
            "friend-profile-overlay"
        );


    if (!overlay) {

        overlay =
            document.createElement("div");

        overlay.id =
            "friend-profile-overlay";

        overlay.className =
            "friend-profile-hidden";

        document.body.appendChild(
            overlay
        );

    }


    overlay.innerHTML = `
        <div class="friend-profile-screen">

            <button
                type="button"
                class="friend-profile-close"
                id="friend-profile-close"
            >
                ×
            </button>

            <div
                id="friend-profile-content"
                class="friend-profile-content"
            >

                <div class="friends-empty">

                    <div class="friends-empty-icon">
                        ⏳
                    </div>

                    <h2>
                        Chargement...
                    </h2>

                </div>

            </div>

        </div>
    `;


    overlay.classList.remove(
        "friend-profile-hidden"
    );


    document
        .getElementById(
            "friend-profile-close"
        )
        .addEventListener(
            "click",
            closeFriendProfile
        );


    try {

        const {
            data: friend,
            error
        } = await supabaseClient
            .from("players")
            .select(`
                id,
                username,
                trophies,
                level,
                xp
            `)
            .eq(
                "id",
                friendId
            )
            .maybeSingle();


        if (error) throw error;


        if (!friend) {

            throw new Error(
                "Joueur introuvable"
            );

        }


        const username =
            friend.username || "Joueur";

        const trophies =
            Number(friend.trophies) || 0;

        const level =
            Number(friend.level) || 1;

        const xp =
            Number(friend.xp) || 0;


        document
            .getElementById(
                "friend-profile-content"
            )
            .innerHTML = `

                <div class="friend-profile-avatar">
                    👤
                </div>

                <p class="friend-profile-kicker">
                    PROFIL JOUEUR
                </p>

                <h1 class="friend-profile-name">
                    ${escapeFriendHtml(username)}
                </h1>

                <div class="friend-profile-stats">

                    <div class="friend-profile-stat">

                        <span class="friend-profile-stat-icon">
                            🏆
                        </span>

                        <strong>
                            ${trophies}
                        </strong>

                        <small>
                            Trophées
                        </small>

                    </div>


                    <div class="friend-profile-stat">

                        <span class="friend-profile-stat-icon">
                            ⭐
                        </span>

                        <strong>
                            ${level}
                        </strong>

                        <small>
                            Niveau
                        </small>

                    </div>


                    <div class="friend-profile-stat">

                        <span class="friend-profile-stat-icon">
                            ✨
                        </span>

                        <strong>
                            ${xp}
                        </strong>

                        <small>
                            XP
                        </small>

                    </div>

                </div>

            `;


    } catch (error) {

        console.error(
            "Erreur profil ami :",
            error
        );


        document
            .getElementById(
                "friend-profile-content"
            )
            .innerHTML = `

                <div class="friends-empty">

                    <div class="friends-empty-icon">
                        ⚠️
                    </div>

                    <h2>
                        Profil introuvable
                    </h2>

                    <p>
                        Impossible de charger ce joueur.
                    </p>

                </div>

            `;

    }

}


function closeFriendProfile() {

    const overlay =
        document.getElementById(
            "friend-profile-overlay"
        );


    if (!overlay) return;


    overlay.classList.add(
        "friend-profile-hidden"
    );

}

function showEmptyFriendsList() {

    const list =
        document.getElementById(
            "friends-list"
        );


    if (!list) return;


    list.innerHTML = `

        <div class="friends-empty">

            <div class="friends-empty-icon">
                👥
            </div>

            <h2>
                Aucun ami pour le moment
            </h2>

            <p>
                Ajoute ton premier ami avec son pseudo.
            </p>

        </div>

    `;

}


/* ============================================================
   ENVOYER UNE DEMANDE
   ============================================================ */

async function sendFriendRequestUI() {

    const input =
        document.getElementById(
            "friends-username-input"
        );


    const message =
        document.getElementById(
            "friends-add-message"
        );


    if (
        !input ||
        !message
    ) return;


    const username =
        input.value.trim();


    if (!username) {

        message.textContent =
            "⚠️ Entre un pseudo.";

        return;

    }


    if (
        username.length < 2
    ) {

        message.textContent =
            "⚠️ Le pseudo est trop court.";

        return;

    }


    const currentUsername =
        typeof getPlayerName === "function"
            ? getPlayerName()
            : "";


    if (
        currentUsername &&
        username.toLowerCase() ===
        currentUsername.toLowerCase()
    ) {

        message.textContent =
            "⚠️ Tu ne peux pas t'ajouter toi-même.";

        return;

    }


    message.textContent =
        "⏳ Recherche du joueur...";


    try {

        const {
            data: targetPlayer,
            error: searchError
        } =
            await supabaseClient
                .from("players")
                .select(
                    "id, username"
                )
                .ilike(
                    "username",
                    username
                )
                .maybeSingle();


        if (searchError) {

            console.error(
                "Erreur recherche joueur :",
                searchError
            );


            message.textContent =
                "❌ Impossible de rechercher ce joueur.";

            return;

        }


        if (!targetPlayer) {

            message.textContent =
                "❌ Joueur introuvable.";

            return;

        }


        const {
            data: { user },
            error: userError
        } =
            await supabaseClient.auth.getUser();


        if (
            userError ||
            !user
        ) {

            message.textContent =
                "❌ Connexion Supabase introuvable.";

            return;

        }


        if (
            targetPlayer.id ===
            user.id
        ) {

            message.textContent =
                "⚠️ Tu ne peux pas t'ajouter toi-même.";

            return;

        }


        const {
            data: existingRequest,
            error: existingError
        } =
            await supabaseClient
                .from("friend_requests")
                .select(
                    "id, status, sender_id, receiver_id"
                )
                .or(
                    `and(sender_id.eq.${user.id},receiver_id.eq.${targetPlayer.id}),and(sender_id.eq.${targetPlayer.id},receiver_id.eq.${user.id})`
                )
                .maybeSingle();


        if (existingError) {

            console.error(
                "Erreur vérification demande :",
                existingError
            );


            message.textContent =
                "❌ Impossible de vérifier cette demande.";

            return;

        }


        if (existingRequest) {

            if (
                existingRequest.status ===
                "accepted"
            ) {

                message.textContent =
                    "👥 Ce joueur est déjà dans tes amis.";

            } else if (
                existingRequest.sender_id ===
                    user.id &&
                existingRequest.status ===
                    "pending"
            ) {

                message.textContent =
                    "⏳ Une demande est déjà en attente.";

            } else if (
                existingRequest.receiver_id ===
                    user.id &&
                existingRequest.status ===
                    "pending"
            ) {

                message.textContent =
                    "🔔 Ce joueur t'a déjà envoyé une demande.";

            } else {

                message.textContent =
                    "⚠️ Une relation existe déjà avec ce joueur.";

            }


            return;

        }


        const {
            error: insertError
        } =
            await supabaseClient
                .from("friend_requests")
                .insert({

                    sender_id:
                        user.id,

                    receiver_id:
                        targetPlayer.id,

                    status:
                        "pending"

                });


        if (insertError) {

            console.error(
                "Erreur création demande :",
                insertError
            );


            message.textContent =
                "❌ Impossible d'envoyer la demande.";

            return;

        }


        message.textContent =
            `✅ Demande envoyée à ${targetPlayer.username} !`;


        input.value = "";


    } catch (error) {

        console.error(
            "Erreur système amis :",
            error
        );


        message.textContent =
            "❌ Une erreur est survenue.";

    }

}


/* ============================================================
   DEMANDES REÇUES
   ============================================================ */

async function loadFriendRequests() {

    const list =
        document.getElementById(
            "friends-list"
        );


    const count =
        document.getElementById(
            "friends-request-count"
        );


    if (
        !list ||
        !count
    ) return;


    list.innerHTML = `

        <div class="friends-empty">

            <div class="friends-empty-icon">
                ⏳
            </div>

            <h2>
                Chargement...
            </h2>

        </div>

    `;


    try {

        const {
            data: { user },
            error: userError
        } =
            await supabaseClient.auth.getUser();


        if (
            userError ||
            !user
        ) {

            throw new Error(
                "Utilisateur Supabase introuvable"
            );

        }


        const {
            data: requests,
            error
        } =
            await supabaseClient
                .from("friend_requests")
                .select(`
                    id,
                    sender_id,
                    status,
                    created_at
                `)
                .eq(
                    "receiver_id",
                    user.id
                )
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) throw error;


        count.textContent =
            requests?.length || 0;


        if (
            !requests ||
            requests.length === 0
        ) {

            list.innerHTML = `

                <div class="friends-empty">

                    <div class="friends-empty-icon">
                        🔔
                    </div>

                    <h2>
                        Aucune demande
                    </h2>

                    <p>
                        Les demandes d'amis reçues apparaîtront ici.
                    </p>

                </div>

            `;

            return;

        }


        const senderIds =
            requests.map(
                request =>
                    request.sender_id
            );


        const {
            data: senders,
            error: sendersError
        } =
            await supabaseClient
                .from("players")
                .select(
                    "id, username"
                )
                .in(
                    "id",
                    senderIds
                );


        if (sendersError) {

            throw sendersError;

        }


        const senderMap =
            new Map(
                (senders || []).map(
                    player => [
                        player.id,
                        player.username
                    ]
                )
            );


        list.innerHTML =
            requests.map(
                request => {

                    const username =
                        senderMap.get(
                            request.sender_id
                        ) ||
                        "Joueur inconnu";


                    return `

                        <div
                            class="friend-request-card"
                        >

                            <div
                                class="friend-request-player"
                            >

                                <div
                                    class="friend-request-avatar"
                                >
                                    👤
                                </div>


                                <div>

                                    <strong>
                                        ${escapeFriendHtml(username)}
                                    </strong>

                                    <small>
                                        Demande d'ami
                                    </small>

                                </div>

                            </div>


                            <div
                                class="friend-request-actions"
                            >

                                <button
                                    type="button"
                                    class="friend-accept-btn"
                                    data-request-id="${request.id}"
                                >
                                    ✓ Accepter
                                </button>


                                <button
                                    type="button"
                                    class="friend-reject-btn"
                                    data-request-id="${request.id}"
                                >
                                    ✕ Refuser
                                </button>

                            </div>

                        </div>

                    `;

                }
            ).join("");


        list
            .querySelectorAll(
                ".friend-accept-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            respondToFriendRequest(
                                button.dataset.requestId,
                                "accepted"
                            )
                    );

                }
            );


        list
            .querySelectorAll(
                ".friend-reject-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            respondToFriendRequest(
                                button.dataset.requestId,
                                "rejected"
                            )
                    );

                }
            );


    } catch (error) {

        console.error(
            "Erreur chargement demandes :",
            error
        );


        list.innerHTML = `

            <div class="friends-empty">

                <div class="friends-empty-icon">
                    ⚠️
                </div>

                <h2>
                    Impossible de charger les demandes
                </h2>

                <p>
                    Réessaie dans quelques instants.
                </p>

            </div>

        `;

    }

}


/* ============================================================
   ACCEPTER / REFUSER
   ============================================================ */

async function respondToFriendRequest(
    requestId,
    status
) {

    try {

        const {
            data: { user },
            error: userError
        } =
            await supabaseClient.auth.getUser();


        if (
            userError ||
            !user
        ) {

            throw new Error(
                "Utilisateur Supabase introuvable"
            );

        }


        const {
            error
        } =
            await supabaseClient
                .from("friend_requests")
                .update({
                    status: status
                })
                .eq(
                    "id",
                    requestId
                )
                .eq(
                    "receiver_id",
                    user.id
                )
                .eq(
                    "status",
                    "pending"
                );


        if (error) throw error;


        await loadFriendRequests();

    } catch (error) {

        console.error(
            "Erreur réponse demande :",
            error
        );


        alert(
            "Impossible de traiter cette demande."
        );

    }

}


/* ============================================================
   SÉCURITÉ HTML
   ============================================================ */

function escapeFriendHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   INITIALISATION
   ============================================================ */

function initFriendsSystem() {

    createFriendsButton();

    createFriendsOverlay();

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initFriendsSystem
    );

} else {

    initFriendsSystem();

}