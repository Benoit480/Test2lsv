# FireMap V22.3.6 — Correction de la réinitialisation

Le problème venait de l’ancien identifiant d’événement actif qui restait dans le téléphone. Le profil continuait alors d’afficher l’ancienne fiche.

## Correction
- suppression de `firemap-command-active-event-data`;
- exclusion des fiches dont `eventClosed = true`;
- priorité aux fiches portant `resetAfterEventId`;
- archivage synchronisé des fiches terminées;
- rafraîchissement immédiat des profils.

Aucune nouvelle règle Firebase.
