# Ayah Web Push backend

Ce serveur envoie les rappels même lorsque la PWA est fermée, à condition que l’hébergement reste actif, que l’appareil soit abonné et que le système autorise les notifications. Il gère les adhkâr du matin (heure choisie, 07:00 par défaut), du sommeil (23:00), le dhikr horaire (08:00–19:00) et le rappel quotidien du wird.

## Déploiement recommandé : Render

Le dossier contient `render.yaml`. Déployez-le comme Blueprint depuis votre dépôt, en indiquant `ayah-pwa/push-server` comme fichier Blueprint si le projet est dans ce sous-dossier. Le service utilise une instance toujours active et un disque persistant : un service gratuit qui s’endort ne convient pas pour des rappels à heure fixe. Configurez les variables suivantes dans Render :

- `APP_ORIGIN` : origine HTTPS exacte de la PWA, sans chemin ni barre finale. Exemple : `https://mon-compte.github.io` (même si la PWA est dans `/mon-depot/`).
- `VAPID_SUBJECT` : une adresse de contact, par exemple `mailto:contact@exemple.fr`.

Au premier démarrage, le serveur crée automatiquement une paire VAPID et la conserve dans le disque persistant (`vapid.json`, permissions restreintes). Aucune clé n’a donc à être copiée dans l’application ou dans le dépôt. **Ne supprimez pas le disque persistant** : il contient aussi les abonnements et la clé privée. Pour fournir vos propres clés au lieu de l’auto-génération, définissez ensemble `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans les variables secrètes du service ; ne publiez jamais la clé privée.

Render fournit l’URL HTTPS du service après le déploiement. Vérifiez `https://VOTRE-SERVEUR/health` : la réponse doit contenir `{"ok":true}`. L’endpoint de clé publique est `/api/push/vapid-public-key`.

## Relier l’app au serveur

1. Déployez d’abord les fichiers PWA sur leur adresse HTTPS.
2. Ouvrez Ayah (sur iPhone, ajoutez d’abord Ayah à l’écran d’accueil et ouvrez cette icône).
3. Dans **Réglages**, renseignez l’URL HTTPS Render dans « Adresse du serveur de notifications », puis touchez **« Activer les notifications en arrière-plan »** et acceptez la demande iOS.
4. Enregistrez les horaires souhaités. L’abonnement et les réglages sont envoyés au serveur. L’horloge utilisée est celle du fuseau local de l’appareil.
5. Testez à une prochaine heure programmée. Les notifications push peuvent subir un léger délai selon le réseau et les réglages d’économie d’énergie du téléphone.

## Hébergement différent / local

`npm install && npm start`, avec les valeurs de `.env.example`. En production, définissez `DATA_DIR` sur un volume persistant : le fichier `subscriptions.json` contient les abonnements et les marqueurs anti-doublons. Le service écoute sur `0.0.0.0:$PORT`.

## Sécurité et limites

- La clé privée VAPID reste uniquement sur le volume persistant privé du backend (ou dans les variables secrètes si vous fournissez votre propre paire) ; elle n’est jamais incluse dans la PWA.
- L’API applique une limite de requêtes et n’autorise en CORS que `APP_ORIGIN`.
- Les adhkâr matin/sommeil sont les invocations citées dans Jami` at-Tirmidhi 3391 et Sahih al-Bukhari 6324. Le dhikr horaire est un rappel de tasbîh.
- Web Push dépend de la prise en charge de l’appareil et du navigateur. Sur iPhone, utilisez une version iOS compatible, installez la PWA sur l’écran d’accueil et accordez l’autorisation. Le système peut encore différer ou supprimer une notification (mode Concentration, économie d’énergie, absence de réseau).
