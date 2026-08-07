# FireMap Louiseville — version optimisée V22.3.1

Cette archive est prête à remplacer complètement le contenu du dépôt GitHub Pages.

## Installation sur GitHub

1. Supprimer les anciens fichiers du dépôt.
2. Décompresser cette archive.
3. Téléverser **tous les fichiers directement à la racine** du dépôt.
4. Vérifier que GitHub Pages déploie la branche principale depuis `/root`.
5. Sur l’iPhone, fermer complètement FireMap, rouvrir la page dans Safari, puis actualiser.
6. Si l’ancienne version reste affichée, supprimer l’icône de l’écran d’accueil et l’ajouter de nouveau.

## Fichiers conservés

- application et interface;
- comptes 102, 202, 502, 602, 802 et 902;
- GPS en direct par véhicule;
- fiches d’utilisation des véhicules;
- Centre de commandement;
- journal automatique;
- prévention et préplans;
- adresses et bornes;
- configuration et règles Firebase;
- PWA et fonctionnement hors ligne.

## Nettoyage effectué

- retrait de tous les anciens fichiers `README-V...`;
- retrait du ZIP d’adresses embarqué devenu inutile;
- retrait du doublon `adresses-louiseville.json`;
- retrait du script inutilisé `unified-buildings.js`;
- cache PWA séparé entre l’application et les grosses données;
- meilleure gestion des mises à jour et du mode hors ligne;
- archive sans sous-dossier, prête pour GitHub.

## Firebase

La configuration actuelle a été conservée. Les fichiers `firestore.rules` et `storage.rules` restent inclus pour publication dans Firebase si nécessaire.


## V22.3.2 — SMS automatique sur iPhone

FireMap accepte maintenant les SMS transmis par une automatisation Apple Raccourcis. Le numéro autorisé est vérifié, les doublons sont bloqués et l’appel actif ainsi que l’événement de commandement sont créés automatiquement.

Voir `CONFIGURATION-RACCOURCI-SMS-IPHONE.md`.


## V22.3.3 — Route d’importation SMS simplifiée

Une nouvelle page `/import/` reçoit le SMS encodé depuis Apple Raccourcis puis redirige automatiquement vers FireMap pour créer l’appel.


## V22.3.5 — Réinitialisation des unités à la fin de l’événement

Lorsque le compte 102 termine l’événement, les fiches utilisées restent archivées dans l’événement terminé. De nouveaux profils propres sont créés pour les unités concernées : En caserne, 0 pompier, non alimenté, sorties fermées et pressions résiduelles vides.


## V22.3.6 — Correction de la réinitialisation

Correction du profil des unités après la fermeture d’un événement :

- suppression de l’identifiant de l’ancien événement actif;
- anciennes fiches exclues de l’affichage courant;
- nouvelle fiche remise à zéro affichée en priorité;
- archivage des anciennes fiches synchronisé.


## V22.3.7 — Fin d’événement réservée au 102

- Le bouton `Terminer l’événement` n’est disponible que dans le poste de commandement.
- Seul le compte 102 peut l’utiliser.
- L’Assistant d’intervention ne permet plus de terminer un événement.
- Une protection JavaScript bloque aussi toute tentative d’un autre compte.
- La réinitialisation des fiches d’unités reste déclenchée par la fermeture faite par le 102.
