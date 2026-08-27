# FireMap V24.0.1 — Stable Firebase sans Google

Base V24.0.0, avant Google Maps.

Conserve la carte Leaflet originale, la banque d'adresses Louiseville,
les bornes, bâtiments/préplans, prévention, assistant, navigation,
comptes unités, fiches véhicules, Poste de commandement et journal.

Correctifs ajoutés uniquement pour Firebase :
- événements mis en attente localement avant l'envoi;
- renvoi automatique quand Firebase revient;
- événements actifs synchronisés entre appareils;
- fiches véhicules mises à jour à distance;
- conservation des timestamps et états de fermeture;
- rafraîchissement du Poste de commandement après une modification distante;
- reconnexion des modules véhicules quand Firebase devient disponible.

Aucune intégration Google Maps ni Google Places.
