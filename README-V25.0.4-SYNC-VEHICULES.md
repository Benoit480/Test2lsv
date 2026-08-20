# FireMap V25.0.4 — Fiches véhicules en temps réel

## Correction
Lorsqu'une fiche véhicule est enregistrée sur un appareil, Firebase transmet la modification
aux autres appareils et FireMap rafraîchit immédiatement :
- la section Véhicules;
- la fiche/profil de l'unité;
- le Poste de commandement du compte 102;
- les compteurs de pompiers, alimentation, sorties et pression résiduelle.

Cette version corrige aussi la perte des champs Firebase `updatedAt`, `eventClosed`
et `resetAfterEventId` lors de la lecture sur un autre appareil.

## Test recommandé
1. Ouvrir FireMap sur deux appareils.
2. Appareil A : compte 202, modifier la fiche et enregistrer.
3. Appareil B : compte 102, rester dans Poste de commandement > Véhicules.
4. La fiche 202 doit changer automatiquement sans actualiser la page.
