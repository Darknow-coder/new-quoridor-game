const SUPABASE_URL = "https://amknivbzbfskcxckjkob.supabase.co";
const SUPABASE_KEY = "sb_publishable_mtVxAzQB-j21khOp5VyGiw_2rs_O3pR";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let supabaseUser = null;

// Initialise la connexion anonyme
async function initSupabase() {
    try {
        // Vérifie si une session existe déjà
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (sessionData.session) {
            supabaseUser = sessionData.session.user;
            return supabaseUser;
        }

        // Sinon, crée automatiquement un joueur anonyme
        const { data, error } =
            await supabaseClient.auth.signInAnonymously();

        if (error) throw error;

        supabaseUser = data.user;
        return supabaseUser;

    } catch (error) {
        console.error("Erreur initialisation Supabase :", error);
        return null;
    }
}

// Crée ou récupère le profil du joueur
async function syncPlayerProfile(username) {
    try {
        if (!supabaseUser) {
            await initSupabase();
        }

        if (!supabaseUser) {
            throw new Error("Impossible de créer la session joueur.");
        }

        const cleanUsername = String(username || "").trim();

        if (!cleanUsername) {
            throw new Error("Pseudo vide.");
        }

        // Cherche le profil existant
        const { data: existing, error: selectError } =
            await supabaseClient
                .from("joueurs")
                .select("*")
                .eq("identifiant", supabaseUser.id)
                .maybeSingle();

        if (selectError) throw selectError;

        // Profil déjà présent
        if (existing) {
            return existing;
        }

        // Premier profil
        const { data: created, error: insertError } =
            await supabaseClient
                .from("joueurs")
                .insert({
                    identifiant: supabaseUser.id,
                    nom_utilisateur: cleanUsername
                })
                .select()
                .single();

        if (insertError) throw insertError;

        return created;

    } catch (error) {
        console.error("Erreur profil joueur :", error);
        return null;
    }
}

// Initialise Supabase dès le chargement du jeu
initSupabase().then((user) => {
    if (user) {
        alert("Connexion Supabase OK !");
        console.log("Utilisateur Supabase :", user);
    } else {
       alert("ERREUR SUPABASE : " + error.message);
console.error("Erreur complète :", error);
    }
});
alert("VERSION NOUVELLE SUPABASE");
