# FireMap V23.0.0

## Fonctions conservées
- Tableau de bord du chef
- Secteurs
- Journal automatique
- GPS
- Comptes véhicules
- Prévention
- Import SMS
- Fiches véhicules

## Nouvelle gestion d’événement
Le seul bouton `Terminer l’événement` est au Poste de commandement et seul le compte 102 peut l’utiliser.

Quand le 102 termine :
1. l’événement passe à `closed`;
2. le journal et les fiches restent archivés;
3. 102, 202, 502, 602, 802 et 902 sont remis à zéro;
4. Firebase transmet la fermeture aux autres appareils;
5. l’Assistant revient automatiquement en attente.

Le menu affiche `FireMap V23.0.0` pour confirmer que la bonne mise à jour est chargée.
