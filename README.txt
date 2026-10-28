AYAH — PWA bilingue français / arabe

L’archive contient la PWA et son serveur Web Push prêt à déployer (dossier push-server). L’application intègre le suivi du khatm, l’audio avec choix de récitateurs, 38 récits, le corpus de 114 sourates et les rappels configurables.

Rappels pris en charge : adhkâr du matin (07:00 par défaut, réglable), dhikr chaque heure de 08:00 à 19:00, adhkâr du sommeil à 23:00 et rappel quotidien du wird à l’heure choisie.

POUR RECEVOIR LES NOTIFICATIONS APP FERMÉE :
1. Hébergez la PWA en HTTPS.
2. Déployez le serveur Node dans push-server sur un hébergement toujours actif avec stockage persistant. Le modèle Render est fourni (service Starter + disque persistant dans render.yaml). Un hébergement qui s’endort ne convient pas.
3. Configurez APP_ORIGIN et VAPID_SUBJECT dans le service. Le serveur génère et conserve sa paire VAPID secrète sur le disque persistant ; consultez push-server/README.md.
4. Dans Ayah > Réglages, entrez l’URL HTTPS du serveur, puis choisissez « Activer les notifications en arrière-plan » et autorisez les notifications. Réglez vos horaires et enregistrez.

Tant que le serveur n’est pas déployé et relié à la PWA, les notifications d’arrière-plan ne peuvent pas fonctionner. Sur iPhone, une version iOS compatible, l’installation sur l’écran d’accueil et l’autorisation système sont nécessaires. Le système ou le réseau peut toujours différer certaines notifications.

Mise à jour GitHub Pages : décompressez l’archive et téléversez le contenu du dossier ayah-pwa à la racine du dépôt. Le backend push doit être déployé séparément depuis ayah-pwa/push-server.

Texte arabe/traduction française Hamidullah, tafsîr Al-Muyassar en arabe et audio nécessitent les licences et conditions de leurs sources avant diffusion publique. Prototype non publié sur l’App Store.
