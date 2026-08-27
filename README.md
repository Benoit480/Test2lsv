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


## V23.0.0 — Gestion stable des événements

Les fonctions existantes restent actives : tableau de bord, secteurs, journal automatique, GPS, prévention, comptes véhicules, import SMS et fiches véhicules.

- Seul le compte 102 peut fermer un événement.
- Le seul bouton de fermeture est dans le Poste de commandement.
- Le vrai bouton `assistantEnd` a été retiré.
- Firebase transmet la fermeture à tous les appareils.
- Les six unités sont remises à zéro.
- L’historique reste conservé.


## V24.0.0 — Base stable événements

Cette version conserve les fonctions opérationnelles existantes (GPS, journal, secteurs,
prévention, comptes véhicules, SMS et fiches véhicules), mais centralise la gestion
de fermeture dans `event-manager.js`.

Le cache PWA historique est volontairement désactivé dans cette version afin que les
mises à jour GitHub soient réellement chargées sur iPhone.


## V24.0.2 — Fluidité légère sans changer l'apparence

- même carte Leaflet/CARTO;
- mêmes icônes de bornes;
- mêmes icônes bâtiments;
- même Poste de commandement;
- aucune intégration Google Maps;
- pas de reconstruction des bornes pendant le déplacement;
- pas de reconstruction des bâtiments pendant le déplacement;
- pas de reconstruction des véhicules pendant le déplacement;
- rafraîchissement une fois le geste terminé;
- animations Leaflet coûteuses réduites.


## V24.0.3 — OpenStreetMap sans clé API

- remplacement du fond CARTO par OpenStreetMap standard;
- aucune clé API nécessaire;
- aucun Google Maps;
- rendu sombre conservé via filtre CSS;
- mêmes bornes, bâtiments, véhicules et Poste de commandement;
- optimisations légères de la V24.0.2 conservées.


## V24.0.4 — OSM natif sans filtre GPU

- suppression complète du filtre sombre appliqué aux tuiles;
- OpenStreetMap affiché dans son rendu natif;
- `detectRetina` désactivé pour éviter les tuiles haute densité;
- tampon de tuiles réduit;
- chargement des nouvelles tuiles surtout à la fin du mouvement;
- mêmes fonctions FireMap, sans Google Maps.
