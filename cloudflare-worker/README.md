# Option gratuite : Cloudflare Workers + KV

Ce Worker remplace le serveur Render payant. Il utilise un Cron Trigger chaque minute, le plan Workers Free et une namespace KV pour les abonnements et les clés Web Push. Pour une utilisation personnelle, la fréquence et le volume sont largement sous les quotas gratuits actuels (100 000 requêtes Workers/jour; quota KV gratuit). Les quotas et disponibilités peuvent évoluer, et aucune plateforme gratuite ne garantit à elle seule la livraison par iOS.

## À faire dans Cloudflare

1. Crée un compte Cloudflare gratuit (aucune carte ne devrait être nécessaire pour Workers Free).
2. Dans **Workers & Pages → KV**, crée une namespace appelée `AYAH_PUSH_DATA` et copie son **ID**.
3. Dans le dépôt GitHub, ouvre `cloudflare-worker/wrangler.jsonc` et remplace `CREATE_KV_NAMESPACE_AND_PASTE_ID_HERE` par l’ID copié. Remplace aussi `mailto:replace-with-your-email@example.com` par ton adresse de contact VAPID. Ne change pas `APP_ORIGIN` : pour ton site, la valeur correcte est `https://sdiriadam5-pixel.github.io` (sans `/ayah-application/`). Commit et push ces deux changements.
4. Dans **Workers & Pages**, crée une application Worker reliée au dépôt GitHub `sdiriadam5-pixel/ayah-application`. Définis le répertoire racine du projet sur `cloudflare-worker`, le répertoire de build sur `cloudflare-worker`, la commande d’installation sur `npm ci` et la commande de déploiement sur `npm run deploy`. Le build requiert Node 22.12 ou ultérieur. Le fichier Wrangler configure le Cron Trigger `* * * * *`.
5. Active l’adresse `workers.dev` gratuite proposée par Cloudflare. À la fin, tu obtiendras une URL telle que `https://ayah-push-free.<ton-sous-domaine>.workers.dev`. Vérifie que l’URL suivie de `/health` répond `{"ok":true}`.
6. Dans Ayah, ouvre **Réglages**, colle l’URL `workers.dev` dans « Adresse du serveur de notifications », puis touche **Activer les notifications en arrière-plan** et autorise l’appareil. Enregistre les horaires.

Le Worker crée automatiquement une paire de clés VAPID et la garde dans KV; la clé privée n’est jamais dans le dépôt ou la PWA. Les adhkâr matin/sommeil sont cités avec leurs références dans le code. Le Cron utilise le fuseau horaire transmis par l’appareil et réessaie les rappels jusqu’à une minute après l’heure prévue.

## Limites

Cloudflare Workers Free inclut des quotas journaliers. Le Worker déclenche un contrôle par minute pour gérer les heures personnalisées; avec un seul appareil, cela représente environ 1 440 exécutions par jour, plus quelques appels de configuration. La livraison finale dépend aussi des services push et d’iOS (mode Concentration, réseau, autorisations, économie d’énergie). Sur iPhone, installe la PWA sur l’écran d’accueil et accepte les notifications. La paire VAPID et l’état KV sont à conserver; ne supprime pas la namespace une fois activée.
