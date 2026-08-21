# FireMap V25.0.5 — Synchronisation Firebase stable

## Corrections principales
- FireMap ne bloque plus son démarrage en attendant Google Maps.
- Firebase démarre immédiatement et indépendamment de Google.
- Un événement est ajouté à une file d'attente locale AVANT toute tentative d'écriture Firestore.
- Dès que Firebase devient disponible, les événements en attente sont renvoyés automatiquement.
- La fermeture d'événement utilise la même file d'attente fiable.
- Les fiches véhicules conservent correctement `updatedAt`, `eventClosed` et `resetAfterEventId`.
- Les snapshots Firebase des fiches véhicules rafraîchissent maintenant le Poste de commandement.
- Les modules bâtiments, prévention, véhicules et fiches véhicules retentent leur connexion lors de `firemap-cloud-ready`.
- La collection bâtiment officielle est `batiments`.
- Une règle temporaire `batimen` est incluse pour compatibilité avec une ancienne collection éventuellement présente.

## Test
1. Mettre V25.0.5 sur GitHub.
2. Vérifier que le menu affiche `FireMap V25.0.5`.
3. Téléphone A : créer un événement.
4. Dans Firestore, vérifier que `evenements_commandement` apparaît.
5. Téléphone B : l'événement doit apparaître sans recharger.
6. Modifier une fiche 202 sur A.
7. Le compte 102 sur B doit voir la modification automatiquement.
