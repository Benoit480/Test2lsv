# FireMap V24.0.0

## Règle principale
Le seul endroit où un événement peut être terminé est le **Poste de commandement**,
et uniquement avec le compte **102**.

## À la fermeture
- événement marqué `closed`;
- ancienne fiche conservée;
- unités 102, 202, 502, 602, 802 et 902 remises à zéro;
- événement actif retiré de l'appareil;
- fermeture publiée dans Firebase;
- autres appareils reçoivent automatiquement la fermeture;
- Assistant d'intervention revient en attente.

## Mise à jour iPhone
Le service worker/cache historique est désactivé dans V24. Les scripts utilisent
`?v=24.0.0` pour empêcher Safari de garder les anciens JavaScript.

## Vérification
Le menu doit afficher :
`FireMap V24.0.0 — Gestion événements V24 active`.
