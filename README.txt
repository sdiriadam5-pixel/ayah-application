AYAH — PWA bilingue français / arabe

Notifications de fond gratuites : le dossier cloudflare-worker/ contient le backend Cloudflare Workers + KV, avec un Cron Trigger chaque minute, clés VAPID conservées côté Worker, stockage des abonnements et service worker prêt à afficher le push. Voir cloudflare-worker/README.md. Ce backend Cloudflare est la voie recommandée si tu veux éviter le service Render payant. Un compte Cloudflare gratuit suffit dans les limites de quotas du plan.

Pour démarrer : héberge d’abord la PWA sur HTTPS, crée une namespace KV gratuite, copie son ID dans cloudflare-worker/wrangler.jsonc, puis déploie cloudflare-worker depuis Workers & Pages. Le guide détaille toutes les étapes. Après le déploiement, saisis l’URL workers.dev dans Ayah > Réglages, active les notifications de fond et autorise-les sur l’appareil.

Le dossier push-server/ est une alternative Node/Render qui nécessite un service toujours actif et du stockage persistant, généralement payants. Ne le déploie pas si tu choisis la voie gratuite Cloudflare.

Horaires pris en charge : adhkâr du matin (07:00 par défaut, réglable), dhikr chaque heure de 08:00 à 19:00, adhkâr du sommeil à 23:00 et rappel quotidien du wird à l’heure choisie.

Sur iPhone, installe la PWA sur l’écran d’accueil et autorise les notifications. Web Push dépend de la prise en charge d’iOS, du réseau et des réglages système; aucune plateforme ne peut garantir une livraison si iOS bloque l’appareil.

Mise à jour GitHub Pages : téléverse les fichiers du dossier ayah-pwa à la racine du dépôt; le backend Cloudflare doit être déployé séparément depuis cloudflare-worker.
