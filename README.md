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


## V25.0.6 — Repositionnement manuel des bornes

Ajout d'un bouton « Repositionner la borne » dans la fiche d'une borne.
Après activation :
1. toucher la nouvelle position sur la carte;
2. vérifier le point;
3. confirmer;
4. latitude/longitude de la borne sont mises à jour;
5. la nouvelle position est enregistrée dans Firebase et propagée aux autres appareils.

La carte Google Maps, la recherche Google, Google Routes et les fonctions V25.0.5 restent inchangées.


## V25.0.7 — Suggestions d'adresses plus visibles

- fond très foncé pour les suggestions Google Places;
- texte blanc;
- partie correspondante en bleu;
- taille du texte augmentée;
- séparation claire entre les résultats;
- survol/sélection plus visible;
- même correction pour les listes de suggestions locales FireMap.


## V25.0.8 — Suggestions Google dans l'Assistant

- google-address-search.js est maintenant réellement chargé au démarrage;
- le champ Adresse de l'Assistant d'intervention utilise Google Places en ligne;
- les anciennes suggestions locales ne remplacent plus les résultats Google;
- toucher une suggestion Google lance l'intervention avec l'adresse et les coordonnées Google;
- la banque Louiseville demeure disponible comme repli hors ligne.


## V25.0.9 — Correction réelle des suggestions Google dans l'Assistant

Correction du bug qui empêchait Google Places d'afficher ses résultats lorsque le champ
n'avait pas d'élément de statut associé.

- Google Places fonctionne maintenant dans `assistantAddress`;
- les suggestions locales sont neutralisées lorsque Google est disponible;
- la banque locale reste le repli hors ligne;
- toucher un résultat Google démarre l'intervention avec ses coordonnées Google.


## V25.0.10 — Google Places chargé explicitement

- `libraries=places` ajouté au chargement Google Maps;
- la recherche Assistant utilise Google Places;
- en ligne, aucun repli silencieux vers les suggestions locales;
- si Places API (New) n'est pas activé, FireMap affiche un message clair;
- la banque Louiseville reste disponible uniquement hors ligne.
